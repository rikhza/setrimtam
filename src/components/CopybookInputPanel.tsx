import { useRef, useEffect } from 'react';

interface CopybookInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onParse: (text: string) => void;
  /** Focus textarea on mount (default true). Set false on secondary tool pages. */
  autoFocus?: boolean;
  /** Panel title in header (default: COBOL Copybook). */
  heading?: string;
}

export default function CopybookInputPanel({
  value,
  onChange,
  onParse,
  autoFocus = true,
  heading = 'COBOL Copybook',
}: CopybookInputPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onParse(value);
    }
  }

  return (
    <section className="panel panel-input" aria-label={heading}>
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>{heading}</span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          title="Parse (Ctrl+Enter)"
          onClick={() => onParse(value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Parse
        </button>
      </div>

      <div className="panel-body">
        <textarea
          ref={textareaRef}
          id="copybook-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste your COBOL copybook here...\n\nExample:\n       01  MY-RECORD.\n           05  FIELD-A           PIC X(4).\n           05  FIELD-B           PIC X(5).\n           05  FIELD-C           PIC 9(3).\n           ...`}
          spellCheck={false}
          aria-label="COBOL copybook source"
        />
      </div>
    </section>
  );
}
