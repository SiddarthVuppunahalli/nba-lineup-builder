import { analyzeLineup } from '../analysis/analyze-lineup.js';
import {
  LINEUP_SIZE,
  METRIC_NAMES,
  type GeneratedLineupCandidate,
  type LineupIntent,
  type MetricPriorities,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import { evaluateLineupConstraints } from './constraints.js';

export const MAX_EXHAUSTIVE_POOL_SIZE = 18;
export const MAX_GENERATION_ALTERNATIVES = 2;

export const BALANCED_PRIORITIES: MetricPriorities = {
  shooting: 1,
  creation: 1,
  playmaking: 1,
  rebounding: 1,
  perimeterDefense: 1,
  interiorDefense: 1,
  switchability: 1,
};

export type GenerationIssue =
  | { code: 'POOL_TOO_LARGE'; message: string; maximum: number; received: number }
  | { code: 'DUPLICATE_ELIGIBLE_PLAYER'; message: string; playerIds: string[] }
  | { code: 'MISSING_PROFILE'; message: string; playerIds: string[] }
  | { code: 'DUPLICATE_PROFILE'; message: string; playerIds: string[] }
  | { code: 'INVALID_PRIORITY'; message: string; metric: string; value: number }
  | { code: 'INVALID_COUNT'; message: string; field: string; value: number }
  | { code: 'INVALID_METRIC_MINIMUM'; message: string; metric: string; value: number }
  | { code: 'DUPLICATE_REQUIRED_PLAYER'; message: string; playerIds: string[] }
  | { code: 'DUPLICATE_EXCLUDED_PLAYER'; message: string; playerIds: string[] }
  | { code: 'CONFLICTING_PLAYER_RULE'; message: string; playerIds: string[] }
  | { code: 'TOO_MANY_REQUIRED_PLAYERS'; message: string; maximum: number; received: number }
  | { code: 'UNKNOWN_REQUIRED_PLAYER'; message: string; playerIds: string[] }
  | { code: 'UNKNOWN_EXCLUDED_PLAYER'; message: string; playerIds: string[] };

export interface InfeasibleConstraintSummary {
  constraintId: string;
  label: string;
  failedCandidateCount: number;
  evaluatedCandidateCount: number;
  description: string;
}

export type GenerateLineupResult =
  | {
      success: true;
      winner: GeneratedLineupCandidate;
      alternatives: GeneratedLineupCandidate[];
      appliedPriorities: MetricPriorities;
      usedBalancedDefault: boolean;
      evaluatedCandidateCount: number;
      validCandidateCount: number;
    }
  | { success: false; reason: 'invalid-input' | 'data-error'; issues: GenerationIssue[] }
  | {
      success: false;
      reason: 'infeasible';
      message: string;
      evaluatedCandidateCount: number;
      constraintSummary: InfeasibleConstraintSummary[];
    };

export interface GenerateLineupInput {
  players: readonly Player[];
  profiles: readonly PlayerProfile[];
  intent: LineupIntent;
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated].sort();
}

