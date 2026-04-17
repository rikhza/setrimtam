import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import StreamBuilderPage from './pages/StreamBuilderPage';
import FmvPage from './pages/FmvPage';
import JulianDatePage from './pages/JulianDatePage';

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
