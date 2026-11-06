export interface Command {
  do(): void;
  undo(): void;
}

/** Undo/redo berbasis command. Satu-satunya cara mengubah goresan yang bisa di-undo. */
export class History {
  onChange?: () => void;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  execute(command: Command): void {
    command.do();
    this.undoStack.push(command);
    this.redoStack = [];
    this.onChange?.();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo();
    this.redoStack.push(command);
    this.onChange?.();
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.do();
    this.undoStack.push(command);
    this.onChange?.();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange?.();
  }
}
