import type { LineupIntentDto, RepairLineupRequest, RosterPlayerDto } from '@lineup-engine/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, postLineupRepair } from '../../api/client.ts';
import { AnalysisPanel } from './AnalysisPanel.tsx';
import { ComparisonPanel } from './ComparisonPanel.tsx';
import { IntentControls } from './IntentControls.tsx';
import { balancedIntent } from './intent-config.ts';
import { NaturalLanguageIntent } from './NaturalLanguageIntent.tsx';
import type { SessionVersionDraft } from './session-version.ts';

interface RepairWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  currentPlayerIds: string[];
  onSaveVersion: (version: SessionVersionDraft) => Promise<void>;
  durableVersionSaving: boolean;
  defaultMinimumShooters?: number;
  defaultMinimumCreators?: number;
  onEditStartingFive: () => void;
}

function errorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

function errorDetails(error: Error | null): string[] {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) return [];
  return error.details.flatMap((detail) => {
    if (typeof detail !== 'object' || detail === null) return [];
    if ('description' in detail && typeof detail.description === 'string')
      return [detail.description];
    if ('message' in detail && typeof detail.message === 'string') return [detail.message];
    return [];
  });
}

export function RepairWorkspace({
  teamId,
  roster,
  currentPlayerIds,
  onSaveVersion,
  durableVersionSaving,
  defaultMinimumShooters = balancedIntent.minimumShooters,
  defaultMinimumCreators = balancedIntent.minimumCreators,
  onEditStartingFive,
}: RepairWorkspaceProps) {
  const initialIntent: LineupIntentDto = {
    ...balancedIntent,
    minimumShooters: defaultMinimumShooters,
    minimumCreators: defaultMinimumCreators,
  };
  const mutation = useMutation({ mutationFn: postLineupRepair });
  const resetRepair = mutation.reset;
  const { control, register, handleSubmit, reset, setValue } = useForm<LineupIntentDto>({
    defaultValues: initialIntent,
  });
  const values = useWatch({ control });
  const initialized = useRef(false);
  const editorRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    resetRepair();
  }, [values, currentPlayerIds, resetRepair]);

  function submit(intent: LineupIntentDto) {
    const request: RepairLineupRequest = { teamId, currentPlayerIds, intent };
    mutation.mutate(request);
  }

  function togglePlayer(field: 'requiredPlayerIds' | 'excludedPlayerIds', playerId: string) {
    const selected = values[field] ?? [];
    if (field === 'requiredPlayerIds' && !selected.includes(playerId) && selected.length >= 5)
      return;
    setValue(
      field,
      selected.includes(playerId)
        ? selected.filter((id) => id !== playerId)
        : [...selected, playerId],
      { shouldDirty: true },
    );
  }

  const response = mutation.data;
  const analysis = response
    ? { lineup: response.repair.after.lineup, analysis: response.repair.after.analysis }
    : undefined;

  return (
    <div className="repair-workflow">
      <header className="workflow-intro">
        <span className="panel-kicker">Repair a lineup</span>
        <h1>Keep the core. Fix the fit.</h1>
        <p>
          Confirm the five you are starting from, describe the new intent, then inspect every
          change.
        </p>
      </header>

      <form
        className="roster-card generation-form repair-editor"
        onSubmit={handleSubmit(submit)}
        ref={editorRef}
        tabIndex={-1}
      >
        <div className="panel-header">
          <div>
            <span className="step-label">
              <b>1</b> Starting five
            </span>
            <h2>Confirm the lineup to repair</h2>
          </div>
          <button className="text-button" type="button" onClick={onEditStartingFive}>
            Edit in Build
          </button>
        </div>

        <div className="repair-starting-five">
          <span>Starting five</span>
          <strong>
            {currentPlayerIds
              .map((id) => roster.find((player) => player.id === id)?.name ?? id)
              .join(' · ')}
          </strong>
        </div>

        <section className="repair-intent" aria-labelledby="repair-intent-title">
          <div className="repair-section-heading">
            <div>
              <span className="step-label">
                <b>2</b> New intent
              </span>
              <h2 id="repair-intent-title">Describe what needs to change</h2>
            </div>
            <button className="text-button" type="button" onClick={() => reset(initialIntent)}>
              Reset intent
            </button>
          </div>

          <NaturalLanguageIntent key={teamId} teamId={teamId} onApply={(intent) => reset(intent)} />

          <details className="advanced-intent">
            <summary>
              <span>
                <strong>Configure intent</strong>
                <small>Priorities, hard requirements, score floors, and player rules</small>
              </span>
              <span aria-hidden="true">+</span>
            </summary>
            <IntentControls
              roster={roster}
              register={register}
              requiredPlayerIds={values.requiredPlayerIds ?? []}
              excludedPlayerIds={values.excludedPlayerIds ?? []}
              onTogglePlayer={togglePlayer}
            />
          </details>
        </section>

        <div className="roster-actions">
          <p>
            <strong>3 · Run repair.</strong> Fewest swaps first, then the strongest fit among
            equally small changes.
          </p>
          <button className="analyze-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Repairing…' : 'Repair lineup'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>

      <div className="generation-result build-results repair-results" aria-live="polite">
        {response && <ComparisonPanel response={response} roster={roster} />}
        {mutation.isPending || mutation.error || response ? (
          <AnalysisPanel
            analysis={analysis}
            error={errorMessage(mutation.error)}
            errorDetails={errorDetails(mutation.error)}
            isPending={mutation.isPending}
            roster={roster}
            selectedPlayerIds={response?.repair.after.lineup.playerIds ?? currentPlayerIds}
            onRetry={() => void handleSubmit(submit)()}
            canRetry={!mutation.isPending}
            resultContext={
              response
                ? {
                    objectiveScore: response.repair.after.objectiveScore,
                    constraints: response.repair.after.constraints,
                    evaluatedCandidateCount: response.evaluatedCandidateCount,
                    validCandidateCount: response.validCandidateCount,
                    usedBalancedDefault: response.usedBalancedDefault,
                    ...(response.search ? { search: response.search } : {}),
                  }
                : undefined
            }
            mode="repair"
            onBackToEditing={() => {
              const editor = editorRef.current;
              if (!editor) return;
              editor.focus({ preventScroll: true });
              const reducedMotion =
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              editor.scrollIntoView({
                behavior: reducedMotion ? 'auto' : 'smooth',
                block: 'start',
              });
            }}
            versionSave={
              response
                ? {
                    suggestedName: 'Repaired lineup',
                    durable: durableVersionSaving,
                    onSave: (name) =>
                      onSaveVersion({
                        name,
                        playerIds: response.repair.after.lineup.playerIds,
                        source: 'repaired',
                        analysis: {
                          lineup: response.repair.after.lineup,
                          analysis: response.repair.after.analysis,
                        },
                        intent: mutation.variables?.intent ?? initialIntent,
                        repair: {
                          startingPlayerIds: [...currentPlayerIds] as [
                            string,
                            string,
                            string,
                            string,
                            string,
                          ],
                          removedPlayerIds: response.repair.removedPlayerIds,
                          addedPlayerIds: response.repair.addedPlayerIds,
                          swapCount: response.repair.swapCount,
                        },
                      }),
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
