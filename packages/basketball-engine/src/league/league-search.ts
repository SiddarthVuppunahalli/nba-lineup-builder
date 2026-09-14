import {
  METRIC_NAMES,
  type LineupIntent,
  type MetricName,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import {
  BALANCED_PRIORITIES,
  generateLineupWithinPoolLimit,
  validateGenerationInput,
  type GenerateLineupInput,
  type GenerateLineupResult,
} from '../generation/generate-lineup.js';
import {
  repairLineupWithinPoolLimit,
  type RepairLineupInput,
  type RepairLineupResult,
} from '../repair/repair-lineup.js';

export const LEAGUE_SHORTLIST_SIZE = 18;
export const LEAGUE_COMBINATION_LIMIT = 8_568;

export interface LeagueSearchMetadata {
  strategy: 'exhaustive' | 'bounded-shortlist';
  eligiblePlayerCount: number;
  searchedPlayerCount: number;
  combinationLimit: number;
  exhausted: boolean;
  optimalityGuaranteed: boolean;
}

type LeagueSearchFailure = {
  success: false;
  reason: 'search-limit';
  message: string;
  evaluatedCandidateCount: number;
  constraintSummary: [];
  search: LeagueSearchMetadata;
};

export type GenerateLeagueLineupResult =
  | (Extract<GenerateLineupResult, { success: true }> & { search: LeagueSearchMetadata })
  | Exclude<GenerateLineupResult, { success: true } | { reason: 'infeasible' }>
  | (Extract<GenerateLineupResult, { success: false; reason: 'infeasible' }> & {
      search: LeagueSearchMetadata;
    })
  | LeagueSearchFailure;

export type RepairLeagueLineupResult =
  | (Extract<RepairLineupResult, { success: true }> & { search: LeagueSearchMetadata })
  | Exclude<RepairLineupResult, { success: true } | { reason: 'infeasible' }>
  | (Extract<RepairLineupResult, { success: false; reason: 'infeasible' }> & {
      search: LeagueSearchMetadata;
    })
  | LeagueSearchFailure;

function playerScore(profile: PlayerProfile, intent: LineupIntent): number {
  const priorities = METRIC_NAMES.every((metric) => intent.priorities[metric] === 0)
    ? BALANCED_PRIORITIES
    : intent.priorities;
  const totalWeight = METRIC_NAMES.reduce((sum, metric) => sum + priorities[metric], 0);
  return (
    METRIC_NAMES.reduce((sum, metric) => sum + profile[metric] * priorities[metric], 0) /
    totalWeight
  );
}

function rankByMetric(
  players: readonly Player[],
  profilesById: ReadonlyMap<string, PlayerProfile>,
  metric: MetricName,
): Player[] {
  return [...players].sort((left, right) => {
    const difference = profilesById.get(right.id)![metric] - profilesById.get(left.id)![metric];
    return difference || left.id.localeCompare(right.id);
  });
}

export function buildLeagueShortlist(
  input: GenerateLineupInput,
  pinnedPlayerIds: readonly string[] = [],
): { players: Player[]; profiles: PlayerProfile[]; search: LeagueSearchMetadata } {
  const excluded = new Set(input.intent.excludedPlayerIds);
  const eligiblePlayers = input.players.filter((player) => !excluded.has(player.id));
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const selectedIds = new Set<string>();

  const add = (player: Player | undefined) => {
    if (player && selectedIds.size < LEAGUE_SHORTLIST_SIZE) selectedIds.add(player.id);
  };

  for (const id of [...input.intent.requiredPlayerIds, ...pinnedPlayerIds].sort()) {
    add(input.players.find((player) => player.id === id));
  }

  const activeMetrics = METRIC_NAMES.filter(
    (metric) =>
      input.intent.priorities[metric] > 0 || input.intent.metricMinimums[metric] !== undefined,
  );
  const shortlistMetrics = activeMetrics.length > 0 ? activeMetrics : [...METRIC_NAMES];
  for (const metric of shortlistMetrics) {
    for (const player of rankByMetric(eligiblePlayers, profilesById, metric).slice(0, 2))
      add(player);
  }

  if (input.intent.minimumShooters > 0) {
    for (const player of rankByMetric(eligiblePlayers, profilesById, 'shooting').slice(0, 5))
      add(player);
  }
  if (input.intent.minimumCreators > 0) {
    for (const player of rankByMetric(eligiblePlayers, profilesById, 'creation').slice(0, 5))
      add(player);
  }

  const overall = [...eligiblePlayers].sort((left, right) => {
    const difference =
      playerScore(profilesById.get(right.id)!, input.intent) -
      playerScore(profilesById.get(left.id)!, input.intent);
    return difference || left.id.localeCompare(right.id);
  });
  for (const player of overall) add(player);

  const players = input.players.filter((player) => selectedIds.has(player.id));
  players.sort((left, right) => left.id.localeCompare(right.id));
  const profiles = players.map((player) => profilesById.get(player.id)!);
  const searchedPlayerCount = players.filter((player) => !excluded.has(player.id)).length;
  const exhausted = eligiblePlayers.every((player) => selectedIds.has(player.id));
  return {
    players,
    profiles,
    search: {
      strategy: exhausted ? 'exhaustive' : 'bounded-shortlist',
      eligiblePlayerCount: eligiblePlayers.length,
      searchedPlayerCount,
      combinationLimit: LEAGUE_COMBINATION_LIMIT,
      exhausted,
      optimalityGuaranteed: exhausted,
    },
  };
}

export function generateLeagueLineup(input: GenerateLineupInput): GenerateLeagueLineupResult {
  const issues = validateGenerationInput(input, null);
  if (issues.length > 0) {
    const dataCodes = new Set([
      'MISSING_PROFILE',
      'DUPLICATE_PROFILE',
      'DUPLICATE_ELIGIBLE_PLAYER',
    ]);
    return {
      success: false,
      reason: issues.some((issue) => dataCodes.has(issue.code)) ? 'data-error' : 'invalid-input',
      issues,
    };
  }

  const shortlist = buildLeagueShortlist(input);
  const result = generateLineupWithinPoolLimit(
    { ...input, players: shortlist.players, profiles: shortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
  );
  if (!result.success && result.reason === 'infeasible' && !shortlist.search.exhausted) {
    return {
      success: false,
      reason: 'search-limit',
      message:
        'The bounded league search found no valid lineup. The full league pool was not exhausted, so this is not proof that the request is infeasible.',
      evaluatedCandidateCount: result.evaluatedCandidateCount,
      constraintSummary: [],
      search: shortlist.search,
    };
  }
  return result.success || result.reason === 'infeasible'
    ? { ...result, search: shortlist.search }
    : result;
}

export function repairLeagueLineup(input: RepairLineupInput): RepairLeagueLineupResult {
  const issues = validateGenerationInput(
    { players: input.players, profiles: input.profiles, intent: input.intent },
    null,
  );
  if (issues.length > 0) {
    const dataCodes = new Set([
      'MISSING_PROFILE',
      'DUPLICATE_PROFILE',
      'DUPLICATE_ELIGIBLE_PLAYER',
    ]);
    return {
      success: false,
      reason: issues.some((issue) => dataCodes.has(issue.code)) ? 'data-error' : 'invalid-input',
      issues,
    };
  }
  const shortlist = buildLeagueShortlist(
    { players: input.players, profiles: input.profiles, intent: input.intent },
    input.currentPlayerIds,
  );
  const result = repairLineupWithinPoolLimit(
    { ...input, players: shortlist.players, profiles: shortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
  );
  if (!result.success && result.reason === 'infeasible' && !shortlist.search.exhausted) {
    return {
      success: false,
      reason: 'search-limit',
      message:
        'The bounded league repair search found no valid lineup. The full league pool was not exhausted, so this is not proof that the request is infeasible.',
      evaluatedCandidateCount: result.evaluatedCandidateCount,
      constraintSummary: [],
      search: shortlist.search,
    };
  }
  return result.success || result.reason === 'infeasible'
    ? { ...result, search: shortlist.search }
    : result;
}
