export type ToolId = 'draw' | 'erase' | 'orbit';
export type GuideType = 'plane' | 'sphere' | 'cube';

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
}

export const DEFAULT_BRUSH: BrushSettings = {
  color: '#b7aaff',
  radius: 35,
  pressure: 70,
  opacity: 100,
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
}

export interface HistoryInfo {
  strokeCount: number;
  canUndo: boolean;
  canRedo: boolean;
}

export const PROJECT_FORMAT = 'feather-android-prototype' as const;
export const PROJECT_VERSION = '0.3';

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: string;
  guide: GuideType;
  strokes: StrokeData[];
}
