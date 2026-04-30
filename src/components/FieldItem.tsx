import { useRef, useEffect, memo } from 'react';
import type { CobolField } from '../lib/cobolParser';

interface FieldItemProps {
  field: CobolField;
  value: string;
  onChange: (name: string, value: string) => void;
  isHighlighted: boolean;
  index: number;
}

function FieldItem({
  field,
  value,
  onChange,
  isHighlighted,
  index,
}: FieldItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isComp3 = field.encoding === 'comp3';

  // Overflow logic differs for COMP-3 vs display fields
  let isOverflow = false;
  let isWarn = false;

  if (isComp3) {
    // For COMP-3: check integer digits don't exceed available integer positions
    const dotIdx = value.indexOf('.');
    const intPart = dotIdx >= 0 ? value.slice(0, dotIdx) : value;
    const intDigitCount = intPart.replace(/[^0-9]/g, '').length;
    const maxIntDigits = field.picInfo.length - field.decimals;
    isOverflow = intDigitCount > maxIntDigits;
  } else {
    const currentLen = value.length;
    isOverflow = currentLen > field.length;
    isWarn = !isOverflow && field.type === 'alpha' && currentLen === field.length;
  }

  const currentLen = value.length;

  useEffect(() => {
    if (isHighlighted && inputRef.current) {
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  const inputClassName = [
    'field-input',
    isOverflow ? 'overflow' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const countClassName = [
    'field-char-count',
    isOverflow ? 'error' : '',
    isWarn ? 'warn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Build placeholder text
  let placeholder: string;
  if (field.defaultValue) {
    placeholder = `Default: ${field.defaultValue}`;
  } else if (isComp3) {
    const intDigits = field.picInfo.length - field.decimals;
    placeholder =
      field.decimals > 0
        ? `Enter number (${intDigits} int + ${field.decimals} dec digits)`
        : `Enter ${field.picInfo.length}-digit number`;
  } else if (field.type === 'numeric') {
    placeholder =
      field.decimals > 0
        ? `Enter number (${field.length - field.decimals} int + ${field.decimals} dec digits)`
        : `Enter ${field.length}-digit number`;
  } else {
    placeholder = `Enter text (${field.length} chars max)`;
  }

  // Counter display for COMP-3 vs display
  const counterText = isComp3
    ? `→ ${field.charLength} hex chars (${field.length}B)`
    : `${currentLen} / ${field.length}`;

  return (
    <div
      className="field-group"
      style={{ animationDelay: `${Math.min(index * 20, 500)}ms` }}
    >
      <div className="field-label">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="field-name">{field.name}</span>
          {(field.occurs > 1 || (field.occurrenceIndex ?? 0) > 0) && (
            <span className="field-occurs-badge">
              [{field.occurrenceIndex}]
            </span>
          )}
        </div>
        <div className="field-meta">
          {isComp3 && (
            <span className="field-type-badge comp3" title="COMP-3 packed decimal">COMP-3</span>
          )}
          <span className={`field-type-badge ${field.type}`}>{field.type}</span>
          <span className="field-pic">{field.pic}</span>
          <span className="field-length" title={isComp3 ? `${field.picInfo.length} digits → ${field.length} bytes packed` : undefined}>
            {isComp3 ? `${field.length}B` : `${field.length}B`}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode={field.type === 'numeric' ? 'numeric' : 'text'}
        className={inputClassName}
        id={`input-${field.name}`}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={placeholder}
        style={
          isHighlighted
            ? { boxShadow: '0 0 0 2px var(--accent-blue)' }
            : undefined
        }
        aria-label={`${field.name} (${field.type}, ${isComp3 ? `${field.picInfo.length} digits COMP-3` : `${field.length} bytes`})`}
      />

      <div className="field-input-info">
        <span className="field-msg" />
        <span className={countClassName}>
          {counterText}
        </span>
      </div>

      {field.conditions.length > 0 && (
        <div className="field-conditions">
          Valid:{' '}
          {field.conditions.map((c, i) => (
            <span key={i}>
              <span>{c.value}</span> ({c.name})
              {i < field.conditions.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(FieldItem);
