import request from 'supertest';
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
