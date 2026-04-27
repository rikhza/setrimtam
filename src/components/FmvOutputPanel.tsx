import type { BreakdownItem } from '../lib/cobolParser';
import { fieldDisplayName, unpackComp3 } from '../lib/cobolParser';

interface FmvOutputPanelProps {
  breakdown: BreakdownItem[];
  layoutReady: boolean;
  hasRaw: boolean;
}

function columnHeader(items: BreakdownItem[], index: number): string {
  const f = items[index].field;
  const name = fieldDisplayName(f);
  const sameNameBefore = items
    .slice(0, index)
    .filter((x) => fieldDisplayName(x.field) === name).length;
  const sameNameTotal = items.filter((x) => fieldDisplayName(x.field) === name).length;
  if (sameNameTotal <= 1) return name;
  return `${name} ·${sameNameBefore + 1}`;
}

function ValueCell({ item }: { item: BreakdownItem }) {
  const f = item.field;
  if (f.encoding === 'comp3') {
    const decoded = unpackComp3(item.value, f);
    const hex = item.value.match(/.{2}/g)?.join(' ') ?? item.value;
    const main = decoded ?? hex;
    return (
      <div className="fmv-pivot-cell-stack">
        <span className="fmv-pivot-primary">{main}</span>
        {decoded !== null && <span className="fmv-pivot-sub mono">{hex}</span>}
      </div>
    );
  }
  if (item.value === '') {
    return <span className="fmv-cell-muted">—</span>;
  }
  if (item.value.trim() === '') {
    return <span className="fmv-cell-muted">{item.value.length} spaces</span>;
  }
  return (
    <span className="fmv-pivot-text mono" title={item.value}>
      {item.value}
    </span>
  );
}

export default function FmvOutputPanel({ breakdown, layoutReady, hasRaw }: FmvOutputPanelProps) {
  const showTable = layoutReady && hasRaw && breakdown.length > 0;

  let emptyHint = '';
  if (!layoutReady) emptyHint = 'Parse copybook first.';
  else if (!hasRaw) emptyHint = 'Paste raw data.';

  return (
    <section className="panel panel-fmv-output" aria-label="Mapped message view">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <span>View</span>
          {showTable && (
            <span className="fmv-meta-pill" aria-label={`${breakdown.length} columns`}>
              {breakdown.length} columns
            </span>
          )}
        </div>
      </div>

      <div className="panel-body panel-body-fmv-table">
        {showTable ? (
          <div className="fmv-pivot-scroll">
            <table className="fmv-pivot-table">
              <thead>
                <tr>
                  {breakdown.map((item, i) => (
                    <th
                      key={`h-${item.field.name}-${item.position}-${i}`}
                      scope="col"
                      className="fmv-pivot-th"
                      title={`${item.field.pic}${item.field.encoding === 'comp3' ? ' · COMP-3' : ''}`}
                    >
                      <span className="fmv-pivot-th-name">{columnHeader(breakdown, i)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {breakdown.map((item, i) => (
                    <td key={`c-${item.field.name}-${item.position}-${i}`} className="fmv-pivot-td">
                      <ValueCell item={item} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fmv-table-empty">{emptyHint}</div>
        )}
      </div>
    </section>
  );
}
