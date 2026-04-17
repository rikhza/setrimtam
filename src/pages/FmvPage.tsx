import { useState, useMemo, useCallback, useLayoutEffect, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { parseCobol, sliceRawStreamToBreakdown, type CobolField, type BreakdownItem } from '../lib/cobolParser';
import { useToast } from '../hooks/useToast';
import type { ToolsOutletContext } from '../toolOutletContext';
import CopybookInputPanel from '../components/CopybookInputPanel';
import RawDataInputPanel from '../components/RawDataInputPanel';
import FmvOutputPanel from '../components/FmvOutputPanel';
import ToastContainer from '../components/ToastContainer';
import type { FmvSnapshot } from '../lib/toolLocalStorage';
import { loadFmv, saveFmv, clearFmvStorage } from '../lib/toolLocalStorage';
import ToolSavesDock from '../components/ToolSavesDock';

export default function FmvPage() {
  const { registerClearAll } = useOutletContext<ToolsOutletContext>();

  const [copybookText, setCopybookText] = useState(() => loadFmv().copybookText);
  const [rawText, setRawText] = useState(() => loadFmv().rawText);
  const [parsedFields, setParsedFields] = useState<CobolField[]>([]);
  const [savesDockOpen, setSavesDockOpen] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  const { breakdown, warnings } = useMemo(() => {
    if (parsedFields.length === 0 || rawText.length === 0) {
      return { breakdown: [] as BreakdownItem[], warnings: [] as string[] };
    }
    const { breakdown: bd, warnings: w } = sliceRawStreamToBreakdown(rawText, parsedFields);
    return { breakdown: bd, warnings: w };
  }, [parsedFields, rawText]);

  useEffect(() => {
    saveFmv({ copybookText, rawText });
  }, [copybookText, rawText]);

  const restoredLayout = useRef(false);
  useLayoutEffect(() => {
    if (restoredLayout.current) return;
    restoredLayout.current = true;
    if (!copybookText.trim()) return;
    try {
      const { fields } = parseCobol(copybookText);
      if (fields.length > 0) setParsedFields(fields);
    } catch {
      /* invalid persisted copybook — user can fix and Parse */
    }
  }, [copybookText]);

  const handleParseCopybook = useCallback(
    (text: string) => {
      if (!text.trim()) {
        showToast('Paste a COBOL copybook first.', 'warning');
        return;
      }
      try {
        const { fields, warnings } = parseCobol(text);
        if (fields.length === 0) {
          showToast('Could not parse any valid fields.', 'error');
          return;
        }
        setParsedFields(fields);
        showToast(`Parsed ${fields.length} fields`, 'success');
        if (warnings.length > 0) console.warn('Parse warnings:', warnings);
      } catch (err) {
        console.error(err);
        showToast(`Parse error: ${(err as Error).message}`, 'error');
      }
    },
    [showToast]
  );

  const applyFmvSnapshot = useCallback(
    (snap: FmvSnapshot) => {
      setCopybookText(snap.copybookText);
      setRawText(snap.rawText);
      if (!snap.copybookText.trim()) {
        setParsedFields([]);
        showToast('Loaded save', 'success');
        return;
      }
      try {
        const { fields } = parseCobol(snap.copybookText);
        setParsedFields(fields.length > 0 ? fields : []);
        showToast('Loaded save', 'success');
      } catch {
        setParsedFields([]);
        showToast('Copybook in save could not be parsed.', 'error');
      }
    },
    [showToast]
  );

  const handleClearAll = useCallback(() => {
    if (window.confirm('Clear copybook, raw data, and view?')) {
      setCopybookText('');
      setRawText('');
      setParsedFields([]);
      clearFmvStorage();
      showToast('Cleared', 'info');
    }
  }, [showToast]);

  useLayoutEffect(() => {
    registerClearAll(handleClearAll);
    return () => registerClearAll(null);
  }, [registerClearAll, handleClearAll]);

  const fmvSnapshot = useCallback((): FmvSnapshot => ({ copybookText, rawText }), [copybookText, rawText]);
  const canSaveNamed = copybookText.trim().length > 0 || rawText.length > 0;

  return (
    <>
      <main className="main-content main-content-fmv">
        <div className="fmv-inputs">
          <CopybookInputPanel
            heading="Copybook"
            value={copybookText}
            onChange={setCopybookText}
            onParse={handleParseCopybook}
            autoFocus={false}
          />
          <RawDataInputPanel
            value={rawText}
            onChange={setRawText}
            heading="Raw data"
            variant="fmv"
          />
        </div>

        {warnings.length > 0 && parsedFields.length > 0 && rawText.length > 0 && (
          <div className="fmv-warnings" role="status">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}

        <FmvOutputPanel
          breakdown={breakdown}
          layoutReady={parsedFields.length > 0}
          hasRaw={rawText.length > 0}
        />
      </main>

      <ToolSavesDock
        tool="fmv"
        isOpen={savesDockOpen}
        onOpenChange={setSavesDockOpen}
        getSnapshot={fmvSnapshot}
        onLoadSnapshot={applyFmvSnapshot}
        canSave={canSaveNamed}
        onAfterSave={(ok) => {
          if (ok) showToast('Saved to list', 'success');
          else showToast('Could not save (storage full or private mode)', 'error');
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
