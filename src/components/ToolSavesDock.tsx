import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StreamBuilderSnapshot, FmvSnapshot, StreamNamedSave, FmvNamedSave } from '../lib/toolLocalStorage';
import {
  listStreamSaves,
  addStreamSave,
  removeStreamSave,
  listFmvSaves,
  addFmvSave,
  removeFmvSave,
} from '../lib/toolLocalStorage';

type ToolSavesDockProps =
  | {
      tool: 'stream';
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
      getSnapshot: () => StreamBuilderSnapshot;
      onLoadSnapshot: (payload: StreamBuilderSnapshot) => void;
      canSave: boolean;
      onAfterSave?: (success: boolean) => void;
    }
  | {
      tool: 'fmv';
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
      getSnapshot: () => FmvSnapshot;
      onLoadSnapshot: (payload: FmvSnapshot) => void;
      canSave: boolean;
      onAfterSave?: (success: boolean) => void;
    };

function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ToolSavesDock(props: ToolSavesDockProps) {
  const { isOpen, onOpenChange, getSnapshot, onLoadSnapshot, canSave, tool, onAfterSave } = props;
  const [tick, setTick] = useState(0);
  const [saveName, setSaveName] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);

  const saves = useMemo((): (StreamNamedSave | FmvNamedSave)[] => {
    return tool === 'stream' ? listStreamSaves() : listFmvSaves();
  }, [tool, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    document.body.dataset.toolSavesOpen = isOpen ? '1' : '';
    return () => {
      delete document.body.dataset.toolSavesOpen;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node;
      if (panelRef.current?.contains(el)) return;
      if (tabRef.current?.contains(el)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onOpenChange]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const name = saveName.trim();
    if (tool === 'stream') {
      const snap = (getSnapshot as () => StreamBuilderSnapshot)();
      const entry = addStreamSave(name, snap);
      if (entry) {
        setSaveName('');
        refresh();
        onOpenChange(false);
        onAfterSave?.(true);
      } else {
        onAfterSave?.(false);
      }
    } else {
      const snap = (getSnapshot as () => FmvSnapshot)();
      const entry = addFmvSave(name, snap);
      if (entry) {
        setSaveName('');
        refresh();
        onOpenChange(false);
        onAfterSave?.(true);
      } else {
        onAfterSave?.(false);
      }
    }
  }, [canSave, getSnapshot, onAfterSave, onOpenChange, refresh, saveName, tool]);

  const handleLoad = useCallback(
    (entry: StreamNamedSave | FmvNamedSave) => {
      onLoadSnapshot(entry.payload as never);
      onOpenChange(false);
    },
    [onLoadSnapshot, onOpenChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (tool === 'stream') removeStreamSave(id);
      else removeFmvSave(id);
      refresh();
    },
    [tool, refresh]
  );

  return (
    <div className={`tool-saves-dock${isOpen ? ' tool-saves-dock-open' : ''}`}>
      <button
        ref={tabRef}
        type="button"
        className="tool-saves-tab"
        aria-expanded={isOpen}
        aria-controls="tool-saves-panel"
        title={isOpen ? 'Close saves' : 'Local saves'}
        onClick={() => onOpenChange(!isOpen)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span className="tool-saves-tab-label">Saves</span>
      </button>

      <aside
        id="tool-saves-panel"
        ref={panelRef}
        className="tool-saves-panel"
        aria-hidden={!isOpen}
      >
        <div className="tool-saves-panel-head">
          <h2 className="tool-saves-title">Local saves</h2>
          <button type="button" className="tool-saves-close" aria-label="Close" onClick={() => onOpenChange(false)}>
            ×
          </button>
        </div>

        <div className="tool-saves-save-row">
          <input
            type="text"
            className="tool-saves-input"
            placeholder="Name (optional)"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={80}
          />
          <button type="button" className="btn btn-primary btn-sm tool-saves-save-btn" disabled={!canSave} onClick={handleSave}>
            Save
          </button>
        </div>
        <p className="tool-saves-hint">Draft still auto-saves. This list keeps named snapshots in localStorage.</p>

        <ul className="tool-saves-list">
          {saves.length === 0 ? (
            <li className="tool-saves-empty">No named saves yet.</li>
          ) : (
            saves.map((s) => (
              <li key={s.id} className="tool-saves-item">
                <div className="tool-saves-item-main">
                  <span className="tool-saves-item-name" title={s.name}>
                    {s.name}
                  </span>
                  <span className="tool-saves-item-time">{formatSavedAt(s.savedAt)}</span>
                </div>
                <div className="tool-saves-item-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleLoad(s)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    title="Remove from list"
                    onClick={() => {
                      if (window.confirm('Remove this save from the list?')) handleDelete(s.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </aside>
    </div>
  );
}
