import { analyzeLineup, type LineupAnalysisIssue } from '../analysis/analyze-lineup.js';
import {
  LINEUP_SIZE,
  type GeneratedLineupCandidate,
  type LineupIntent,
  type MetricPriorities,
  type Player,
  type PlayerProfile,
  type RepairedLineup,
} from '../domain/types.js';
import { compareLineupAnalyses } from '../comparison/compare-lineups.js';
import { evaluateLineupConstraints } from '../generation/constraints.js';
import {
  calculateObjectiveScore,
  generateLineupWithinPoolLimit,
  MAX_EXHAUSTIVE_POOL_SIZE,
  type GenerationIssue,
  type InfeasibleConstraintSummary,
} from '../generation/generate-lineup.js';

export interface RepairLineupInput {
  currentPlayerIds: readonly string[];
  players: readonly Player[];
  profiles: readonly PlayerProfile[];
  intent: LineupIntent;
}

export type RepairLineupIssue =
  | GenerationIssue
  | {
      code: 'INVALID_CURRENT_LINEUP';
      message: string;
      issues: LineupAnalysisIssue[];
    };

export type RepairLineupResult =
  | {
      success: true;
      repair: RepairedLineup;
      appliedPriorities: MetricPriorities;
      usedBalancedDefault: boolean;
      evaluatedCandidateCount: number;
      validCandidateCount: number;
    }
  | { success: false; reason: 'invalid-input' | 'data-error'; issues: RepairLineupIssue[] }
  | {
      success: false;
      reason: 'infeasible';
      message: string;
      evaluatedCandidateCount: number;
      constraintSummary: InfeasibleConstraintSummary[];
    };

function combinations(ids: readonly string[]): string[][] {
  const output: string[][] = [];
  function visit(start: number, selected: string[]) {
    if (selected.length === LINEUP_SIZE) {
      output.push([...selected]);
      return;
    }
    for (let index = start; index <= ids.length - (LINEUP_SIZE - selected.length); index += 1) {
      selected.push(ids[index]!);
      visit(index + 1, selected);
      selected.pop();
    }
  }
  visit(0, []);
  return output;
}

function canonicalCompare(left: GeneratedLineupCandidate, right: GeneratedLineupCandidate): number {
  const scoreDifference = right.objectiveScore - left.objectiveScore;
  if (scoreDifference !== 0) return scoreDifference;
  const leftKey = left.lineup.playerIds.join('|');
  const rightKey = right.lineup.playerIds.join('|');
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function repairLineupWithinPoolLimit(
  input: RepairLineupInput,
  maximumPoolSize: number,
): RepairLineupResult {
  const current = analyzeLineup({
    playerIds: input.currentPlayerIds,
    players: input.players,
    profiles: input.profiles,
  });
  if (!current.success) {
    const dataError = current.issues.some((issue) => issue.code === 'MISSING_PROFILE');
    return {
      success: false,
      reason: dataError ? 'data-error' : 'invalid-input',
      issues: [
        {
          code: 'INVALID_CURRENT_LINEUP',
          message: 'The starting lineup cannot be repaired because it is invalid.',
          issues: current.issues,
        },
      ],
    };
  }

  const generated = generateLineupWithinPoolLimit(
    { players: input.players, profiles: input.profiles, intent: input.intent },
    maximumPoolSize,
  );
  if (!generated.success) return generated;

  const required = new Set(input.intent.requiredPlayerIds);
  const excluded = new Set(input.intent.excludedPlayerIds);
  const eligibleIds = input.players
    .map((player) => player.id)
    .filter((id) => !excluded.has(id))
    .sort();
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const currentIds = new Set(current.lineup.playerIds);
  const candidates: Array<GeneratedLineupCandidate & { swapCount: number }> = [];

  for (const playerIds of combinations(eligibleIds)) {
    if (![...required].every((id) => playerIds.includes(id))) continue;
    const analyzed = analyzeLineup({ playerIds, players: input.players, profiles: input.profiles });
    if (!analyzed.success) continue;
    const constraints = evaluateLineupConstraints(
      playerIds.map((id) => profilesById.get(id)!),
      analyzed.analysis,
      input.intent,
    );
    if (constraints.some((constraint) => !constraint.satisfied)) continue;
    candidates.push({
      lineup: analyzed.lineup,
      analysis: analyzed.analysis,
      objectiveScore: calculateObjectiveScore(analyzed.analysis, generated.appliedPriorities),
      constraints,
      swapCount: playerIds.filter((id) => !currentIds.has(id)).length,
    });
  }

  candidates.sort(
    (left, right) => left.swapCount - right.swapCount || canonicalCompare(left, right),
  );
  const selected = candidates[0]!;
  const repairedCandidate: GeneratedLineupCandidate =
    selected.swapCount === 0 ? { ...selected, lineup: current.lineup } : selected;
  const removedPlayerIds = current.lineup.playerIds
    .filter((id) => !repairedCandidate.lineup.playerIds.includes(id))
    .sort();
  const addedPlayerIds = repairedCandidate.lineup.playerIds
    .filter((id) => !currentIds.has(id))
    .sort();
  const beforeProfiles = current.lineup.playerIds.map((id) => profilesById.get(id)!);
  const before: GeneratedLineupCandidate = {
    lineup: current.lineup,
    analysis: current.analysis,
    objectiveScore: calculateObjectiveScore(current.analysis, generated.appliedPriorities),
    constraints: evaluateLineupConstraints(beforeProfiles, current.analysis, input.intent),
  };

  return {
    success: true,
    repair: {
      before,
      after: repairedCandidate,
      swapCount: selected.swapCount,
      removedPlayerIds,
      addedPlayerIds,
      comparison: compareLineupAnalyses(current.analysis, repairedCandidate.analysis),
    },
    appliedPriorities: generated.appliedPriorities,
    usedBalancedDefault: generated.usedBalancedDefault,
    evaluatedCandidateCount: generated.evaluatedCandidateCount,
    validCandidateCount: generated.validCandidateCount,
  };
}

export function repairLineup(input: RepairLineupInput): RepairLineupResult {
  return repairLineupWithinPoolLimit(input, MAX_EXHAUSTIVE_POOL_SIZE);
}
