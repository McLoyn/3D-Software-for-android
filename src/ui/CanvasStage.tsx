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
    engine.onInput = (info) => useUI.getState().setInput(info);
    setEngine(engine);

    // Store UI -> engine. Setter engine bersifat idempoten, jadi aman dipanggil setiap perubahan.
    const apply = (s: UIState) => {
      engine.setTool(s.tool);
      engine.setBrush(s.brush);
      engine.setMirror(s.mirror);
      engine.setTouchMode(s.touchMode);
      engine.setInputDebug(s.inputDebug);
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
  const inputDebug = useUI((s) => s.inputDebug);
  const input = useUI((s) => s.input);

  return (
    <main id="stage" ref={stageRef}>
      <canvas id="view" ref={canvasRef} />
      <div id="toast" style={{ opacity: toastVisible ? 1 : 0 }}>
        {toastText}
      </div>
      {inputDebug && (
        <div className="debug">
          {input ? (
            <>
              <div>
                {input.pointerType || '—'} · pressure {input.pressure.toFixed(2)}
                {input.inContact ? ' · touching' : ''}
              </div>
              <div>
                last contact {input.min.toFixed(2)}–{input.max.toFixed(2)}
              </div>
              <div>
                {input.max - input.min >= 0.04
                  ? 'pressure varies → hardware pressure in use'
                  : 'no pressure variation → speed simulation in use'}
              </div>
            </>
          ) : (
            <div>Touch the canvas with the stylus…</div>
          )}
        </div>
      )}
      <div className="hint">Stylus draws · fingers orbit, pan & pinch-zoom once a stylus is detected</div>
    </main>
  );
}
