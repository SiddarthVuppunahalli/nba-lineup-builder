import {
  analyzeLineup,
  compareLineups,
  DEMO_PLAYERS,
  DEMO_PROFILES,
  DEMO_TEAM,
  generateLineup,
  repairLineup,
  type LineupIntent,
} from '@lineup-engine/basketball-engine';
import {
  apiErrorResponseSchema,
  comparedLineupsResponseSchema,
  lineupAnalysisResponseSchema,
  generatedLineupResponseSchema,
  repairedLineupResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type ApiErrorResponse,
  type ComparedLineupsResponse,
  type LineupAnalysisResponse,
  type GeneratedLineupResponse,
  type RepairedLineupResponse,
  type RosterResponse,
  type TeamsResponse,
} from '@lineup-engine/shared';

export type DemoAnalysisResult =
  | { success: true; data: LineupAnalysisResponse }
  | { success: false; status: 404 | 422; error: ApiErrorResponse };

export type DemoGenerationResult =
  | { success: true; data: GeneratedLineupResponse }
  | { success: false; status: 404 | 409 | 422 | 500; error: ApiErrorResponse };

export type DemoRepairResult =
  | { success: true; data: RepairedLineupResponse }
  | { success: false; status: 404 | 409 | 422 | 500; error: ApiErrorResponse };

export type DemoComparisonResult =
  | { success: true; data: ComparedLineupsResponse }
  | { success: false; status: 404 | 422 | 500; error: ApiErrorResponse };

export function listDemoTeams(): TeamsResponse {
  return teamsResponseSchema.parse({ teams: [DEMO_TEAM] });
}

export function getDemoRoster(teamId: string): RosterResponse | null {
  if (teamId !== DEMO_TEAM.id) {
    return null;
  }

  const profilesByPlayerId = new Map(DEMO_PROFILES.map((profile) => [profile.playerId, profile]));

  return rosterResponseSchema.parse({
    team: DEMO_TEAM,
    players: DEMO_PLAYERS.map((player) => {
      const profile = profilesByPlayerId.get(player.id);
      if (!profile) {
        throw new Error(`Demo roster configuration is missing a profile for ${player.id}.`);
      }

      return {
        ...player,
        profile: {
          shooting: profile.shooting,
          creation: profile.creation,
          playmaking: profile.playmaking,
          rebounding: profile.rebounding,
          perimeterDefense: profile.perimeterDefense,
          interiorDefense: profile.interiorDefense,
          switchability: profile.switchability,
        },
      };
    }),
  });
}

export function analyzeDemoLineup(
  teamId: string,
  playerIds: readonly string[],
): DemoAnalysisResult {
  if (teamId !== DEMO_TEAM.id) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: `No team exists with the id "${teamId}".`,
        },
      }),
    };
  }

  const result = analyzeLineup({
    playerIds,
    players: DEMO_PLAYERS,
    profiles: DEMO_PROFILES,
  });

  if (!result.success) {
    return {
      success: false,
      status: 422,
      error: apiErrorResponseSchema.parse({
        error: {
          code: 'INVALID_LINEUP',
          message: 'The selected players do not form an analyzable lineup.',
          details: result.issues,
        },
      }),
    };
  }

  return {
    success: true,
    data: lineupAnalysisResponseSchema.parse({
      lineup: result.lineup,
      analysis: result.analysis,
    }),
  };
}

export function generateDemoLineup(teamId: string, intent: LineupIntent): DemoGenerationResult {
  if (teamId !== DEMO_TEAM.id) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: `No team exists with the id "${teamId}".`,
        },
      }),
    };
  }

  const result = generateLineup({ players: DEMO_PLAYERS, profiles: DEMO_PROFILES, intent });
  if (!result.success) {
    if (result.reason === 'infeasible') {
      return {
        success: false,
        status: 409,
        error: apiErrorResponseSchema.parse({
          error: {
            code: 'INFEASIBLE_LINEUP',
            message: result.message,
            details: result.constraintSummary,
          },
        }),
      };
    }

    const dataFailure = result.reason === 'data-error';
    return {
      success: false,
      status: dataFailure ? 500 : 422,
      error: apiErrorResponseSchema.parse({
        error: {
          code: dataFailure ? 'ROSTER_DATA_ERROR' : 'INVALID_INTENT',
          message: dataFailure
            ? 'The eligible roster is missing required basketball data.'
            : 'The lineup generation intent is invalid.',
          details: result.issues,
        },
      }),
    };
  }

  return { success: true, data: generatedLineupResponseSchema.parse(result) };
}

export function repairDemoLineup(
  teamId: string,
  currentPlayerIds: readonly string[],
  intent: LineupIntent,
): DemoRepairResult {
  if (teamId !== DEMO_TEAM.id) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: { code: 'TEAM_NOT_FOUND', message: `No team exists with the id "${teamId}".` },
      }),
    };
  }

  const result = repairLineup({
    currentPlayerIds,
    players: DEMO_PLAYERS,
    profiles: DEMO_PROFILES,
    intent,
  });
  if (!result.success) {
    if (result.reason === 'infeasible') {
      return {
        success: false,
        status: 409,
        error: apiErrorResponseSchema.parse({
          error: {
            code: 'INFEASIBLE_REPAIR',
            message: result.message,
            details: result.constraintSummary,
          },
        }),
      };
    }
    const dataFailure = result.reason === 'data-error';
    return {
      success: false,
      status: dataFailure ? 500 : 422,
      error: apiErrorResponseSchema.parse({
        error: {
          code: dataFailure ? 'ROSTER_DATA_ERROR' : 'INVALID_REPAIR',
          message: dataFailure
            ? 'The eligible roster is missing required basketball data.'
            : 'The lineup repair request is invalid.',
          details: result.issues,
        },
      }),
    };
  }

  return { success: true, data: repairedLineupResponseSchema.parse(result) };
}

export function compareDemoLineups(
  teamId: string,
  beforePlayerIds: readonly string[],
  afterPlayerIds: readonly string[],
  intent: LineupIntent,
): DemoComparisonResult {
  if (teamId !== DEMO_TEAM.id) {
    return {
      success: false,
      status: 404,
      error: apiErrorResponseSchema.parse({
        error: { code: 'TEAM_NOT_FOUND', message: `No team exists with the id "${teamId}".` },
      }),
    };
  }

  const result = compareLineups({
    beforePlayerIds,
    afterPlayerIds,
    players: DEMO_PLAYERS,
    profiles: DEMO_PROFILES,
    intent,
  });
  if (!result.success) {
    const dataFailure = result.reason === 'data-error';
    const side = result.reason === 'invalid-after' ? 'second' : 'first';
    const invalidIntent = result.reason === 'invalid-intent';
    return {
      success: false,
      status: dataFailure ? 500 : 422,
      error: apiErrorResponseSchema.parse({
        error: {
          code: dataFailure
            ? 'ROSTER_DATA_ERROR'
            : invalidIntent
              ? 'INVALID_COMPARISON_INTENT'
              : 'INVALID_COMPARISON_LINEUP',
          message: dataFailure
            ? 'The roster is missing required basketball data.'
            : invalidIntent
              ? 'The comparison requirements are invalid.'
              : `The ${side} lineup cannot be compared because it is invalid.`,
          details: result.issues,
        },
      }),
    };
  }

  return { success: true, data: comparedLineupsResponseSchema.parse(result) };
}
