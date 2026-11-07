import type { ViewId } from '../engine/types';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

const VIEWS: { id: ViewId; label: string; title: string }[] = [
  { id: 'front', label: 'F', title: 'Front view' },
  { id: 'side', label: 'S', title: 'Side view' },
  { id: 'top', label: 'T', title: 'Top view' },
];

/** Panel kecil kanan bawah: tampak cepat dan toggle perspektif/ortografi. */
export function ViewBar() {
  const ortho = useUI((s) => s.ortho);
  const toggleOrtho = useUI((s) => s.toggleOrtho);

  return (
    <div className="pill bottom-right">
      {VIEWS.map((v) => (
        <button key={v.id} title={v.title} onClick={() => getEngine()?.setView(v.id)}>
          {v.label}
        </button>
      ))}
      <div className="vdivider" />
      <button className={ortho ? 'active' : ''} title="Orthographic" onClick={toggleOrtho}>
        Ortho
      </button>
    </div>
  );
}
