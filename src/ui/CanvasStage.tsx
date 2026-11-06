import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { setEngine } from '../engineRef';
import { useUI, type UIState } from '../store';

export function CanvasStage() {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const engine = new Engine(canvas, stage);
    engine.onChange = (info) => useUI.getState().setHistory(info);
    setEngine(engine);

    // Store UI -> engine. Setter engine bersifat idempoten, jadi aman dipanggil setiap perubahan.
    const apply = (s: UIState) => {
      engine.setTool(s.tool);
      engine.setBrush(s.brush);
      engine.setMirror(s.mirror);
      engine.setTouchMode(s.touchMode);
      engine.setGuide(s.guide);
      engine.setGridVisible(s.gridVisible);
      engine.setGuideVisible(s.guideVisible);
    };
    apply(useUI.getState());
    const unsubscribe = useUI.subscribe(apply);

    return () => {
      unsubscribe();
      setEngine(null);
      engine.dispose();
    };
  }, []);

  const toastText = useUI((s) => s.toastText);
  const toastVisible = useUI((s) => s.toastVisible);

  return (
    <main id="stage" ref={stageRef}>
      <canvas id="view" ref={canvasRef} />
      <div id="toast" style={{ opacity: toastVisible ? 1 : 0 }}>
        {toastText}
      </div>
      <div className="hint">Stylus draws · fingers orbit, pan & pinch-zoom once a stylus is detected</div>
    </main>
  );
}
