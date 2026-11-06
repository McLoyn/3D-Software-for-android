import * as THREE from 'three';
import type { GuideType } from './types';

export interface GuideHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

/** Panduan permukaan untuk menggambar: bola atau kubus. 'plane' berarti tanpa mesh panduan. */
export class Guides {
  readonly root = new THREE.Group();
  private current: GuideType = 'plane';
  private surface: THREE.Mesh | null = null;

  get type(): GuideType {
    return this.current;
  }

  get active(): boolean {
    return this.surface !== null && this.root.visible;
  }

  setType(type: GuideType): void {
    if (type === this.current) return;
    this.clear();
    this.current = type;
    if (type === 'plane') return;

    const geometry =
      type === 'sphere' ? new THREE.SphereGeometry(1.35, 32, 24) : new THREE.BoxGeometry(2, 2, 2);

    const surface = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x8a90b0,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const wire = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x7f86a8,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      }),
    );
    wire.raycast = () => {};

    this.root.add(surface, wire);
    this.surface = surface;
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  /** Titik tembak pada permukaan panduan (sedikit diangkat dari permukaan), atau null. */
  intersect(raycaster: THREE.Raycaster): GuideHit | null {
    if (!this.surface) return null;
    const hits = raycaster.intersectObject(this.surface, false);
    const hit = hits[0];
    if (!hit || !hit.face) return null;
    const normal = hit.face.normal.clone();
    return {
      point: hit.point.clone().add(normal.clone().multiplyScalar(0.012)),
      normal,
    };
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.surface = null;
  }
}

  