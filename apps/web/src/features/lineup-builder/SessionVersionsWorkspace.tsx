import type {
  CompareLineupsRequest,
  LineupIntentDto,
  RosterPlayerDto,
} from '@lineup-engine/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, postLineupComparison } from '../../api/client.ts';
import { FullComparisonPanel } from './FullComparisonPanel.tsx';
import { IntentControls } from './IntentControls.tsx';
import { balancedIntent } from './intent-config.ts';
import type { SessionLineupVersion } from './session-version.ts';

interface SessionVersionsWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  versions: SessionLineupVersion[];
  onBranch: (version: SessionLineupVersion) => void;
  onDelete: (versionId: string) => void;
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
}: SessionVersionsWorkspaceProps) {
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
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
      <section className="roster-card versions-card" aria-labelledby="versions-title">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">This browser tab only</span>
            <h2 id="versions-title">Session versions</h2>
          </div>
          <span className="version-count">{versions.length}</span>
        </div>
        <p className="session-notice">
          These versions disappear when you refresh or close this tab. Durable saving arrives in
          Phase 9.
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

      <form className="roster-card comparison-form" onSubmit={handleSubmit(compare)}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Side by side</span>
            <h2>Compare two versions</h2>
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

      {mutation.error ? (
        <section className="analysis-card analysis-error" role="alert">
          <div className="eyebrow">Comparison unavailable</div>
          <h2>We couldn’t compare those versions.</h2>
          <p>{comparisonError(mutation.error)}</p>
        </section>
      ) : mutation.data && before && after ? (
        <FullComparisonPanel
          response={mutation.data}
          beforeName={before.name}
          afterName={after.name}
          roster={roster}
        />
      ) : null}
    </div>
  );
}
