import type { AnalyzeLineupRequest, SaveScenarioRequest, TeamDto } from '@lineup-engine/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  ApiClientError,
  fetchPersistenceStatus,
  fetchRoster,
  fetchSavedScenario,
  fetchSavedScenarios,
  fetchTeams,
  postLineupAnalysis,
  saveScenarioRequest,
} from '../../api/client.ts';
import { AnalysisPanel } from './AnalysisPanel.tsx';
import { DemoScenarios, type DemoScenarioSelection } from './DemoScenarios.tsx';
import { GenerationWorkspace } from './GenerationWorkspace.tsx';
import { RepairWorkspace } from './RepairWorkspace.tsx';
import { RosterPanel } from './RosterPanel.tsx';
import { SessionVersionsWorkspace } from './SessionVersionsWorkspace.tsx';
import { anonymousSessionKey } from './anonymous-session.ts';
import type { SessionLineupVersion, SessionVersionDraft } from './session-version.ts';

interface LineupFormValues {
  playerIds: string[];
}

export type PoolCategory = 'team' | 'league' | 'demo';

export type WorkflowRoute = 'build' | 'repair' | 'compare';

export interface LineupBuilderSessionState {
  teamOverride: string;
  setTeamOverride: Dispatch<SetStateAction<string>>;
  poolCategorySelection: PoolCategory;
  setPoolCategorySelection: Dispatch<SetStateAction<PoolCategory>>;
  versions: SessionLineupVersion[];
  setVersions: Dispatch<SetStateAction<SessionLineupVersion[]>>;
  activeParentVersionId: string | undefined;
  setActiveParentVersionId: Dispatch<SetStateAction<string | undefined>>;
  activeScenario: { id: string; name: string } | undefined;
  setActiveScenario: Dispatch<SetStateAction<{ id: string; name: string } | undefined>>;
}

function poolCategory(team: TeamDto): PoolCategory {
  return team.isDemo ? 'demo' : team.mode;
}

function requestErrorMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiClientError) return error.message;
  return 'The lineup service is temporarily unavailable. Please try again.';
}

