import * as THREE from 'three';
import type { StrokeData, Vec3Tuple } from './types';

export type StrokeDraft = Omit<StrokeData, 'id'>;

export function effectiveRadius(base: number, response: number, pressure: number): number {
  return base * (1 - response + response * Math.max(0.08, pressure));
}

function averagePressure(pressures: number[]): number {
  if (pressures.length === 0) return 0.5;
  return pressures.reduce((a, b) => a + b, 0) / pressures.length;
}

function buildTube(
  points: Vec3Tuple[],
  radius: number,
  material: THREE.Material,
  flipX: boolean,
): THREE.Mesh {
  const vectors = points.map(([x, y, z]) => new THREE.Vector3(flipX ? -x : x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors);
  const geometry = new THREE.TubeGeometry(curve, Math.max(12, points.length * 3), radius, 8, false);
  return new THREE.Mesh(geometry, material);
}

/** Membangun mesh goresan (plus sisi cermin bila aktif). Mengembalikan group kosong jika titik < 2. */
export function buildStrokeGroup(draft: StrokeDraft): THREE.Group {
  const group = new THREE.Group();
  if (draft.points.length < 2) return group;

  const radius = effectiveRadius(
    draft.radius,
    draft.pressureResponse,
    averagePressure(draft.pressures),
  );
  const material = new THREE.MeshStandardMaterial({
    color: draft.color,
    roughness: 0.68,
    metalness: 0.02,
    transparent: draft.opacity < 1,
    opacity: draft.opacity,
  });

  group.add(buildTube(draft.points, radius, material, false));
  if (draft.mirror) group.add(buildTube(draft.points, radius, material, true));
  return group;
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const material = obj.material as THREE.Material | THREE.Material[];
      (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
    }
  });
}
