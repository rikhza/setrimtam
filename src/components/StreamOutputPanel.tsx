import { useRef, useState } from 'react';
import type { CobolField, BreakdownItem } from '../lib/cobolParser';
import { fieldDisplayName, unpackComp3 } from '../lib/cobolParser';
import TerminalPreview from './TerminalPreview';

interface StreamOutputPanelProps {
  stream: string;
  breakdown: BreakdownItem[];
  totalBytes: number;
  fields: CobolField[];
  onCopyStream: () => void;
  onCopyHex: () => void;
  onHighlightField: (name: string | null) => void;
}

function describeDisplayValue(value: string, length: number): string {
  if (value === '') return `[empty, ${length}B]`;
  if (value.trim() === '') {
    const count = value.length;
    return `[${count} space${count === 1 ? '' : 's'}]`;
  }
  return `'${value}'`;
}

/** Format breakdown position label: shows byte offset + char offset if different (COMP-3). */
function formatPosition(item: BreakdownItem): string {
  if (item.field.encoding === 'comp3') {
    return `+${item.byteOffset}B (+${item.position}ch)`;
  }
  return `+${item.byteOffset}`;
}

/** Format field length label for the detail bar. */
function formatFieldLength(field: CobolField): string {
  if (field.encoding === 'comp3') {
    return `${field.length}B packed`;
  }
  return `${field.length}B`;
}

