import * as THREE from 'three';
import type { GuidePlaneData, GuideType } from './types';

/** surfaceId untuk bola/kubus. Bidang buatan pengguna memakai id >= 1. */
export const BASE_SURFACE = 0;
const PLANE_SIZE = 4;
const LIFT = 0.012;

export interface GuideHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surface: number;
}

interface PlaneEntry {
  data: GuidePlaneData;
  group: THREE.Group;
  mesh: THREE.Mesh;
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}

function fillMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x8a90b0,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function wireMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x7f86a8,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
  });
}

/** Panduan permukaan untuk menggambar: bola/kubus dasar plus bidang buatan pengguna. */
export class Guides {
  readonly root = new THREE.Group();
  private readonly baseGroup = new THREE.Group();
  private readonly planeGroup = new THREE.Group();
  private readonly planes = new Map<number, PlaneEntry>();
  private current: GuideType = 'plane';
  private surface: THREE.Mesh | null = null;

  constructor() {
    this.root.add(this.baseGroup, this.planeGroup);
  }

  get type(): GuideType {
    return this.current;
  }

  /** True bila ada bola/kubus dasar. */
  get hasBase(): boolean {
    return this.surface !== null;
  }

  /** Ada permukaan guide yang bisa ditembak dan guide sedang terlihat. */
  get active(): boolean {
    return (this.surface !== null || this.planes.size > 0) && this.root.visible;
  }

  setType(type: GuideType): void {
    if (type === this.current) return;
    this.clearBase();
    this.current = type;
    if (type === 'plane') return;

    const geometry =
      type === 'sphere' ? new THREE.SphereGeometry(1.35, 32, 24) : new THREE.BoxGeometry(2, 2, 2);

    const surface = new THREE.Mesh(geometry, fillMaterial());
    surface.userData.surfaceId = BASE_SURFACE;
    const wire = new THREE.Mesh(geometry, wireMaterial());
    wire.raycast = () => {};

    this.baseGroup.add(surface, wire);
    this.surface = surface;
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  addPlane(data: GuidePlaneData): void {
    if (this.planes.has(data.id)) return;
    const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 8, 8);
    const mesh = new THREE.Mesh(geometry, fillMaterial());
    mesh.userData.surfaceId = data.id;
    const wire = new THREE.Mesh(geometry, wireMaterial());
    wire.raycast = () => {};

    const group = new THREE.Group();
    group.add(mesh, wire);
    group.position.fromArray(data.origin);
    group.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3().fromArray(data.normal).normalize(),
    );
    // Raycast butuh matrixWorld terbaru, padahal render berikutnya belum terjadi.
    group.updateMatrixWorld(true);

    this.planeGroup.add(group);
    this.planes.set(data.id, { data, group, mesh });
  }

  removePlane(id: number): void {
    const entry = this.planes.get(id);
    if (!entry) return;
    this.planeGroup.remove(entry.group);
    disposeTree(entry.group);
    this.planes.delete(id);
  }

  clearPlanes(): void {
    for (const id of [...this.planes.keys()]) this.removePlane(id);
  }

  /** Semua bidang buatan pengguna, urut id. */
  allPlanes(): GuidePlaneData[] {
    return [...this.planes.values()].map((p) => p.data).sort((a, b) => a.id - b.id);
  }

  getPlane(id: number): GuidePlaneData | undefined {
    return this.planes.get(id)?.data;
  }

  /** Id bidang buatan pengguna terdepan yang tertembak ray, atau null (bola/kubus tidak dihitung). */
  pick(raycaster: THREE.Raycaster): number | null {
    if (!this.root.visible || this.planes.size === 0) return null;
    const meshes = [...this.planes.values()].map((p) => p.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? (hit.object.userData.surfaceId as number) : null;
  }

  /**
   * Titik tembak pada permukaan guide (sedikit diangkat ke arah kamera), atau null.
   * lock = null: uji semua permukaan, ambil yang terdekat. lock = id: uji hanya permukaan itu.
   */
  intersect(raycaster: THREE.Raycaster, lock: number | null): GuideHit | null {
    const targets: THREE.Object3D[] = [];
    if (this.surface && (lock === null || lock === BASE_SURFACE)) targets.push(this.surface);
    for (const [id, entry] of this.planes) {
      if (lock === null || lock === id) targets.push(entry.mesh);
    }
    if (targets.length === 0) return null;

    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit || !hit.face) return null;

    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
    return {
      point: hit.point.clone().add(normal.clone().multiplyScalar(LIFT)),
      normal,
      surface: hit.object.userData.surfaceId as number,
    };
  }

  dispose(): void {
    this.clearBase();
    this.clearPlanes();
  }

  private clearBase(): void {
    disposeTree(this.baseGroup);
    this.baseGroup.clear();
    this.surface = null;
  }
}