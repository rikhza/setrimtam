import { useRef, useState, useMemo, useCallback } from 'react';
import type { CobolField } from '../lib/cobolParser';
import { fieldDisplayName } from '../lib/cobolParser';

interface TerminalPreviewProps {
  stream: string;
  fields: CobolField[];
}

const COLS = 80;
const ROWS = 24;

function formatStreamForTerminal(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += COLS) {
    out += s.substring(i, Math.min(i + COLS, s.length)) + '\n';
  }
  return out;
}

export default function TerminalPreview({ stream, fields }: TerminalPreviewProps) {
  const [cursorInfo, setCursorInfo] = useState('');
  const containerRef = useRef<HTMLPreElement>(null);
  const rafRef = useRef<number>(0);

  const formatted = useMemo(() => stream ? formatStreamForTerminal(stream) : '', [stream]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLPreElement>) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
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
              setCursorInfo(`[${row + 1},${col + 1}] Pos:${streamPos} → ${fieldDisplayName(f)}`);
              return;
            }
            accPos += f.length;
          }
        } else {
          setCursorInfo(`[${row + 1},${col + 1}] Empty space`);
        }
      }
    });
  }, [stream, fields]);

  function handleMouseLeave() {
    cancelAnimationFrame(rafRef.current);
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
            <span className="terminal-title">Terminal preview (24×80)</span>
          </div>
          <pre
            ref={containerRef}
            className="terminal-screen"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-label="Terminal preview of message stream"
          >
            {formatted}
          </pre>
        </div>
      </div>
    </div>
  );
}
