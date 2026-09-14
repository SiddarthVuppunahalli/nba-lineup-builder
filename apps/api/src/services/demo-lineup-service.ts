import {
  analyzeLineup,
  compareLineups,
  DEMO_PLAYERS,
  DEMO_PROFILES,
  DEMO_TEAM,
  generateLeagueLineup,
  generateLineup,
  repairLeagueLineup,
  repairLineup,
  type LineupIntent,
} from '@lineup-engine/basketball-engine';
import {
  NBA_2024_25_LEAGUE_POOL,
  NBA_2024_25_TEAM_POOLS,
  type LineupPool,
} from '@lineup-engine/nba-data';
import {
  apiErrorResponseSchema,
  comparedLineupsResponseSchema,
  generatedLineupResponseSchema,
  lineupAnalysisResponseSchema,
  repairedLineupResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type ApiErrorResponse,
  type ComparedLineupsResponse,
  type GeneratedLineupResponse,
  type LineupAnalysisResponse,
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

const DEMO_POOL: LineupPool = {
  team: DEMO_TEAM,
  mode: 'team',
  source: {
    id: 'fictional-demo-v1',
    label: 'Seeded fictional demo ratings',
    url: 'https://github.com/',
    season: 'Demo',
    snapshotDate: '2026-09-14',
    methodologyVersion: 'fictional-demo-v1',
  },
  isDemo: true,
  searchStrategy: 'exhaustive',
  players: DEMO_PLAYERS,
  profiles: DEMO_PROFILES,
  teamAbbreviations: new Map([[DEMO_TEAM.id, DEMO_TEAM.abbreviation]]),
};

const POOLS: readonly LineupPool[] = [
  ...NBA_2024_25_TEAM_POOLS,
  NBA_2024_25_LEAGUE_POOL,
  DEMO_POOL,
];

function getPool(poolId: string): LineupPool | undefined {
  return POOLS.find((pool) => pool.team.id === poolId);
}

function teamDto(pool: LineupPool) {
  return {
    ...pool.team,
    mode: pool.mode,
    season: pool.source.season,
    sourceLabel: pool.source.label,
    ...(pool.isDemo ? {} : { sourceUrl: pool.source.url }),
    snapshotDate: pool.source.snapshotDate,
    isDemo: pool.isDemo,
    searchStrategy: pool.searchStrategy,
  };
}

function combinationCount(playerCount: number): number {
  if (playerCount < 5) return 0;
  return (
    (playerCount * (playerCount - 1) * (playerCount - 2) * (playerCount - 3) * (playerCount - 4)) /
    120
  );
}

function exhaustiveSearchMetadata(pool: LineupPool, intent: LineupIntent) {
  const excluded = new Set(intent.excludedPlayerIds);
  const eligiblePlayerCount = pool.players.filter((player) => !excluded.has(player.id)).length;
  return {
    strategy: 'exhaustive' as const,
    eligiblePlayerCount,
    searchedPlayerCount: eligiblePlayerCount,
    combinationLimit: Math.max(1, combinationCount(eligiblePlayerCount)),
    exhausted: true,
    optimalityGuaranteed: true,
  };
}

function notFound(poolId: string) {
  return apiErrorResponseSchema.parse({
    error: { code: 'TEAM_NOT_FOUND', message: `No lineup pool exists with the id "${poolId}".` },
  });
}

export function getLineupPool(poolId: string): LineupPool | undefined {
  return getPool(poolId);
}

export function listDemoTeams(): TeamsResponse {
  return teamsResponseSchema.parse({ teams: POOLS.map(teamDto) });
}

export function getDemoRoster(teamId: string): RosterResponse | null {
  const pool = getPool(teamId);
  if (!pool) return null;
  const profilesByPlayerId = new Map(pool.profiles.map((profile) => [profile.playerId, profile]));
  return rosterResponseSchema.parse({
    team: teamDto(pool),
    players: pool.players.map((player) => {
      const profile = profilesByPlayerId.get(player.id);
      if (!profile) throw new Error(`Roster configuration is missing a profile for ${player.id}.`);
      return {
        ...player,
        teamAbbreviation: pool.teamAbbreviations.get(player.teamId) ?? pool.team.abbreviation,
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
  const pool = getPool(teamId);
  if (!pool) return { success: false, status: 404, error: notFound(teamId) };
  const result = analyzeLineup({ playerIds, players: pool.players, profiles: pool.profiles });
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
    data: lineupAnalysisResponseSchema.parse({ lineup: result.lineup, analysis: result.analysis }),
  };
}

export function generateDemoLineup(teamId: string, intent: LineupIntent): DemoGenerationResult {
  const pool = getPool(teamId);
  if (!pool) return { success: false, status: 404, error: notFound(teamId) };
  const result =
    pool.mode === 'league'
      ? generateLeagueLineup({ players: pool.players, profiles: pool.profiles, intent })
      : generateLineup({ players: pool.players, profiles: pool.profiles, intent });
  if (!result.success) {
    if (result.reason === 'infeasible' || result.reason === 'search-limit') {
      return {
        success: false,
        status: 409,
        error: apiErrorResponseSchema.parse({
          error: {
            code: result.reason === 'search-limit' ? 'LEAGUE_SEARCH_LIMIT' : 'INFEASIBLE_LINEUP',
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
  return {
    success: true,
    data: generatedLineupResponseSchema.parse({
      ...result,
      search: 'search' in result ? result.search : exhaustiveSearchMetadata(pool, intent),
    }),
  };
}

export function repairDemoLineup(
  teamId: string,
  currentPlayerIds: readonly string[],
  intent: LineupIntent,
): DemoRepairResult {
  const pool = getPool(teamId);
  if (!pool) return { success: false, status: 404, error: notFound(teamId) };
  const result =
    pool.mode === 'league'
      ? repairLeagueLineup({
          currentPlayerIds,
          players: pool.players,
          profiles: pool.profiles,
          intent,
        })
      : repairLineup({
          currentPlayerIds,
          players: pool.players,
          profiles: pool.profiles,
          intent,
        });
  if (!result.success) {
    if (result.reason === 'infeasible' || result.reason === 'search-limit') {
      return {
        success: false,
        status: 409,
        error: apiErrorResponseSchema.parse({
          error: {
            code: result.reason === 'search-limit' ? 'LEAGUE_SEARCH_LIMIT' : 'INFEASIBLE_REPAIR',
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
  return {
    success: true,
    data: repairedLineupResponseSchema.parse({
      ...result,
      search: 'search' in result ? result.search : exhaustiveSearchMetadata(pool, intent),
    }),
  };
}

export function compareDemoLineups(
  teamId: string,
  beforePlayerIds: readonly string[],
  afterPlayerIds: readonly string[],
  intent: LineupIntent,
): DemoComparisonResult {
  const pool = getPool(teamId);
  if (!pool) return { success: false, status: 404, error: notFound(teamId) };
  const result = compareLineups({
    beforePlayerIds,
    afterPlayerIds,
    players: pool.players,
    profiles: pool.profiles,
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
