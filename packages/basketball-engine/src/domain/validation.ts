import { LINEUP_SIZE, type Lineup, type LineupPlayerIds } from './types.js';

export type LineupValidationIssue =
  | {
      code: 'INVALID_PLAYER_COUNT';
      message: string;
      expected: number;
      received: number;
    }
  | {
      code: 'DUPLICATE_PLAYER';
      message: string;
      duplicatePlayerIds: string[];
    };

export type LineupValidationResult =
  { valid: true; lineup: Lineup } | { valid: false; issues: LineupValidationIssue[] };

function findDuplicateIds(playerIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const playerId of playerIds) {
    if (seen.has(playerId)) {
      duplicates.add(playerId);
    }
    seen.add(playerId);
  }

  return [...duplicates].sort();
}

export function validateLineup(playerIds: readonly string[]): LineupValidationResult {
  const issues: LineupValidationIssue[] = [];

  if (playerIds.length !== LINEUP_SIZE) {
    issues.push({
      code: 'INVALID_PLAYER_COUNT',
      message: `A lineup must contain exactly ${LINEUP_SIZE} players; received ${playerIds.length}.`,
      expected: LINEUP_SIZE,
      received: playerIds.length,
    });
  }

  const duplicatePlayerIds = findDuplicateIds(playerIds);
  if (duplicatePlayerIds.length > 0) {
    issues.push({
      code: 'DUPLICATE_PLAYER',
      message: `A lineup cannot contain the same player more than once: ${duplicatePlayerIds.join(', ')}.`,
      duplicatePlayerIds,
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  // The length check above makes this conversion from a runtime array to the domain tuple safe.
  return {
    valid: true,
    lineup: { playerIds: [...playerIds] as LineupPlayerIds },
  };
}
