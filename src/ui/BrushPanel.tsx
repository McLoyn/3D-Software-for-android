import type { TouchMode } from '../engine/types';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

/** Lembar pengaturan lanjutan, dibuka dari tombol roda gigi di kanan atas. */
export function BrushPanel() {
  const settingsOpen = useUI((s) => s.settingsOpen);
  const toggleSettings = useUI((s) => s.toggleSettings);
  const brush = useUI((s) => s.brush);
  const setBrush = useUI((s) => s.setBrush);
  const gridVisible = useUI((s) => s.gridVisible);
  const guideVisible = useUI((s) => s.guideVisible);
  const toggleGrid = useUI((s) => s.toggleGrid);
  const toggleGuide = useUI((s) => s.toggleGuide);
  const touchMode = useUI((s) => s.touchMode);
  const setTouchMode = useUI((s) => s.setTouchMode);
  const inputDebug = useUI((s) => s.inputDebug);
  const setInputDebug = useUI((s) => s.setInputDebug);
  const showToast = useUI((s) => s.showToast);

  if (!settingsOpen) return null;

  return (
    <aside className="sheet">
      <div className="sheet-head">
        <span>Settings</span>
        <button onClick={toggleSettings} title="Close">
          ✕
        </button>
      </div>

      <div className="group">
        <h3>3D Brush</h3>
        <label>
          Pressure response <span>{brush.pressure}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={brush.pressure}
          onChange={(e) => setBrush({ pressure: Number(e.target.value) })}
        />
      </div>

      <div className="group">
        <h3>Surface</h3>
        <label>Guide visibility</label>
        <div className="row">
          <button className={gridVisible ? 'active' : ''} onClick={toggleGrid}>
            Grid
          </button>
          <button className={guideVisible ? 'active' : ''} onClick={toggleGuide}>
            Guide
          </button>
        </div>
      </div>

      <div className="group">
        <h3>Input</h3>
        <label>Finger touch</label>
        <select value={touchMode} onChange={(e) => setTouchMode(e.target.value as TouchMode)}>
          <option value="auto">Auto (orbit once stylus seen)</option>
          <option value="orbit">Always orbit</option>
          <option value="draw">Always draw</option>
        </select>
        <button
          className={inputDebug ? 'active' : ''}
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setInputDebug(!inputDebug)}
        >
          Input debug: {inputDebug ? 'On' : 'Off'}
        </button>
      </div>

      <div className="group">
        <h3>Project</h3>
        <div className="row">
          <button
            onClick={() => {
              getEngine()?.clearStrokes();
              showToast('Strokes and guides cleared');
            }}
          >
            Clear strokes
          </button>
          <button onClick={() => getEngine()?.resetView()}>Reset view</button>
        </div>
      </div>

      <div className="note">
         Build 0.9 · Tablet-first prototype
        <br />
        Pressure uses Pointer Events. Stylus pressure depends on browser, device and pen support.
        This build is a web prototype, not a native APK.
      </div>
    </aside>
  );
}
