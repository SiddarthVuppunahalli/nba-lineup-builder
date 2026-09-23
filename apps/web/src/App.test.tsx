import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiClientError,
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
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: unknown[];

    constructor(message: string, status: number, code: string, details: unknown[] = []) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
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
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  Element.prototype.scrollIntoView = vi.fn();
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
          description: '5 of 5 players meet the 65-point shooting threshold; 3 required.',
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

function renderApp(initialEntry = '/build') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('navigation foundation', () => {
  it('shows the landing hero and all three workflow choices', async () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'STARTING FIVE' })).toBeVisible();
    expect(screen.getByRole('link', { name: /build a lineup/i })).toHaveAttribute('href', '/build');
    expect(screen.getByRole('link', { name: /repair/i })).toHaveAttribute('href', '/repair');
    expect(screen.getByRole('link', { name: /compare/i })).toHaveAttribute('href', '/compare');
    expect(screen.getByRole('region', { name: 'Lineup workflows' })).toBeVisible();
    expect(screen.queryByText('Next possession')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('What do you want to solve?')).not.toBeInTheDocument();
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
    expect(screen.queryByText('Adapt')).not.toBeInTheDocument();
    expect(screen.queryByText('Decide')).not.toBeInTheDocument();
    expect(screen.queryByText(/system ready/i)).not.toBeInTheDocument();
  });

  it('supports direct navigation to the personal About page with its media and profiles', () => {
    renderApp('/about');

    expect(screen.getByRole('heading', { name: 'About me' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'San Antonio Spurs logo' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Kawhi Leonard' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My favorite NBA moment' })).toBeVisible();
    expect(screen.getByTitle('My favorite NBA moment')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/ojM9nVvigyA',
    );
    expect(screen.queryByText(/privacy-enhanced/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play video' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'LinkedIn profile' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/siddarthvuppunahalli',
    );
    expect(screen.getByRole('link', { name: 'GitHub profile' })).toHaveAttribute(
      'href',
      'https://github.com/SiddarthVuppunahalli',
    );
    expect(screen.queryByText('[ABOUT THE PROJECT]')).not.toBeInTheDocument();
    expect(screen.queryByText('01')).not.toBeInTheDocument();
    expect(screen.queryByText('02')).not.toBeInTheDocument();
    expect(screen.queryByText('03')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to landing/i })).toHaveAttribute('href', '/');
  });

  it('returns workflow pages to the selector on the landing page', () => {
    renderApp('/build');

    expect(screen.getByRole('link', { name: /all workflows/i })).toHaveAttribute(
      'href',
      '/#workflows',
    );
    expect(screen.getByRole('region', { name: 'Player pool selection' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Repair a lineup' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Compare & versions' })).not.toBeInTheDocument();
    expect(screen.queryByText('Choose the five. Understand the fit.')).not.toBeInTheDocument();
  });
});

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
    await user.click(screen.getByText('Details +'));
    expect(
      screen.getByText(/12 of 18 current players have completed-season profiles/i),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: "Profile unavailable for Ja'Kobi Gillespie" }),
    ).toBeDisabled();
    expect(screen.getByText('Profile unavailable')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByText('Advanced controls'));
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
    await user.click(screen.getByText('Details +'));
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
    const lineupDisclosure = screen.getByText('Edit selected five').closest('details')!;
    expect(lineupDisclosure).not.toHaveAttribute('open');
    expect(
      screen.getByRole('heading', { name: 'Select exactly five', hidden: true }),
    ).not.toBeVisible();

    const analysisSection = screen
      .getByRole('heading', { name: 'How this five fits together.' })
      .closest('section');
    const shootingCard = within(analysisSection!).getByText('Shooting').closest('details');
    expect(shootingCard).not.toBeNull();
    await user.click(within(shootingCard!).getByText('Shooting'));
    expect(within(shootingCard!).getByText('Four-player spacing bonus')).toBeVisible();
    expect(within(shootingCard!).getByText('Lineup average · 100%')).toBeVisible();
    expect(within(shootingCard!).getByText('91.2 / 100')).toBeVisible();

    await user.click(screen.getByText('Edit selected five'));
    expect(lineupDisclosure).toHaveAttribute('open');
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
    expect(await screen.findByRole('heading', { name: 'Select exactly five' })).toBeVisible();
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
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Lineup request' }),
      'Prioritize spacing and defense, keep Jordan, and use two creators.',
    );
    await user.click(screen.getByRole('button', { name: 'Interpret request' }));

    expect(await screen.findByRole('heading', { name: 'Review the interpretation' })).toBeVisible();
    expect(screen.getByText('Prioritize spacing and defense with two creators.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use as a starting point' }));

    await user.click(screen.getByText('Advanced controls'));
    expect(screen.getByLabelText('Minimum credible shooters')).toHaveValue('4');
    expect(screen.getByLabelText('Minimum high-level creators')).toHaveValue('2');
    expect(screen.getByLabelText('Perimeter defense', { selector: 'input' })).toHaveValue(75);
    expect(screen.getByText('Required').closest('.player-rule-chip')).toHaveTextContent(
      'Jordan Vega',
    );
    expect(screen.getByText('Excluded').closest('.player-rule-chip')).toHaveTextContent(
      'Darius Knox',
    );
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
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
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
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
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
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
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

    const generationDisclosure = screen
      .getByText('Edit goals and requirements')
      .closest('details')!;
    expect(generationDisclosure).not.toHaveAttribute('open');
    await user.click(screen.getByText('Edit goals and requirements'));
    expect(generationDisclosure).toHaveAttribute('open');
    await user.click(screen.getByText('Advanced controls'));
    await user.selectOptions(screen.getByLabelText('Shooting', { selector: 'select' }), '0.5');
    expect(
      screen.queryByRole('heading', { name: 'The strongest fit for your intent.' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shape your best five' })).toBeVisible();
  });

  it('keeps the manual selection workflow available after visiting generation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByRole('tab', { name: 'Choose players' }));

    expect(screen.getByRole('button', { name: 'Select Jordan Vega' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyze lineup' })).toBeDisabled();
  });

  it('uses the latest generated winner as a repair starting point', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByRole('button', { name: 'Generate lineup' }));
    await screen.findByRole('heading', { name: 'The strongest fit for your intent.' });

    await user.click(screen.getByRole('button', { name: 'Repair this lineup' }));
    expect(screen.getByRole('heading', { name: 'Confirm the lineup to repair' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Describe what needs to change' })).toBeVisible();
    expect(screen.getByText(/Jordan Vega · Malik Rhodes · Eli Mercer/)).toBeVisible();
  });

  it('preserves player selections and goal settings while switching Build methods', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Select Jordan Vega' }));
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Lineup request' }),
      'Prioritize shooting.',
    );
    await user.click(screen.getByText('Advanced controls'));
    await user.selectOptions(screen.getByLabelText('Minimum credible shooters'), '4');

    await user.click(screen.getByRole('tab', { name: 'Choose players' }));
    expect(screen.getByRole('button', { name: 'Remove Jordan Vega' })).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    expect(screen.getByRole('textbox', { name: 'Lineup request' })).toHaveValue(
      'Prioritize shooting.',
    );
    expect(screen.getByLabelText('Minimum credible shooters')).toHaveValue('4');
  });

  it('keeps league player rules compact with search, explicit actions, and removable chips', async () => {
    const user = userEvent.setup();
    const leaguePlayers = Array.from({ length: 40 }, (_, index) => ({
      ...players[index % players.length]!,
      id: `league-player-${index}`,
      name: `League Player ${String(index + 1).padStart(2, '0')}`,
      teamId: `team-${index % 30}`,
      teamAbbreviation: `T${String(index % 30).padStart(2, '0')}`,
    }));
    mockedFetchRoster.mockResolvedValue({ team: demoTeam, players: leaguePlayers });
    renderApp();

    await screen.findByRole('button', { name: 'Select League Player 01' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByText('Advanced controls'));
    expect(screen.getByText('No player-specific rules.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Require' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Add player rule'));
    await user.type(
      screen.getByRole('searchbox', { name: 'Find a player or team' }),
      'League Player',
    );
    expect(screen.getAllByRole('button', { name: 'Require' })).toHaveLength(8);
    expect(screen.getAllByRole('button', { name: 'Exclude' })).toHaveLength(8);

    await user.click(screen.getAllByRole('button', { name: 'Require' })[0]!);
    const removeRequirement = screen.getByRole('button', {
      name: 'Remove requirement for League Player 01',
    });
    expect(removeRequirement.closest('.player-rule-chip')).toHaveTextContent('League Player 01');
    await user.click(removeRequirement);
    expect(screen.getByText('No player-specific rules.')).toBeVisible();
  });

  it('limits required player rules to five', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByText('Advanced controls'));
    await user.click(screen.getByText('Add player rule'));
    await user.type(screen.getByRole('searchbox', { name: 'Find a player or team' }), 'MCM');

    for (let count = 0; count < 5; count += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Require' })[0]!);
    }

    expect(screen.getAllByText('Required', { selector: 'small' })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Require' })).toBeDisabled();
  });

  it('shows domain validation messages returned by generation', async () => {
    const user = userEvent.setup();
    mockedPostLineupGeneration.mockRejectedValueOnce(
      new ApiClientError('The lineup generation intent is invalid.', 422, 'INVALID_INTENT', [
        {
          code: 'UNKNOWN_EXCLUDED_PLAYER',
          message: 'Excluded players are not in the eligible pool: example-player.',
          playerIds: ['example-player'],
        },
      ]),
    );
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByRole('button', { name: 'Generate lineup' }));

    expect(
      await screen.findByText('Excluded players are not in the eligible pool: example-player.'),
    ).toBeVisible();
  });

  it('shows generation loading and preserves infeasible messaging and retry behavior', async () => {
    const user = userEvent.setup();
    let rejectGeneration!: (reason: Error) => void;
    mockedPostLineupGeneration.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectGeneration = reject;
        }),
    );
    renderApp();

    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    await user.click(screen.getByRole('button', { name: 'Generate lineup' }));
    expect(
      await screen.findByRole('heading', { name: 'Finding the best five for your intent…' }),
    ).toBeVisible();

    await act(async () => rejectGeneration(new Error('No lineup satisfies all requirements.')));
    expect(
      await screen.findByRole('heading', { name: 'Those requirements don’t fit this roster.' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry generation' }));
    expect(
      await screen.findByRole('heading', { name: 'The strongest fit for your intent.' }),
    ).toBeVisible();
  });

  it('reveals full-width results after the editor, moves focus, and returns to the exact five', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    const editor = screen.getByRole('heading', { name: 'Select exactly five' }).closest('form')!;
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));

    const heading = await screen.findByRole('heading', { name: 'How this five fits together.' });
    const results = heading.closest('.build-results')!;
    expect(editor.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const findings = screen.getByRole('heading', { name: 'What works' }).closest('.findings-grid')!;
    const scores = results.querySelector('.metric-grid')!;
    expect(
      findings.compareDocumentPosition(scores) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(heading).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    const lineupDisclosure = screen.getByText('Edit selected five').closest('details')!;
    expect(lineupDisclosure).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Back to editing' }));
    expect(lineupDisclosure).toHaveAttribute('open');
    expect(editor).toHaveFocus();
    for (const name of playerNames.slice(0, 5)) {
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toBeVisible();
    }
    expect(heading).toBeVisible();
    expect(screen.getByRole('button', { name: 'Repair this lineup' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Compare versions' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save version' })).toBeVisible();
  });

  it('focuses successful results without auto-scrolling when reduced motion is requested', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });
    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));

    const heading = await screen.findByRole('heading', { name: 'How this five fits together.' });
    expect(heading).toHaveFocus();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps long content in document flow at narrow widths', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    mockedFetchRoster.mockResolvedValue({
      team: demoTeam,
      players: [
        {
          ...players[0]!,
          name: 'A Very Long Player Name That Must Remain Fully Available On Narrow Screens',
        },
        ...players.slice(1),
      ],
    });
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText(
        'A Very Long Player Name That Must Remain Fully Available On Narrow Screens',
      ),
    ).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Generate from goals' }));
    const form = screen.getByRole('heading', { name: 'Shape your best five' }).closest('form')!;
    expect(form.style.height).toBe('');
    expect(form.style.maxHeight).toBe('');
    expect(form.style.overflowY).toBe('');
  });
});

