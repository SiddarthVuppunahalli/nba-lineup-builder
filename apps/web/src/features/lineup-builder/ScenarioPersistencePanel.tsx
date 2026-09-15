import type { SavedScenarioSummary } from '@lineup-engine/shared';
import { useState } from 'react';

interface ScenarioPersistencePanelProps {
  available: boolean;
  scenarios: SavedScenarioSummary[];
  activeScenarioId?: string;
  activeScenarioName?: string;
  versionCount: number;
  isPending: boolean;
  error?: string;
  onSave: (name: string) => void;
  onLoad: (scenarioId: string) => void;
}

export function ScenarioPersistencePanel({
  available,
  scenarios,
  activeScenarioId,
  activeScenarioName,
  versionCount,
  isPending,
  error,
  onSave,
  onLoad,
}: ScenarioPersistencePanelProps) {
  const [name, setName] = useState(activeScenarioName ?? 'My lineup scenario');

  return (
    <section className="roster-card persistence-card" aria-labelledby="persistence-title">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Durable recovery</span>
          <h2 id="persistence-title">Saved scenarios</h2>
        </div>
        <span className={`persistence-status ${available ? 'is-available' : ''}`}>
          {available ? 'Database ready' : 'Not configured'}
        </span>
      </div>
      {!available ? (
        <p className="session-notice">
          Session versions still work in this tab. Add a PostgreSQL database to save and reopen
          complete scenarios.
        </p>
      ) : (
        <>
          <div className="scenario-save-controls">
            <label>
              <span>Scenario name</span>
              <input
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              className="intent-button"
              type="button"
              disabled={isPending || versionCount === 0 || name.trim().length === 0}
              onClick={() => onSave(name.trim())}
            >
              {isPending ? 'Saving…' : activeScenarioId ? 'Update saved scenario' : 'Save scenario'}
            </button>
          </div>
          {versionCount === 0 ? (
            <p className="session-notice">
              Save at least one lineup version before saving a scenario.
            </p>
          ) : null}
          {error ? (
            <p className="persistence-error" role="alert">
              {error}
            </p>
          ) : null}
          {scenarios.length > 0 ? (
            <div className="saved-scenario-list" aria-label="Saved scenarios">
              {scenarios.map((scenario) => (
                <article key={scenario.id}>
                  <div>
                    <strong>{scenario.name}</strong>
                    <small>
                      {scenario.versionCount} version{scenario.versionCount === 1 ? '' : 's'} ·{' '}
                      updated {new Date(scenario.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => onLoad(scenario.id)}
                  >
                    {scenario.id === activeScenarioId ? 'Reload' : 'Open'}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="session-notice">
              No durable scenarios have been saved with this browser yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
