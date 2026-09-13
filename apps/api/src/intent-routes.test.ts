import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { NaturalLanguageIntentInterpreter } from './ai/intent-interpreter.js';
import { createApp } from './app.js';

const interpreted = {
  status: 'ready' as const,
  intent: {
    priorities: {
      shooting: 1 as const,
      creation: 1 as const,
      playmaking: 0.5 as const,
      rebounding: 0.5 as const,
      perimeterDefense: 1 as const,
      interiorDefense: 1 as const,
      switchability: 1 as const,
    },
    minimumShooters: 3,
    minimumCreators: 1,
    metricMinimums: {
      shooting: 75,
      creation: null,
      playmaking: null,
      rebounding: null,
      perimeterDefense: null,
      interiorDefense: null,
      switchability: null,
    },
    requiredPlayerIds: ['andre-okafor'],
    excludedPlayerIds: ['nico-park'],
  },
  summary: 'Prioritize shooting and defense with Andre required.',
  assumptions: ['Defense means both supported defense metrics.'],
  questions: [],
};

function fakeInterpreter(output: unknown = interpreted): NaturalLanguageIntentInterpreter {
  return {
    provider: 'test-provider',
    model: 'test-model',
    interpret: vi.fn().mockResolvedValue(output),
  };
}

describe('natural-language intent routes', () => {
  it('reports availability without exposing provider configuration', async () => {
    expect((await request(createApp()).get('/api/intents/status')).body).toEqual({
      available: false,
    });
    expect(
      (
        await request(createApp({ intentInterpreter: fakeInterpreter() })).get(
          '/api/intents/status',
        )
      ).body,
    ).toEqual({ available: true });
  });

  it('validates, normalizes, and returns an editable interpretation', async () => {
    const interpreter = fakeInterpreter();
    const response = await request(createApp({ intentInterpreter: interpreter }))
      .post('/api/intents/interpret')
      .send({
        teamId: 'metro-city-meteors',
        text: 'Keep Andre, leave Nico out, and prioritize shooting and defense.',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ready',
      intent: {
        minimumShooters: 3,
        metricMinimums: { shooting: 75 },
        requiredPlayerIds: ['andre-okafor'],
        excludedPlayerIds: ['nico-park'],
      },
      provider: 'test-provider',
      model: 'test-model',
    });
    expect(interpreter.interpret).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Keep Andre'),
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'andre-okafor', name: 'Andre Okafor' }),
        ]),
      }),
    );
  });

  it('feeds interpreted intent through the same deterministic generation endpoint', async () => {
    const app = createApp({ intentInterpreter: fakeInterpreter() });
    const interpretation = await request(app).post('/api/intents/interpret').send({
      teamId: 'metro-city-meteors',
      text: 'Keep Andre, leave Nico out, and prioritize shooting and defense.',
    });
    const generation = await request(app).post('/api/lineups/generate').send({
      teamId: 'metro-city-meteors',
      intent: interpretation.body.intent,
    });

    expect(generation.status).toBe(200);
    expect(generation.body.winner.lineup.playerIds).toContain('andre-okafor');
    expect(generation.body.winner.lineup.playerIds).not.toContain('nico-park');
  });

  it('returns an explicit unavailable response when no provider is configured', async () => {
    const response = await request(createApp()).post('/api/intents/interpret').send({
      teamId: 'metro-city-meteors',
      text: 'Build around shooting.',
    });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('rejects invalid provider output and handles provider failures', async () => {
    const invalid = await request(
      createApp({ intentInterpreter: fakeInterpreter({ unsupported: true }) }),
    )
      .post('/api/intents/interpret')
      .send({ teamId: 'metro-city-meteors', text: 'Play small-ball.' });
    expect(invalid.status).toBe(502);
    expect(invalid.body.error.code).toBe('AI_INVALID_OUTPUT');

    const failingInterpreter = fakeInterpreter();
    vi.mocked(failingInterpreter.interpret).mockRejectedValueOnce(new Error('provider offline'));
    const failed = await request(createApp({ intentInterpreter: failingInterpreter }))
      .post('/api/intents/interpret')
      .send({ teamId: 'metro-city-meteors', text: 'Prioritize shooting.' });
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('AI_PROVIDER_ERROR');
  });

  it('rejects malformed text before calling the provider', async () => {
    const interpreter = fakeInterpreter();
    const response = await request(createApp({ intentInterpreter: interpreter }))
      .post('/api/intents/interpret')
      .send({ teamId: 'metro-city-meteors', text: ' ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(interpreter.interpret).not.toHaveBeenCalled();
  });
});
