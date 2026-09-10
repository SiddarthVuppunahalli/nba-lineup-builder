import { healthResponseSchema, type HealthResponse } from '@lineup-engine/shared';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';

async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error('The API did not respond successfully.');
  }

  return healthResponseSchema.parse(await response.json());
}

function StatusPill() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: getHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const label = health.isPending
    ? 'Checking system'
    : health.isError
      ? 'API unavailable'
      : 'System ready';

  return (
    <div className={`status-pill ${health.isError ? 'status-pill--error' : ''}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

function HomePage() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Lineup Engine home">
          <span className="brand-mark" aria-hidden="true">
            LE
          </span>
          <span>Lineup Engine</span>
        </a>
        <StatusPill />
      </nav>

      <section className="hero">
        <div className="eyebrow">Deterministic basketball intelligence</div>
        <h1>
          Build a lineup
          <span> by intent.</span>
        </h1>
        <p className="hero-copy">
          Describe the outcome you want. Lineup Engine will turn it into a valid five-player lineup,
          check every constraint, and explain the tradeoffs.
        </p>

        <div className="intent-preview" aria-label="Future lineup intent preview">
          <div className="preview-label">What are you trying to build?</div>
          <p>A switchable small-ball lineup with elite shooting and at least two creators.</p>
          <button type="button" disabled title="Available after the engine phases">
            Generate lineup
            <span aria-hidden="true">→</span>
          </button>
          <small>Generation unlocks after the basketball engine is complete.</small>
        </div>
      </section>

      <section className="flow" aria-labelledby="flow-title">
        <div>
          <div className="eyebrow">The product loop</div>
          <h2 id="flow-title">Automation you can inspect.</h2>
        </div>
        <ol className="flow-steps">
          {['Intent', 'Generate', 'Evaluate', 'Validate', 'Repair', 'Explain'].map(
            (step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {step}
              </li>
            ),
          )}
        </ol>
      </section>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
