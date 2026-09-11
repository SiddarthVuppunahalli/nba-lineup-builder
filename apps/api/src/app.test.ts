import request from 'supertest';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns a schema-valid readiness response', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'lineup-engine-api',
    });
    expect(new Date(response.body.timestamp as string).toISOString()).toBe(response.body.timestamp);
  });
});

describe('production web serving', () => {
  const webSourcePath = fileURLToPath(new URL('../../web', import.meta.url));

  it('serves the web entry point and supports client-side routes', async () => {
    const app = createApp({ webDistPath: webSourcePath });
    const home = await request(app).get('/');
    const nested = await request(app).get('/lineups/demo');

    expect(home.status).toBe(200);
    expect(home.text).toContain('<div id="root"></div>');
    expect(nested.status).toBe(200);
    expect(nested.text).toContain('<div id="root"></div>');
  });

  it('does not turn unknown API routes into the web app', async () => {
    const response = await request(createApp({ webDistPath: webSourcePath })).get('/api/missing');
    expect(response.status).toBe(404);
  });
});
