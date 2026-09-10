import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchHealth,
  fetchRoster,
  fetchTeams,
  postLineupAnalysis,
  postLineupGeneration,
} from './api/client.ts';
import { App } from './App.tsx';

vi.mock('./api/client.ts', () => ({
  ApiClientError: class ApiClientError extends Error {},
  fetchHealth: vi.fn(),
  fetchTeams: vi.fn(),
  fetchRoster: vi.fn(),
  postLineupAnalysis: vi.fn(),
  postLineupGeneration: vi.fn(),
}));

const mockedFetchHealth = vi.mocked(fetchHealth);
const mockedFetchTeams = vi.mocked(fetchTeams);
const mockedFetchRoster = vi.mocked(fetchRoster);
const mockedPostLineupAnalysis = vi.mocked(postLineupAnalysis);
const mockedPostLineupGeneration = vi.mocked(postLineupGeneration);

const playerNames = [
  'Jordan Vega',
  'Malik Rhodes',
  'Eli Mercer',
  'Theo Grant',
  'Samir Cole',
  'Darius Knox',
];

const players = playerNames.map((name, index) => ({
  id: name.toLowerCase().replace(' ', '-'),
  name,
  teamId: 'metro-city-meteors',
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
  mockedFetchTeams.mockResolvedValue({
    teams: [{ id: 'metro-city-meteors', name: 'Metro City Meteors', abbreviation: 'MCM' }],
  });
  mockedFetchRoster.mockResolvedValue({
    team: { id: 'metro-city-meteors', name: 'Metro City Meteors', abbreviation: 'MCM' },
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
      team: { id: 'metro-city-meteors', name: 'Metro City Meteors', abbreviation: 'MCM' },
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
});
