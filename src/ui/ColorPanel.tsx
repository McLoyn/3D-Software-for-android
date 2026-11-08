import { useUI } from '../store';
import { ColorWheel } from './ColorWheel';

/** Popover color wheel dari tombol warna di toolbar. */
export function ColorPanel() {
  const open = useUI((s) => s.colorOpen);
  const color = useUI((s) => s.brush.color);
  const recent = useUI((s) => s.recentColors);
  const setBrush = useUI((s) => s.setBrush);
  const pushRecent = useUI((s) => s.pushRecentColor);
  const toggleColor = useUI((s) => s.toggleColor);

  if (!open) return null;

  return (
    <aside className="sheet color-pop">
      <div className="sheet-head">
        <span>Color</span>
        <button onClick={toggleColor} title="Close">
          ✕
        </button>
      </div>
      <ColorWheel value={color} onChange={(hex) => setBrush({ color: hex })} onCommit={pushRecent} />
      <div className="recent">
        {recent.map((c) => (
          <button
            key={c}
            className="recent-dot"
            style={{ background: c }}
            title={c}
            onClick={() => setBrush({ color: c })}
          />
        ))}
      </div>
    </aside>
  );
}
