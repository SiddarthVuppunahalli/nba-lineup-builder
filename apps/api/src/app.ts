import {
  analyzeLineupRequestSchema,
  apiErrorResponseSchema,
  healthResponseSchema,
  generateLineupRequestSchema,
  intentInterpreterStatusResponseSchema,
  interpretIntentRequestSchema,
  repairLineupRequestSchema,
} from '@lineup-engine/shared';
import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';

import type { NaturalLanguageIntentInterpreter } from './ai/intent-interpreter.js';

import {
  analyzeDemoLineup,
  generateDemoLineup,
  getDemoRoster,
  listDemoTeams,
  repairDemoLineup,
} from './services/demo-lineup-service.js';
import { interpretDemoIntent } from './services/intent-interpretation-service.js';

interface CreateAppOptions {
  webDistPath?: string;
  intentInterpreter?: NaturalLanguageIntentInterpreter | undefined;
}

export function createApp(options: CreateAppOptions = {}) {
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

  app.get('/api/intents/status', (_request, response) => {
    response.status(200).json(
      intentInterpreterStatusResponseSchema.parse({
        available: Boolean(options.intentInterpreter),
      }),
    );
  });

  app.post('/api/intents/interpret', async (request, response) => {
    const parsedRequest = interpretIntentRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(400).json(
        apiErrorResponseSchema.parse({
          error: {
            code: 'INVALID_REQUEST',
            message: 'The natural-language intent request is malformed.',
            details: parsedRequest.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        }),
      );
      return;
    }

    const result = await interpretDemoIntent(
      parsedRequest.data.teamId,
      parsedRequest.data.text,
      options.intentInterpreter,
    );
    if (!result.success) {
      response.status(result.status).json(result.error);
      return;
    }
    response.status(200).json(result.data);
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

  app.post('/api/lineups/generate', (request, response) => {
    const parsedRequest = generateLineupRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      const error = apiErrorResponseSchema.parse({
        error: {
          code: 'INVALID_REQUEST',
          message: 'The lineup generation request is malformed.',
          details: parsedRequest.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      response.status(400).json(error);
      return;
    }

    const result = generateDemoLineup(parsedRequest.data.teamId, parsedRequest.data.intent);
    if (!result.success) {
      response.status(result.status).json(result.error);
      return;
    }

    response.status(200).json(result.data);
  });

  app.post('/api/lineups/repair', (request, response) => {
    const parsedRequest = repairLineupRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      const error = apiErrorResponseSchema.parse({
        error: {
          code: 'INVALID_REQUEST',
          message: 'The lineup repair request is malformed.',
          details: parsedRequest.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      response.status(400).json(error);
      return;
    }

    const result = repairDemoLineup(
      parsedRequest.data.teamId,
      parsedRequest.data.currentPlayerIds,
      parsedRequest.data.intent,
    );
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

  if (options.webDistPath) {
    app.use(express.static(options.webDistPath, { index: false, maxAge: '1h' }));
    app.use((request, response, next) => {
      if (
        request.method !== 'GET' ||
        request.path === '/api' ||
        request.path.startsWith('/api/') ||
        !request.accepts('html')
      ) {
        next();
        return;
      }

      response.sendFile(path.join(options.webDistPath!, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  return app;
}
