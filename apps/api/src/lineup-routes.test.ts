import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('lineup pool routes', () => {
  it('lists real team, league, and fictional fallback pools with provenance', async () => {
    const response = await request(createApp()).get('/api/teams');

    expect(response.status).toBe(200);
    expect(response.body.teams).toHaveLength(37);
    expect(response.body.teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nba-2026-27-sas',
          mode: 'team',
          season: '2026–27 rosters · 2025–26 stats',
          rosterPlayerCount: 18,
          profiledPlayerCount: 12,
          defaultMinimumShooters: 0,
          defaultMinimumCreators: 0,
        }),
        expect.objectContaining({
          id: 'nba-current-league-2026-09-15',
          mode: 'league',
          rosterPlayerCount: 598,
          profiledPlayerCount: 392,
          searchStrategy: 'solver',
        }),
        expect.objectContaining({
          id: 'nba-2024-25-bos',
          mode: 'team',
          season: '2024–25',
          isDemo: false,
          searchStrategy: 'exhaustive',
        }),
        expect.objectContaining({
          id: 'nba-2024-25-league-snapshot',
          mode: 'league',
          searchStrategy: 'solver',
        }),
        expect.objectContaining({ id: 'metro-city-meteors', isDemo: true }),
      ]),
    );
  });

  it('returns roster players with normalized profiles', async () => {
    const response = await request(createApp()).get('/api/teams/metro-city-meteors/players');

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(10);
    expect(response.body.players[0]).toMatchObject({
      id: 'jordan-vega',
      name: 'Jordan Vega',
      position: 'PG',
      teamAbbreviation: 'MCM',
      profile: { shooting: 92, creation: 94 },
    });
  });

  it('returns a dated real roster and a cross-team league pool', async () => {
    const team = await request(createApp()).get('/api/teams/nba-2024-25-bos/players');
    const league = await request(createApp()).get('/api/teams/nba-2024-25-league-snapshot/players');

    expect(team.status).toBe(200);
    expect(team.body.team).toMatchObject({ name: 'Boston Celtics', snapshotDate: '2025-04-13' });
    expect(team.body.players).toHaveLength(10);
    expect(team.body.players).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Jayson Tatum' })]),
    );
    expect(league.status).toBe(200);
    expect(league.body.players).toHaveLength(40);
    expect(
      new Set(
        league.body.players.map((player: { teamAbbreviation: string }) => player.teamAbbreviation),
      ).size,
    ).toBe(4);
  });

  it('returns the full current Spurs roster and labels players without invented profiles', async () => {
    const response = await request(createApp()).get('/api/teams/nba-2026-27-sas/players');

    expect(response.status).toBe(200);
    expect(response.body.team).toMatchObject({
      name: 'San Antonio Spurs',
      snapshotDate: '2026-09-15',
      rosterPlayerCount: 18,
      profiledPlayerCount: 12,
    });
    expect(response.body.players).toHaveLength(18);
    expect(response.body.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Victor Wembanyama',
          profileStatus: 'available',
          profile: expect.objectContaining({ interiorDefense: expect.any(Number) }),
        }),
        expect.objectContaining({
          name: "Ja'Kobi Gillespie",
          profileStatus: 'unavailable',
          profileReason: expect.stringContaining('No completed 2025–26'),
        }),
        expect.objectContaining({
          name: 'David Jones García',
          profileStatus: 'unavailable',
          profileReason: expect.stringContaining('below the 400-minute minimum'),
        }),
      ]),
    );
  });

  it('returns every current roster with accurate eligible and unavailable counts', async () => {
    const teamsResponse = await request(createApp()).get('/api/teams');
    const currentTeams = teamsResponse.body.teams.filter(
      (team: { id: string; mode: string }) =>
        team.id.startsWith('nba-2026-27-') && team.mode === 'team',
    );
    expect(currentTeams).toHaveLength(30);

    const atlanta = await request(createApp()).get('/api/teams/nba-2026-27-atl/players');
    expect(atlanta.status).toBe(200);
    expect(atlanta.body.team).toMatchObject({
      rosterPlayerCount: 23,
      profiledPlayerCount: 17,
      defaultMinimumShooters: 0,
      defaultMinimumCreators: 0,
    });
    expect(
      atlanta.body.players.filter(
        (player: { profileStatus: string }) => player.profileStatus === 'unavailable',
      ),
    ).toHaveLength(6);
  });

  it('returns an explicit error for an unknown team', async () => {
    const response = await request(createApp()).get('/api/teams/missing-team/players');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'TEAM_NOT_FOUND',
        message: 'No team exists with the id "missing-team".',
      },
    });
  });
});

