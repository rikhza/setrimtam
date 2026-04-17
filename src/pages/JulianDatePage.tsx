import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { calendarToOrdinal, parseOrdinalDigits, ordinalToCalendar } from '../lib/julianOrdinalDate';
import type { OrdinalDecodeResult } from '../lib/julianOrdinalDate';
import type { ToolsOutletContext } from '../toolOutletContext';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function JulianDatePage() {
  const { registerClearAll } = useOutletContext<ToolsOutletContext>();

  const [isoDate, setIsoDate] = useState(todayISO);
  const [ordinalInput, setOrdinalInput] = useState('');

  const forward = useMemo(() => calendarToOrdinal(isoDate), [isoDate]);

  const reverse = useMemo((): { status: 'empty' } | { status: 'error'; message: string } | { status: 'ok'; data: OrdinalDecodeResult } => {
    const trimmed = ordinalInput.trim();
    if (!trimmed) return { status: 'empty' };
    const parsed = parseOrdinalDigits(trimmed);
    if (!parsed) return { status: 'error', message: 'Use 5 digits (YYDDD) or 7 digits (YYYYDDD).' };
    const cal = ordinalToCalendar(parsed);
    if (!cal) return { status: 'error', message: 'Invalid day-of-year for that year.' };
    return { status: 'ok', data: cal };
  }, [ordinalInput]);

  const handleClearAll = useCallback(() => {
    setIsoDate(todayISO());
    setOrdinalInput('');
  }, []);

  useLayoutEffect(() => {
    registerClearAll(handleClearAll);
    return () => registerClearAll(null);
  }, [registerClearAll, handleClearAll]);

  return (
    <main className="main-content main-content-julian">
      <section className="panel panel-julian" aria-label="Calendar to ordinal Julian">
        <div className="panel-header">
          <div className="panel-title">
            <span>Calendar → Julian (ordinal)</span>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setIsoDate(todayISO())}>
            Today
          </button>
        </div>
        <div className="panel-body julian-panel-body">
          <label className="julian-label" htmlFor="julian-iso-date">
            Date
          </label>
          <input
            id="julian-iso-date"
            className="julian-date-input"
            type="date"
            value={isoDate}
            onChange={(e) => setIsoDate(e.target.value)}
          />
          {forward ? (
            <div className="julian-results">
              <div className="julian-result-row">
                <span className="julian-result-key">YYDDD</span>
                <code className="julian-code">{forward.yyddd}</code>
              </div>
              <div className="julian-result-row">
                <span className="julian-result-key">YYYYDDD</span>
                <code className="julian-code">{forward.yyyyddd}</code>
              </div>
              <p className="julian-meta">
                Day-of-year <strong>{forward.dayOfYear}</strong> · {forward.weekday}
              </p>
              <p className="julian-meta muted">{forward.longLabel}</p>
            </div>
          ) : (
            <p className="julian-error">Invalid date.</p>
          )}
        </div>
      </section>

      <section className="panel panel-julian" aria-label="Ordinal Julian to calendar">
        <div className="panel-header">
          <div className="panel-title">
            <span>Julian (ordinal) → calendar</span>
          </div>
        </div>
        <div className="panel-body julian-panel-body">
          <label className="julian-label" htmlFor="julian-ordinal-in">
            YYDDD or YYYYDDD
          </label>
          <input
            id="julian-ordinal-in"
            className="julian-text-input"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 25048 or 2025048"
            value={ordinalInput}
            onChange={(e) => setOrdinalInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {reverse.status === 'empty' ? (
            <p className="julian-hint">Digits only; 5 = two-digit year + DDD, 7 = full year + DDD.</p>
          ) : reverse.status === 'error' ? (
            <p className="julian-error">{reverse.message}</p>
          ) : (
            <div className="julian-results">
              <div className="julian-result-row">
                <span className="julian-result-key">ISO</span>
                <code className="julian-code">{reverse.data.iso}</code>
              </div>
              <p className="julian-meta">{reverse.data.longLabel}</p>
              <div className="julian-result-row">
                <span className="julian-result-key">YYDDD</span>
                <code className="julian-code">{reverse.data.yyddd}</code>
              </div>
              <div className="julian-result-row">
                <span className="julian-result-key">YYYYDDD</span>
                <code className="julian-code">{reverse.data.yyyyddd}</code>
              </div>
              {reverse.data.note && <p className="julian-hint">{reverse.data.note}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
