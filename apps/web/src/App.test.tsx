import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchHealth,
  fetchIntentInterpreterStatus,
  fetchPersistenceStatus,
  fetchRoster,
  fetchSavedScenario,
  fetchSavedScenarios,
  fetchTeams,
  postLineupAnalysis,
  postLineupComparison,
  postLineupGeneration,
  postIntentInterpretation,
  postLineupRepair,
  saveScenarioRequest,
} from './api/client.ts';
import { App } from './App.tsx';

vi.mock('./api/client.ts', () => ({
  ApiClientError: class ApiClientError extends Error {},
  fetchHealth: vi.fn(),
  fetchIntentInterpreterStatus: vi.fn(),
  fetchPersistenceStatus: vi.fn(),
  fetchTeams: vi.fn(),
  fetchRoster: vi.fn(),
  fetchSavedScenario: vi.fn(),
  fetchSavedScenarios: vi.fn(),
  postLineupAnalysis: vi.fn(),
  postLineupComparison: vi.fn(),
  postLineupGeneration: vi.fn(),
  postIntentInterpretation: vi.fn(),
  postLineupRepair: vi.fn(),
  saveScenarioRequest: vi.fn(),
}));

const mockedFetchHealth = vi.mocked(fetchHealth);
const mockedFetchIntentInterpreterStatus = vi.mocked(fetchIntentInterpreterStatus);
const mockedFetchPersistenceStatus = vi.mocked(fetchPersistenceStatus);
const mockedFetchTeams = vi.mocked(fetchTeams);
const mockedFetchRoster = vi.mocked(fetchRoster);
const mockedFetchSavedScenario = vi.mocked(fetchSavedScenario);
const mockedFetchSavedScenarios = vi.mocked(fetchSavedScenarios);
const mockedPostLineupAnalysis = vi.mocked(postLineupAnalysis);
const mockedPostLineupComparison = vi.mocked(postLineupComparison);
const mockedPostLineupGeneration = vi.mocked(postLineupGeneration);
const mockedPostIntentInterpretation = vi.mocked(postIntentInterpretation);
const mockedPostLineupRepair = vi.mocked(postLineupRepair);
const mockedSaveScenarioRequest = vi.mocked(saveScenarioRequest);

const playerNames = [
  'Jordan Vega',
  'Malik Rhodes',
  'Eli Mercer',
  'Theo Grant',
  'Samir Cole',
  'Darius Knox',
];

const demoTeam = {
  id: 'metro-city-meteors',
  name: 'Metro City Meteors',
  abbreviation: 'MCM',
  mode: 'team' as const,
  season: 'Demo',
  sourceLabel: 'Seeded fictional demo ratings',
  snapshotDate: '2026-09-14',
  isDemo: true,
  searchStrategy: 'exhaustive' as const,
};

const players = playerNames.map((name, index) => ({
  id: name.toLowerCase().replace(' ', '-'),
  name,
  teamId: 'metro-city-meteors',
  teamAbbreviation: 'MCM',
  position: ['PG', 'SG', 'SF', 'PF', 'SG', 'SF/PF'][index] ?? 'G',
  profile: {
    shooting: 90 - index,
    creation: 84 - index,
    playmaking: 80 - index,
    rebounding: 60 + index,
    perimeterDefense: 78 + index,
    interiorDefense: 55 + index,
    switchability: 76 + index,
  },
}));

