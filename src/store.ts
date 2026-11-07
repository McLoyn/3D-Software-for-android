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
  settingsOpen: boolean;
  inputDebug: boolean;
  input: InputInfo | null;
  guide: GuideType;
  guideDraw: boolean;
  ortho: boolean;
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
  setBrush: (patch: Partial<BrushSettings>) => void;
  toggleMirror: () => void;
  setGuide: (guide: GuideType) => void;
  setGuideDraw: (on: boolean) => void;
  toggleOrtho: () => void;
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
  settingsOpen: false,
  inputDebug: false,
  input: null,
  guide: 'plane',
  guideDraw: false,
  ortho: false,
  gridVisible: true,
  guideVisible: true,
  history: { strokeCount: 0, canUndo: false, canRedo: false },
  toastText: '',
  toastVisible: false,

  setTool: (tool) => set({ tool }),
  setTouchMode: (touchMode) => set({ touchMode }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setInputDebug: (inputDebug) => set({ inputDebug, input: null }),
  setInput: (input) => set({ input }),
  setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
  toggleMirror: () => set((s) => ({ mirror: !s.mirror })),
  setGuide: (guide) => set({ guide }),
  setGuideDraw: (guideDraw) => set({ guideDraw }),
  toggleOrtho: () => set((s) => ({ ortho: !s.ortho })),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleGuide: () => set((s) => ({ guideVisible: !s.guideVisible })),
  setHistory: (history) => set({ history }),
  showToast: (toastText) => {
    set({ toastText, toastVisible: true });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastVisible: false }), 1250);
  },
}));