export default function StreamOutputPanel({
  stream,
  breakdown,
  totalBytes,
  fields,
  onCopyStream,
  onCopyHex,
  onHighlightField,
}: StreamOutputPanelProps) {
  const rawWrapperRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<BreakdownItem | null>(null);

  function handleCopyStream() {
    onCopyStream();
    if (rawWrapperRef.current) {
      rawWrapperRef.current.classList.add('copy-flash');
      setTimeout(() => rawWrapperRef.current?.classList.remove('copy-flash'), 600);
    }
  }

  const hasSegments = breakdown.length > 0 && stream.length > 0;

  // For COMP-3 hover: decode packed hex back to numeric
  const hoveredComp3Value =
    hoveredItem?.field.encoding === 'comp3'
      ? unpackComp3(hoveredItem.value, hoveredItem.field)
      : null;

  return (
    <section className="panel panel-output" aria-label="Stream output">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Stream</span>
          {totalBytes > 0 && (
            <span className="stream-length" aria-label={`${totalBytes} bytes total`}>
              {totalBytes} B
            </span>
          )}
        </div>

        <div className="panel-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Copy stream to clipboard"
            onClick={handleCopyStream}
            disabled={!stream}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Copy hex representation (COMP-3 fields shown as packed bytes)"
            onClick={onCopyHex}
            disabled={!stream}
          >
            HEX
          </button>
        </div>
      </div>

      <div className="panel-body">
        {/* Raw Stream — segmented by field when breakdown is available */}
        <div className="stream-section">
          <div className="stream-label">
            <span>Raw Stream</span>
            {hasSegments && (
              <span className="stream-label-hint">hover segment to inspect</span>
            )}
          </div>
          <div ref={rawWrapperRef} className="stream-raw-wrapper">
            <pre className="stream-raw" aria-label="Raw message stream">
              {hasSegments ? (
                breakdown.map((item, i) => {
                  const segment = stream.slice(item.position, item.position + item.field.charLength);
                  const isHovered = hoveredItem === item;
                  const segClass = [
                    'stream-segment',
                    item.field.isFiller ? 'filler' : '',
                    item.field.encoding === 'comp3' ? 'comp3' : '',
                    isHovered ? 'hovered' : '',
                    i % 2 === 0 ? 'even' : 'odd',
                  ].filter(Boolean).join(' ');

                  return (
                    <span
                      key={`${item.field.name}-${item.position}-${i}`}
                      className={segClass}
                      onMouseEnter={() => {
                        setHoveredItem(item);
                        if (!item.field.isFiller) onHighlightField(item.field.name);
                      }}
                      onMouseLeave={() => {
                        setHoveredItem(null);
                        onHighlightField(null);
                      }}
                    >
                      {segment}
                    </span>
                  );
                })
              ) : (
                stream
              )}
            </pre>
          </div>

          {/* Inline segment detail — shown on hover */}
          <div
            className={`stream-segment-detail${hoveredItem ? ' visible' : ''}`}
            aria-live="polite"
          >
            {hoveredItem ? (
              <>
                <span className="ssd-name">{fieldDisplayName(hoveredItem.field)}</span>
                <span className="ssd-sep" aria-hidden="true">·</span>

                {hoveredItem.field.encoding === 'comp3' ? (
                  /* COMP-3: show encoding badge + packed hex + decoded numeric */
                  <>
                    <span className="ssd-badge-comp3" title="COMP-3 packed decimal">COMP-3</span>
                    <span className="ssd-sep" aria-hidden="true">·</span>
                    <span className="ssd-value ssd-hex" title="Packed hex bytes">
                      {hoveredItem.value.match(/.{2}/g)?.join(' ') ?? hoveredItem.value}
                    </span>
                    {hoveredComp3Value !== null && (
                      <>
                        <span className="ssd-sep" aria-hidden="true">→</span>
                        <span className="ssd-numeric" title="Decoded numeric value">{hoveredComp3Value}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="ssd-value">
                    {describeDisplayValue(hoveredItem.value, hoveredItem.field.length)}
                  </span>
                )}

                <span className="ssd-sep" aria-hidden="true">·</span>
                <span className="ssd-meta ssd-pos" title="Byte offset in record">
                  {formatPosition(hoveredItem)}
                </span>
                <span className="ssd-sep" aria-hidden="true">·</span>
                <span className="ssd-meta" title="Field storage size">
                  {formatFieldLength(hoveredItem.field)}
                </span>
              </>
            ) : (
              hasSegments && (
                <span className="ssd-hint">Hover a segment to inspect field details</span>
              )
            )}
          </div>
        </div>

        {/* Field Breakdown Map */}
        {hasSegments && (
          <div className="stream-section stream-section-map">
            <div className="stream-label">Copybook Map</div>
            <div className="stream-map">
              {breakdown.map((item, i) => (
                <div
                  key={`map-${item.field.name}-${i}`}
                  className={[
                    'stream-map-row',
                    item.field.isFiller ? 'filler' : '',
                    item.field.encoding === 'comp3' ? 'comp3' : '',
                    hoveredItem === item ? 'hovered' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => {
                    setHoveredItem(item);
                    if (!item.field.isFiller) onHighlightField(item.field.name);
                  }}
                  onMouseLeave={() => {
                    setHoveredItem(null);
                    onHighlightField(null);
                  }}
                >
                  <span className="smr-offset" title="Byte offset">+{item.byteOffset}</span>
                  <span className="smr-name">{fieldDisplayName(item.field)}</span>
                  <div className="smr-badges">
                    {item.field.encoding === 'comp3' && (
                      <span className="smr-badge comp3">C3</span>
                    )}
                    <span className={`smr-badge type-${item.field.type}`}>
                      {item.field.type === 'alpha' ? 'X' : '9'}
                    </span>
                    {item.field.decimals > 0 && (
                      <span className="smr-badge decimal">V{item.field.decimals}</span>
                    )}
                    {item.field.signed && (
                      <span className="smr-badge signed">S</span>
                    )}
                  </div>
                  <span className="smr-pic">{item.field.pic}</span>
                  <span className="smr-len">{item.field.length}B</span>
                  <span className="smr-value" title={
                    item.field.encoding === 'comp3'
                      ? `Packed: ${item.value}`
                      : item.value
                  }>
                    {item.field.encoding === 'comp3'
                      ? (() => {
                          const decoded = unpackComp3(item.value, item.field);
                          return decoded !== null
                            ? decoded
                            : item.value.match(/.{2}/g)?.join(' ') ?? item.value;
                        })()
                      : item.value.trim() === ''
                        ? <span className="smr-empty">[spaces]</span>
                        : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminal Preview */}
        <TerminalPreview stream={stream} fields={fields} />
      </div>
    </section>
  );
}
