import type { Command } from './History';
import type { Guides } from './Guides';
import type { Layers } from './Layers';
import type { StrokeLayer } from './StrokeLayer';
import type { GuidePlaneData, LayerData, StrokeData } from './types';

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

/** Mengganti sekumpulan goresan sekaligus (transformasi, duplikat, hapus). Satu langkah undo. */
export class ReplaceStrokesCommand implements Command {
  private readonly layer: StrokeLayer;
  private readonly before: StrokeData[];
  private readonly after: StrokeData[];

  constructor(layer: StrokeLayer, before: StrokeData[], after: StrokeData[]) {
    this.layer = layer;
    this.before = before;
    this.after = after;
  }

  do(): void {
    for (const s of this.before) this.layer.remove(s.id);
    for (const s of this.after) this.layer.add(s);
  }

  undo(): void {
    for (const s of this.after) this.layer.remove(s.id);
    for (const s of this.before) this.layer.add(s);
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

export class RemoveGuideCommand implements Command {
  private readonly guides: Guides;
  private readonly plane: GuidePlaneData;

  constructor(guides: Guides, plane: GuidePlaneData) {
    this.guides = guides;
    this.plane = plane;
  }

  do(): void {
    this.guides.removePlane(this.plane.id);
  }

  undo(): void {
    this.guides.addPlane(this.plane);
  }
}

export class AddLayerCommand implements Command {
  private readonly layers: Layers;
  private readonly data: LayerData;
  private readonly index: number;

  constructor(layers: Layers, data: LayerData, index: number) {
    this.layers = layers;
    this.data = data;
    this.index = index;
  }

  do(): void {
    this.layers.insert(this.data, this.index);
  }

  undo(): void {
    this.layers.remove(this.data.id);
  }
}

/** Menghapus layer beserta semua goresannya. Undo mengembalikan layer lalu goresannya. */
export class DeleteLayerCommand implements Command {
  private readonly layers: Layers;
  private readonly strokes: StrokeLayer;
  private readonly data: LayerData;
  private readonly index: number;
  private readonly removed: StrokeData[];

  constructor(layers: Layers, strokes: StrokeLayer, data: LayerData, index: number, removed: StrokeData[]) {
    this.layers = layers;
    this.strokes = strokes;
    this.data = data;
    this.index = index;
    this.removed = removed;
  }

  do(): void {
    for (const s of this.removed) this.strokes.remove(s.id);
    this.layers.remove(this.data.id);
  }

  undo(): void {
    this.layers.insert(this.data, this.index);
    for (const s of this.removed) this.strokes.add(s);
  }
}
