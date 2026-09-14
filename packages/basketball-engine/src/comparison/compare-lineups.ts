import { analyzeLineup, type LineupAnalysisIssue } from '../analysis/analyze-lineup.js';
import {
  METRIC_NAMES,
  type ComparedLineups,
  type GeneratedLineupCandidate,
  type LineupAnalysis,
  type LineupComparison,
  type LineupIntent,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import { evaluateLineupConstraints } from '../generation/constraints.js';
import {
  BALANCED_PRIORITIES,
  calculateObjectiveScore,
  validateGenerationInput,
  type GenerationIssue,
} from '../generation/generate-lineup.js';

export interface CompareLineupsInput {
  beforePlayerIds: readonly string[];
  afterPlayerIds: readonly string[];
  players: readonly Player[];
  profiles: readonly PlayerProfile[];
  intent: LineupIntent;
}

export type CompareLineupsResult =
  | { success: true; comparison: ComparedLineups; usedBalancedDefault: boolean }
  | {
      success: false;
      reason: 'invalid-before' | 'invalid-after' | 'invalid-intent' | 'data-error';
      issues: Array<LineupAnalysisIssue | GenerationIssue>;
    };

export function compareLineupAnalyses(
  before: LineupAnalysis,
  after: LineupAnalysis,
): LineupComparison {
  const metrics = METRIC_NAMES.map((metric) => ({
    metric,
    before: before[metric].score,
    after: after[metric].score,
    delta: Number((after[metric].score - before[metric].score).toFixed(1)),
  }));
  const gains = metrics
    .filter((metric) => metric.delta > 0)
    .sort((left, right) => right.delta - left.delta || left.metric.localeCompare(right.metric));
  const tradeoffs = metrics
    .filter((metric) => metric.delta < 0)
    .sort((left, right) => left.delta - right.delta || left.metric.localeCompare(right.metric));
  return {
    metrics,
    ...(gains[0] ? { largestGain: gains[0] } : {}),
    ...(tradeoffs[0] ? { largestTradeoff: tradeoffs[0] } : {}),
  };
}

export function compareLineups(input: CompareLineupsInput): CompareLineupsResult {
  const inputIssues = validateGenerationInput(
    {
      players: input.players,
      profiles: input.profiles,
      intent: input.intent,
    },
    null,
  );
  if (inputIssues.length > 0) {
    return {
      success: false,
      reason: inputIssues.some(
        (issue) =>
          issue.code === 'MISSING_PROFILE' ||
          issue.code === 'DUPLICATE_PROFILE' ||
          issue.code === 'DUPLICATE_ELIGIBLE_PLAYER',
      )
        ? 'data-error'
        : 'invalid-intent',
      issues: inputIssues,
    };
  }

  const before = analyzeLineup({
    playerIds: input.beforePlayerIds,
    players: input.players,
    profiles: input.profiles,
  });
  if (!before.success) {
    return {
      success: false,
      reason: before.issues.some((issue) => issue.code === 'MISSING_PROFILE')
        ? 'data-error'
        : 'invalid-before',
      issues: before.issues,
    };
  }

  const after = analyzeLineup({
    playerIds: input.afterPlayerIds,
    players: input.players,
    profiles: input.profiles,
  });
  if (!after.success) {
    return {
      success: false,
      reason: after.issues.some((issue) => issue.code === 'MISSING_PROFILE')
        ? 'data-error'
        : 'invalid-after',
      issues: after.issues,
    };
  }

  const priorities = input.intent.priorities;
  const usedBalancedDefault = Object.values(priorities).every((value) => value === 0);
  const appliedPriorities = usedBalancedDefault ? BALANCED_PRIORITIES : priorities;
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const candidate = (
    lineup: typeof before.lineup,
    analysis: typeof before.analysis,
  ): GeneratedLineupCandidate => ({
    lineup,
    analysis,
    objectiveScore: calculateObjectiveScore(analysis, appliedPriorities),
    constraints: evaluateLineupConstraints(
      lineup.playerIds.map((id) => profilesById.get(id)!),
      analysis,
      input.intent,
    ),
  });
  const beforeIds = new Set(before.lineup.playerIds);
  const afterIds = new Set(after.lineup.playerIds);

  return {
    success: true,
    usedBalancedDefault,
    comparison: {
      before: candidate(before.lineup, before.analysis),
      after: candidate(after.lineup, after.analysis),
      removedPlayerIds: before.lineup.playerIds.filter((id) => !afterIds.has(id)).sort(),
      addedPlayerIds: after.lineup.playerIds.filter((id) => !beforeIds.has(id)).sort(),
      retainedPlayerIds: before.lineup.playerIds.filter((id) => afterIds.has(id)).sort(),
      comparison: compareLineupAnalyses(before.analysis, after.analysis),
    },
  };
}
