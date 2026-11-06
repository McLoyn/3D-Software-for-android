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
  const setGuide = useUI((s) => s.setGuide);
  const toggleMirror = useUI((s) => s.toggleMirror);
  const toggleSettings = useUI((s) => s.toggleSettings);

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
