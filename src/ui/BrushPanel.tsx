import type { GuideType } from '../engine/types';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

export function BrushPanel() {
  const brush = useUI((s) => s.brush);
  const setBrush = useUI((s) => s.setBrush);
  const guide = useUI((s) => s.guide);
  const setGuide = useUI((s) => s.setGuide);
  const gridVisible = useUI((s) => s.gridVisible);
  const guideVisible = useUI((s) => s.guideVisible);
  const toggleGrid = useUI((s) => s.toggleGrid);
  const toggleGuide = useUI((s) => s.toggleGuide);
  const mirror = useUI((s) => s.mirror);
  const toggleMirror = useUI((s) => s.toggleMirror);
  const showToast = useUI((s) => s.showToast);

  return (
    <aside>
      <div className="group">
        <h3>3D Brush</h3>
        <label>Color</label>
        <input
          type="color"
          value={brush.color}
          onChange={(e) => setBrush({ color: e.target.value })}
        />
        <label>
          Radius <span>{(brush.radius / 1000).toFixed(3)}</span>
        </label>
        <input
          type="range"
          min={5}
          max={100}
          value={brush.radius}
          onChange={(e) => setBrush({ radius: Number(e.target.value) })}
        />
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
        <label>
          Opacity <span>{brush.opacity}%</span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          value={brush.opacity}
          onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
        />
      </div>

      <div className="group">
        <h3>Surface</h3>
        <select value={guide} onChange={(e) => setGuide(e.target.value as GuideType)}>
          <option value="plane">Plane</option>
          <option value="sphere">Sphere guide</option>
          <option value="cube">Cube guide</option>
        </select>
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
        <h3>Symmetry</h3>
        <button
          className={mirror ? 'active' : ''}
          style={{ width: '100%' }}
          onClick={toggleMirror}
        >
          Live mirror: {mirror ? 'On' : 'Off'}
        </button>
      </div>

      <div className="group">
        <h3>Project</h3>
        <div className="row">
          <button
            onClick={() => {
              getEngine()?.clearStrokes();
              showToast('Strokes cleared');
            }}
          >
            Clear strokes
          </button>
          <button onClick={() => getEngine()?.resetView()}>Reset view</button>
        </div>
      </div>

      <div className="note">
        Build 0.3 · Tablet-first prototype
        <br />
        Pressure uses Pointer Events. Stylus pressure depends on browser, device and pen support.
        This build is a web prototype, not a native APK.
      </div>
    </aside>
  );
}
