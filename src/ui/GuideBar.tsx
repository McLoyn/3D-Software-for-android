import type { GuideType } from '../engine/types';
import { useUI } from '../store';

const GUIDES: { id: GuideType; icon: string; title: string }[] = [
  { id: 'sphere', icon: '◯', title: 'Sphere guide' },
  { id: 'cube', icon: '▣', title: 'Cube guide' },
  { id: 'plane', icon: '▤', title: 'Plane guide' },
];

/** Panel kecil kanan atas: guide, mirror, dan tombol pengaturan. */
export function GuideBar() {
  const guide = useUI((s) => s.guide);
  const mirror = useUI((s) => s.mirror);
  const settingsOpen = useUI((s) => s.settingsOpen);
  const guideDraw = useUI((s) => s.guideDraw);
  const setGuide = useUI((s) => s.setGuide);
  const setGuideDraw = useUI((s) => s.setGuideDraw);
  const toggleMirror = useUI((s) => s.toggleMirror);
  const toggleSettings = useUI((s) => s.toggleSettings);
  const showToast = useUI((s) => s.showToast);

  return (
    <div className="pill top-right">
      {GUIDES.map((g) => (
        <button
          key={g.id}
          className={guide === g.id ? 'active' : ''}
          title={g.title}
          onClick={() => setGuide(g.id)}
        >
          {g.icon}
        </button>
      ))}
      <button
        className={guideDraw ? 'active' : ''}
        title="Draw 3D Guide"
        onClick={() => {
          setGuideDraw(!guideDraw);
          if (!guideDraw) showToast('Draw a line: it becomes a guide plane');
        }}
      >
        ⟂
      </button>
      <div className="vdivider" />
      <button className={mirror ? 'active' : ''} title="Mirror" onClick={toggleMirror}>
        ⇋
      </button>
      <button className={settingsOpen ? 'active' : ''} title="Settings" onClick={toggleSettings}>
        {'⚙︎'}
      </button>
    </div>
  );
}
