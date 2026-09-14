import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('demo roster routes', () => {
  it('lists the available demo team', async () => {
    const response = await request(createApp()).get('/api/teams');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      teams: [
        {
          id: 'metro-city-meteors',
          name: 'Metro City Meteors',
          abbreviation: 'MCM',
        },
      ],
    });
  });

  it('returns roster players with normalized profiles', async () => {
    const response = await request(createApp()).get('/api/teams/metro-city-meteors/players');

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(10);
    expect(response.body.players[0]).toMatchObject({
      id: 'jordan-vega',
      name: 'Jordan Vega',
      position: 'PG',
      profile: { shooting: 92, creation: 94 },
    });
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

  it('returns a clear conflict for a valid but infeasible request', async () => {
    const response = await request(createApp())
      .post('/api/lineups/generate')
      .send({
        teamId: 'metro-city-meteors',
        intent: {
          ...generationIntent,
          minimumCreators: 5,
          requiredPlayerIds: [],
          excludedPlayerIds: [],
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
          minimumShooters: 3,
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
          excludedPlayerIds: [],
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
