import {
  analyzeLineup,
  DEMO_PLAYERS,
  DEMO_PROFILES,
  DEMO_TEAM,
  generateLineup,
  type LineupIntent,
} from '@lineup-engine/basketball-engine';
import {
  apiErrorResponseSchema,
  lineupAnalysisResponseSchema,
  generatedLineupResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type ApiErrorResponse,
  type LineupAnalysisResponse,
  type GeneratedLineupResponse,
  type RosterResponse,
  type TeamsResponse,
} from '@lineup-engine/shared';

export type DemoAnalysisResult =
  | { success: true; data: LineupAnalysisResponse }
  | { success: false; status: 404 | 422; error: ApiErrorResponse };

export type DemoGenerationResult =
  | { success: true; data: GeneratedLineupResponse }
  | { success: false; status: 404 | 409 | 422 | 500; error: ApiErrorResponse };

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
