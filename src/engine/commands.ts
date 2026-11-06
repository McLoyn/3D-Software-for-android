import type { Command } from './History';
import type { StrokeLayer } from './StrokeLayer';
import type { StrokeData } from './types';

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