export function LineupBuilderPage({
  routeWorkflow,
  session,
}: {
  routeWorkflow: WorkflowRoute;
  session: LineupBuilderSessionState;
}) {
  const navigate = useNavigate();
  const [buildWorkflow, setBuildWorkflow] = useState<'manual' | 'generation'>('manual');
  const workflow =
    routeWorkflow === 'build' ? buildWorkflow : routeWorkflow === 'repair' ? 'repair' : 'versions';
  const {
    teamOverride,
    setTeamOverride,
    poolCategorySelection,
    setPoolCategorySelection,
    versions,
    setVersions,
    activeParentVersionId,
    setActiveParentVersionId,
    activeScenario,
    setActiveScenario,
  } = session;
  const [sessionKey] = useState(anonymousSessionKey);
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams });
  const persistenceStatusQuery = useQuery({
    queryKey: ['persistence-status'],
    queryFn: fetchPersistenceStatus,
  });
  const persistenceAvailable = persistenceStatusQuery.data?.available ?? false;
  const savedScenariosQuery = useQuery({
    queryKey: ['saved-scenarios', sessionKey],
    queryFn: () => fetchSavedScenarios(sessionKey),
    enabled: persistenceAvailable,
  });
  const matchingPools =
    teamsQuery.data?.teams.filter((team) => poolCategory(team) === poolCategorySelection) ?? [];
  const availablePools = matchingPools.length > 0 ? matchingPools : (teamsQuery.data?.teams ?? []);
  const selectedTeamId =
    (availablePools.some((team) => team.id === teamOverride) ? teamOverride : '') ||
    availablePools[0]?.id ||
    '';
  const selectedPool = teamsQuery.data?.teams.find((team) => team.id === selectedTeamId);
  const rosterQuery = useQuery({
    queryKey: ['roster', selectedTeamId],
    queryFn: () => fetchRoster(selectedTeamId),
    enabled: Boolean(selectedTeamId),
  });
  const profiledRoster =
    rosterQuery.data?.players.filter(
      (player) => player.profileStatus !== 'unavailable' && Boolean(player.profile),
    ) ?? [];
  const manualDisclosureRef = useRef<HTMLDetailsElement>(null);
  const analysisMutation = useMutation({ mutationFn: postLineupAnalysis });
  const manualEditorRef = useRef<HTMLFormElement>(null);
  const { control, handleSubmit, reset, setValue } = useForm<LineupFormValues>({
    defaultValues: { playerIds: [] },
  });
  const selectedPlayerIds = useWatch({ control, name: 'playerIds' });
  const saveScenarioMutation = useMutation({
    mutationFn: ({ request }: { name: string; request: SaveScenarioRequest }) =>
      saveScenarioRequest(sessionKey, request, activeScenario?.id),
    onSuccess: (scenario) => {
      setActiveScenario({ id: scenario.id, name: scenario.name });
      setVersions((current) => [
        ...current.filter((version) => version.teamId !== scenario.teamId),
        ...scenario.versions.map((version) => ({
          id: version.clientVersionId,
          teamId: scenario.teamId,
          name: version.name,
          playerIds: version.playerIds,
          source: version.source,
          ...(version.parentClientVersionId
            ? { parentVersionId: version.parentClientVersionId }
            : {}),
          analysis: version.analysis,
          ...(version.intent ? { intent: version.intent } : {}),
          ...(version.repair ? { repair: version.repair } : {}),
          dataVersion: version.dataVersion,
          scoringVersion: version.scoringVersion,
          createdAt: version.createdAt,
        })),
      ]);
      void savedScenariosQuery.refetch();
    },
  });
  const loadScenarioMutation = useMutation({
    mutationFn: (scenarioId: string) => fetchSavedScenario(sessionKey, scenarioId),
    onSuccess: (scenario) => {
      const team = teamsQuery.data?.teams.find((candidate) => candidate.id === scenario.teamId);
      if (team) setPoolCategorySelection(poolCategory(team));
      setTeamOverride(scenario.teamId);
      reset({ playerIds: [...scenario.selectedPlayerIds] });
      analysisMutation.reset();
      setVersions((current) => [
        ...current.filter((version) => version.teamId !== scenario.teamId),
        ...scenario.versions.map((version) => ({
          id: version.clientVersionId,
          teamId: scenario.teamId,
          name: version.name,
          playerIds: version.playerIds,
          source: version.source,
          ...(version.parentClientVersionId
            ? { parentVersionId: version.parentClientVersionId }
            : {}),
          analysis: version.analysis,
          ...(version.intent ? { intent: version.intent } : {}),
          ...(version.repair ? { repair: version.repair } : {}),
          dataVersion: version.dataVersion,
          scoringVersion: version.scoringVersion,
          createdAt: version.createdAt,
        })),
      ]);
      setActiveParentVersionId(scenario.activeParentClientVersionId);
      setActiveScenario({ id: scenario.id, name: scenario.name });
      navigate('/compare');
    },
  });

  function changeTeam(teamId: string) {
    setTeamOverride(teamId);
    reset({ playerIds: [] });
    analysisMutation.reset();
    setActiveParentVersionId(undefined);
    setActiveScenario(undefined);
  }

  function changePoolCategory(category: PoolCategory) {
    setPoolCategorySelection(category);
    setTeamOverride('');
    reset({ playerIds: [] });
    analysisMutation.reset();
    setActiveParentVersionId(undefined);
    setActiveScenario(undefined);
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

  async function saveVersion(draft: SessionVersionDraft): Promise<void> {
    const { name, playerIds, source, analysis, intent, repair } = draft;
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
    const id = `session-version-${window.crypto.randomUUID()}`;
    const version: SessionLineupVersion = {
      id,
      teamId: selectedTeamId,
      name: uniqueName,
      playerIds: [...playerIds] as SessionLineupVersion['playerIds'],
      source,
      analysis,
      ...(activeParentVersionId ? { parentVersionId: activeParentVersionId } : {}),
      ...(intent ? { intent } : {}),
      ...(repair ? { repair } : {}),
    };
    const nextTeamVersions = [
      ...versions.filter((candidate) => candidate.teamId === selectedTeamId),
      version,
    ];

    if (persistenceAvailable) {
      const scenarioName = activeScenario?.name ?? `${selectedPool?.name ?? 'Lineup'} versions`;
      const request: SaveScenarioRequest = {
        name: scenarioName,
        teamId: selectedTeamId,
        selectedPlayerIds: version.playerIds,
        activeParentClientVersionId: id,
        versions: nextTeamVersions.map((candidate) => ({
          clientVersionId: candidate.id,
          ...(candidate.parentVersionId
            ? { parentClientVersionId: candidate.parentVersionId }
            : {}),
          name: candidate.name,
          source: candidate.source,
          playerIds: candidate.playerIds,
          ...(candidate.intent ? { intent: candidate.intent } : {}),
          ...(candidate.repair ? { repair: candidate.repair } : {}),
        })),
      };
      await saveScenarioMutation.mutateAsync({ name: scenarioName, request });
      setActiveParentVersionId(id);
      return;
    }

    setVersions((current) => [...current, version]);
    setActiveParentVersionId(id);
  }

  function branchFromVersion(version: SessionLineupVersion) {
    setValue('playerIds', [...version.playerIds], { shouldDirty: true });
    analysisMutation.reset();
    setActiveParentVersionId(version.id);
    setBuildWorkflow('manual');
    navigate('/build');
  }

  const teamVersions = versions.filter((version) => version.teamId === selectedTeamId);

  function persistCurrentScenario(name: string) {
    if (teamVersions.length === 0) return;
    const request: SaveScenarioRequest = {
      name,
      teamId: selectedTeamId,
      selectedPlayerIds,
      ...(activeParentVersionId ? { activeParentClientVersionId: activeParentVersionId } : {}),
      versions: teamVersions.map((version) => ({
        clientVersionId: version.id,
        ...(version.parentVersionId ? { parentClientVersionId: version.parentVersionId } : {}),
        name: version.name,
        source: version.source,
        playerIds: version.playerIds,
        ...(version.intent ? { intent: version.intent } : {}),
        ...(version.repair ? { repair: version.repair } : {}),
      })),
    };
    saveScenarioMutation.mutate({ name, request });
  }

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
    if (selection.workflow === 'repair') {
      navigate('/repair');
    } else {
      setBuildWorkflow(selection.workflow);
      navigate('/build');
    }

    if (selection.analyzeImmediately && playerIds.length === 5) {
      analysisMutation.mutate({ teamId: selectedTeamId, playerIds });
    }
  }

  const rosterError = requestErrorMessage(rosterQuery.error);
  const persistenceRequestError = requestErrorMessage(
    saveScenarioMutation.error ?? loadScenarioMutation.error ?? savedScenariosQuery.error,
  );
  const rosterReady = teamsQuery.isSuccess && rosterQuery.isSuccess && Boolean(selectedTeamId);
  const canAnalyze = rosterReady && selectedPlayerIds.length === 5 && !analysisMutation.isPending;

  function returnToEditor(editor: HTMLElement | null) {
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    editor.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

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
        searchable={selectedPool?.mode === 'league'}
      />
    );
  }

  return (
    <main className="workspace">
      <section className="pool-bar" aria-label="Player pool selection">
        <div className="pool-controls">
          <div className="mode-switch" aria-label="Player pool mode">
            {(
              [
                ['team', 'Team'],
                ['league', 'League'],
                ['demo', 'Demo'],
              ] as const
            ).map(([category, label]) => (
              <button
                type="button"
                key={category}
                aria-pressed={poolCategorySelection === category}
                onClick={() => changePoolCategory(category)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="team-control">
            <span>{poolCategorySelection === 'league' ? 'Snapshot' : 'Team'}</span>
            <select
              value={selectedTeamId}
              onChange={(event) => changeTeam(event.target.value)}
              disabled={teamsQuery.isPending || teamsQuery.isError || !availablePools.length}
            >
              {!selectedTeamId && (
                <option value="">
                  {teamsQuery.isPending ? 'Loading options…' : 'No option available'}
                </option>
              )}
              {availablePools.map((team) => (
                <option value={team.id} key={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedPool ? (
          <details className="data-provenance" aria-label="Data source and search scope">
            <summary>
              <strong>{selectedPool.mode === 'league' ? 'League pool' : 'Team roster'}</strong>
              <span>
                {selectedPool.sourceLabel} · snapshot {selectedPool.snapshotDate}
              </span>
              <span className="data-provenance__toggle">Details +</span>
            </summary>
            <div className="data-provenance__details">
              <p>
                {selectedPool.searchStrategy === 'solver'
                  ? 'Generation and repair use a time-limited full-pool optimizer and disclose proof, gap, or fallback status.'
                  : 'Generation checks every five-player combination in this roster.'}
                {selectedPool.rosterPlayerCount !== undefined &&
                selectedPool.profiledPlayerCount !== undefined &&
                selectedPool.profiledPlayerCount < selectedPool.rosterPlayerCount
                  ? ` ${selectedPool.profiledPlayerCount} of ${selectedPool.rosterPlayerCount} current players have completed-season profiles and are eligible.`
                  : ''}
              </p>
              {selectedPool.scoringLabel ? <p>{selectedPool.scoringLabel}</p> : null}
              {selectedPool.sourceUrl ? (
                <a href={selectedPool.sourceUrl} target="_blank" rel="noreferrer">
                  View source
                </a>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>

      {selectedPool?.isDemo && rosterReady && rosterQuery.data?.players.length ? (
        <DemoScenarios onSelect={loadDemoScenario} />
      ) : null}

      {routeWorkflow === 'build' ? (
        <section className="build-experience" aria-label="Build a lineup">
          <div className="build-method-switch" role="tablist" aria-label="Build method">
            <button
              type="button"
              role="tab"
              aria-label="Choose players"
              aria-selected={buildWorkflow === 'manual'}
              aria-controls="choose-players-panel"
              onClick={() => setBuildWorkflow('manual')}
            >
              <span>Choose players</span>
              <small>Pick and analyze your five</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Generate from goals"
              aria-selected={buildWorkflow === 'generation'}
              aria-controls="generate-goals-panel"
              onClick={() => setBuildWorkflow('generation')}
            >
              <span>Generate from goals</span>
              <small>Describe the fit you need</small>
            </button>
          </div>

          <div
            id="choose-players-panel"
            role="tabpanel"
            hidden={buildWorkflow !== 'manual'}
            className="build-method-panel"
          >
            <div className="build-method-workspace">
              <details
                className={`result-editor-disclosure ${analysisMutation.data ? 'result-editor-disclosure--active' : ''}`}
                open={!analysisMutation.data}
                ref={manualDisclosureRef}
              >
                <summary>
                  <span>
                    <span className="panel-kicker">Lineup setup</span>
                    <strong>Edit selected five</strong>
                  </span>
                  <span className="result-editor-disclosure__status">
                    {selectedPlayerIds.length} players selected
                    <span className="result-editor-disclosure__chevron" aria-hidden="true">
                      ↓
                    </span>
                  </span>
                </summary>
                <form
                  className="roster-card build-editor"
                  onSubmit={handleSubmit(submitLineup)}
                  ref={manualEditorRef}
                  tabIndex={-1}
                >
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
              </details>

              {analysisMutation.isPending || analysisMutation.error || analysisMutation.data ? (
                <div className="build-results" aria-live="polite">
                  <AnalysisPanel
                    analysis={analysisMutation.data}
                    error={requestErrorMessage(analysisMutation.error)}
                    isPending={analysisMutation.isPending}
                    roster={rosterQuery.data?.players ?? []}
                    selectedPlayerIds={selectedPlayerIds}
                    onRetry={() => void handleSubmit(submitLineup)()}
                    canRetry={canAnalyze}
                    revealOnSuccess
                    onBackToEditing={() => {
                      if (manualDisclosureRef.current) manualDisclosureRef.current.open = true;
                      returnToEditor(manualEditorRef.current);
                    }}
                    onRepair={() => navigate('/repair')}
                    onCompare={() => navigate('/compare')}
                    versionSave={
                      analysisMutation.data
                        ? {
                            suggestedName: 'Manual lineup',
                            durable: persistenceAvailable,
                            onSave: (name) =>
                              saveVersion({
                                name,
                                playerIds: selectedPlayerIds,
                                source: 'manual',
                                analysis: analysisMutation.data,
                              }),
                          }
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div
            id="generate-goals-panel"
            role="tabpanel"
            hidden={buildWorkflow !== 'generation'}
            className="build-method-panel"
          >
            {rosterReady && rosterQuery.data?.players.length ? (
              <GenerationWorkspace
                key={selectedTeamId}
                teamId={selectedTeamId}
                roster={profiledRoster}
                usesLeagueSolver={selectedPool?.searchStrategy === 'solver'}
                defaultMinimumShooters={selectedPool?.defaultMinimumShooters ?? 3}
                defaultMinimumCreators={selectedPool?.defaultMinimumCreators ?? 1}
                onGeneratedLineup={useLineupForRepair}
                onSaveVersion={saveVersion}
                durableVersionSaving={persistenceAvailable}
                onOpenRepair={() => navigate('/repair')}
                onOpenCompare={() => navigate('/compare')}
              />
            ) : buildWorkflow === 'generation' ? (
              <section className="roster-card build-editor">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">Player pool</span>
                    <h2>Prepare generation</h2>
                  </div>
                </div>
                {rosterContent()}
              </section>
            ) : null}
          </div>
        </section>
      ) : workflow === 'repair' && rosterReady && rosterQuery.data?.players.length ? (
        selectedPlayerIds.length === 5 ? (
          <RepairWorkspace
            key={selectedTeamId}
            teamId={selectedTeamId}
            roster={profiledRoster}
            currentPlayerIds={selectedPlayerIds}
            defaultMinimumShooters={selectedPool?.defaultMinimumShooters ?? 3}
            defaultMinimumCreators={selectedPool?.defaultMinimumCreators ?? 1}
            onSaveVersion={saveVersion}
            durableVersionSaving={persistenceAvailable}
            onEditStartingFive={() => {
              setBuildWorkflow('manual');
              navigate('/build');
            }}
          />
        ) : (
          <section className="analysis-card repair-prerequisite">
            <div className="eyebrow">Starting lineup needed</div>
            <h2>Select five players before repairing.</h2>
            <p>
              Repair preserves as much of an existing lineup as possible, so begin with five in the
              manual builder or generate a lineup first. Your current team and player pool will stay
              selected when you continue to Build.
            </p>
            <button
              className="analyze-button"
              type="button"
              onClick={() => {
                setBuildWorkflow('manual');
                navigate('/build');
              }}
            >
              Build starting five <span aria-hidden="true">→</span>
            </button>
          </section>
        )
      ) : workflow === 'versions' && rosterReady && rosterQuery.data?.players.length ? (
        <SessionVersionsWorkspace
          teamId={selectedTeamId}
          roster={profiledRoster}
          versions={teamVersions}
          onBranch={branchFromVersion}
          onDelete={(versionId) => {
            setVersions((current) => current.filter((version) => version.id !== versionId));
            if (activeParentVersionId === versionId) setActiveParentVersionId(undefined);
          }}
          persistence={{
            available: persistenceAvailable,
            scenarios: savedScenariosQuery.data?.scenarios ?? [],
            ...(activeScenario
              ? { activeScenarioId: activeScenario.id, activeScenarioName: activeScenario.name }
              : {}),
            isPending: saveScenarioMutation.isPending || loadScenarioMutation.isPending,
            ...(persistenceRequestError ? { error: persistenceRequestError } : {}),
            onSave: persistCurrentScenario,
            onLoad: (scenarioId) => loadScenarioMutation.mutate(scenarioId),
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
                    durable: persistenceAvailable,
                    onSave: (name) =>
                      saveVersion({
                        name,
                        playerIds: selectedPlayerIds,
                        source: 'manual',
                        analysis: analysisMutation.data,
                      }),
                  }
                : undefined
            }
          />
        </div>
      )}
    </main>
  );
}
