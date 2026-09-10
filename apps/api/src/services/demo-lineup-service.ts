import {
  analyzeLineup,
  DEMO_PLAYERS,
  DEMO_PROFILES,
  DEMO_TEAM,
} from '@lineup-engine/basketball-engine';
import {
  apiErrorResponseSchema,
  lineupAnalysisResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type ApiErrorResponse,
  type LineupAnalysisResponse,
  type RosterResponse,
  type TeamsResponse,
} from '@lineup-engine/shared';

export type DemoAnalysisResult =
  | { success: true; data: LineupAnalysisResponse }
  | { success: false; status: 404 | 422; error: ApiErrorResponse };

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
