import type { Command } from './History';
import type { StrokeLayer } from './StrokeLayer';
import type { Guides } from './Guides';
import type { GuidePlaneData, StrokeData } from './types';

export class AddStrokeCommand implements Command {
  private readonly layer: StrokeLayer;
  private readonly stroke: StrokeData;

  constructor(layer: StrokeLayer, stroke: StrokeData) {
    this.layer = layer;
    this.stroke = stroke;
  }

  do(): void {
    this.layer.add(this.stroke);
  }

  undo(): void {
    this.layer.remove(this.stroke.id);
  }
}

export class RemoveStrokeCommand implements Command {
  private readonly layer: StrokeLayer;
  private readonly stroke: StrokeData;

  constructor(layer: StrokeLayer, stroke: StrokeData) {
    this.layer = layer;
    this.stroke = stroke;
  }

  do(): void {
    this.layer.remove(this.stroke.id);
  }

  undo(): void {
    this.layer.add(this.stroke);
  }
}

export class AddGuideCommand implements Command {
  private readonly guides: Guides;
  private readonly plane: GuidePlaneData;

  constructor(guides: Guides, plane: GuidePlaneData) {
    this.guides = guides;
    this.plane = plane;
  }

  do(): void {
    this.guides.addPlane(this.plane);
  }

  undo(): void {
    this.guides.removePlane(this.plane.id);
  }
}

/** Beberapa command sebagai satu langkah undo/redo. */
export class BatchCommand implements Command {
  private readonly items: Command[];

  constructor(items: Command[]) {
    this.items = items;
  }

  do(): void {
    for (const c of this.items) c.do();
  }

  undo(): void {
    for (let i = this.items.length - 1; i >= 0; i--) this.items[i].undo();
  }
}
