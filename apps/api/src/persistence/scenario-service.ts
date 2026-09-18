import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { SCORING_VERSION } from '@lineup-engine/basketball-engine';

import {
  apiErrorResponseSchema,
  savedScenarioSchema,
  type ApiErrorResponse,
  type SaveScenarioRequest,
  type SavedScenario,
} from '@lineup-engine/shared';

import { analyzeDemoLineup, getLineupPool } from '../services/demo-lineup-service.js';
import type { ScenarioRepository, ScenarioWrite } from './scenario-repository.js';

export { SCORING_VERSION };

export function anonymousOwnerKey(sessionKey: string): string {
  return createHash('sha256').update(sessionKey).digest('hex');
}

type PrepareResult =
  | { success: true; scenario: ScenarioWrite }
  | { success: false; status: 404 | 422; error: ApiErrorResponse };

function invalidScenario(
  message: string,
  details?: unknown[],
): Extract<PrepareResult, { success: false }> {
  return {
    success: false,
    status: 422,
    error: apiErrorResponseSchema.parse({
      error: { code: 'INVALID_SCENARIO', message, ...(details ? { details } : {}) },
    }),
  };
}

export function prepareScenario(
  request: SaveScenarioRequest,
  existingScenario?: SavedScenario,
): PrepareResult {
  const pool = getLineupPool(request.teamId);
  if (!pool) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: `No lineup pool exists with the id "${request.teamId}".`,
        },
      }),
    };
  }
  const rosterIds = new Set(pool.players.map((player) => player.id));
  const unknownSelection = request.selectedPlayerIds.filter((id) => !rosterIds.has(id));
  if (unknownSelection.length > 0) {
    return invalidScenario(
      'The current selection contains players outside this roster.',
      unknownSelection,
    );
  }
  const clientIds = request.versions.map((version) => version.clientVersionId);
  if (new Set(clientIds).size !== clientIds.length) {
    return invalidScenario('Every saved version must have a unique version identifier.');
  }
  const clientIdSet = new Set(clientIds);
  const invalidParents = request.versions.flatMap((version) =>
    version.parentClientVersionId && !clientIdSet.has(version.parentClientVersionId)
      ? [version.parentClientVersionId]
      : [],
  );
  if (
    invalidParents.length > 0 ||
    (request.activeParentClientVersionId && !clientIdSet.has(request.activeParentClientVersionId))
  ) {
    return invalidScenario('A saved version refers to a parent that is not in this scenario.');
  }

  const timestamp = new Date().toISOString();
  const dataVersion = `${pool.source.id}:${pool.source.snapshotDate}:${pool.source.methodologyVersion}`;
  const versions: ScenarioWrite['versions'] = [];
  for (const version of request.versions) {
    const existingVersion = existingScenario?.versions.find(
      (candidate) => candidate.clientVersionId === version.clientVersionId,
    );
    if (existingVersion) {
      const existingInput = {
        clientVersionId: existingVersion.clientVersionId,
        ...(existingVersion.parentClientVersionId
          ? { parentClientVersionId: existingVersion.parentClientVersionId }
          : {}),
        name: existingVersion.name,
        source: existingVersion.source,
        playerIds: existingVersion.playerIds,
        ...(existingVersion.intent ? { intent: existingVersion.intent } : {}),
        ...(existingVersion.repair ? { repair: existingVersion.repair } : {}),
      };
      if (!isDeepStrictEqual(existingInput, version)) {
        return invalidScenario(
          'Existing saved versions are immutable. Create a new version for changed lineup decisions.',
        );
      }
      versions.push(existingVersion);
      continue;
    }
    const analysis = analyzeDemoLineup(request.teamId, version.playerIds);
    if (!analysis.success) {
      return invalidScenario(
        `The version "${version.name}" cannot be saved because its lineup is invalid.`,
        [analysis.error.error],
      );
    }
    if (version.source === 'repaired' && (!version.intent || !version.repair)) {
      return invalidScenario('Repaired versions must include their intent and swap history.');
    }
    if (version.source === 'generated' && !version.intent) {
      return invalidScenario('Generated versions must include their generation intent.');
    }
    versions.push({
      ...version,
      analysis: analysis.data,
      dataVersion,
      scoringVersion: SCORING_VERSION,
      createdAt: timestamp,
    });
  }
  return {
    success: true,
    scenario: {
      ...request,
      versions,
    },
  };
}

export async function saveScenario(
  repository: ScenarioRepository,
  sessionKey: string,
  request: SaveScenarioRequest,
  scenarioId?: string,
): Promise<
  | { success: true; scenario: SavedScenario }
  | { success: false; status: 404 | 422; error: ApiErrorResponse }
> {
  const ownerKey = anonymousOwnerKey(sessionKey);
  const existingScenario = scenarioId ? await repository.get(ownerKey, scenarioId) : undefined;
  if (scenarioId && !existingScenario) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: { code: 'SCENARIO_NOT_FOUND', message: 'That saved scenario could not be found.' },
      }),
    };
  }
  if (existingScenario && existingScenario.teamId !== request.teamId) {
    return invalidScenario('A saved scenario cannot be moved to a different player pool.');
  }
  const prepared = prepareScenario(request, existingScenario);
  if (!prepared.success) return prepared;
  const stored = await repository.save(ownerKey, prepared.scenario, scenarioId);
  if (!stored) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: { code: 'SCENARIO_NOT_FOUND', message: 'That saved scenario could not be found.' },
      }),
    };
  }
  return { success: true, scenario: savedScenarioSchema.parse(stored) };
}