export function validateGenerationInput(
  input: GenerateLineupInput,
  maximumPoolSize: number | null = MAX_EXHAUSTIVE_POOL_SIZE,
  knownPlayerIds: readonly string[] = input.players.map((player) => player.id),
): GenerationIssue[] {
  const issues: GenerationIssue[] = [];
  const playerIds = input.players.map((player) => player.id);
  const playerIdSet = new Set(playerIds);
  const knownPlayerIdSet = new Set(knownPlayerIds);
  const profileIds = input.profiles.map((profile) => profile.playerId);
  const duplicatePlayers = duplicates(playerIds);
  const duplicateProfiles = duplicates(profileIds);
  const missingProfiles = [...playerIdSet].filter((id) => !profileIds.includes(id)).sort();
  const duplicateRequired = duplicates(input.intent.requiredPlayerIds);
  const duplicateExcluded = duplicates(input.intent.excludedPlayerIds);
  const excluded = new Set(input.intent.excludedPlayerIds);
  const conflicts = [
    ...new Set(input.intent.requiredPlayerIds.filter((id) => excluded.has(id))),
  ].sort();
  const unknownRequired = [
    ...new Set(input.intent.requiredPlayerIds.filter((id) => !knownPlayerIdSet.has(id))),
  ].sort();
  const unknownExcluded = [
    ...new Set(input.intent.excludedPlayerIds.filter((id) => !knownPlayerIdSet.has(id))),
  ].sort();

  if (maximumPoolSize !== null && input.players.length > maximumPoolSize)
    issues.push({
      code: 'POOL_TOO_LARGE',
      message: `Exhaustive generation supports at most ${maximumPoolSize} eligible players; received ${input.players.length}.`,
      maximum: maximumPoolSize,
      received: input.players.length,
    });
  if (duplicatePlayers.length)
    issues.push({
      code: 'DUPLICATE_ELIGIBLE_PLAYER',
      message: `The eligible pool repeats: ${duplicatePlayers.join(', ')}.`,
      playerIds: duplicatePlayers,
    });
  if (missingProfiles.length)
    issues.push({
      code: 'MISSING_PROFILE',
      message: `No basketball profile is available for: ${missingProfiles.join(', ')}.`,
      playerIds: missingProfiles,
    });
  if (duplicateProfiles.length)
    issues.push({
      code: 'DUPLICATE_PROFILE',
      message: `Multiple profiles were supplied for: ${duplicateProfiles.join(', ')}.`,
      playerIds: duplicateProfiles,
    });

  for (const metric of METRIC_NAMES) {
    const value = input.intent.priorities[metric];
    if (!Number.isFinite(value) || value < 0 || value > 1)
      issues.push({
        code: 'INVALID_PRIORITY',
        message: `${metric} priority must be a finite number from 0 to 1.`,
        metric,
        value,
      });
    const minimum = input.intent.metricMinimums[metric];
    if (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0 || minimum > 100))
      issues.push({
        code: 'INVALID_METRIC_MINIMUM',
        message: `${metric} minimum must be a finite number from 0 to 100.`,
        metric,
        value: minimum,
      });
  }
  for (const [field, value] of [
    ['minimumShooters', input.intent.minimumShooters],
    ['minimumCreators', input.intent.minimumCreators],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > LINEUP_SIZE)
      issues.push({
        code: 'INVALID_COUNT',
        message: `${field} must be an integer from 0 to ${LINEUP_SIZE}.`,
        field,
        value,
      });
  }
  if (duplicateRequired.length)
    issues.push({
      code: 'DUPLICATE_REQUIRED_PLAYER',
      message: `Required players repeat: ${duplicateRequired.join(', ')}.`,
      playerIds: duplicateRequired,
    });
  if (duplicateExcluded.length)
    issues.push({
      code: 'DUPLICATE_EXCLUDED_PLAYER',
      message: `Excluded players repeat: ${duplicateExcluded.join(', ')}.`,
      playerIds: duplicateExcluded,
    });
  if (conflicts.length)
    issues.push({
      code: 'CONFLICTING_PLAYER_RULE',
      message: `Players cannot be both required and excluded: ${conflicts.join(', ')}.`,
      playerIds: conflicts,
    });
  if (input.intent.requiredPlayerIds.length > LINEUP_SIZE)
    issues.push({
      code: 'TOO_MANY_REQUIRED_PLAYERS',
      message: `At most ${LINEUP_SIZE} players can be required.`,
      maximum: LINEUP_SIZE,
      received: input.intent.requiredPlayerIds.length,
    });
  if (unknownRequired.length)
    issues.push({
      code: 'UNKNOWN_REQUIRED_PLAYER',
      message: `Required players are not in the eligible pool: ${unknownRequired.join(', ')}.`,
      playerIds: unknownRequired,
    });
  if (unknownExcluded.length)
    issues.push({
      code: 'UNKNOWN_EXCLUDED_PLAYER',
      message: `Excluded players are not in the eligible pool: ${unknownExcluded.join(', ')}.`,
      playerIds: unknownExcluded,
    });
  return issues;
}

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

