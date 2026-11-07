export type ToolId = 'draw' | 'erase' | 'orbit' | 'select' | 'pick';
export type TransformMode = 'move' | 'rotate' | 'scale';
export type GuideType = 'plane' | 'sphere' | 'cube';
export type ViewId = 'front' | 'side' | 'top';

/**
 * Perilaku sentuhan jari.
 * - auto: jari menggambar sampai stylus terdeteksi, setelah itu jari hanya navigasi (palm rejection)
 * - orbit: jari selalu navigasi (orbit/pan/zoom)
 * - draw: jari selalu mengikuti tool aktif
 */
export type TouchMode = 'auto' | 'orbit' | 'draw';

export type Vec3Tuple = [number, number, number];

/** Pengaturan kuas seperti yang tampil di UI (nilai slider). */
export interface BrushSettings {
  color: string;
  /** Nilai slider 5..100. Radius dunia = nilai / 1000. */
  radius: number;
  /** 0..100, seberapa kuat tekanan memengaruhi ketebalan. */
  pressure: number;
  /** 10..100 */
  opacity: number;
  /** 0..100, seberapa kuat penghalusan pointer (Stable Stroke). */
  stabilize: number;
}

export const DEFAULT_BRUSH: BrushSettings = {
  color: '#1b1c22',
  radius: 12,
  pressure: 70,
  opacity: 100,
  stabilize: 0,
};

/** Satu goresan lengkap. Gaya kuas dan mirror disimpan per goresan agar undo/redo konsisten. */
export interface StrokeData {
  id: number;
  points: Vec3Tuple[];
  pressures: number[];
  color: string;
  /** Radius dasar dalam satuan dunia. */
  radius: number;
  /** 0..1 */
  pressureResponse: number;
  /** 0..1 */
  opacity: number;
  /** Apakah goresan ini dicerminkan pada sumbu X. */
  mirror: boolean;
  /** Waktu tiap titik dalam ms sejak titik pertama. Dipakai untuk simulasi tekanan dari kecepatan. */
  times?: number[];
}

/** Ringkasan input terakhir, untuk indikator debug. */
export interface InputInfo {
  pointerType: string;
  pressure: number;
  /** Rentang tekanan selama kontak terakhir. */
  min: number;
  max: number;
  inContact: boolean;
}

export interface HistoryInfo {
  strokeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  selectionCount: number;
}

export const PROJECT_FORMAT = 'feather-android-prototype' as const;
export const PROJECT_VERSION = '1.1';

/** Bidang panduan buatan pengguna (Draw 3D Guide). */
export interface GuidePlaneData {
  id: number;
  origin: Vec3Tuple;
  /** Vektor satuan. */
  normal: Vec3Tuple;
}

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: string;
  guide: GuideType;
  planes?: GuidePlaneData[];
  strokes: StrokeData[];
}
