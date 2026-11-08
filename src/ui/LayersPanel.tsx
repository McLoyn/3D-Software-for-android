import { getEngine } from '../engineRef';
import { useUI } from '../store';

/** Panel layer (group): aktif, tampil/sembunyi, kunci, urutan, ganti nama, hapus, pindahkan seleksi. */
export function LayersPanel() {
  const open = useUI((s) => s.layersOpen);
  const layers = useUI((s) => s.layers);
  const active = useUI((s) => s.activeLayer);
  const hasSelection = useUI((s) => s.history.selectionCount > 0);
  const toggleLayers = useUI((s) => s.toggleLayers);

  if (!open) return null;

  return (
    <aside className="sheet layers-sheet">
      <div className="sheet-head">
        <span>Layers</span>
        <span>
          <button title="New layer" onClick={() => getEngine()?.addLayer()}>
            ＋
          </button>
          <button onClick={toggleLayers} title="Close">
            ✕
          </button>
        </span>
      </div>
      <div className="layer-list">
        {[...layers].reverse().map((l) => (
          <div key={l.id} className={`layer-row${l.id === active ? ' current' : ''}`}>
            <button
              title={l.visible ? 'Hide' : 'Show'}
              onClick={() => getEngine()?.setLayerVisible(l.id, !l.visible)}
            >
              {l.visible ? '👁' : '◌'}
            </button>
            <button
              title={l.locked ? 'Unlock' : 'Lock'}
              onClick={() => getEngine()?.setLayerLocked(l.id, !l.locked)}
            >
              {l.locked ? '🔒' : '🔓'}
            </button>
            <button className="name" title="Set active layer" onClick={() => getEngine()?.setActiveLayer(l.id)}>
              {l.name}
            </button>
            <button
              title="Rename"
              onClick={() => {
                const name = window.prompt('Layer name', l.name);
                if (name !== null) getEngine()?.renameLayer(l.id, name);
              }}
            >
              ✎
            </button>
            <button title="Move up" onClick={() => getEngine()?.moveLayer(l.id, 1)}>
              ↑
            </button>
            <button title="Move down" onClick={() => getEngine()?.moveLayer(l.id, -1)}>
              ↓
            </button>
            <button
              title="Move selection to this layer"
              disabled={!hasSelection}
              onClick={() => getEngine()?.moveSelectionToLayer(l.id)}
            >
              ⇥
            </button>
            <button title="Delete layer" onClick={() => getEngine()?.deleteLayer(l.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