describe('lineup repair and comparison', () => {
  it('requires a starting five before opening repair controls', async () => {
    const user = userEvent.setup();
    renderApp('/repair');

    expect(
      await screen.findByRole('heading', { name: 'Select five players before repairing.' }),
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
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    await user.click(screen.getByRole('button', { name: 'Repair this lineup' }));
    expect(screen.getByRole('heading', { name: 'Confirm the lineup to repair' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Describe what needs to change' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Repair lineup' }));
    expect(mockedPostLineupRepair.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        teamId: 'metro-city-meteors',
        currentPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      }),
    );
    expect(await screen.findByRole('heading', { name: '1 swap made.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '1 swap made.' })).toHaveFocus();
    expect(screen.getByText('Samir Cole', { selector: '.swap-summary strong' })).toBeVisible();
    expect(screen.getByText('Darius Knox', { selector: '.swap-summary strong' })).toBeVisible();
    const fixedRequirements = screen
      .getByRole('heading', { name: 'Requirements fixed' })
      .closest<HTMLElement>('.repair-constraint-summary')!;
    expect(
      within(fixedRequirements).getByText('3 of 5 players meet the threshold; 3 required.'),
    ).toBeVisible();
    expect(screen.getByText('Largest tradeoff')).toBeVisible();
    expect(screen.getByText('Rebounding', { selector: '.tradeoff strong' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'The smallest change that works.' })).toBeVisible();
    expect(screen.getByText(/fewest swaps took priority over weighted fit/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to editing' }));
    expect(
      screen.getByRole('heading', { name: 'Confirm the lineup to repair' }).closest('form'),
    ).toHaveFocus();
  });
});

describe('session lineup versions', () => {
  it('automatically persists a saved version when PostgreSQL is available', async () => {
    mockedFetchPersistenceStatus.mockResolvedValue({ available: true });
    const scenarioId = '44444444-4444-4444-8444-444444444444';
    mockedSaveScenarioRequest.mockImplementation(async (_sessionKey, request, requestedId) => ({
      id: requestedId ?? scenarioId,
      ...request,
      versions: request.versions.map((version, index) => ({
        ...version,
        analysis: {
          lineup: { playerIds: version.playerIds },
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
        },
        dataVersion: 'fictional-demo-v1:2026-09-14:fictional-demo-v1',
        scoringVersion: 'lineup-analysis-v2-experimental-roles',
        createdAt: `2026-09-21T08:0${index}:00.000Z`,
      })),
      createdAt: '2026-09-21T08:00:00.000Z',
      updatedAt: '2026-09-21T08:00:00.000Z',
    }));

    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });

    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    expect(await screen.findByText(/Saved to PostgreSQL automatically/i)).toBeVisible();

    const versionName = screen.getByRole('textbox', { name: 'Version name' });
    await user.clear(versionName);
    await user.type(versionName, 'Durable five');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await waitFor(() => expect(mockedSaveScenarioRequest).toHaveBeenCalledTimes(1));
    expect(mockedSaveScenarioRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: 'Metro City Meteors versions',
        teamId: 'metro-city-meteors',
        activeParentClientVersionId: expect.stringMatching(/^session-version-/),
        versions: [expect.objectContaining({ name: 'Durable five' })],
      }),
      undefined,
    );
    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Home' }));
    await user.click(screen.getByRole('link', { name: /compare/i }));
    expect(await screen.findByText('Durable five')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Update saved scenario' })).toBeVisible();
  });

  it('keeps saved versions available after visiting the landing page', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('button', { name: 'Select Jordan Vega' });

    for (const name of playerNames.slice(0, 5)) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    const versionName = screen.getByRole('textbox', { name: 'Version name' });
    await user.clear(versionName);
    await user.type(versionName, 'Return trip');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('heading', { name: 'STARTING FIVE' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: /compare/i }));

    expect(await screen.findByText('Return trip')).toBeVisible();
    expect(screen.getByText('1', { selector: '.version-count' })).toBeVisible();
  });

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

    await user.click(screen.getByText('Edit selected five'));
    await user.click(screen.getByRole('button', { name: 'Remove Samir Cole' }));
    await user.click(screen.getByRole('button', { name: 'Select Darius Knox' }));
    await user.click(screen.getByRole('button', { name: 'Analyze lineup' }));
    await screen.findByRole('heading', { name: 'How this five fits together.' });
    const secondName = screen.getByRole('textbox', { name: 'Version name' });
    await user.clear(secondName);
    await user.type(secondName, 'Defense branch');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await user.click(screen.getByRole('button', { name: 'Compare versions' }));
    expect(screen.getByLabelText('Selected comparison versions')).toHaveTextContent(
      'Balanced start',
    );
    expect(screen.getByLabelText('Selected comparison versions')).toHaveTextContent(
      'Defense branch',
    );
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
    expect(screen.getByRole('heading', { name: 'Balanced start Defense branch' })).toHaveFocus();
    expect(screen.getByText('× Misses')).toBeVisible();
    expect(screen.getByText('✓ Meets')).toBeVisible();
    const comparisonDisclosure = screen.getByText('Edit comparison').closest('details')!;
    expect(comparisonDisclosure).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Back to selection' }));
    expect(comparisonDisclosure).toHaveAttribute('open');
    expect(
      screen.getByRole('heading', { name: 'Choose the two lineups' }).closest('form'),
    ).toHaveFocus();

    await user.click(screen.getAllByRole('button', { name: 'Branch from here' })[0]!);
    expect(screen.getByRole('tab', { name: 'Choose players' })).toHaveAttribute(
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
    renderApp('/compare');
    expect(await screen.findByText('Database ready')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Open' }));

    expect(
      await screen.findByText('manual · branched from Balanced start · lineup-analysis-v1'),
    ).toBeVisible();
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
