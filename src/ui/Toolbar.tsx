import type { GuideType, ToolId } from '../engine/types';
import { useUI } from '../store';

const TOOLS: { id: ToolId; icon: string; title: string }[] = [
  { id: 'draw', icon: '✎', title: '3D Brush' },
  { id: 'erase', icon: '⌫', title: 'Eraser' },
  { id: 'orbit', icon: '◉', title: 'Orbit' },
];

const GUIDES: { id: GuideType; icon: string; title: string }[] = [
  { id: 'sphere', icon: '◯', title: 'Sphere guide' },
  { id: 'cube', icon: '▣', title: 'Cube guide' },
  { id: 'plane', icon: '▤', title: 'Plane guide' },
];

export function Toolbar() {
  const tool = useUI((s) => s.tool);
  const guide = useUI((s) => s.guide);
  const mirror = useUI((s) => s.mirror);
  const setTool = useUI((s) => s.setTool);
  const setGuide = useUI((s) => s.setGuide);
  const toggleMirror = useUI((s) => s.toggleMirror);
  const showToast = useUI((s) => s.showToast);

  return (
    <nav>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={tool === t.id ? 'active' : ''}
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
      <button className={mirror ? 'active' : ''} title="Mirror" onClick={toggleMirror}>
        ⇋
      </button>
    </nav>
  );
}
