import type { AnalyzeLineupRequest } from '@lineup-engine/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, fetchRoster, fetchTeams, postLineupAnalysis } from '../../api/client.ts';
import { AnalysisPanel } from './AnalysisPanel.tsx';
import { RosterPanel } from './RosterPanel.tsx';

interface LineupFormValues {
  playerIds: string[];
}

function requestErrorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

export function LineupBuilderPage() {
  const [teamOverride, setTeamOverride] = useState('');
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams });
  const selectedTeamId = teamOverride || teamsQuery.data?.teams[0]?.id || '';
  const rosterQuery = useQuery({
    queryKey: ['roster', selectedTeamId],
    queryFn: () => fetchRoster(selectedTeamId),
    enabled: Boolean(selectedTeamId),
  });
  const analysisMutation = useMutation({ mutationFn: postLineupAnalysis });
  const { control, handleSubmit, reset, setValue } = useForm<LineupFormValues>({
    defaultValues: { playerIds: [] },
  });
  const selectedPlayerIds = useWatch({ control, name: 'playerIds' });

  function changeTeam(teamId: string) {
    setTeamOverride(teamId);
    reset({ playerIds: [] });
    analysisMutation.reset();
  }

  function togglePlayer(playerId: string) {
    const selected = selectedPlayerIds.includes(playerId);
    const nextPlayerIds = selected
      ? selectedPlayerIds.filter((id) => id !== playerId)
      : selectedPlayerIds.length < 5
        ? [...selectedPlayerIds, playerId]
        : selectedPlayerIds;

    setValue('playerIds', nextPlayerIds, { shouldDirty: true });
    analysisMutation.reset();
  }

  function submitLineup(values: LineupFormValues) {
    if (!selectedTeamId || values.playerIds.length !== 5) return;
    const request: AnalyzeLineupRequest = {
      teamId: selectedTeamId,
      playerIds: values.playerIds,
    };
    analysisMutation.mutate(request);
  }

  const rosterError = requestErrorMessage(rosterQuery.error);

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <div className="eyebrow">Manual lineup lab · Phase 03</div>
          <h1>
            Choose the five. <span>Understand the fit.</span>
          </h1>
          <p>
            Build a lineup from the roster, then let the deterministic engine surface its strengths,
            risks, and underlying evidence.
          </p>
        </div>
        <label className="team-control">
          <span>Team</span>
          <select
            value={selectedTeamId}
            onChange={(event) => changeTeam(event.target.value)}
            disabled={teamsQuery.isPending || teamsQuery.isError}
          >
            {teamsQuery.data?.teams.map((team) => (
              <option value={team.id} key={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="builder-layout">
        <form className="roster-card" onSubmit={handleSubmit(submitLineup)}>
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Available roster</span>
              <h2>Select exactly five</h2>
            </div>
            <div
              className={`selection-count ${selectedPlayerIds.length === 5 ? 'is-complete' : ''}`}
            >
              <strong>{selectedPlayerIds.length}</strong>
              <span>/ 5</span>
            </div>
          </div>

          {rosterQuery.isPending || !selectedTeamId ? (
            <div className="roster-state" role="status">
              Loading roster…
            </div>
          ) : rosterError ? (
            <div className="roster-state roster-state--error" role="alert">
              {rosterError}
            </div>
          ) : (
            <RosterPanel
              players={rosterQuery.data?.players ?? []}
              selectedPlayerIds={selectedPlayerIds}
              onTogglePlayer={togglePlayer}
            />
          )}

          <div className="roster-actions">
            <p>
              {selectedPlayerIds.length === 5
                ? 'Your five is ready for analysis.'
                : `Choose ${5 - selectedPlayerIds.length} more player${5 - selectedPlayerIds.length === 1 ? '' : 's'}.`}
            </p>
            <button
              className="analyze-button"
              type="submit"
              disabled={selectedPlayerIds.length !== 5 || analysisMutation.isPending}
            >
              Analyze lineup <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>

        <AnalysisPanel
          analysis={analysisMutation.data}
          error={requestErrorMessage(analysisMutation.error)}
          isPending={analysisMutation.isPending}
          roster={rosterQuery.data?.players ?? []}
          selectedPlayerIds={selectedPlayerIds}
        />
      </div>
    </main>
  );
}
