import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';

import { fetchHealth } from './api/client.ts';
import { LineupBuilderPage } from './features/lineup-builder/LineupBuilderPage.tsx';

function StatusPill() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const label = health.isPending
    ? 'Checking system'
    : health.isError
      ? 'Service unavailable'
      : 'System ready';

  return (
    <div className={`status-pill ${health.isError ? 'status-pill--error' : ''}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

function AppShell() {
  return (
    <>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Lineup Engine home">
          <span className="brand-mark" aria-hidden="true">
            LE
          </span>
          <span>Lineup Engine</span>
        </a>
        <span className="nav-context">Basketball, in balance</span>
        <StatusPill />
      </nav>
      <LineupBuilderPage />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
