import type {
  CompareLineupsRequest,
  LineupIntentDto,
  RosterPlayerDto,
} from '@lineup-engine/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, postLineupComparison } from '../../api/client.ts';
import { FullComparisonPanel } from './FullComparisonPanel.tsx';
import { IntentControls } from './IntentControls.tsx';
import { balancedIntent } from './intent-config.ts';
import type { SessionLineupVersion } from './session-version.ts';
import type { SavedScenarioSummary } from '@lineup-engine/shared';
import { ScenarioPersistencePanel } from './ScenarioPersistencePanel.tsx';

interface SessionVersionsWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  versions: SessionLineupVersion[];
  onBranch: (version: SessionLineupVersion) => void;
  onDelete: (versionId: string) => void;
  persistence: {
    available: boolean;
    scenarios: SavedScenarioSummary[];
    activeScenarioId?: string;
    activeScenarioName?: string;
    isPending: boolean;
    error?: string;
    onSave: (name: string) => void;
    onLoad: (scenarioId: string) => void;
  };
}

function comparisonError(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup comparison is temporarily unavailable. Please try again.';
}

export function SessionVersionsWorkspace({
  teamId,
  roster,
  versions,
  onBranch,
  onDelete,
  persistence,
}: SessionVersionsWorkspaceProps) {
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const selectionRef = useRef<HTMLFormElement>(null);
  const mutation = useMutation({ mutationFn: postLineupComparison });
  const resetComparison = mutation.reset;
  const { control, register, handleSubmit } = useForm<LineupIntentDto>({
    defaultValues: balancedIntent,
  });
  const intent = useWatch({ control });

  const selectedBeforeId = versions.some((version) => version.id === beforeId)
    ? beforeId
    : (versions[0]?.id ?? '');
  const selectedAfterId = versions.some(
    (version) => version.id === afterId && version.id !== selectedBeforeId,
  )
    ? afterId
    : (versions.find((version) => version.id !== selectedBeforeId)?.id ?? '');

  useEffect(() => {
    resetComparison();
  }, [selectedBeforeId, selectedAfterId, intent, resetComparison]);

  const before = versions.find((version) => version.id === selectedBeforeId);
  const after = versions.find((version) => version.id === selectedAfterId);

  function compare(comparisonIntent: LineupIntentDto) {
    if (!before || !after || before.id === after.id) return;
    const request: CompareLineupsRequest = {
      teamId,
      beforePlayerIds: before.playerIds,
      afterPlayerIds: after.playerIds,
      intent: { ...comparisonIntent, requiredPlayerIds: [], excludedPlayerIds: [] },
    };
    mutation.mutate(request);
  }

  return (
    <div className="versions-workspace">
      <header className="workflow-intro compare-intro">
        <span className="panel-kicker">Compare lineups</span>
        <h1>Trace the decision, not just the score.</h1>
        <p>
          Open a saved scenario or use this session’s versions, choose two, then compare the same
          requirements across both.
        </p>
      </header>
      <ScenarioPersistencePanel
        key={persistence.activeScenarioId ?? 'new-scenario'}
        {...persistence}
        versionCount={versions.length}
      />
      <section className="roster-card versions-card" aria-labelledby="versions-title">
        <div className="panel-header">
          <div>
            <span className="step-label">
              <b>1</b> Version history
            </span>
            <h2 id="versions-title">Saved and session versions</h2>
          </div>
          <span className="version-count">{versions.length}</span>
        </div>
        <p className="session-notice">
          Versions remain editable in this tab. Save the scenario above to recover the complete
          history after a refresh.
        </p>

        {versions.length === 0 ? (
          <div className="versions-empty">
            <strong>No versions saved yet.</strong>
            <p>Analyze, generate, or repair a lineup, then save that result with a name.</p>
          </div>
        ) : (
          <div className="version-list">
            {versions.map((version) => {
              const parent = versions.find((candidate) => candidate.id === version.parentVersionId);
              return (
                <article className="version-row" key={version.id}>
                  <div>
                    <strong>{version.name}</strong>
                    <small>
                      {version.source}
                      {parent ? ` · branched from ${parent.name}` : ''}
                      {version.scoringVersion ? ` · ${version.scoringVersion}` : ''}
                    </small>
                    <span>
                      {version.playerIds
                        .map((id) => roster.find((player) => player.id === id)?.name ?? id)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="version-actions">
                    <button className="text-button" type="button" onClick={() => onBranch(version)}>
                      Branch from here
                    </button>
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      aria-label={`Delete ${version.name}`}
                      onClick={() => onDelete(version.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <form
        className="roster-card comparison-form"
        onSubmit={handleSubmit(compare)}
        ref={selectionRef}
        tabIndex={-1}
      >
        <div className="panel-header">
          <div>
            <span className="step-label">
              <b>2</b> Select versions
            </span>
            <h2>Choose the two lineups</h2>
          </div>
        </div>
        {versions.length < 2 ? (
          <p className="versions-empty">Save at least two versions to compare their decisions.</p>
        ) : (
          <>
            <div className="version-selectors">
              <label>
                <span>Starting version</span>
                <select
                  value={selectedBeforeId}
                  onChange={(event) => setBeforeId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option value={version.id} key={version.id}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Compared version</span>
                <select
                  value={selectedAfterId}
                  onChange={(event) => setAfterId(event.target.value)}
                >
                  {versions
                    .filter((version) => version.id !== selectedBeforeId)
                    .map((version) => (
                      <option value={version.id} key={version.id}>
                        {version.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {before && after ? (
              <div className="selected-comparison" aria-label="Selected comparison versions">
                <article>
                  <span>Starting version</span>
                  <strong>{before.name}</strong>
                  <small>
                    {before.playerIds
                      .map((id) => roster.find((player) => player.id === id)?.name ?? id)
                      .join(' · ')}
                  </small>
                </article>
                <span className="selected-comparison__arrow" aria-hidden="true">
                  →
                </span>
                <article>
                  <span>Compared version</span>
                  <strong>{after.name}</strong>
                  <small>
                    {after.playerIds
                      .map((id) => roster.find((player) => player.id === id)?.name ?? id)
                      .join(' · ')}
                  </small>
                </article>
              </div>
            ) : null}
            <details className="comparison-requirements">
              <summary>Comparison priorities and requirements</summary>
              <p>
                These settings evaluate both versions equally; they do not change either saved
                lineup.
              </p>
              <IntentControls
                roster={roster}
                register={register}
                requiredPlayerIds={[]}
                excludedPlayerIds={[]}
                onTogglePlayer={() => undefined}
                showPlayerRules={false}
              />
            </details>
            <button className="analyze-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Comparing…' : 'Compare versions'}{' '}
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </form>

      {mutation.isPending ? (
        <section className="analysis-card analysis-loading comparison-state" aria-live="polite">
          <span className="analysis-orbit" aria-hidden="true" />
          <div className="eyebrow">Comparing versions</div>
          <h2>Measuring every change…</h2>
          <p>Applying the same priorities and hard requirements to both lineups.</p>
        </section>
      ) : mutation.error ? (
        <section className="analysis-card analysis-error" role="alert">
          <div className="eyebrow">Comparison unavailable</div>
          <h2>We couldn’t compare those versions.</h2>
          <p>{comparisonError(mutation.error)}</p>
          <button
            className="retry-button"
            type="button"
            onClick={() => void handleSubmit(compare)()}
            disabled={!before || !after}
          >
            Retry comparison
          </button>
        </section>
      ) : mutation.data && before && after ? (
        <FullComparisonPanel
          response={mutation.data}
          beforeName={before.name}
          afterName={after.name}
          roster={roster}
          onBackToSelection={() => {
            const selection = selectionRef.current;
            if (!selection) return;
            selection.focus({ preventScroll: true });
            const reducedMotion =
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            selection.scrollIntoView({
              behavior: reducedMotion ? 'auto' : 'smooth',
              block: 'start',
            });
          }}
        />
      ) : null}
    </div>
  );
}
