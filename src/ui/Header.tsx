import { useRef, type ChangeEvent } from 'react';
import { downloadText, downloadUrl } from '../download';
import { getEngine } from '../engineRef';
import { useUI } from '../store';

export function Header() {
  const canUndo = useUI((s) => s.history.canUndo);
  const canRedo = useUI((s) => s.history.canRedo);
  const showToast = useUI((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSave = () => {
    const engine = getEngine();
    if (!engine) return;
    downloadText(
      JSON.stringify(engine.serialize(), null, 2),
      'feather-project.fthr.json',
      'application/json',
    );
    showToast('Project data saved');
  };

  const onExport = () => {
    const engine = getEngine();
    if (!engine) return;
    downloadUrl(engine.exportPNG(), 'feather-android-build-04.png');
    showToast('PNG exported');
  };

  const onOpen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const engine = getEngine();
    if (!file || !engine) return;
    try {
      const result = engine.loadProject(JSON.parse(await file.text()));
      useUI.getState().setGuide(result.guide);
      showToast(`Project opened · ${result.count} strokes`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open project');
    }
  };

  return (
    <header>
      <div className="brand">
        <b>✦</b> Feather{' '}
        <span style={{ color: '#777d8e', fontWeight: 500 }}>Android · 0.4</span>
      </div>
      <div className="spacer" />
      <button disabled={!canUndo} onClick={() => getEngine()?.undo()} title="Undo">
        ↶
      </button>
      <button disabled={!canRedo} onClick={() => getEngine()?.redo()} title="Redo">
        ↷
      </button>
      <button onClick={() => fileRef.current?.click()}>Open</button>
      <button onClick={onSave}>Save</button>
      <button onClick={onExport}>PNG</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={onOpen}
      />
    </header>
  );
}
