import { create } from 'zustand';
import {
  DEFAULT_BRUSH,
  type BrushSettings,
  type GuideType,
  type HistoryInfo,
  type ToolId,
} from './engine/types';

export interface UIState {
  tool: ToolId;
  brush: BrushSettings;
  mirror: boolean;
  guide: GuideType;
  gridVisible: boolean;
  guideVisible: boolean;
  history: HistoryInfo;
  toastText: string;
  toastVisible: boolean;

  setTool: (tool: ToolId) => void;
  setBrush: (patch: Partial<BrushSettings>) => void;
  toggleMirror: () => void;
  setGuide: (guide: GuideType) => void;
  toggleGrid: () => void;
  toggleGuide: () => void;
  setHistory: (info: HistoryInfo) => void;
  showToast: (text: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUI = create<UIState>((set) => ({
  tool: 'draw',
  brush: { ...DEFAULT_BRUSH },
  mirror: false,
  guide: 'plane',
  gridVisible: true,
  guideVisible: true,
  history: { strokeCount: 0, canUndo: false, canRedo: false },
  toastText: '',
  toastVisible: false,

  setTool: (tool) => set({ tool }),
  setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
  toggleMirror: () => set((s) => ({ mirror: !s.mirror })),
  setGuide: (guide) => set({ guide }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleGuide: () => set((s) => ({ guideVisible: !s.guideVisible })),
  setHistory: (history) => set({ history }),
  showToast: (toastText) => {
    set({ toastText, toastVisible: true });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastVisible: false }), 1250);
  },
}));
