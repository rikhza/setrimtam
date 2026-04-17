import type { CobolField } from '../lib/cobolParser';
import FieldItem from './FieldItem';

interface FieldsFormPanelProps {
  fields: CobolField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onFillExample: () => void;
  onClearForm: () => void;
  formPulse: boolean;
  highlightedField: string | null;
}

export default function FieldsFormPanel({
  fields,
  values,
  onChange,
  onFillExample,
  onClearForm,
  formPulse,
  highlightedField,
}: FieldsFormPanelProps) {
  const panelClass = ['panel panel-form', formPulse ? 'pulse-glow' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <section className={panelClass} aria-label="Field Input Form">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <span>Field Input</span>
          {fields.length > 0 && (
            <span className="field-count">{fields.length} Fields</span>
          )}
        </div>

        <div className="panel-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Fill with example data"
            onClick={onFillExample}
            disabled={fields.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Fill Example</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Clear form values"
            onClick={onClearForm}
            disabled={fields.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="panel-body">
        {fields.length === 0 ? (
          <div className="form-container">
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <p>
                Paste a COBOL copybook on the left and click <strong>Parse</strong>
              </p>
            </div>
          </div>
        ) : (
          <div className="form-container">
            {fields.map((field, index) => (
              <FieldItem
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                onChange={onChange}
                isHighlighted={highlightedField === field.name}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
