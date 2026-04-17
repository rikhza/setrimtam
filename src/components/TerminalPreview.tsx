import { useRef, useState } from 'react';
import type { CobolField } from '../lib/cobolParser';

interface TerminalPreviewProps {
  stream: string;
  fields: CobolField[];
}

const COLS = 80;
const ROWS = 24;

export default function TerminalPreview({ stream, fields }: TerminalPreviewProps) {
  const [cursorInfo, setCursorInfo] = useState('');
  const containerRef = useRef<HTMLPreElement>(null);

  function formatStreamForTerminal(s: string): string {
    let formatted = '';
    for (let i = 0; i < s.length; i += COLS) {
      formatted += s.substring(i, Math.min(i + COLS, s.length)) + '\n';
    }
    return formatted;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLPreElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const charWidth = 6.6;
    const charHeight = 14.3;

    const x = e.clientX - rect.left - 10;
    const y = e.clientY - rect.top - 8;

    const col = Math.floor(Math.max(0, x) / charWidth);
    const row = Math.floor(Math.max(0, y) / charHeight);

    if (col < COLS && row < ROWS) {
      const streamPos = row * COLS + col;
      if (streamPos < stream.length) {
        let accPos = 0;
        for (const f of fields) {
          if (streamPos >= accPos && streamPos < accPos + f.length) {
            setCursorInfo(`[${row + 1},${col + 1}] Pos:${streamPos} → ${f.name}`);
            return;
          }
          accPos += f.length;
        }
      } else {
        setCursorInfo(`[${row + 1},${col + 1}] Empty space`);
      }
    }
  }

  function handleMouseLeave() {
    setCursorInfo('');
  }

  return (
    <div className="stream-section">
      <div className="stream-label">
        Terminal Preview (24×80)
        <span className="terminal-cursor-info" aria-live="polite">
          {cursorInfo}
        </span>
      </div>

      <div className="terminal-wrapper">
        <div className="terminal-frame">
          <div className="terminal-bar">
            <span className="terminal-dot red" aria-hidden="true" />
            <span className="terminal-dot yellow" aria-hidden="true" />
            <span className="terminal-dot green" aria-hidden="true" />
            <span className="terminal-title">3270 Terminal — VTAM</span>
          </div>
          <pre
            ref={containerRef}
            className="terminal-screen"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-label="Terminal preview of VTAM stream"
          >
            {stream ? formatStreamForTerminal(stream) : ''}
          </pre>
        </div>
      </div>
    </div>
  );
}
