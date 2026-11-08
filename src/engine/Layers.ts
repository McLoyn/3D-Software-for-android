import type { LayerData } from './types';

/** Daftar layer (group) proyek. Selalu berisi minimal satu layer setelah reset(). */
export class Layers {
  onChange?: () => void;

  private list: LayerData[] = [];
  private nextId = 1;

  get count(): number {
    return this.list.length;
  }

  get firstId(): number {
    return this.list[0].id;
  }

  all(): LayerData[] {
    return this.list.map((l) => ({ ...l }));
  }

  get(id: number): LayerData | undefined {
    return this.list.find((l) => l.id === id);
  }

  has(id: number): boolean {
    return this.list.some((l) => l.id === id);
  }

  indexOf(id: number): number {
    return this.list.findIndex((l) => l.id === id);
  }

  /** Membuat data layer baru (id otomatis) tanpa memasukkannya ke daftar. */
  create(): LayerData {
    const id = this.nextId++;
    return { id, name: `Layer ${id}`, visible: true, locked: false };
  }

  insert(data: LayerData, index: number): void {
    if (this.has(data.id)) return;
    const i = Math.min(Math.max(index, 0), this.list.length);
    this.list.splice(i, 0, { ...data });
    this.nextId = Math.max(this.nextId, data.id + 1);
    this.onChange?.();
  }

  remove(id: number): void {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.list.splice(i, 1);
    this.onChange?.();
  }

  update(id: number, patch: Partial<Pick<LayerData, 'name' | 'visible' | 'locked'>>): void {
    const layer = this.get(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.onChange?.();
  }

  /** delta = +1 naik (ke arah akhir daftar), -1 turun. */
  move(id: number, delta: number): void {
    const i = this.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.list.length) return;
    const [item] = this.list.splice(i, 1);
    this.list.splice(j, 0, item);
    this.onChange?.();
  }

  /** Mengganti seluruh daftar. Bila kosong dibuat satu layer bawaan. */
  reset(list: LayerData[]): void {
    this.list = list.map((l) => ({ ...l }));
    if (this.list.length === 0) this.list.push({ id: 1, name: 'Layer 1', visible: true, locked: false });
    this.nextId = Math.max(...this.list.map((l) => l.id)) + 1;
    this.onChange?.();
  }
}
