import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  parseCobol,
  buildStream,
  buildStreamHex,
  rawStreamToFieldValues,
  type CobolField,
  type BreakdownItem,
} from '../lib/cobolParser';
import { useToast } from '../hooks/useToast';
import CopybookInputPanel from '../components/CopybookInputPanel';
import FieldsFormPanel from '../components/FieldsFormPanel';
import StreamOutputPanel from '../components/StreamOutputPanel';
import ToastContainer from '../components/ToastContainer';
import type { ToolsOutletContext } from '../toolOutletContext';
import type { StreamBuilderSnapshot } from '../lib/toolLocalStorage';
import { loadStreamBuilder, saveStreamBuilder, clearStreamBuilderStorage } from '../lib/toolLocalStorage';
import ToolSavesDock from '../components/ToolSavesDock';

export default function StreamBuilderPage() {
  const { registerClearAll } = useOutletContext<ToolsOutletContext>();

  const [copybookText, setCopybookText] = useState(() => loadStreamBuilder().copybookText);
  const [parsedFields, setParsedFields] = useState<CobolField[]>([]);
  const [fieldValues, setFieldValues] = useState(() => loadStreamBuilder().fieldValues);
  const [formPulse, setFormPulse] = useState(false);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [savesDockOpen, setSavesDockOpen] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  const { stream, breakdown } = useMemo<{ stream: string; breakdown: BreakdownItem[] }>(() => {
    if (parsedFields.length === 0) return { stream: '', breakdown: [] };
    return buildStream(parsedFields, fieldValues);
  }, [parsedFields, fieldValues]);

  useEffect(() => {
    if (!formPulse) return;
    const timer = setTimeout(() => setFormPulse(false), 2000);
    return () => clearTimeout(timer);
  }, [formPulse]);

  useEffect(() => {
    saveStreamBuilder({ copybookText, fieldValues });
  }, [copybookText, fieldValues]);

  const restoredFields = useRef(false);
  useLayoutEffect(() => {
    if (restoredFields.current) return;
    restoredFields.current = true;
    if (!copybookText.trim()) return;
    try {
      const { fields } = parseCobol(copybookText);
      if (fields.length === 0) return;
      setParsedFields(fields);
      setFieldValues((prev) => {
        const next: Record<string, string> = {};
        fields
          .filter((f) => !f.isFiller)
          .forEach((f) => {
            next[f.name] = prev[f.name] ?? f.defaultValue ?? '';
          });
        return next;
      });
    } catch {
      /* invalid session — user parses again */
    }
  }, [copybookText]);

  const handleParse = useCallback(
    (text: string) => {
      if (!text.trim()) {
        showToast('Please enter or paste a COBOL copybook first.', 'warning');
        return;
      }
      try {
        const { fields, warnings } = parseCobol(text);

        if (fields.length === 0) {
          showToast('Could not parse any valid fields from the input.', 'error');
          return;
        }

        setParsedFields(fields);
        setFieldValues((prev) => {
          const next: Record<string, string> = {};
          fields
            .filter((f) => !f.isFiller)
            .forEach((f) => {
              next[f.name] = prev[f.name] ?? f.defaultValue ?? '';
            });
          return next;
        });
        showToast(`Successfully parsed ${fields.length} fields`, 'success');

        if (warnings.length > 0) {
          console.warn('Parse warnings:', warnings);
        }

        setFormPulse(true);
      } catch (err) {
        console.error(err);
        showToast(`Error parsing copybook: ${(err as Error).message}`, 'error');
      }
    },
    [showToast]
  );

  const applyStreamSnapshot = useCallback(
    (snap: StreamBuilderSnapshot) => {
      if (!snap.copybookText.trim()) {
        setCopybookText('');
        setParsedFields([]);
        setFieldValues({});
        clearStreamBuilderStorage();
        showToast('Loaded save', 'success');
        return;
      }
      try {
        const { fields } = parseCobol(snap.copybookText);
        if (fields.length === 0) {
          showToast('Copybook in this save could not be parsed.', 'error');
          return;
        }
        setCopybookText(snap.copybookText);
        setParsedFields(fields);
        const next: Record<string, string> = {};
        fields
          .filter((f) => !f.isFiller)
          .forEach((f) => {
            next[f.name] = snap.fieldValues[f.name] ?? f.defaultValue ?? '';
          });
        setFieldValues(next);
        showToast('Loaded save', 'success');
      } catch (err) {
        showToast(`Load error: ${(err as Error).message}`, 'error');
      }
    },
    [showToast]
  );

  const handleClearAll = useCallback(() => {
    if (window.confirm('Clear copybook and all generated fields?')) {
      setCopybookText('');
      setParsedFields([]);
      setFieldValues({});
      clearStreamBuilderStorage();
      showToast('All data cleared', 'info');
    }
  }, [showToast]);

  useLayoutEffect(() => {
    registerClearAll(handleClearAll);
    return () => registerClearAll(null);
  }, [registerClearAll, handleClearAll]);

  const handleFillFromRawStream = useCallback(
    (raw: string) => {
      if (parsedFields.length === 0) return;
      const trimmed = raw.trim();
      if (!trimmed) {
        showToast('Paste a raw stream first (screen capture or one contiguous block).', 'warning');
        return;
      }
      const { values, warnings } = rawStreamToFieldValues(raw, parsedFields);
      setFieldValues((prev) => ({ ...prev, ...values }));
      const note = warnings.length ? `${warnings.join(' ')} — ` : '';
      showToast(`${note}Fields filled from raw stream.`, warnings.length > 0 ? 'info' : 'success');
    },
    [parsedFields, showToast]
  );

  const handleClearForm = useCallback(() => {
    if (parsedFields.length === 0) return;
    const cleared: Record<string, string> = {};
    parsedFields
      .filter((f) => !f.isFiller)
      .forEach((f) => {
        cleared[f.name] = '';
      });
    setFieldValues(cleared);
    showToast('Form values cleared', 'info');
  }, [parsedFields, showToast]);

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCopyStream = useCallback(async () => {
    if (!stream) return;
    try {
      await navigator.clipboard.writeText(stream);
      showToast('Stream copied to clipboard', 'success');
    } catch {
      showToast('Could not copy — check clipboard permission', 'error');
    }
  }, [stream, showToast]);

  const handleCopyHex = useCallback(async () => {
    if (!stream) return;
    try {
      await navigator.clipboard.writeText(buildStreamHex(stream, breakdown));
      showToast('Hex copied (COMP-3 fields as packed bytes)', 'success');
    } catch {
      showToast('Could not copy — check clipboard permission', 'error');
    }
  }, [stream, breakdown, showToast]);

  const nonFillerFields = useMemo(
    () => parsedFields.filter((f) => !f.isFiller),
    [parsedFields]
  );

  const totalBytes = useMemo(
    () => parsedFields.reduce((s, f) => s + f.length, 0),
    [parsedFields]
  );

  const streamSnapshot = useCallback(
    (): StreamBuilderSnapshot => ({ copybookText, fieldValues }),
    [copybookText, fieldValues]
  );

  const canSaveNamed = copybookText.trim().length > 0;

  return (
    <>
      <main className="main-content">
        <CopybookInputPanel
          value={copybookText}
          onChange={setCopybookText}
          onParse={handleParse}
        />

        <FieldsFormPanel
          fields={nonFillerFields}
          values={fieldValues}
          onChange={handleFieldChange}
          onFillFromRawStream={handleFillFromRawStream}
          onClearForm={handleClearForm}
          formPulse={formPulse}
          highlightedField={highlightedField}
        />

        <StreamOutputPanel
          stream={stream}
          breakdown={breakdown}
          totalBytes={totalBytes}
          fields={parsedFields}
          onCopyStream={handleCopyStream}
          onCopyHex={handleCopyHex}
          onHighlightField={setHighlightedField}
        />
      </main>

      <ToolSavesDock
        tool="stream"
        isOpen={savesDockOpen}
        onOpenChange={setSavesDockOpen}
        getSnapshot={streamSnapshot}
        onLoadSnapshot={applyStreamSnapshot}
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
