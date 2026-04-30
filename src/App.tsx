import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const HomePage = lazy(() => import('./pages/HomePage'));
const StreamBuilderPage = lazy(() => import('./pages/StreamBuilderPage'));
const FmvPage = lazy(() => import('./pages/FmvPage'));
const JulianDatePage = lazy(() => import('./pages/JulianDatePage'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minHeight: 0,
      color: 'var(--text-muted)',
      fontSize: 13,
      fontFamily: "'Inter', sans-serif",
    }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tools" element={<Navigate to="/tools/stream" replace />} />
            <Route path="/tools/stream" element={<StreamBuilderPage />} />
            <Route path="/tools/fmv" element={<FmvPage />} />
            <Route path="/tools/julian" element={<JulianDatePage />} />
            <Route path="/tools/inspect" element={<Navigate to="/tools/fmv" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}