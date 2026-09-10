import {
  analyzeLineupRequestSchema,
  apiErrorResponseSchema,
  healthResponseSchema,
} from '@lineup-engine/shared';
import express, { type ErrorRequestHandler } from 'express';

import { analyzeDemoLineup, getDemoRoster, listDemoTeams } from './services/demo-lineup-service.js';

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

  app.get('/api/teams', (_request, response) => {
    response.status(200).json(listDemoTeams());
  });

  app.get('/api/teams/:teamId/players', (request, response) => {
    const roster = getDemoRoster(request.params.teamId);
    if (!roster) {
      const error = apiErrorResponseSchema.parse({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: `No team exists with the id "${request.params.teamId}".`,
        },
      });
      response.status(404).json(error);
      return;
    }

    response.status(200).json(roster);
  });

  app.post('/api/lineups/analyze', (request, response) => {
    const parsedRequest = analyzeLineupRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      const error = apiErrorResponseSchema.parse({
        error: {
          code: 'INVALID_REQUEST',
          message: 'The lineup analysis request is malformed.',
          details: parsedRequest.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      response.status(400).json(error);
      return;
    }

    const result = analyzeDemoLineup(parsedRequest.data.teamId, parsedRequest.data.playerIds);
    if (!result.success) {
      response.status(result.status).json(result.error);
      return;
    }

    response.status(200).json(result.data);
  });

  const malformedJsonHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json(
        apiErrorResponseSchema.parse({
          error: {
            code: 'INVALID_JSON',
            message: 'The request body must contain valid JSON.',
          },
        }),
      );
      return;
    }

    next(error);
  };

  app.use(malformedJsonHandler);

  return app;
}