const metric = {
  score: 91.2,
  evidence: [
    {
      id: 'shooting:weight:mean',
      kind: 'weighted-component' as const,
      label: 'Lineup average · 100%',
      value: 86.2,
      description: '86.2 × 100% = 86.2 points.',
    },
    {
      id: 'shooting:player:jordan-vega',
      kind: 'player-score' as const,
      label: 'Jordan Vega',
      value: 92,
      description: "Jordan Vega's normalized shooting profile score.",
      playerId: 'jordan-vega',
    },
    {
      id: 'shooting:rule:spacing',
      kind: 'rule-adjustment' as const,
      label: 'Four-player spacing bonus',
      value: 5,
      description: 'Five credible shooters force the defense to cover most of the floor.',
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchHealth.mockResolvedValue({
    status: 'ok',
    service: 'lineup-engine-api',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
  mockedFetchIntentInterpreterStatus.mockResolvedValue({ available: true });
  mockedFetchPersistenceStatus.mockResolvedValue({ available: false });
  mockedFetchSavedScenarios.mockResolvedValue({ scenarios: [] });
  mockedFetchTeams.mockResolvedValue({
    teams: [demoTeam],
  });
  mockedFetchRoster.mockResolvedValue({
    team: demoTeam,
    players,
  });
  mockedPostLineupAnalysis.mockResolvedValue({
    lineup: {
      playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
    },
    analysis: {
      shooting: metric,
      creation: metric,
      playmaking: metric,
      rebounding: metric,
      perimeterDefense: metric,
      interiorDefense: metric,
      switchability: metric,
      findings: [
        {
          id: 'spacing:strong',
          type: 'spacing',
          severity: 'strength',
          title: 'Strong spacing',
          description: 'Five players meet the shooting threshold.',
        },
      ],
    },
  });
  mockedPostLineupGeneration.mockResolvedValue({
    winner: {
      lineup: {
        playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      },
      analysis: {
        shooting: metric,
        creation: metric,
        playmaking: metric,
        rebounding: metric,
        perimeterDefense: metric,
        interiorDefense: metric,
        switchability: metric,
        findings: [],
      },
      objectiveScore: 91.2,
      constraints: [
        {
          id: 'minimum-shooters',
          kind: 'minimum-shooters',
          label: 'Credible shooters',
          satisfied: true,
          actual: 5,
          required: 3,
          description: '5 of 5 players meet the 75-point shooting threshold; 3 required.',
        },
      ],
    },
    alternatives: [],
    appliedPriorities: {
      shooting: 1,
      creation: 1,
      playmaking: 1,
      rebounding: 1,
      perimeterDefense: 1,
      interiorDefense: 1,
      switchability: 1,
    },
    usedBalancedDefault: false,
    evaluatedCandidateCount: 6,
    validCandidateCount: 4,
  });
  mockedPostIntentInterpretation.mockResolvedValue({
    status: 'ready',
    intent: {
      priorities: {
        shooting: 1,
        creation: 0.5,
        playmaking: 0.5,
        rebounding: 0.5,
        perimeterDefense: 1,
        interiorDefense: 1,
        switchability: 1,
      },
      minimumShooters: 4,
      minimumCreators: 2,
      metricMinimums: { perimeterDefense: 75 },
      requiredPlayerIds: ['jordan-vega'],
      excludedPlayerIds: ['darius-knox'],
    },
    summary: 'Prioritize spacing and defense with two creators.',
    assumptions: ['Defense means both perimeter and interior defense.'],
    questions: [],
    provider: 'openai',
    model: 'test-model',
  });
  const beforeMetric = { ...metric, score: 70 };
  const beforeRebounding = { ...metric, score: 80 };
  const afterMetric = { ...metric, score: 80 };
  const afterRebounding = { ...metric, score: 70 };
  const beforeAnalysis = {
    shooting: beforeMetric,
    creation: beforeMetric,
    playmaking: beforeMetric,
    rebounding: beforeRebounding,
    perimeterDefense: beforeMetric,
    interiorDefense: beforeMetric,
    switchability: beforeMetric,
    findings: [],
  };
  const afterAnalysis = {
    shooting: afterMetric,
    creation: afterMetric,
    playmaking: afterMetric,
    rebounding: afterRebounding,
    perimeterDefense: afterMetric,
    interiorDefense: afterMetric,
    switchability: afterMetric,
    findings: [],
  };
  mockedPostLineupRepair.mockResolvedValue({
    repair: {
      before: {
        lineup: {
          playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
        },
        analysis: beforeAnalysis,
        objectiveScore: 71.4,
        constraints: [
          {
            id: 'minimum-shooters',
            kind: 'minimum-shooters',
            label: 'Credible shooters',
            satisfied: false,
            actual: 2,
            required: 3,
            description: '2 of 5 players meet the threshold; 3 required.',
          },
        ],
      },
      after: {
        lineup: {
          playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'],
        },
        analysis: afterAnalysis,
        objectiveScore: 78.6,
        constraints: [
          {
            id: 'minimum-shooters',
            kind: 'minimum-shooters',
            label: 'Credible shooters',
            satisfied: true,
            actual: 3,
            required: 3,
            description: '3 of 5 players meet the threshold; 3 required.',
          },
        ],
      },
      swapCount: 1,
      removedPlayerIds: ['samir-cole'],
      addedPlayerIds: ['darius-knox'],
      comparison: {
        metrics: [
          { metric: 'shooting', before: 70, after: 80, delta: 10 },
          { metric: 'creation', before: 70, after: 80, delta: 10 },
          { metric: 'playmaking', before: 70, after: 80, delta: 10 },
          { metric: 'rebounding', before: 80, after: 70, delta: -10 },
          { metric: 'perimeterDefense', before: 70, after: 80, delta: 10 },
          { metric: 'interiorDefense', before: 70, after: 80, delta: 10 },
          { metric: 'switchability', before: 70, after: 80, delta: 10 },
        ],
        largestGain: { metric: 'shooting', before: 70, after: 80, delta: 10 },
        largestTradeoff: { metric: 'rebounding', before: 80, after: 70, delta: -10 },
      },
    },
    appliedPriorities: {
      shooting: 1,
      creation: 1,
      playmaking: 1,
      rebounding: 1,
      perimeterDefense: 1,
      interiorDefense: 1,
      switchability: 1,
    },
    usedBalancedDefault: false,
    evaluatedCandidateCount: 6,
    validCandidateCount: 4,
  });
  mockedPostLineupComparison.mockResolvedValue({
    comparison: {
      before: {
        lineup: {
          playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
        },
        analysis: beforeAnalysis,
        objectiveScore: 71.4,
        constraints: [
          {
            id: 'minimum-shooters',
            kind: 'minimum-shooters',
            label: 'Credible shooters',
            satisfied: false,
            actual: 2,
            required: 3,
            description: '2 of 5 players meet the threshold; 3 required.',
          },
        ],
      },
      after: {
        lineup: {
          playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'],
        },
        analysis: afterAnalysis,
        objectiveScore: 78.6,
        constraints: [
          {
            id: 'minimum-shooters',
            kind: 'minimum-shooters',
            label: 'Credible shooters',
            satisfied: true,
            actual: 3,
            required: 3,
            description: '3 of 5 players meet the threshold; 3 required.',
          },
        ],
      },
      removedPlayerIds: ['samir-cole'],
      addedPlayerIds: ['darius-knox'],
      retainedPlayerIds: ['eli-mercer', 'jordan-vega', 'malik-rhodes', 'theo-grant'],
      comparison: {
        metrics: [
          { metric: 'shooting', before: 70, after: 80, delta: 10 },
          { metric: 'creation', before: 70, after: 80, delta: 10 },
          { metric: 'playmaking', before: 70, after: 80, delta: 10 },
          { metric: 'rebounding', before: 80, after: 70, delta: -10 },
          { metric: 'perimeterDefense', before: 70, after: 80, delta: 10 },
          { metric: 'interiorDefense', before: 70, after: 80, delta: 10 },
          { metric: 'switchability', before: 70, after: 80, delta: 10 },
        ],
        largestGain: { metric: 'shooting', before: 70, after: 80, delta: 10 },
        largestTradeoff: { metric: 'rebounding', before: 80, after: 70, delta: -10 },
      },
    },
    usedBalancedDefault: false,
  });
});

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('manual lineup builder', () => {
  it('defaults to the current Spurs roster and disables players without completed-season data', async () => {
    const user = userEvent.setup();
    const spurs = {
      ...demoTeam,
      id: 'nba-2026-27-sas',
      name: 'San Antonio Spurs',
      abbreviation: 'SAS',
      season: '2026–27 roster · 2025–26 stats',
      sourceLabel: 'Current Spurs roster with completed 2025–26 profiles',
      sourceUrl: 'https://www.nba.com/team/1610612759',
      snapshotDate: '2026-09-14',
      isDemo: false,
      rosterPlayerCount: 18,
      profiledPlayerCount: 12,
      defaultMinimumShooters: 0,
      defaultMinimumCreators: 0,
    };
    mockedFetchTeams.mockResolvedValue({ teams: [spurs, demoTeam] });
    mockedFetchRoster.mockResolvedValue({
      team: spurs,
      players: [
        { ...players[0]!, teamId: spurs.id, teamAbbreviation: 'SAS' },
        {
          id: 'nba-2026-27-sas-jakobi-gillespie',
          name: "Ja'Kobi Gillespie",
          teamId: spurs.id,
          teamAbbreviation: 'SAS',
          position: 'PG',
          profileStatus: 'unavailable',
          profileReason: 'No completed 2025–26 NBA regular-season profile is available.',
        },
      ],
    });

    renderApp();

    expect(await screen.findByText('San Antonio Spurs')).toBeVisible();
    expect(
      screen.getByText(/12 of 18 current players have completed-season profiles/i),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: "Profile unavailable for Ja'Kobi Gillespie" }),
    ).toBeDisabled();
    expect(screen.getByText('Profile unavailable')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    expect(screen.getByLabelText('Minimum credible shooters')).toHaveValue('0');
    expect(screen.getByLabelText('Minimum high-level creators')).toHaveValue('0');
  });

  it('switches between real team and searchable league pools with source context', async () => {
    const user = userEvent.setup();
    const realTeam = {
      ...demoTeam,
      id: 'nba-2024-25-bos',
      name: 'Boston Celtics',
      abbreviation: 'BOS',
      season: '2024–25',
      sourceLabel: 'Basketball Reference 2024–25 regular-season snapshot',
      sourceUrl: 'https://www.basketball-reference.com/leagues/NBA_2025.html',
      snapshotDate: '2025-04-13',
      isDemo: false,
    };
    const leaguePool = {
      ...realTeam,
      id: 'nba-2024-25-league-snapshot',
      name: '2024–25 league snapshot',
      abbreviation: 'NBA',
      mode: 'league' as const,
      searchStrategy: 'solver' as const,
    };
    const leaguePlayers = ['Boston Player', 'Denver Player', 'New York Player', 'OKC Player'].map(
      (name, index) => ({
        ...players[index]!,
        id: `real-${index}`,
        name,
        teamId: `real-team-${index}`,
        teamAbbreviation: ['BOS', 'DEN', 'NYK', 'OKC'][index]!,
      }),
    );
    mockedFetchTeams.mockResolvedValue({ teams: [realTeam, leaguePool, demoTeam] });
    mockedFetchRoster.mockImplementation(async (teamId) => ({
      team: teamId === leaguePool.id ? leaguePool : realTeam,
      players: teamId === leaguePool.id ? leaguePlayers : leaguePlayers.slice(0, 1),
    }));

    renderApp();
    expect(await screen.findByText(/snapshot 2025-04-13/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'League' }));
    expect(await screen.findByText(/time-limited full-pool optimizer/i)).toBeVisible();
    const search = screen.getByRole('searchbox', { name: 'Find a player or team' });
    await user.type(search, 'DEN');
    expect(screen.getByRole('button', { name: 'Select Denver Player' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Select Boston Player' })).not.toBeInTheDocument();
  });

  it('opens a curated analysis scenario in one click', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Analyze balanced five' }));

    expect(mockedPostLineupAnalysis.mock.calls[0]?.[0]).toEqual({
      teamId: 'metro-city-meteors',
      playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
    });
    expect(
      await screen.findByRole('heading', { name: 'How this five fits together.' }),
    ).toBeVisible();
  });

  it('selects exactly five players, requests analysis, and reveals metric evidence', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByRole('button', { name: 'Select Jordan Vega' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();

    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }

    expect(screen.getByText('Your five is ready for analysis.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Select Darius Knox' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));

    expect(mockedPostLineupAnalysis.mock.calls[0]?.[0]).toEqual({
      teamId: 'metro-city-meteors',
      playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
    });
    expect(
      await screen.findByRole('heading', { name: 'How this five fits together.' }),
    ).toBeVisible();
    expect(screen.getByText('Strong spacing')).toBeVisible();

    const shootingCard = screen.getByText('Shooting').closest('details');
    expect(shootingCard).not.toBeNull();
    await user.click(within(shootingCard!).getByText('Shooting'));
    expect(within(shootingCard!).getByText('Four-player spacing bonus')).toBeVisible();
    expect(within(shootingCard!).getByText('Lineup average · 100%')).toBeVisible();
    expect(within(shootingCard!).getByText('91.2 / 100')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove Jordan Vega' }));
    expect(
      screen.queryByRole('heading', { name: 'How this five fits together.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();
  });

  it('shows a team error instead of indefinite roster loading and recovers on retry', async () => {
    const user = userEvent.setup();
    mockedFetchTeams.mockRejectedValueOnce(new Error('offline'));
    renderApp();

    expect(await screen.findByText('We couldn’t load the teams.')).toBeVisible();
    expect(screen.queryByText('Loading roster…')).not.toBeInTheDocument();
    expect(mockedFetchRoster).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry teams' }));
    expect(await screen.findByRole('button', { name: 'Select Jordan Vega' })).toBeVisible();
    expect(screen.queryByText('We couldn’t load the teams.')).not.toBeInTheDocument();
  });

  it('distinguishes an empty team list from loading', async () => {
    mockedFetchTeams.mockResolvedValue({ teams: [] });
    renderApp();

    expect(await screen.findByText('No teams available yet.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeDisabled();
    expect(screen.queryByText('Loading roster…')).not.toBeInTheDocument();
    expect(mockedFetchRoster).not.toHaveBeenCalled();
  });

  it('recovers from a roster failure without reloading the page', async () => {
    const user = userEvent.setup();
    mockedFetchRoster.mockRejectedValueOnce(new Error('offline'));
    renderApp();

    expect(await screen.findByText('We couldn’t load this roster.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry roster' }));
    expect(await screen.findByRole('button', { name: 'Select Jordan Vega' })).toBeVisible();
  });

  it('shows an empty roster and keeps analysis disabled', async () => {
    mockedFetchRoster.mockResolvedValue({
      team: demoTeam,
      players: [],
    });
    renderApp();

    expect(await screen.findByText('No players available yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();
    expect(screen.queryByText('Loading roster…')).not.toBeInTheDocument();
  });

  it('retries a failed analysis with the same selected five', async () => {
    const user = userEvent.setup();
    mockedPostLineupAnalysis.mockRejectedValueOnce(new Error('offline'));
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t evaluate that five.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry analysis' }));
    expect(
      await screen.findByRole('heading', { name: 'How this five fits together.' }),
    ).toBeVisible();
    expect(mockedPostLineupAnalysis.mock.calls[1]?.[0]).toEqual(
      mockedPostLineupAnalysis.mock.calls[0]?.[0],
    );
  });

  it('does not display an outdated analysis after the selection changes during a request', async () => {
    const user = userEvent.setup();
    const response = await mockedPostLineupAnalysis({
      teamId: 'metro-city-meteors',
      playerIds: [],
    });
    let resolveAnalysis!: (value: typeof response) => void;
    mockedPostLineupAnalysis.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAnalysis = resolve;
        }),
    );
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    expect(
      await screen.findByRole('heading', { name: 'Finding the strengths in your five…' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove Jordan Vega' }));
    await act(async () => {
      resolveAnalysis(response);
    });
    expect(
      await screen.findByRole('heading', { name: 'Build the lineup, then inspect the fit.' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'How this five fits together.' }),
    ).not.toBeInTheDocument();
  });
});

describe('structured lineup generation', () => {
  it('interprets natural language into editable structured settings', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Lineup request' }),
      'Prioritize spacing and defense, keep Jordan, and use two creators.',
    );
    await user.click(screen.getByRole('button', { name: 'Interpret request' }));

    expect(await screen.findByRole('heading', { name: 'Review the interpretation' })).toBeVisible();
    expect(screen.getByText('Prioritize spacing and defense with two creators.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use as a starting point' }));

    expect(screen.getByLabelText('Minimum credible shooters')).toHaveValue('4');
    expect(screen.getByLabelText('Minimum high-level creators')).toHaveValue('2');
    expect(screen.getByLabelText('Perimeter defense', { selector: 'input' })).toHaveValue(75);
    expect(screen.getByRole('checkbox', { name: 'Require Jordan Vega' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Exclude Darius Knox' })).toBeChecked();
  });

  it('shows clarification questions before an ambiguous interpretation is applied', async () => {
    const user = userEvent.setup();
    mockedPostIntentInterpretation.mockResolvedValueOnce({
      status: 'needs_clarification',
      intent: {
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
      },
      summary: 'The request includes a small-ball preference that needs clarification.',
      assumptions: [],
      questions: ['Which supported metric should represent small ball for this request?'],
      provider: 'openai',
      model: 'test-model',
    });
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Lineup request' }),
      'Build a small-ball five.',
    );
    await user.click(screen.getByRole('button', { name: 'Interpret request' }));

    expect(await screen.findByText('Needs clarification')).toBeVisible();
    expect(
      screen.getByText('Which supported metric should represent small ball for this request?'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use as a starting point' })).toBeEnabled();
  });

  it('keeps structured generation usable when AI is unavailable', async () => {
    const user = userEvent.setup();
    mockedFetchIntentInterpreterStatus.mockResolvedValueOnce({ available: false });
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    expect(
      await screen.findByText(
        'Natural-language help is unavailable. Every structured control below still works.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Interpret request' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate lineup' })).toBeEnabled();
  });

  it('submits balanced defaults, shows requirement evidence, and clears stale results on change', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    expect(screen.getByRole('heading', { name: 'Shape your best five' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Generate lineup' }));
    expect(mockedPostLineupGeneration.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        teamId: 'metro-city-meteors',
        intent: expect.objectContaining({
          minimumShooters: 3,
          minimumCreators: 1,
          requiredPlayerIds: [],
          excludedPlayerIds: [],
        }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'The strongest fit for your intent.' }),
    ).toBeVisible();
    expect(screen.getByText('Weighted fit')).toBeVisible();
    expect(screen.getByText('Credible shooters')).toBeVisible();
    expect(screen.getByText(/Ranked first among 4 valid lineups/)).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Shooting', { selector: 'select' }), '0.5');
    expect(
      screen.queryByRole('heading', { name: 'The strongest fit for your intent.' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Set the rules. We’ll search every five.' }),
    ).toBeVisible();
  });

  it('keeps the manual selection workflow available after visiting generation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    await user.click(screen.getByRole('tab', { name: 'Build manually' }));

    expect(screen.getByRole('button', { name: 'Select Jordan Vega' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();
  });

  it('uses the latest generated winner as a repair starting point', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from intent' }));
    await user.click(screen.getByRole('button', { name: 'Generate lineup' }));
    await screen.findByRole('heading', { name: 'The strongest fit for your intent.' });

    await user.click(screen.getByRole('tab', { name: 'Repair a lineup' }));
    expect(screen.getByRole('heading', { name: 'Set the new intent' })).toBeVisible();
    expect(screen.getByText(/Jordan Vega · Malik Rhodes · Eli Mercer/)).toBeVisible();
  });
});

describe('lineup repair and comparison', () => {
  it('requires a starting five before opening repair controls', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });

    await user.click(screen.getByRole('tab', { name: 'Repair a lineup' }));
    expect(
      screen.getByRole('heading', { name: 'Select five players before repairing.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Build starting five' }));
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();
  });

  it('repairs a manual five and explains swaps and metric tradeoffs', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('tab', { name: 'Repair a lineup' }));
    expect(screen.getByRole('heading', { name: 'Set the new intent' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Repair lineup' }));
    expect(mockedPostLineupRepair.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        teamId: 'metro-city-meteors',
        currentPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      }),
    );
    expect(await screen.findByRole('heading', { name: '1 swap made.' })).toBeVisible();
    expect(screen.getByText('Samir Cole', { selector: '.swap-summary strong' })).toBeVisible();
    expect(screen.getByText('Darius Knox', { selector: '.swap-summary strong' })).toBeVisible();
    expect(screen.getByText('Largest tradeoff')).toBeVisible();
    expect(screen.getByText('Rebounding', { selector: '.tradeoff strong' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'The smallest change that works.' })).toBeVisible();
    expect(screen.getByText(/fewest swaps took priority over weighted fit/)).toBeVisible();
  });
});

describe('session lineup versions', () => {
  it('saves named versions, compares them, and branches without replacing history', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });

    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    const firstName = screen.getByRole('textbox', { name: 'Version name' });
    await user.clear(firstName);
    await user.type(firstName, 'Balanced start');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await user.click(screen.getByRole('button', { name: 'Remove Samir Cole' }));
    await user.click(screen.getByRole('button', { name: 'Select Darius Knox' }));
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    const secondName = screen.getByRole('textbox', { name: 'Version name' });
    await user.clear(secondName);
    await user.type(secondName, 'Defense branch');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await user.click(screen.getByRole('tab', { name: 'Compare & versions' }));
    expect(screen.getAllByText('Balanced start')[0]).toBeVisible();
    expect(screen.getAllByText('Defense branch')[0]).toBeVisible();
    expect(screen.getByText('manual · branched from Balanced start')).toBeVisible();
    expect(screen.getByText(/Save the scenario above to recover/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Compare versions' }));
    expect(mockedPostLineupComparison.mock.calls[0]?.[0]).toMatchObject({
      teamId: 'metro-city-meteors',
      beforePlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      afterPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'],
    });
    expect(await screen.findByText('Largest tradeoff')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Balanced start Defense branch' })).toBeVisible();
    expect(screen.getByText('× Misses')).toBeVisible();
    expect(screen.getByText('✓ Meets')).toBeVisible();

    await user.click(screen.getAllByRole('button', { name: 'Branch from here' })[0]!);
    expect(screen.getByRole('tab', { name: 'Build manually' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Remove Samir Cole' })).toBeVisible();
  });

  it('saves and reopens a durable scenario with its branch history', async () => {
    mockedFetchPersistenceStatus.mockResolvedValue({ available: true });
    const scenarioId = '33333333-3333-4333-8333-333333333333';
    mockedFetchSavedScenarios.mockResolvedValue({
      scenarios: [
        {
          id: scenarioId,
          name: 'Saved branch',
          teamId: 'metro-city-meteors',
          versionCount: 2,
          createdAt: '2026-09-15T08:00:00.000Z',
          updatedAt: '2026-09-15T08:10:00.000Z',
        },
      ],
    });
    const analysis = {
      lineup: {
        playerIds: [
          ...playerNames.slice(0, 5).map((name) => name.toLowerCase().replace(' ', '-')),
        ] as [string, string, string, string, string],
      },
      analysis: {
        shooting: metric,
        creation: metric,
        playmaking: metric,
        rebounding: metric,
        perimeterDefense: metric,
        interiorDefense: metric,
        switchability: metric,
        findings: [],
      },
    };
    mockedFetchSavedScenario.mockResolvedValue({
      id: scenarioId,
      name: 'Saved branch',
      teamId: 'metro-city-meteors',
      selectedPlayerIds: analysis.lineup.playerIds,
      activeParentClientVersionId: 'saved-2',
      versions: [
        {
          clientVersionId: 'saved-1',
          name: 'Balanced start',
          source: 'manual',
          playerIds: analysis.lineup.playerIds,
          analysis,
          dataVersion: 'fictional-demo-v1:2026-09-14:fictional-demo-v1',
          scoringVersion: 'lineup-analysis-v1',
          createdAt: '2026-09-15T08:00:00.000Z',
        },
        {
          clientVersionId: 'saved-2',
          parentClientVersionId: 'saved-1',
          name: 'Defense branch',
          source: 'manual',
          playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'],
          analysis: {
            ...analysis,
            lineup: {
              playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'],
            },
          },
          dataVersion: 'fictional-demo-v1:2026-09-14:fictional-demo-v1',
          scoringVersion: 'lineup-analysis-v1',
          createdAt: '2026-09-15T08:05:00.000Z',
        },
      ],
      createdAt: '2026-09-15T08:00:00.000Z',
      updatedAt: '2026-09-15T08:10:00.000Z',
    });

    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Compare & versions' }));
    expect(await screen.findByText('Database ready')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Open' }));

    expect(await screen.findByText('manual · branched from Balanced start')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update saved scenario' })).toBeVisible();
    expect(mockedFetchSavedScenario).toHaveBeenCalledWith(expect.any(String), scenarioId);

    const loadedScenario = await mockedFetchSavedScenario.mock.results[0]!.value;
    mockedSaveScenarioRequest.mockResolvedValue(loadedScenario);
    await user.click(screen.getByRole('button', { name: 'Update saved scenario' }));
    expect(mockedSaveScenarioRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'Saved branch', versions: expect.any(Array) }),
      scenarioId,
    );
  });
});
