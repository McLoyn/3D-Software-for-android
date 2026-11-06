import { create } from 'zustand';
import {
  DEFAULT_BRUSH,
  type BrushSettings,
  type GuideType,
  type HistoryInfo,
  type InputInfo,
  type ToolId,
  type TouchMode,
} from './engine/types';

export interface UIState {
  tool: ToolId;
  brush: BrushSettings;
  mirror: boolean;
  touchMode: TouchMode;
  inputDebug: boolean;
  input: InputInfo | null;
  guide: GuideType;
  gridVisible: boolean;
  guideVisible: boolean;
  history: HistoryInfo;
  toastText: string;
  toastVisible: boolean;

  setTool: (tool: ToolId) => void;
  setTouchMode: (mode: TouchMode) => void;
  setInputDebug: (on: boolean) => void;
  setInput: (info: InputInfo) => void;
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
  touchMode: 'auto',
  inputDebug: false,
  input: null,
  guide: 'plane',
  gridVisible: true,
  guideVisible: true,
  history: { strokeCount: 0, canUndo: false, canRedo: false },
  toastText: '',
  toastVisible: false,

  setTool: (tool) => set({ tool }),
  setTouchMode: (touchMode) => set({ touchMode }),
  setInputDebug: (inputDebug) => set({ inputDebug, input: null }),
  setInput: (input) => set({ input }),
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