export function calculateObjectiveScore(
  analysis: GeneratedLineupCandidate['analysis'],
  priorities: MetricPriorities,
): number {
  const totalWeight = METRIC_NAMES.reduce((sum, metric) => sum + priorities[metric], 0);
  const weighted = METRIC_NAMES.reduce(
    (sum, metric) => sum + analysis[metric].score * priorities[metric],
    0,
  );
  return Number((weighted / totalWeight).toFixed(4));
}

export function generateLineupWithinPoolLimit(
  input: GenerateLineupInput,
  maximumPoolSize: number,
  knownPlayerIds?: readonly string[],
): GenerateLineupResult {
  const issues = validateGenerationInput(input, maximumPoolSize, knownPlayerIds);
  if (issues.length) {
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

  const usedBalancedDefault = METRIC_NAMES.every((metric) => input.intent.priorities[metric] === 0);
  const appliedPriorities = usedBalancedDefault
    ? BALANCED_PRIORITIES
    : { ...input.intent.priorities };
  const required = new Set(input.intent.requiredPlayerIds);
  const excluded = new Set(input.intent.excludedPlayerIds);
  const eligibleIds = input.players
    .map((player) => player.id)
    .filter((id) => !excluded.has(id))
    .sort();
  const candidateIds = combinations(eligibleIds).filter((ids) =>
    [...required].every((id) => ids.includes(id)),
  );
  const profilesById = new Map(input.profiles.map((profile) => [profile.playerId, profile]));
  const candidates: GeneratedLineupCandidate[] = [];
  const failureCounts = new Map<string, { label: string; count: number; description: string }>();

  for (const playerIds of candidateIds) {
    const analyzed = analyzeLineup({ playerIds, players: input.players, profiles: input.profiles });
    if (!analyzed.success)
      throw new Error('Validated generation input produced an unanalyzable candidate.');
    const candidateProfiles = playerIds.map((id) => profilesById.get(id)!);
    const constraints = evaluateLineupConstraints(
      candidateProfiles,
      analyzed.analysis,
      input.intent,
    );
    for (const constraint of constraints.filter((item) => !item.satisfied)) {
      const current = failureCounts.get(constraint.id);
      failureCounts.set(constraint.id, {
        label: constraint.label,
        count: (current?.count ?? 0) + 1,
        description: constraint.description,
      });
    }
    if (constraints.some((constraint) => !constraint.satisfied)) continue;
    const candidate: GeneratedLineupCandidate = {
      lineup: analyzed.lineup,
      analysis: analyzed.analysis,
      objectiveScore: 0,
      constraints,
    };
    candidate.objectiveScore = calculateObjectiveScore(candidate.analysis, appliedPriorities);
    candidates.push(candidate);
  }

  candidates.sort((left, right) => {
    const scoreDifference = right.objectiveScore - left.objectiveScore;
    if (scoreDifference !== 0) return scoreDifference;
    const leftKey = left.lineup.playerIds.join('|');
    const rightKey = right.lineup.playerIds.join('|');
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  if (!candidates.length) {
    return {
      success: false,
      reason: 'infeasible',
      message: 'No five-player lineup satisfies every requirement. No requirement was relaxed.',
      evaluatedCandidateCount: candidateIds.length,
      constraintSummary: [...failureCounts.entries()]
        .map(([constraintId, value]) => ({
          constraintId,
          label: value.label,
          failedCandidateCount: value.count,
          evaluatedCandidateCount: candidateIds.length,
          description: `${value.label} excluded ${value.count} of ${candidateIds.length} eligible combinations. Example: ${value.description}`,
        }))
        .sort((left, right) => left.constraintId.localeCompare(right.constraintId)),
    };
  }

  return {
    success: true,
    winner: candidates[0]!,
    alternatives: candidates.slice(1, MAX_GENERATION_ALTERNATIVES + 1),
    appliedPriorities,
    usedBalancedDefault,
    evaluatedCandidateCount: candidateIds.length,
    validCandidateCount: candidates.length,
  };
}

export function generateLineup(input: GenerateLineupInput): GenerateLineupResult {
  return generateLineupWithinPoolLimit(input, MAX_EXHAUSTIVE_POOL_SIZE);
}
