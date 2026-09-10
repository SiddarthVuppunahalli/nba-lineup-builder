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
