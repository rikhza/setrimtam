import { useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import type { ToolsOutletContext } from '../toolOutletContext';

export default function Layout() {
  const { pathname } = useLocation();
  const toolsLayout = pathname.startsWith('/tools');
  const clearAllRef = useRef<(() => void) | null>(null);

  const registerClearAll = useCallback((fn: (() => void) | null) => {
    clearAllRef.current = fn;
  }, []);

  const runClearAll = useCallback(() => {
    clearAllRef.current?.();
  }, []);

  const outletContext: ToolsOutletContext = { registerClearAll };

  return (
    <div className="app-container">
      <Header onClearAll={runClearAll} />

      <div className={`main-outlet${toolsLayout ? ' main-outlet-tools' : ''}`}>
        <Outlet context={outletContext} />
      </div>

      <footer className="app-footer">
        Works offline. Last-opened drafts and optional named saves stay in this browser (localStorage); nothing
        is sent to a server.
      </footer>
    </div>
  );
}
