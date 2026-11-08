import { create } from 'zustand';
import {
  DEFAULT_BRUSH,
  type BrushSettings,
  type GuideType,
  type HistoryInfo,
  type InputInfo,
  type LayerData,
  type ToolId,
  type TouchMode,
  type TransformMode,
} from './engine/types';

const PRESETS_KEY = 'feather-android-presets';
export const MAX_PRESETS = 8;

const isBrush = (v: unknown): v is BrushSettings => {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.color === 'string' &&
    ['radius', 'pressure', 'opacity', 'stabilize'].every(
      (k) => typeof b[k] === 'number' && Number.isFinite(b[k]),
    )
  );
};

function loadPresets(): BrushSettings[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter(isBrush).slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

function persistPresets(list: BrushSettings[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    // penyimpanan tidak tersedia; preset hanya hidup selama sesi
  }
}

export interface UIState {
  tool: ToolId;
  brush: BrushSettings;
  presets: BrushSettings[];
  mirror: boolean;
  touchMode: TouchMode;
  settingsOpen: boolean;
  inputDebug: boolean;
  input: InputInfo | null;
  layers: LayerData[];
  activeLayer: number;
  layersOpen: boolean;
  colorOpen: boolean;
  recentColors: string[];
  guide: GuideType;
  guideDraw: boolean;
  ortho: boolean;
  transform: TransformMode | null;
  gridVisible: boolean;
  guideVisible: boolean;
  history: HistoryInfo;
  toastText: string;
  toastVisible: boolean;

  setTool: (tool: ToolId) => void;
  setTouchMode: (mode: TouchMode) => void;
  toggleSettings: () => void;
  setInputDebug: (on: boolean) => void;
  setInput: (info: InputInfo) => void;
  setLayers: (layers: LayerData[], active: number) => void;
  toggleLayers: () => void;
  toggleColor: () => void;
  pushRecentColor: (hex: string) => void;
  setBrush: (patch: Partial<BrushSettings>) => void;
  savePreset: () => void;
  removePreset: (index: number) => void;
  applyPreset: (index: number) => void;
  toggleMirror: () => void;
  setGuide: (guide: GuideType) => void;
  setGuideDraw: (on: boolean) => void;
  toggleOrtho: () => void;
  setTransform: (mode: TransformMode | null) => void;
  toggleGrid: () => void;
  toggleGuide: () => void;
  setHistory: (info: HistoryInfo) => void;
  showToast: (text: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUI = create<UIState>((set) => ({
  tool: 'draw',
  brush: { ...DEFAULT_BRUSH },
  presets: loadPresets(),
  mirror: false,
  touchMode: 'auto',
  settingsOpen: false,
  inputDebug: false,
  input: null,
  layers: [],
  activeLayer: 1,
  layersOpen: false,
  colorOpen: false,
  recentColors: [],
  guide: 'plane',
  guideDraw: false,
  ortho: false,
  transform: null,
  gridVisible: true,
  guideVisible: true,
  history: { strokeCount: 0, canUndo: false, canRedo: false, selectionCount: 0 },
  toastText: '',
  toastVisible: false,

  setTool: (tool) => set({ tool }),
  setTouchMode: (touchMode) => set({ touchMode }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setInputDebug: (inputDebug) => set({ inputDebug, input: null }),
  setInput: (input) => set({ input }),
  setLayers: (layers, activeLayer) => set({ layers, activeLayer }),
  toggleLayers: () => set((s) => ({ layersOpen: !s.layersOpen })),
  toggleColor: () => set((s) => ({ colorOpen: !s.colorOpen })),
  pushRecentColor: (hex) =>
    set((s) => ({ recentColors: [hex, ...s.recentColors.filter((c) => c !== hex)].slice(0, 8) })),
  setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
  savePreset: () =>
    set((s) => {
      if (s.presets.length >= MAX_PRESETS) return s;
      const presets = [...s.presets, { ...s.brush }];
      persistPresets(presets);
      return { presets };
    }),
  removePreset: (index) =>
    set((s) => {
      const presets = s.presets.filter((_, i) => i !== index);
      persistPresets(presets);
      return { presets };
    }),
  applyPreset: (index) => set((s) => (s.presets[index] ? { brush: { ...s.presets[index] } } : s)),
  toggleMirror: () => set((s) => ({ mirror: !s.mirror })),
  setGuide: (guide) => set({ guide }),
  setGuideDraw: (guideDraw) => set({ guideDraw }),
  toggleOrtho: () => set((s) => ({ ortho: !s.ortho })),
  setTransform: (transform) => set({ transform }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleGuide: () => set((s) => ({ guideVisible: !s.guideVisible })),
  setHistory: (history) => set({ history }),
  showToast: (toastText) => {
    set({ toastText, toastVisible: true });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastVisible: false }), 1250);
  },
}));