describe('POST /api/lineups/analyze', () => {
  it('analyzes a valid five-player lineup through the domain engine', async () => {
    const response = await request(createApp())
      .post('/api/lineups/analyze')
      .send({
        teamId: 'metro-city-meteors',
        playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      });

    expect(response.status).toBe(200);
    expect(response.body.analysis.shooting.score).toBe(91.2);
    expect(response.body.analysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'spacing:strong', severity: 'strength' }),
      ]),
    );
  });

  it('returns domain validation details for an incomplete lineup', async () => {
    const response = await request(createApp())
      .post('/api/lineups/analyze')
      .send({
        teamId: 'metro-city-meteors',
        playerIds: ['jordan-vega', 'malik-rhodes'],
      });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_LINEUP',
        details: [
          {
            code: 'INVALID_PLAYER_COUNT',
            expected: 5,
            received: 2,
          },
        ],
      },
    });
  });

  it('rejects malformed request fields at the HTTP boundary', async () => {
    const response = await request(createApp()).post('/api/lineups/analyze').send({
      teamId: 42,
      playerIds: 'not-an-array',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects invalid JSON with a stable API error', async () => {
    const response = await request(createApp())
      .post('/api/lineups/analyze')
      .set('Content-Type', 'application/json')
      .send('{"teamId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body must contain valid JSON.',
      },
    });
  });

  it('rejects a malformed external payload before calling the domain', async () => {
    const response = await request(createApp()).post('/api/lineups/analyze').send({
      teamId: 'metro-city-meteors',
      playerIds: 'not-an-array',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The lineup analysis request is malformed.',
      },
    });
  });
});

const generationIntent = {
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
  metricMinimums: { perimeterDefense: 70 },
  requiredPlayerIds: ['andre-okafor'],
  excludedPlayerIds: ['nico-park'],
};

describe('POST /api/lineups/generate', () => {
  it('returns a schema-valid ranked lineup with constraint evidence', async () => {
    const response = await request(createApp()).post('/api/lineups/generate').send({
      teamId: 'metro-city-meteors',
      intent: generationIntent,
    });

    expect(response.status).toBe(200);
    expect(response.body.winner.lineup.playerIds).toHaveLength(5);
    expect(response.body.winner.lineup.playerIds).toContain('andre-okafor');
    expect(response.body.winner.lineup.playerIds).not.toContain('nico-park');
    expect(
      response.body.winner.constraints.every((item: { satisfied: boolean }) => item.satisfied),
    ).toBe(true);
    expect(response.body.alternatives.length).toBeLessThanOrEqual(2);
  });

  it('returns proof-aware full-pool solver metadata for league generation', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'nba-2024-25-league-snapshot',
        intent: {
          ...generationIntent,
          minimumShooters: 0,
          minimumCreators: 0,
          metricMinimums: {},
          requiredPlayerIds: [],
          excludedPlayerIds: [],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.winner.lineup.playerIds).toHaveLength(5);
    expect(response.body.search).toMatchObject({
      strategy: 'cp-sat',
      eligiblePlayerCount: 40,
      searchedPlayerCount: 40,
      combinationLimit: 658008,
      solverVersion: 'or-tools-cp-sat-wasm-0.9.1',
      timeLimitMs: 10000,
    });
    expect(response.body.search.solverStatus).toMatch(/optimal|feasible-time-limit/);
    expect(response.body.search.optimalityGuaranteed).toBe(
      response.body.search.solverStatus === 'optimal',
    );
  }, 15_000);

  it('exhaustively searches every profiled player on the current Spurs roster', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'nba-2026-27-sas',
        intent: {
          ...generationIntent,
          minimumShooters: 0,
          minimumCreators: 0,
          metricMinimums: {},
          requiredPlayerIds: [],
          excludedPlayerIds: [],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.evaluatedCandidateCount).toBe(792);
    expect(response.body.search).toEqual({
      strategy: 'exhaustive',
      eligiblePlayerCount: 12,
      searchedPlayerCount: 12,
      combinationLimit: 792,
      exhausted: true,
      optimalityGuaranteed: true,
    });
  });

  it('returns a clear conflict for a valid but infeasible request', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'metro-city-meteors',
        intent: {
          ...generationIntent,
          minimumCreators: 5,
          requiredPlayerIds: [],
          excludedPlayerIds: ['jordan-vega', 'malik-rhodes'],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: {
        code: 'INFEASIBLE_LINEUP',
        message: expect.stringContaining('No requirement was relaxed'),
        details: expect.arrayContaining([
          expect.objectContaining({ constraintId: 'minimum-creators' }),
        ]),
      },
    });
  });

  it('rejects malformed priorities at the HTTP boundary', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'metro-city-meteors',
        intent: {
          ...generationIntent,
          priorities: { ...generationIntent.priorities, shooting: 2 },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('maps unknown player rules to an invalid intent response', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'metro-city-meteors',
        intent: { ...generationIntent, requiredPlayerIds: ['unknown'], excludedPlayerIds: [] },
      });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_INTENT',
        details: [expect.objectContaining({ code: 'UNKNOWN_REQUIRED_PLAYER' })],
      },
    });
  });
});

