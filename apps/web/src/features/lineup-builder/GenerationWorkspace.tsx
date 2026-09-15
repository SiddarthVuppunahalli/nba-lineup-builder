import type {
  GenerateLineupRequest,
  GeneratedLineupResponse,
  LineupIntentDto,
  RosterPlayerDto,
} from '@lineup-engine/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, postLineupGeneration } from '../../api/client.ts';
import { AnalysisPanel } from './AnalysisPanel.tsx';
import { IntentControls } from './IntentControls.tsx';
import { balancedIntent } from './intent-config.ts';
import { NaturalLanguageIntent } from './NaturalLanguageIntent.tsx';

interface GenerationWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  onGeneratedLineup: (playerIds: string[]) => void;
  onSaveVersion: (name: string, playerIds: readonly string[]) => void;
  isBoundedSearch: boolean;
  defaultMinimumShooters?: number;
  defaultMinimumCreators?: number;
}

function errorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

function generationErrorDetails(error: Error | null): string[] {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) return [];
  return error.details.flatMap((detail) => {
    if (
      typeof detail === 'object' &&
      detail !== null &&
      'description' in detail &&
      typeof detail.description === 'string'
    ) {
      return [detail.description];
    }
    return [];
  });
}

export function GenerationWorkspace({
  teamId,
  roster,
  onGeneratedLineup,
  onSaveVersion,
  isBoundedSearch,
  defaultMinimumShooters = balancedIntent.minimumShooters,
  defaultMinimumCreators = balancedIntent.minimumCreators,
}: GenerationWorkspaceProps) {
  const initialIntent: LineupIntentDto = {
    ...balancedIntent,
    minimumShooters: defaultMinimumShooters,
    minimumCreators: defaultMinimumCreators,
  };
  const mutation = useMutation({
    mutationFn: postLineupGeneration,
    onSuccess: (response) => onGeneratedLineup([...response.winner.lineup.playerIds]),
  });
  const resetGeneration = mutation.reset;
  const { control, register, handleSubmit, reset, setValue } = useForm<LineupIntentDto>({
    defaultValues: initialIntent,
  });
  const values = useWatch({ control });
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    resetGeneration();
  }, [values, resetGeneration]);

  function submit(intent: LineupIntentDto) {
    const request: GenerateLineupRequest = { teamId, intent };
    mutation.mutate(request);
  }

  function togglePlayer(field: 'requiredPlayerIds' | 'excludedPlayerIds', playerId: string) {
    const selected = values[field] ?? [];
    const next = selected.includes(playerId)
      ? selected.filter((id) => id !== playerId)
      : [...selected, playerId];
    setValue(field, next, { shouldDirty: true });
  }

  const response: GeneratedLineupResponse | undefined = mutation.data;
  const analysis = response
    ? { lineup: response.winner.lineup, analysis: response.winner.analysis }
    : undefined;

  return (
    <div className="builder-layout generation-layout">
      <form className="roster-card generation-form" onSubmit={handleSubmit(submit)}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Structured intent</span>
            <h2>Shape your best five</h2>
          </div>
          <button className="text-button" type="button" onClick={() => reset(initialIntent)}>
            Reset
          </button>
        </div>

        <NaturalLanguageIntent key={teamId} teamId={teamId} onApply={(intent) => reset(intent)} />

        <IntentControls
          roster={roster}
          register={register}
          requiredPlayerIds={values.requiredPlayerIds ?? []}
          excludedPlayerIds={values.excludedPlayerIds ?? []}
          onTogglePlayer={togglePlayer}
        />

        <div className="roster-actions">
          <p>
            {isBoundedSearch
              ? 'Builds a deterministic 18-player shortlist, then checks every five within that bound.'
              : 'Searches every five-player combination in this roster.'}
          </p>
          <button
            className="analyze-button"
            type="submit"
            disabled={mutation.isPending || roster.length < 5}
          >
            {mutation.isPending ? 'Generating…' : 'Generate lineup'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>

      <div className="generation-result">
        <AnalysisPanel
          analysis={analysis}
          error={errorMessage(mutation.error)}
          errorDetails={generationErrorDetails(mutation.error)}
          isPending={mutation.isPending}
          roster={roster}
          selectedPlayerIds={response?.winner.lineup.playerIds ?? []}
          onRetry={() => void handleSubmit(submit)()}
          canRetry={!mutation.isPending && roster.length >= 5}
          resultContext={
            response
              ? {
                  objectiveScore: response.winner.objectiveScore,
                  constraints: response.winner.constraints,
                  evaluatedCandidateCount: response.evaluatedCandidateCount,
                  validCandidateCount: response.validCandidateCount,
                  usedBalancedDefault: response.usedBalancedDefault,
                  ...(response.search ? { search: response.search } : {}),
                }
              : undefined
          }
          mode="generation"
          versionSave={
            response
              ? {
                  suggestedName: 'Generated lineup',
                  onSave: (name) => onSaveVersion(name, response.winner.lineup.playerIds),
                }
              : undefined
          }
        />
        {response && response.alternatives.length > 0 && (
          <section className="alternatives-card" aria-labelledby="alternatives-title">
            <span className="panel-kicker">Also considered</span>
            <h2 id="alternatives-title">Top alternatives</h2>
            {response.alternatives.map((candidate, index) => (
              <div className="alternative-row" key={candidate.lineup.playerIds.join('|')}>
                <span>#{index + 2}</span>
                <div>
                  <strong>
                    {candidate.lineup.playerIds
                      .map((id) => roster.find((player) => player.id === id)?.name)
                      .join(' · ')}
                  </strong>
                  <small>Fit score {candidate.objectiveScore}</small>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
