import * as THREE from 'three';
import type { StrokeData, Vec3Tuple } from './types';

export type StrokeDraft = Omit<StrokeData, 'id'>;

const RADIAL_SEGMENTS = 8;
/** Selisih tekanan minimum agar dianggap tekanan asli dari stylus. */
const PRESSURE_RANGE_EPS = 0.04;
/** Panjang maksimum (satuan dunia) bagian ujung goresan yang meruncing. */
const TAPER_MAX_LENGTH = 0.12;
/** Skala radius paling kecil di ujung goresan. */
const TAPER_MIN_SCALE = 0.3;

export function effectiveRadius(base: number, response: number, pressure: number): number {
  return base * (1 - response + response * Math.max(0.08, pressure));
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Rata-rata bergerak 3 titik, ujungnya dipertahankan. */
function smooth(values: number[], passes: number): number[] {
  let out = values.slice();
  for (let p = 0; p < passes; p++) {
    const next = out.slice();
    for (let i = 1; i < out.length - 1; i++) {
      next[i] = (out[i - 1] + out[i] + out[i + 1]) / 3;
    }
    out = next;
  }
  return out;
}

/** Tekanan semu dari kecepatan: pelan = tebal, cepat = tipis (relatif terhadap kecepatan rata-rata). */
function speedPressures(points: Vec3Tuple[], times: number[]): number[] {
  const n = points.length;
  const speeds = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dt = Math.max(1, times[i] - times[i - 1]);
    speeds[i] = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
  }
  speeds[0] = speeds[1];
  const mean = speeds.reduce((s, v) => s + v, 0) / n || 1e-6;
  return speeds.map((v) => clamp(0.85 - 0.35 * (v / mean - 1), 0.3, 1));
}

/**
 * Tekanan efektif (0..1) untuk tiap titik.
 * Memakai tekanan stylus bila bervariasi; bila konstan (mouse, jari, atau stylus tanpa sensor
 * tekanan) disimulasikan dari kecepatan gambar.
 */
export function resolvePressures(
  points: Vec3Tuple[],
  pressures: number[],
  times?: number[],
): number[] {
  const n = points.length;
  let min = Infinity;
  let max = -Infinity;
  for (const p of pressures) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  if (n > 0 && pressures.length === n && max - min >= PRESSURE_RANGE_EPS) {
    return smooth(pressures, 2);
  }
  if (times && times.length === n && n > 2) {
    return smooth(speedPressures(points, times), 3);
  }
  return pressures.length === n ? pressures : points.map(() => 0.5);
}

/**
 * Tabung dengan radius berbeda di tiap penampang (menggantikan TubeGeometry yang radiusnya tunggal).
 * `radii` berisi radius pada kedua ujung tiap segmen, panjangnya segments + 1.
 */
function buildVariableTube(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  radii: number[],
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const center = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, center);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
      const v = (j / RADIAL_SEGMENTS) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      dir.set(
        cos * n.x + sin * b.x,
        cos * n.y + sin * b.y,
        cos * n.z + sin * b.z,
      ).normalize();
      positions.push(center.x + radii[i] * dir.x, center.y + radii[i] * dir.y, center.z + radii[i] * dir.z);
      normals.push(dir.x, dir.y, dir.z);
    }
  }

  const ring = RADIAL_SEGMENTS + 1;
  for (let j = 1; j <= segments; j++) {
    for (let k = 1; k <= RADIAL_SEGMENTS; k++) {
      const a = ring * (j - 1) + (k - 1);
      const b = ring * j + (k - 1);
      const c = ring * j + k;
      const d = ring * (j - 1) + k;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/** Radius pada fraksi panjang 0..1, diinterpolasi dari radius per titik (diukur dengan panjang tali busur). */
function sampleRadii(
  vectors: THREE.Vector3[],
  pointRadii: number[],
  segments: number,
): number[] {
  const cumulative = [0];
  for (let i = 1; i < vectors.length; i++) {
    cumulative.push(cumulative[i - 1] + vectors[i].distanceTo(vectors[i - 1]));
  }
  const total = cumulative[cumulative.length - 1] || 1;
  const taperLength = Math.min(total * 0.3, TAPER_MAX_LENGTH);

  const out: number[] = [];
  let k = 1;
  for (let s = 0; s <= segments; s++) {
    const dist = (s / segments) * total;
    while (k < cumulative.length - 1 && cumulative[k] < dist) k++;
    const span = cumulative[k] - cumulative[k - 1] || 1;
    const t = clamp((dist - cumulative[k - 1]) / span, 0, 1);
    let radius = pointRadii[k - 1] + (pointRadii[k] - pointRadii[k - 1]) * t;

    const fromEnd = Math.min(dist, total - dist);
    const u = taperLength > 0 ? clamp(fromEnd / taperLength, 0, 1) : 1;
    const ease = u * u * (3 - 2 * u);
    radius *= TAPER_MIN_SCALE + (1 - TAPER_MIN_SCALE) * ease;
    out.push(radius);
  }
  return out;
}

function buildTube(
  points: Vec3Tuple[],
  pointRadii: number[],
  material: THREE.Material,
  flipX: boolean,
): THREE.Mesh {
  const vectors = points.map(([x, y, z]) => new THREE.Vector3(flipX ? -x : x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors);
  const segments = Math.max(12, points.length * 3);
  const radii = sampleRadii(vectors, pointRadii, segments);
  return new THREE.Mesh(buildVariableTube(curve, segments, radii), material);
}

/** Membangun mesh goresan (plus sisi cermin bila aktif). Mengembalikan group kosong jika titik < 2. */
export function buildStrokeGroup(draft: StrokeDraft): THREE.Group {
  const group = new THREE.Group();
  if (draft.points.length < 2) return group;

  const pressures = resolvePressures(draft.points, draft.pressures, draft.times);
  const pointRadii = pressures.map((p) => effectiveRadius(draft.radius, draft.pressureResponse, p));
  // Tinta datar tanpa pencahayaan, seperti garis di Feather asli.
  const material = new THREE.MeshBasicMaterial({
    color: draft.color,
    transparent: draft.opacity < 1,
    opacity: draft.opacity,
  });

  group.add(buildTube(draft.points, pointRadii, material, false));
  if (draft.mirror) group.add(buildTube(draft.points, pointRadii, material, true));
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