describe('POST /api/lineups/repair', () => {
  const currentPlayerIds = [
    'andre-okafor',
    'darius-knox',
    'owen-price',
    'luca-hayes',
    'theo-grant',
  ];

  it('returns the smallest valid repair with before-and-after evidence', async () => {
    const response = await request(createApp())
      .post('/api/lineups/repair')
      .send({
        teamId: 'metro-city-meteors',
        currentPlayerIds,
        intent: {
          ...generationIntent,
          minimumShooters: 5,
          metricMinimums: {},
          requiredPlayerIds: ['darius-knox'],
          excludedPlayerIds: [],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.repair.swapCount).toBe(2);
    expect(response.body.repair.after.lineup.playerIds).toContain('darius-knox');
    expect(
      response.body.repair.after.constraints.every(
        (item: { satisfied: boolean }) => item.satisfied,
      ),
    ).toBe(true);
    expect(response.body.repair.before.constraints).toContainEqual(
      expect.objectContaining({ id: 'minimum-shooters', satisfied: false }),
    );
    expect(response.body.repair.comparison.metrics).toHaveLength(7);
  });

  it('returns an infeasible repair without silently relaxing intent', async () => {
    const response = await request(createApp())
      .post('/api/lineups/repair')
      .send({
        teamId: 'metro-city-meteors',
        currentPlayerIds,
        intent: {
          ...generationIntent,
          minimumCreators: 5,
          metricMinimums: {},
          requiredPlayerIds: [],
          excludedPlayerIds: ['jordan-vega', 'malik-rhodes'],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: {
        code: 'INFEASIBLE_REPAIR',
        message: expect.stringContaining('No requirement was relaxed'),
      },
    });
  });

  it('distinguishes an invalid starting lineup from infeasibility', async () => {
    const response = await request(createApp())
      .post('/api/lineups/repair')
      .send({
        teamId: 'metro-city-meteors',
        currentPlayerIds: ['andre-okafor'],
        intent: generationIntent,
      });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_REPAIR',
        details: [expect.objectContaining({ code: 'INVALID_CURRENT_LINEUP' })],
      },
    });
  });
});

describe('POST /api/lineups/compare', () => {
  const beforePlayerIds = ['andre-okafor', 'darius-knox', 'owen-price', 'luca-hayes', 'theo-grant'];
  const afterPlayerIds = ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'];

  it('compares any two valid lineups with changes, metrics, and requirements', async () => {
    const response = await request(createApp())
      .post('/api/lineups/compare')
      .send({
        teamId: 'metro-city-meteors',
        beforePlayerIds,
        afterPlayerIds,
        intent: { ...generationIntent, requiredPlayerIds: [], excludedPlayerIds: [] },
      });

    expect(response.status).toBe(200);
    expect(response.body.comparison.comparison.metrics).toHaveLength(7);
    expect(response.body.comparison.removedPlayerIds).toHaveLength(4);
    expect(response.body.comparison.addedPlayerIds).toHaveLength(4);
    expect(response.body.comparison.retainedPlayerIds).toEqual(['theo-grant']);
    expect(response.body.comparison.before.constraints).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'minimum-shooters' })]),
    );
  });

  it('compares cross-team league lineups without applying the generation pool bound', async () => {
    const response = await request(createApp())
      .post('/api/lineups/compare')
      .send({
        teamId: 'nba-2024-25-league-snapshot',
        beforePlayerIds: [
          'nba-2024-25-bos-jayson-tatum',
          'nba-2024-25-bos-derrick-white',
          'nba-2024-25-den-nikola-jokic',
          'nba-2024-25-nyk-jalen-brunson',
          'nba-2024-25-okc-alex-caruso',
        ],
        afterPlayerIds: [
          'nba-2024-25-okc-shai-gilgeous-alexander',
          'nba-2024-25-okc-luguentz-dort',
          'nba-2024-25-bos-kristaps-porzingis',
          'nba-2024-25-den-aaron-gordon',
          'nba-2024-25-nyk-karl-anthony-towns',
        ],
        intent: { ...generationIntent, requiredPlayerIds: [], excludedPlayerIds: [] },
      });

    expect(response.status).toBe(200);
    expect(response.body.comparison.comparison.metrics).toHaveLength(7);
    expect(response.body.comparison.addedPlayerIds).toHaveLength(5);
  });

  it('rejects an invalid comparison side without returning partial analysis', async () => {
    const response = await request(createApp())
      .post('/api/lineups/compare')
      .send({
        teamId: 'metro-city-meteors',
        beforePlayerIds: ['jordan-vega'],
        afterPlayerIds,
        intent: { ...generationIntent, requiredPlayerIds: [], excludedPlayerIds: [] },
      });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_COMPARISON_LINEUP',
        message: expect.stringContaining('first lineup'),
      },
    });
  });

  it('rejects malformed comparison requests at the HTTP boundary', async () => {
    const response = await request(createApp()).post('/api/lineups/compare').send({
      teamId: 'metro-city-meteors',
      beforePlayerIds,
      afterPlayerIds: 'not-an-array',
      intent: generationIntent,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('does not silently treat generation eligibility rules as comparison requirements', async () => {
    const response = await request(createApp()).post('/api/lineups/compare').send({
      teamId: 'metro-city-meteors',
      beforePlayerIds,
      afterPlayerIds,
      intent: generationIntent,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });
});
