import { useUI } from '../store';

export function StatusBar() {
  const strokeCount = useUI((s) => s.history.strokeCount);
  return (
    <footer className="footer">
      <span>Ready · {strokeCount} strokes</span>
      <span>Cross-platform prototype · Dark</span>
    </footer>
  );
}
