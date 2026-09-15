import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { MemoryScenarioRepository } from './persistence/memory-scenario-repository.js';

const sessionKey = '11111111-1111-4111-8111-111111111111';
const otherSessionKey = '22222222-2222-4222-8222-222222222222';
const firstFive = ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'];
const secondFive = ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'darius-knox'];

function scenarioBody() {
  return {
    name: 'Spurs ideas',
    teamId: 'metro-city-meteors',
    selectedPlayerIds: firstFive,
    activeParentClientVersionId: 'version-1',
    versions: [
      {
        clientVersionId: 'version-1',
        name: 'Balanced start',
        source: 'manual',
        playerIds: firstFive,
      },
    ],
  };
}

describe('saved scenario routes', () => {
  it('reports whether durable persistence is configured', async () => {
    expect((await request(createApp()).get('/api/persistence/status')).body).toEqual({
      available: false,
    });
    expect(
      (
        await request(createApp({ scenarioRepository: new MemoryScenarioRepository() })).get(
          '/api/persistence/status',
        )
      ).body,
    ).toEqual({ available: true });
  });

  it('creates, lists, reloads, and updates an owned scenario with recomputed analysis', async () => {
    const app = createApp({ scenarioRepository: new MemoryScenarioRepository() });
    const created = await request(app)
      .post('/api/scenarios')
      .set('x-lineup-session', sessionKey)
      .send(scenarioBody());

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Spurs ideas',
      teamId: 'metro-city-meteors',
      activeParentClientVersionId: 'version-1',
      versions: [
        {
          clientVersionId: 'version-1',
          dataVersion: expect.stringContaining('fictional-demo-v1'),
          scoringVersion: 'lineup-analysis-v1',
          analysis: { lineup: { playerIds: firstFive } },
        },
      ],
    });
    const scenarioId = created.body.id as string;
    const firstVersionCreatedAt = created.body.versions[0].createdAt as string;

    const list = await request(app).get('/api/scenarios').set('x-lineup-session', sessionKey);
    expect(list.body.scenarios).toEqual([
      expect.objectContaining({ id: scenarioId, name: 'Spurs ideas', versionCount: 1 }),
    ]);
    const hidden = await request(app)
      .get(`/api/scenarios/${scenarioId}`)
      .set('x-lineup-session', otherSessionKey);
    expect(hidden.status).toBe(404);

    const updated = await request(app)
      .put(`/api/scenarios/${scenarioId}`)
      .set('x-lineup-session', sessionKey)
      .send({
        ...scenarioBody(),
        name: 'Spurs ideas revised',
        selectedPlayerIds: secondFive,
        activeParentClientVersionId: 'version-2',
        versions: [
          ...scenarioBody().versions,
          {
            clientVersionId: 'version-2',
            parentClientVersionId: 'version-1',
            name: 'Defense branch',
            source: 'manual',
            playerIds: secondFive,
          },
        ],
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: scenarioId,
      name: 'Spurs ideas revised',
      selectedPlayerIds: secondFive,
      versions: [
        { clientVersionId: 'version-1' },
        { clientVersionId: 'version-2', parentClientVersionId: 'version-1' },
      ],
    });
    expect(updated.body.versions[0].createdAt).toBe(firstVersionCreatedAt);

    const mutatedHistory = await request(app)
      .put(`/api/scenarios/${scenarioId}`)
      .set('x-lineup-session', sessionKey)
      .send({
        ...scenarioBody(),
        versions: [{ ...scenarioBody().versions[0], name: 'Rewritten history' }],
      });
    expect(mutatedHistory.status).toBe(422);
    expect(mutatedHistory.body.error.message).toContain('immutable');
  });

  it('distinguishes missing configuration, invalid session keys, and invalid lineups', async () => {
    const unavailable = await request(createApp())
      .post('/api/scenarios')
      .set('x-lineup-session', sessionKey)
      .send(scenarioBody());
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('PERSISTENCE_UNAVAILABLE');

    const app = createApp({ scenarioRepository: new MemoryScenarioRepository() });
    const invalidSession = await request(app)
      .get('/api/scenarios')
      .set('x-lineup-session', 'not-a-uuid');
    expect(invalidSession.status).toBe(400);
    expect(invalidSession.body.error.code).toBe('INVALID_SESSION_KEY');

    const invalidLineup = await request(app)
      .post('/api/scenarios')
      .set('x-lineup-session', sessionKey)
      .send({
        ...scenarioBody(),
        versions: [
          { ...scenarioBody().versions[0], playerIds: [...firstFive.slice(0, 4), 'missing'] },
        ],
      });
    expect(invalidLineup.status).toBe(422);
    expect(invalidLineup.body.error.code).toBe('INVALID_SCENARIO');
  });
});
