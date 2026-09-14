import {
  apiErrorResponseSchema,
  interpretedIntentResponseSchema,
  type ApiErrorResponse,
  type InterpretedIntentResponse,
} from '@lineup-engine/shared';

import {
  providerIntentInterpretationSchema,
  type NaturalLanguageIntentInterpreter,
} from '../ai/intent-interpreter.js';
import { getLineupPool } from './demo-lineup-service.js';

export type IntentInterpretationResult =
  | { success: true; data: InterpretedIntentResponse }
  | { success: false; status: 404 | 502 | 503; error: ApiErrorResponse };

function errorResult(
  status: 404 | 502 | 503,
  code: string,
  message: string,
): IntentInterpretationResult {
  return {
    success: false,
    status,
    error: apiErrorResponseSchema.parse({ error: { code, message } }),
  };
}

function hasInvalidPlayerRules(
  required: string[],
  excluded: string[],
  rosterIds: ReadonlySet<string>,
): boolean {
  const requiredSet = new Set(required);
  const excludedSet = new Set(excluded);
  return (
    requiredSet.size !== required.length ||
    excludedSet.size !== excluded.length ||
    required.length > 5 ||
    required.some((id) => !rosterIds.has(id) || excludedSet.has(id)) ||
    excluded.some((id) => !rosterIds.has(id))
  );
}

export async function interpretDemoIntent(
  teamId: string,
  text: string,
  interpreter?: NaturalLanguageIntentInterpreter,
): Promise<IntentInterpretationResult> {
  const pool = getLineupPool(teamId);
  if (!pool) {
    return errorResult(404, 'TEAM_NOT_FOUND', `No team exists with the id "${teamId}".`);
  }
  if (!interpreter) {
    return errorResult(
      503,
      'AI_UNAVAILABLE',
      'Natural-language interpretation is not configured. Use the structured controls instead.',
    );
  }

  try {
    const parsed = providerIntentInterpretationSchema.safeParse(
      await interpreter.interpret({
        text,
        players: pool.players.map(({ id, name, position }) => ({ id, name, position })),
      }),
    );
    if (!parsed.success) {
      return errorResult(
        502,
        'AI_INVALID_OUTPUT',
        'The interpretation could not be validated. Review the structured controls instead.',
      );
    }

    if (
      (parsed.data.status === 'ready' && parsed.data.questions.length > 0) ||
      (parsed.data.status === 'needs_clarification' && parsed.data.questions.length === 0)
    ) {
      return errorResult(
        502,
        'AI_INVALID_OUTPUT',
        'The interpretation returned an inconsistent clarification state. Review the structured controls instead.',
      );
    }

    const { metricMinimums, ...intent } = parsed.data.intent;
    const compactMinimums = Object.fromEntries(
      Object.entries(metricMinimums).filter(
        (entry): entry is [string, number] => entry[1] !== null,
      ),
    );
    if (
      hasInvalidPlayerRules(
        intent.requiredPlayerIds,
        intent.excludedPlayerIds,
        new Set(pool.players.map((player) => player.id)),
      )
    ) {
      return errorResult(
        502,
        'AI_INVALID_OUTPUT',
        'The interpretation referenced invalid player rules. Review the structured controls instead.',
      );
    }

    const response = interpretedIntentResponseSchema.safeParse({
      ...parsed.data,
      intent: { ...intent, metricMinimums: compactMinimums },
      provider: interpreter.provider,
      model: interpreter.model,
    });
    if (!response.success) {
      return errorResult(
        502,
        'AI_INVALID_OUTPUT',
        'The interpretation could not be validated. Review the structured controls instead.',
      );
    }
    return { success: true, data: response.data };
  } catch {
    return errorResult(
      502,
      'AI_PROVIDER_ERROR',
      'Natural-language interpretation is temporarily unavailable. Use the structured controls instead.',
    );
  }
}
