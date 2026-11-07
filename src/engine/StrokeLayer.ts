import * as THREE from 'three';
import { buildStrokeGroup, disposeGroup, type StrokeDraft } from './StrokeBuilder';
import type { StrokeData } from './types';

const SELECT_COLOR = '#4a3fd0';
interface Entry {
  data: StrokeData;
  group: THREE.Group;
}

/** Menyimpan semua goresan (data + mesh) dan satu preview goresan yang sedang digambar. */
export class StrokeLayer {
  readonly root = new THREE.Group();
  private readonly entries = new Map<number, Entry>();
  private preview: THREE.Group | null = null;
  private readonly selected = new Set<number>();

  get count(): number {
    return this.entries.size;
  }

  get(id: number): StrokeData | undefined {
    return this.entries.get(id)?.data;
  }

  /** Semua goresan, diurutkan berdasarkan id (urutan dibuat). */
  all(): StrokeData[] {
    return [...this.entries.values()].map((e) => e.data).sort((a, b) => a.id - b.id);
  }

  add(data: StrokeData): void {
    if (this.entries.has(data.id)) return;
    const group = buildStrokeGroup(data);
    group.userData.strokeId = data.id;
    this.entries.set(data.id, { data, group });
    this.root.add(group);
  }

  remove(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.selected.delete(id);
    this.root.remove(entry.group);
    disposeGroup(entry.group);
    this.entries.delete(id);
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
    this.clearPreview();
  }

  get selection(): number[] {
    return [...this.selected];
  }

  get selectionCount(): number {
    return this.selected.size;
  }

  /** Mengganti seleksi. Id yang tidak ada diabaikan. Goresan terpilih diwarnai SELECT_COLOR. */
  setSelection(ids: Iterable<number>): void {
    const touched = new Set(this.selected);
    this.selected.clear();
    for (const id of ids) {
      if (this.entries.has(id)) {
        this.selected.add(id);
        touched.add(id);
      }
    }
    for (const id of touched) this.tint(id);
  }

  /** Kotak pembatas gabungan semua goresan terpilih (kosong bila tak ada seleksi). */
  selectionBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const id of this.selected) {
      const entry = this.entries.get(id);
      if (entry) box.expandByObject(entry.group);
    }
    return box;
  }

  /** Pratinjau transformasi: matrix diterapkan ke group (tanpa membangun ulang mesh). null = kembalikan. */
  setPreviewMatrix(ids: Iterable<number>, matrix: THREE.Matrix4 | null): void {
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      if (matrix) {
        entry.group.matrix.copy(matrix);
        entry.group.matrixAutoUpdate = false;
      } else {
        entry.group.matrixAutoUpdate = true;
      }
      entry.group.matrixWorldNeedsUpdate = true;
    }
  }

  private tint(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const color = this.selected.has(id) ? SELECT_COLOR : entry.data.color;
    entry.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) (obj.material as THREE.MeshBasicMaterial).color.set(color);
    });
  }
  setPreview(draft: StrokeDraft): void {
    this.clearPreview();
    this.preview = buildStrokeGroup(draft);
    this.root.add(this.preview);
  }

  clearPreview(): void {
    if (!this.preview) return;
    this.root.remove(this.preview);
    disposeGroup(this.preview);
    this.preview = null;
  }

  /** Mengembalikan id goresan terdepan yang tertembak ray, atau null. */
  pick(raycaster: THREE.Raycaster): number | null {
    const meshes = [...this.entries.values()].flatMap((e) => e.group.children);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const id: unknown = hits[0].object.parent?.userData.strokeId;
    return typeof id === 'number' ? id : null;
  }
}
