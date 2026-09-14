import type { AnalyzeLineupRequest } from '@lineup-engine/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiClientError, fetchRoster, fetchTeams, postLineupAnalysis } from '../../api/client.ts';
import { AnalysisPanel } from './AnalysisPanel.tsx';
import { DemoScenarios, type DemoScenarioSelection } from './DemoScenarios.tsx';
import { GenerationWorkspace } from './GenerationWorkspace.tsx';
import { RepairWorkspace } from './RepairWorkspace.tsx';
import { RosterPanel } from './RosterPanel.tsx';
import { SessionVersionsWorkspace } from './SessionVersionsWorkspace.tsx';
import type { SessionLineupVersion, SessionVersionSource } from './session-version.ts';

interface LineupFormValues {
  playerIds: string[];
}

function requestErrorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

export function LineupBuilderPage() {
  const [workflow, setWorkflow] = useState<'manual' | 'generation' | 'repair' | 'versions'>(
    'manual',
  );
  const [teamOverride, setTeamOverride] = useState('');
  const [versions, setVersions] = useState<SessionLineupVersion[]>([]);
  const [activeParentVersionId, setActiveParentVersionId] = useState<string>();
  const nextVersionId = useRef(1);
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
    setActiveParentVersionId(undefined);
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

  function useLineupForRepair(playerIds: string[]) {
    setValue('playerIds', playerIds, { shouldDirty: true });
    analysisMutation.reset();
  }

  function saveVersion(name: string, playerIds: readonly string[], source: SessionVersionSource) {
    if (playerIds.length !== 5) return;
    const existingNames = new Set(
      versions
        .filter((version) => version.teamId === selectedTeamId)
        .map((version) => version.name),
    );
    let uniqueName = name;
    let suffix = 2;
    while (existingNames.has(uniqueName)) {
      uniqueName = `${name} (${suffix})`;
      suffix += 1;
    }
    const id = `session-version-${nextVersionId.current}`;
    nextVersionId.current += 1;
    const version: SessionLineupVersion = {
      id,
      teamId: selectedTeamId,
      name: uniqueName,
      playerIds: [...playerIds] as SessionLineupVersion['playerIds'],
      source,
      ...(activeParentVersionId ? { parentVersionId: activeParentVersionId } : {}),
    };
    setVersions((current) => [...current, version]);
    setActiveParentVersionId(id);
  }

  function branchFromVersion(version: SessionLineupVersion) {
    setValue('playerIds', [...version.playerIds], { shouldDirty: true });
    analysisMutation.reset();
    setActiveParentVersionId(version.id);
    setWorkflow('manual');
  }

  const teamVersions = versions.filter((version) => version.teamId === selectedTeamId);

  function submitLineup(values: LineupFormValues) {
    if (!canAnalyze || values.playerIds.length !== 5) return;
    const request: AnalyzeLineupRequest = {
      teamId: selectedTeamId,
      playerIds: values.playerIds,
    };
    analysisMutation.mutate(request);
  }

  function loadDemoScenario(selection: DemoScenarioSelection) {
    const availablePlayerIds = new Set(rosterQuery.data?.players.map((player) => player.id) ?? []);
    const playerIds = selection.playerIds.filter((id) => availablePlayerIds.has(id));

    setValue('playerIds', playerIds, { shouldDirty: true });
    analysisMutation.reset();
    setActiveParentVersionId(undefined);
    setWorkflow(selection.workflow);

    if (selection.analyzeImmediately && playerIds.length === 5) {
      analysisMutation.mutate({ teamId: selectedTeamId, playerIds });
    }
  }

  const rosterError = requestErrorMessage(rosterQuery.error);
  const rosterReady = teamsQuery.isSuccess && rosterQuery.isSuccess && Boolean(selectedTeamId);
  const canAnalyze = rosterReady && selectedPlayerIds.length === 5 && !analysisMutation.isPending;

  function rosterContent() {
    if (teamsQuery.isPending) {
      return (
        <div className="roster-state" role="status">
          Loading teams…
        </div>
      );
    }
    if (teamsQuery.isError) {
      return (
        <div className="roster-state roster-state--error" role="alert">
          <strong>We couldn’t load the teams.</strong>
          <p>{requestErrorMessage(teamsQuery.error)}</p>
          <button
            className="retry-button"
            type="button"
            disabled={teamsQuery.isFetching}
            onClick={() => void teamsQuery.refetch()}
          >
            {teamsQuery.isFetching ? 'Retrying…' : 'Retry teams'}
          </button>
        </div>
      );
    }
    if (!selectedTeamId) {
      return (
        <div className="roster-state" role="status">
          <strong>No teams available yet.</strong>
          <p>Check again to see whether a roster has been added.</p>
          <button
            className="retry-button"
            type="button"
            disabled={teamsQuery.isFetching}
            onClick={() => void teamsQuery.refetch()}
          >
            Refresh teams
          </button>
        </div>
      );
    }
    if (rosterQuery.isPending) {
      return (
        <div className="roster-state" role="status">
          Loading roster…
        </div>
      );
    }
    if (rosterError) {
      return (
        <div className="roster-state roster-state--error" role="alert">
          <strong>We couldn’t load this roster.</strong>
          <p>{rosterError}</p>
          <button
            className="retry-button"
            type="button"
            disabled={rosterQuery.isFetching}
            onClick={() => void rosterQuery.refetch()}
          >
            {rosterQuery.isFetching ? 'Retrying…' : 'Retry roster'}
          </button>
        </div>
      );
    }
    if (!rosterQuery.data?.players.length) {
      return (
        <div className="roster-state" role="status">
          <strong>No players available yet.</strong>
          <p>Choose another team or check this roster again.</p>
          <button
            className="retry-button"
            type="button"
            disabled={rosterQuery.isFetching}
            onClick={() => void rosterQuery.refetch()}
          >
            Refresh roster
          </button>
        </div>
      );
    }
    return (
      <RosterPanel
        players={rosterQuery.data.players}
        selectedPlayerIds={selectedPlayerIds}
        onTogglePlayer={togglePlayer}
      />
    );
  }

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <div className="eyebrow">The lineup lab</div>
          <h1>
            Choose the five. <span>Understand the fit.</span>
          </h1>
          <p>
            A little shooting. A little size. The right five together. Explore your lineup’s
            strengths, tradeoffs, and the story behind every score.
          </p>
          <span className="demo-note">Fictional demo roster · Illustrative ratings</span>
        </div>
        <label className="team-control">
          <span>Team</span>
          <select
            value={selectedTeamId}
            onChange={(event) => changeTeam(event.target.value)}
            disabled={teamsQuery.isPending || teamsQuery.isError || !teamsQuery.data?.teams.length}
          >
            {!selectedTeamId && (
              <option value="">
                {teamsQuery.isPending ? 'Loading teams…' : 'No team selected'}
              </option>
            )}
            {teamsQuery.data?.teams.map((team) => (
              <option value={team.id} key={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {rosterReady && rosterQuery.data?.players.length ? (
        <DemoScenarios onSelect={loadDemoScenario} />
      ) : null}

      <div className="workflow-tabs" role="tablist" aria-label="Lineup workflow">
        <button
          type="button"
          role="tab"
          aria-selected={workflow === 'manual'}
          onClick={() => setWorkflow('manual')}
        >
          Build manually
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workflow === 'generation'}
          onClick={() => setWorkflow('generation')}
        >
          Generate from intent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workflow === 'repair'}
          onClick={() => setWorkflow('repair')}
        >
          Repair a lineup
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workflow === 'versions'}
          onClick={() => setWorkflow('versions')}
        >
          Compare &amp; versions
        </button>
      </div>

      {workflow === 'generation' && rosterReady && rosterQuery.data?.players.length ? (
        <GenerationWorkspace
          teamId={selectedTeamId}
          roster={rosterQuery.data.players}
          onGeneratedLineup={useLineupForRepair}
          onSaveVersion={(name, playerIds) => saveVersion(name, playerIds, 'generated')}
        />
      ) : workflow === 'repair' && rosterReady && rosterQuery.data?.players.length ? (
        selectedPlayerIds.length === 5 ? (
          <RepairWorkspace
            teamId={selectedTeamId}
            roster={rosterQuery.data.players}
            currentPlayerIds={selectedPlayerIds}
            onSaveVersion={(name, playerIds) => saveVersion(name, playerIds, 'repaired')}
          />
        ) : (
          <section className="analysis-card repair-prerequisite">
            <div className="eyebrow">Starting lineup needed</div>
            <h2>Select five players before repairing.</h2>
            <p>
              Repair preserves as much of an existing lineup as possible, so begin with five in the
              manual builder or generate a lineup first.
            </p>
            <button className="analyze-button" type="button" onClick={() => setWorkflow('manual')}>
              Build starting five <span aria-hidden="true">→</span>
            </button>
          </section>
        )
      ) : workflow === 'versions' && rosterReady && rosterQuery.data?.players.length ? (
        <SessionVersionsWorkspace
          teamId={selectedTeamId}
          roster={rosterQuery.data.players}
          versions={teamVersions}
          onBranch={branchFromVersion}
          onDelete={(versionId) => {
            setVersions((current) => current.filter((version) => version.id !== versionId));
            if (activeParentVersionId === versionId) setActiveParentVersionId(undefined);
          }}
        />
      ) : (
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

            {rosterContent()}

            <div className="roster-actions">
              <p>
                {!rosterReady || !rosterQuery.data?.players.length
                  ? 'Load an available roster to get started.'
                  : selectedPlayerIds.length === 5
                    ? 'Your five is ready for analysis.'
                    : `Choose ${5 - selectedPlayerIds.length} more player${5 - selectedPlayerIds.length === 1 ? '' : 's'}.`}
              </p>
              <button className="analyze-button" type="submit" disabled={!canAnalyze}>
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
            onRetry={() => void handleSubmit(submitLineup)()}
            canRetry={canAnalyze}
            versionSave={
              analysisMutation.data
                ? {
                    suggestedName: 'Manual lineup',
                    onSave: (name) => saveVersion(name, selectedPlayerIds, 'manual'),
                  }
                : undefined
            }
          />
        </div>
      )}
    </main>
  );
}
