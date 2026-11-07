import type { ToolId } from '../engine/types';
import { useUI } from '../store';

const TOOLS: { id: ToolId; icon: string; title: string }[] = [
  { id: 'draw', icon: '✎', title: '3D Brush' },
  { id: 'erase', icon: '⌫', title: 'Eraser' },
  { id: 'orbit', icon: '◉', title: 'Orbit' },
  { id: 'select', icon: '⬚', title: 'Select' },
];

/** Panel alat di kiri: alat, warna, ukuran, dan opasitas kuas. */
export function Toolbar() {
  const tool = useUI((s) => s.tool);
  const brush = useUI((s) => s.brush);
  const setTool = useUI((s) => s.setTool);
  const setBrush = useUI((s) => s.setBrush);
  const showToast = useUI((s) => s.showToast);

  return (
    <nav className="pill col left-tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn${tool === t.id ? ' active' : ''}`}
          title={t.title}
          onClick={() => {
            setTool(t.id);
            showToast(`${t.id} tool`);
          }}
        >
          {t.icon}
        </button>
      ))}
      <div className="divider" />
      <label className="swatch" title="Color" style={{ background: brush.color }}>
        <input
          type="color"
          value={brush.color}
          onChange={(e) => setBrush({ color: e.target.value })}
        />
      </label>
      <div className="vslider" title="Size">
        <input
          type="range"
          min={5}
          max={100}
          value={brush.radius}
          onChange={(e) => setBrush({ radius: Number(e.target.value) })}
        />
        <span>{brush.radius}</span>
      </div>
      <div className="vslider" title="Opacity">
        <input
          type="range"
          min={10}
          max={100}
          value={brush.opacity}
          onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
        />
        <span>{brush.opacity}%</span>
      </div>
    </nav>
  );
}
