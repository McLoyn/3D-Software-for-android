import * as THREE from 'three';
import { buildStrokeGroup, disposeGroup, type StrokeDraft } from './StrokeBuilder';
import type { StrokeData } from './types';

interface Entry {
  data: StrokeData;
  group: THREE.Group;
}

/** Menyimpan semua goresan (data + mesh) dan satu preview goresan yang sedang digambar. */
export class StrokeLayer {
  readonly root = new THREE.Group();
  private readonly entries = new Map<number, Entry>();
  private preview: THREE.Group | null = null;

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
    this.root.remove(entry.group);
    disposeGroup(entry.group);
    this.entries.delete(id);
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
    this.clearPreview();
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
