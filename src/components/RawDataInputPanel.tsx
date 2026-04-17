interface RawDataInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  /** Panel title (default: Raw capture). */
  heading?: string;
  /** FMV: copybook-oriented labels and placeholder. */
  variant?: 'default' | 'fmv';
}

export default function RawDataInputPanel({
  value,
  onChange,
  heading = 'Raw capture',
  variant = 'default',
}: RawDataInputPanelProps) {
  const len = value.length;

  return (
    <section className="panel panel-input panel-fmv-raw" aria-label={heading}>
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>{heading}</span>
        </div>
        {len > 0 && (
          <span className="panel-meta" aria-label={`${len} characters`}>
            {len.toLocaleString()} ch
          </span>
        )}
      </div>

      <div className="panel-body">
        <textarea
          id="raw-stream-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            variant === 'fmv'
              ? `Paste captured raw data — same layout as the copybook fields (character positions line up).\n\nDisplay PICs: plain text. COMP-3: hex pairs per byte (e.g. 01234C).`
              : `Paste the captured message stream here — same byte layout as the copybook.\n\nDisplay PICs: plain text. COMP-3: hex pairs per byte (e.g. 01234C).`
          }
          spellCheck={false}
          aria-label={variant === 'fmv' ? 'Raw message data' : 'Captured raw stream data'}
        />
      </div>
    </section>
  );
}
