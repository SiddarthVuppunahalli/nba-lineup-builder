import {
  analyzeLineupRequestSchema,
  apiErrorResponseSchema,
  compareLineupsRequestSchema,
  healthResponseSchema,
  generateLineupRequestSchema,
  intentInterpreterStatusResponseSchema,
  interpretIntentRequestSchema,
  repairLineupRequestSchema,
  persistenceStatusResponseSchema,
  savedScenarioSchema,
  savedScenariosResponseSchema,
  saveScenarioRequestSchema,
} from '@lineup-engine/shared';
import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { z } from 'zod';

import type { NaturalLanguageIntentInterpreter } from './ai/intent-interpreter.js';

import {
  analyzeDemoLineup,
  compareDemoLineups,
  generateDemoLineup,
  getDemoRoster,
  listDemoTeams,
  repairDemoLineup,
} from './services/demo-lineup-service.js';
import { interpretDemoIntent } from './services/intent-interpretation-service.js';
import type { ScenarioRepository } from './persistence/scenario-repository.js';
import { anonymousOwnerKey, saveScenario } from './persistence/scenario-service.js';

interface CreateAppOptions {
  webDistPath?: string;
  intentInterpreter?: NaturalLanguageIntentInterpreter | undefined;
  scenarioRepository?: ScenarioRepository | undefined;
}

const anonymousSessionSchema = z.uuid();

function persistenceError(code: string, message: string) {
  return apiErrorResponseSchema.parse({ error: { code, message } });
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

  app.get('/api/persistence/status', (_request, response) => {
    response
      .status(200)
      .json(
        persistenceStatusResponseSchema.parse({ available: Boolean(options.scenarioRepository) }),
      );
  });

  function sessionKey(request: express.Request, response: express.Response) {
    const parsed = anonymousSessionSchema.safeParse(request.get('x-lineup-session'));
    if (!parsed.success) {
      response
        .status(400)
        .json(
          persistenceError(
            'INVALID_SESSION_KEY',
            'A valid anonymous session key is required for saved scenarios.',
          ),
        );
      return undefined;
    }
    return parsed.data;
  }

  app.get('/api/scenarios', async (request, response) => {
    if (!options.scenarioRepository) {
      response
        .status(503)
        .json(persistenceError('PERSISTENCE_UNAVAILABLE', 'Durable saving is not configured.'));
      return;
    }
    const key = sessionKey(request, response);
    if (!key) return;
    try {
      const scenarios = await options.scenarioRepository.list(anonymousOwnerKey(key));
      response.status(200).json(savedScenariosResponseSchema.parse({ scenarios }));
    } catch (error) {
      console.error('Failed to list lineup scenarios.', error);
      response
        .status(503)
        .json(
          persistenceError('PERSISTENCE_ERROR', 'Saved scenarios are temporarily unavailable.'),
        );
    }
  });

  app.get('/api/scenarios/:scenarioId', async (request, response) => {
    if (!options.scenarioRepository) {
      response
        .status(503)
        .json(persistenceError('PERSISTENCE_UNAVAILABLE', 'Durable saving is not configured.'));
      return;
    }
    const key = sessionKey(request, response);
    if (!key) return;
    const id = z.uuid().safeParse(request.params.scenarioId);
    if (!id.success) {
      response
        .status(400)
        .json(persistenceError('INVALID_SCENARIO_ID', 'The saved scenario identifier is invalid.'));
      return;
    }
    try {
      const scenario = await options.scenarioRepository.get(anonymousOwnerKey(key), id.data);
      if (!scenario) {
        response
          .status(404)
          .json(persistenceError('SCENARIO_NOT_FOUND', 'That saved scenario could not be found.'));
        return;
      }
      response.status(200).json(savedScenarioSchema.parse(scenario));
    } catch (error) {
      console.error('Failed to load lineup scenario.', error);
      response
        .status(503)
        .json(
          persistenceError('PERSISTENCE_ERROR', 'That scenario could not be loaded right now.'),
        );
    }
  });

  async function persistScenario(
    request: express.Request,
    response: express.Response,
    scenarioId?: string,
  ) {
    if (!options.scenarioRepository) {
      response
        .status(503)
        .json(persistenceError('PERSISTENCE_UNAVAILABLE', 'Durable saving is not configured.'));
      return;
    }
    const key = sessionKey(request, response);
    if (!key) return;
    const parsedRequest = saveScenarioRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(400).json(
        apiErrorResponseSchema.parse({
          error: {
            code: 'INVALID_REQUEST',
            message: 'The saved scenario request is malformed.',
            details: parsedRequest.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        }),
      );
      return;
    }
    if (scenarioId && !z.uuid().safeParse(scenarioId).success) {
      response
        .status(400)
        .json(persistenceError('INVALID_SCENARIO_ID', 'The saved scenario identifier is invalid.'));
      return;
    }
    try {
      const result = await saveScenario(
        options.scenarioRepository,
        key,
        parsedRequest.data,
        scenarioId,
      );
      if (!result.success) {
        response.status(result.status).json(result.error);
        return;
      }
      response.status(scenarioId ? 200 : 201).json(result.scenario);
    } catch (error) {
      console.error('Failed to save lineup scenario.', error);
      response
        .status(503)
        .json(persistenceError('PERSISTENCE_ERROR', 'That scenario could not be saved right now.'));
    }
  }

  app.post('/api/scenarios', (request, response) => void persistScenario(request, response));
  app.put(
    '/api/scenarios/:scenarioId',
    (request, response) => void persistScenario(request, response, request.params.scenarioId),
  );

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

  app.post('/api/lineups/generate', async (request, response) => {
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

    const result = await generateDemoLineup(parsedRequest.data.teamId, parsedRequest.data.intent);
    if (!result.success) {
      response.status(result.status).json(result.error);
      return;
    }

    response.status(200).json(result.data);
  });

  app.post('/api/lineups/repair', async (request, response) => {
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

    const result = await repairDemoLineup(
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

  app.post('/api/lineups/compare', (request, response) => {
    const parsedRequest = compareLineupsRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(400).json(
        apiErrorResponseSchema.parse({
          error: {
            code: 'INVALID_REQUEST',
            message: 'The lineup comparison request is malformed.',
            details: parsedRequest.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        }),
      );
      return;
    }

    const result = compareDemoLineups(
      parsedRequest.data.teamId,
      parsedRequest.data.beforePlayerIds,
      parsedRequest.data.afterPlayerIds,
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
