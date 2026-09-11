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

interface GenerationWorkspaceProps {
  teamId: string;
  roster: RosterPlayerDto[];
  onGeneratedLineup: (playerIds: string[]) => void;
}

const metrics = [
  ['shooting', 'Shooting'],
  ['creation', 'Creation'],
  ['playmaking', 'Playmaking'],
  ['rebounding', 'Rebounding'],
  ['perimeterDefense', 'Perimeter defense'],
  ['interiorDefense', 'Interior defense'],
  ['switchability', 'Switchability'],
] as const;

const balancedIntent: LineupIntentDto = {
  priorities: {
    shooting: 1,
    creation: 1,
    playmaking: 1,
    rebounding: 1,
    perimeterDefense: 1,
    interiorDefense: 1,
    switchability: 1,
  },
  minimumShooters: 3,
  minimumCreators: 1,
  metricMinimums: {},
  requiredPlayerIds: [],
  excludedPlayerIds: [],
};

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
}: GenerationWorkspaceProps) {
  const mutation = useMutation({
    mutationFn: postLineupGeneration,
    onSuccess: (response) => onGeneratedLineup([...response.winner.lineup.playerIds]),
  });
  const resetGeneration = mutation.reset;
  const { control, register, handleSubmit, reset, setValue } = useForm<LineupIntentDto>({
    defaultValues: balancedIntent,
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
          <button className="text-button" type="button" onClick={() => reset(balancedIntent)}>
            Reset
          </button>
        </div>

        <div className="generation-form-body">
          <fieldset>
            <legend>Ranking priorities</legend>
            <p>Choose what matters most. Equal settings use the balanced ranking.</p>
            <div className="control-grid">
              {metrics.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <select {...register(`priorities.${key}`, { valueAsNumber: true })}>
                    <option value={0}>Ignore</option>
                    <option value={0.5}>Helpful</option>
                    <option value={1}>Important</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Role requirements</legend>
            <p>These are hard rules. The generator will never loosen them.</p>
            <div className="control-grid control-grid--two">
              <label>
                <span>Minimum credible shooters</span>
                <select {...register('minimumShooters', { valueAsNumber: true })}>
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option value={count} key={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Minimum high-level creators</span>
                <select {...register('minimumCreators', { valueAsNumber: true })}>
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option value={count} key={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Minimum lineup scores</legend>
            <p>Optional floors use the same 0–100 scores shown in the analysis.</p>
            <div className="control-grid">
              {metrics.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="No minimum"
                    {...register(`metricMinimums.${key}`, {
                      setValueAs: (value) => (value === '' ? undefined : Number(value)),
                    })}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Player rules</legend>
            <p>Lock players into the result or keep them out.</p>
            <div className="player-rules" aria-label="Required and excluded players">
              {roster.map((player) => {
                const required = (values.requiredPlayerIds ?? []).includes(player.id);
                const excluded = (values.excludedPlayerIds ?? []).includes(player.id);
                return (
                  <div className="player-rule" key={player.id}>
                    <span>
                      <strong>{player.name}</strong>
                      <small>{player.position}</small>
                    </span>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Require ${player.name}`}
                        checked={required}
                        disabled={excluded}
                        onChange={() => togglePlayer('requiredPlayerIds', player.id)}
                      />
                      Require
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Exclude ${player.name}`}
                        checked={excluded}
                        disabled={required}
                        onChange={() => togglePlayer('excludedPlayerIds', player.id)}
                      />
                      Exclude
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="roster-actions">
          <p>Searches every five-player combination on this fictional roster.</p>
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
                }
              : undefined
          }
          mode="generation"
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
