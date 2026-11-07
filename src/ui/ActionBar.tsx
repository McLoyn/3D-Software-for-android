import type { TransformMode } from '../engine/types';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

const MODES: { id: TransformMode; label: string; title: string }[] = [
  { id: 'move', label: 'Move', title: 'Move: drag to move in the view plane' },
  { id: 'rotate', label: 'Rotate', title: 'Rotate: horizontal = around Y, vertical = around screen X' },
  { id: 'scale', label: 'Scale', title: 'Scale: drag up = bigger, drag down = smaller' },
];

/** Panel aksi seleksi (muncul saat tool Select aktif): transformasi, duplikat, hapus. */
export function ActionBar() {
  const tool = useUI((s) => s.tool);
  const transform = useUI((s) => s.transform);
  const count = useUI((s) => s.history.selectionCount);
  const setTransform = useUI((s) => s.setTransform);
  const showToast = useUI((s) => s.showToast);

  if (tool !== 'select') return null;
  const none = count === 0;

  return (
    <div className="pill action-bar">
      <span className="count">{count} selected</span>
      {MODES.map((m) => (
        <button
          key={m.id}
          className={transform === m.id ? 'active' : ''}
          disabled={none}
          title={m.title}
          onClick={() => setTransform(transform === m.id ? null : m.id)}
        >
          {m.label}
        </button>
      ))}
      <div className="vdivider" />
      <button disabled={none} title="Duplicate" onClick={() => getEngine()?.duplicateSelection(false)}>
        Dup
      </button>
      <button disabled={none} title="Duplicate mirrored on X" onClick={() => getEngine()?.duplicateSelection(true)}>
        Sym
      </button>
      <button
        disabled={none}
        title="Apply current brush to selection"
        onClick={() => {
          getEngine()?.applyBrushToSelection();
          showToast('Brush applied');
        }}
      >
        Brush
      </button>
      <button disabled={none} title="Delete" onClick={() => getEngine()?.deleteSelection()}>
        Del
      </button>
      <button
        disabled={none}
        title="Deselect"
        onClick={() => {
          setTransform(null);
          getEngine()?.clearSelection();
        }}
      >
        None
      </button>
    </div>
  );
}
