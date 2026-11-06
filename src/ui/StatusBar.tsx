import { useUI } from '../store';

export function StatusBar() {
  const strokeCount = useUI((s) => s.history.strokeCount);
  return <div className="status">Ready · {strokeCount} strokes</div>;
}
