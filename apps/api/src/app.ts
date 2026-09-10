import { healthResponseSchema } from '@lineup-engine/shared';
import express from 'express';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => {
    const body = healthResponseSchema.parse({
      status: 'ok',
      service: 'lineup-engine-api',
      timestamp: new Date().toISOString(),
    });

    response.status(200).json(body);
  });

  return app;
}
