import { DEFAULT_BRUSH, type GuideType, type StrokeData, type Vec3Tuple, type GuidePlaneData } from './types';

export type NewStroke = Omit<StrokeData, 'id'>;
export type NewPlane = Omit<GuidePlaneData, 'id'>;

export interface ParsedProject {
  guide: GuideType;
  strokes: NewStroke[];
  planes: NewPlane[];
}

const GUIDES: GuideType[] = ['plane', 'sphere', 'cube'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3Tuple => Array.isArray(v) && v.length === 3 && v.every(isNum);

/**
 * Membaca berkas proyek (.fthr.json). Menerima format Build 0.2 sampai 0.8 (planes opsional).
 * Melempar Error bila berkas tidak valid; goresan rusak dilewati.
 */
export function parseProject(raw: unknown): ParsedProject {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid project file');
  const obj = raw as Record<string, unknown>;

  if (typeof obj.format !== 'string' || !obj.format.startsWith('feather-android')) {
    throw new Error('Unrecognized project format');
  }
  if (!Array.isArray(obj.strokes)) throw new Error('Project has no stroke data');

  const guide = GUIDES.includes(obj.guide as GuideType) ? (obj.guide as GuideType) : 'plane';
  const strokes: NewStroke[] = [];

  for (const item of obj.strokes as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const s = item as Record<string, unknown>;

    const points = s.points;
    if (!Array.isArray(points) || points.length < 2 || !points.every(isVec3)) continue;

    const rawPressures = s.pressures;
    const pressures: number[] =
      Array.isArray(rawPressures) &&
      rawPressures.length === points.length &&
      rawPressures.every(isNum)
        ? rawPressures
        : points.map(() => 0.5);

    const rawTimes = s.times;
    const times: number[] | undefined =
      Array.isArray(rawTimes) && rawTimes.length === points.length && rawTimes.every(isNum)
        ? rawTimes
        : undefined;

    strokes.push({
      points,
      pressures,
      times,
      color: typeof s.color === 'string' ? s.color : DEFAULT_BRUSH.color,
      radius: isNum(s.radius) ? s.radius : DEFAULT_BRUSH.radius / 1000,
      pressureResponse: isNum(s.pressureResponse) ? s.pressureResponse : DEFAULT_BRUSH.pressure / 100,
      opacity: isNum(s.opacity) ? s.opacity : DEFAULT_BRUSH.opacity / 100,
      mirror: s.mirror === true,
    });
  }

  const planes: NewPlane[] = [];
  if (Array.isArray(obj.planes)) {
    for (const item of obj.planes as unknown[]) {
      if (typeof item !== 'object' || item === null) continue;
      const p = item as Record<string, unknown>;
      if (!isVec3(p.origin) || !isVec3(p.normal)) continue;
      const len = Math.hypot(p.normal[0], p.normal[1], p.normal[2]);
      if (len < 1e-6) continue;
      planes.push({
        origin: p.origin,
        normal: [p.normal[0] / len, p.normal[1] / len, p.normal[2] / len],
      });
    }
  }
  return { guide, strokes, planes };
}
