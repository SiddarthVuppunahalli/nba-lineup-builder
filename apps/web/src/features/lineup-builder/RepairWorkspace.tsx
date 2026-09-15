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

interface RepairWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  currentPlayerIds: string[];
  onSaveVersion: (name: string, playerIds: readonly string[]) => void;
  defaultMinimumShooters?: number;
  defaultMinimumCreators?: number;
}

function errorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

function errorDetails(error: Error | null): string[] {
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

export function RepairWorkspace({
  teamId,
  roster,
  currentPlayerIds,
  onSaveVersion,
  defaultMinimumShooters = balancedIntent.minimumShooters,
  defaultMinimumCreators = balancedIntent.minimumCreators,
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
    <div className="builder-layout generation-layout">
      <form className="roster-card generation-form" onSubmit={handleSubmit(submit)}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Adapt your lineup</span>
            <h2>Set the new intent</h2>
          </div>
          <button className="text-button" type="button" onClick={() => reset(initialIntent)}>
            Reset
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

        <NaturalLanguageIntent key={teamId} teamId={teamId} onApply={(intent) => reset(intent)} />

        <IntentControls
          roster={roster}
          register={register}
          requiredPlayerIds={values.requiredPlayerIds ?? []}
          excludedPlayerIds={values.excludedPlayerIds ?? []}
          onTogglePlayer={togglePlayer}
        />

        <div className="roster-actions">
          <p>Fewest swaps first, then the strongest fit among equally small changes.</p>
          <button className="analyze-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Repairing…' : 'Repair lineup'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>

      <div className="generation-result">
        {response && <ComparisonPanel response={response} roster={roster} />}
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
          versionSave={
            response
              ? {
                  suggestedName: 'Repaired lineup',
                  onSave: (name) => onSaveVersion(name, response.repair.after.lineup.playerIds),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
