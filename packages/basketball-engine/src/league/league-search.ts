import {
  METRIC_NAMES,
  type GeneratedLineupCandidate,
  type LineupIntent,
  type MetricName,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import { analyzeLineup } from '../analysis/analyze-lineup.js';
import { compareLineupAnalyses } from '../comparison/compare-lineups.js';
import { evaluateLineupConstraints } from '../generation/constraints.js';
import {
  BALANCED_PRIORITIES,
  calculateObjectiveScore,
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
import {
  LEAGUE_SOLVER_TIME_LIMIT_MS,
  LEAGUE_SOLVER_VERSION,
  optimizeLeagueLineup,
  type LeagueSolverProof,
} from './cp-sat-league-optimizer.js';

export const LEAGUE_SHORTLIST_SIZE = 18;
export const LEAGUE_COMBINATION_LIMIT = 8_568;

export interface LeagueSearchMetadata {
  strategy: 'exhaustive' | 'cp-sat' | 'bounded-shortlist';
  eligiblePlayerCount: number;
  searchedPlayerCount: number;
  combinationLimit: number;
  exhausted: boolean;
  optimalityGuaranteed: boolean;
  solverStatus?: 'optimal' | 'feasible-time-limit' | 'infeasible' | 'fallback';
  solverVersion?: string;
  timeLimitMs?: number;
  elapsedMs?: number;
  objectiveValue?: number;
  objectiveBound?: number;
  objectiveGap?: number;
  canonicalTieProven?: boolean;
  minimumSwapsProven?: boolean;
  incumbentSource?: 'solver' | 'bounded-seed';
  fallbackReason?: string;
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

function combinationCount(playerCount: number): number {
  if (playerCount < 5) return 0;
  return (
    (playerCount * (playerCount - 1) * (playerCount - 2) * (playerCount - 3) * (playerCount - 4)) /
    120
  );
}

function proofMetadata(
  eligiblePlayerCount: number,
  proof: LeagueSolverProof,
): LeagueSearchMetadata {
  return {
    strategy: 'cp-sat',
    eligiblePlayerCount,
    searchedPlayerCount: eligiblePlayerCount,
    combinationLimit: Math.max(1, combinationCount(eligiblePlayerCount)),
    exhausted: proof.status === 'optimal' || proof.status === 'infeasible',
    optimalityGuaranteed: proof.status === 'optimal',
    solverStatus: proof.status,
    solverVersion: LEAGUE_SOLVER_VERSION,
    timeLimitMs: LEAGUE_SOLVER_TIME_LIMIT_MS,
    elapsedMs: proof.elapsedMs,
    ...(proof.objectiveValue !== undefined ? { objectiveValue: proof.objectiveValue } : {}),
    ...(proof.objectiveBound !== undefined ? { objectiveBound: proof.objectiveBound } : {}),
    ...(proof.objectiveGap !== undefined ? { objectiveGap: proof.objectiveGap } : {}),
    canonicalTieProven: proof.canonicalTieProven,
    ...(proof.minimumSwapsProven !== undefined
      ? { minimumSwapsProven: proof.minimumSwapsProven }
      : {}),
    ...(proof.incumbentSource ? { incumbentSource: proof.incumbentSource } : {}),
  };
}

function candidateFor(
  playerIds: readonly string[],
  input: GenerateLineupInput,
  priorities: typeof BALANCED_PRIORITIES,
): GeneratedLineupCandidate {
  const analyzed = analyzeLineup({
    playerIds,
    players: input.players,
    profiles: input.profiles,
  });
  if (!analyzed.success) throw new Error('CP-SAT returned an unanalyzable lineup.');
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const constraints = evaluateLineupConstraints(
    analyzed.lineup.playerIds.map((id) => profilesById.get(id)!),
    analyzed.analysis,
    input.intent,
  );
  if (constraints.some((constraint) => !constraint.satisfied))
    throw new Error('CP-SAT returned a lineup that violates the authoritative engine constraints.');
  return {
    lineup: analyzed.lineup,
    analysis: analyzed.analysis,
    objectiveScore: calculateObjectiveScore(analyzed.analysis, priorities),
    constraints,
  };
}

function appliedPriorities(intent: LineupIntent) {
  const usedBalancedDefault = METRIC_NAMES.every((metric) => intent.priorities[metric] === 0);
  return {
    usedBalancedDefault,
    priorities: usedBalancedDefault ? BALANCED_PRIORITIES : { ...intent.priorities },
  };
}

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

function generateWithFallback(
  input: GenerateLineupInput,
  fallbackReason: string,
): GenerateLeagueLineupResult {
  const shortlist = buildLeagueShortlist(input);
  const search: LeagueSearchMetadata = {
    ...shortlist.search,
    solverStatus: 'fallback',
    solverVersion: LEAGUE_SOLVER_VERSION,
    timeLimitMs: LEAGUE_SOLVER_TIME_LIMIT_MS,
    fallbackReason,
  };
  const result = generateLineupWithinPoolLimit(
    { ...input, players: shortlist.players, profiles: shortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
    input.players.map((player) => player.id),
  );
  if (!result.success && result.reason === 'infeasible' && !shortlist.search.exhausted) {
    return {
      success: false,
      reason: 'search-limit',
      message:
        'The full-pool solver was unavailable and the deterministic fallback found no valid lineup. The full league pool was not exhausted, so this is not proof that the request is infeasible.',
      evaluatedCandidateCount: result.evaluatedCandidateCount,
      constraintSummary: [],
      search,
    };
  }
  return result.success || result.reason === 'infeasible' ? { ...result, search } : result;
}

export async function generateLeagueLineup(
  input: GenerateLineupInput,
): Promise<GenerateLeagueLineupResult> {
  const issues = validateGenerationInput(input, null);
  if (issues.length > 0) {
    const dataCodes = new Set([
      'MISSING_PROFILE',
      'DUPLICATE_PROFILE',
      'DUPLICATE_ELIGIBLE_PLAYER',
    ]);
    return Promise.resolve({
      success: false,
      reason: issues.some((issue) => dataCodes.has(issue.code)) ? 'data-error' : 'invalid-input',
      issues,
    });
  }

  const excluded = new Set(input.intent.excludedPlayerIds);
  const eligiblePlayerCount = input.players.filter((player) => !excluded.has(player.id)).length;
  const hintShortlist = buildLeagueShortlist(input);
  const hintResult = generateLineupWithinPoolLimit(
    { ...input, players: hintShortlist.players, profiles: hintShortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
    input.players.map((player) => player.id),
  );
  const solved = await optimizeLeagueLineup(input.players, input.profiles, input.intent, {
    ...(hintResult.success ? { hintPlayerIds: hintResult.winner.lineup.playerIds } : {}),
  });
  if (solved.kind === 'unavailable') return generateWithFallback(input, solved.reason);
  const search = proofMetadata(eligiblePlayerCount, solved.proof);
  if (solved.kind === 'infeasible') {
    return {
      success: false,
      reason: 'infeasible',
      message:
        'CP-SAT proved that no five-player lineup in the full eligible league pool satisfies every requirement. No requirement was relaxed.',
      evaluatedCandidateCount: 0,
      constraintSummary: [],
      search,
    };
  }
  const { priorities, usedBalancedDefault } = appliedPriorities(input.intent);
  return {
    success: true,
    winner: candidateFor(solved.playerIds, input, priorities),
    alternatives: [],
    appliedPriorities: priorities,
    usedBalancedDefault,
    evaluatedCandidateCount: 0,
    validCandidateCount: 1,
    search,
  };
}

function repairWithFallback(
  input: RepairLineupInput,
  fallbackReason: string,
): RepairLeagueLineupResult {
  const shortlist = buildLeagueShortlist(
    { players: input.players, profiles: input.profiles, intent: input.intent },
    input.currentPlayerIds,
  );
  const search: LeagueSearchMetadata = {
    ...shortlist.search,
    solverStatus: 'fallback',
    solverVersion: LEAGUE_SOLVER_VERSION,
    timeLimitMs: LEAGUE_SOLVER_TIME_LIMIT_MS,
    fallbackReason,
  };
  const result = repairLineupWithinPoolLimit(
    { ...input, players: shortlist.players, profiles: shortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
    input.players.map((player) => player.id),
  );
  if (!result.success && result.reason === 'infeasible' && !shortlist.search.exhausted) {
    return {
      success: false,
      reason: 'search-limit',
      message:
        'The full-pool solver was unavailable and the deterministic fallback found no valid repair. The full league pool was not exhausted, so this is not proof that the request is infeasible.',
      evaluatedCandidateCount: result.evaluatedCandidateCount,
      constraintSummary: [],
      search,
    };
  }
  return result.success || result.reason === 'infeasible' ? { ...result, search } : result;
}

export async function repairLeagueLineup(
  input: RepairLineupInput,
): Promise<RepairLeagueLineupResult> {
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
    return Promise.resolve({
      success: false,
      reason: issues.some((issue) => dataCodes.has(issue.code)) ? 'data-error' : 'invalid-input',
      issues,
    });
  }

  const current = analyzeLineup({
    playerIds: input.currentPlayerIds,
    players: input.players,
    profiles: input.profiles,
  });
  if (!current.success) return repairWithFallback(input, 'The starting lineup is invalid.');
  const excluded = new Set(input.intent.excludedPlayerIds);
  const eligiblePlayerCount = input.players.filter((player) => !excluded.has(player.id)).length;
  const hintShortlist = buildLeagueShortlist(
    { players: input.players, profiles: input.profiles, intent: input.intent },
    input.currentPlayerIds,
  );
  const hintResult = repairLineupWithinPoolLimit(
    { ...input, players: hintShortlist.players, profiles: hintShortlist.profiles },
    LEAGUE_SHORTLIST_SIZE,
    input.players.map((player) => player.id),
  );
  const solved = await optimizeLeagueLineup(input.players, input.profiles, input.intent, {
    currentPlayerIds: input.currentPlayerIds,
    ...(hintResult.success ? { hintPlayerIds: hintResult.repair.after.lineup.playerIds } : {}),
  });
  if (solved.kind === 'unavailable') return repairWithFallback(input, solved.reason);
  const search = proofMetadata(eligiblePlayerCount, solved.proof);
  if (solved.kind === 'infeasible') {
    return {
      success: false,
      reason: 'infeasible',
      message:
        'CP-SAT proved that no repair in the full eligible league pool satisfies every requirement. No requirement was relaxed.',
      evaluatedCandidateCount: 0,
      constraintSummary: [],
      search,
    };
  }
  const generationInput = {
    players: input.players,
    profiles: input.profiles,
    intent: input.intent,
  };
  const { priorities, usedBalancedDefault } = appliedPriorities(input.intent);
  const after = candidateFor(solved.playerIds, generationInput, priorities);
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const before: GeneratedLineupCandidate = {
    lineup: current.lineup,
    analysis: current.analysis,
    objectiveScore: calculateObjectiveScore(current.analysis, priorities),
    constraints: evaluateLineupConstraints(
      current.lineup.playerIds.map((id) => profilesById.get(id)!),
      current.analysis,
      input.intent,
    ),
  };
  const currentIds = new Set(current.lineup.playerIds);
  const removedPlayerIds = current.lineup.playerIds
    .filter((id) => !after.lineup.playerIds.includes(id))
    .sort();
  const addedPlayerIds = after.lineup.playerIds.filter((id) => !currentIds.has(id)).sort();
  return {
    success: true,
    repair: {
      before,
      after: removedPlayerIds.length === 0 ? { ...after, lineup: current.lineup } : after,
      swapCount: addedPlayerIds.length,
      removedPlayerIds,
      addedPlayerIds,
      comparison: compareLineupAnalyses(current.analysis, after.analysis),
    },
    appliedPriorities: priorities,
    usedBalancedDefault,
    evaluatedCandidateCount: 0,
    validCandidateCount: 1,
    search,
  };
}
