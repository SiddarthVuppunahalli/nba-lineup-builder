import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type { LineupIntent } from '../domain/types.js';
import { BALANCED_PRIORITIES } from '../generation/generate-lineup.js';
import { repairLineup } from './repair-lineup.js';

const weakShootingLineup = [
  'andre-okafor',
  'darius-knox',
  'owen-price',
  'luca-hayes',
  'theo-grant',
];

function intent(overrides: Partial<LineupIntent> = {}): LineupIntent {
  return {
    priorities: BALANCED_PRIORITIES,
    minimumShooters: 0,
    minimumCreators: 0,
    metricMinimums: {},
    requiredPlayerIds: [],
    excludedPlayerIds: [],
    ...overrides,
  };
}

function repair(inputIntent: LineupIntent, players = DEMO_PLAYERS, profiles = DEMO_PROFILES) {
  const result = repairLineup({
    currentPlayerIds: weakShootingLineup,
    players,
    profiles,
    intent: inputIntent,
  });
  if (!result.success) throw new Error(`Expected repair to succeed: ${JSON.stringify(result)}`);
  return result;
}

describe('repairLineup', () => {
  it('uses the fewest swaps needed to satisfy new requirements', () => {
    const result = repair(intent({ minimumShooters: 5, requiredPlayerIds: ['darius-knox'] }));

    expect(result.repair.swapCount).toBe(2);
    expect(result.repair.removedPlayerIds).toHaveLength(2);
    expect(result.repair.addedPlayerIds).toHaveLength(2);
    expect(result.repair.after.lineup.playerIds).toContain('darius-knox');
    expect(result.repair.after.constraints.every((constraint) => constraint.satisfied)).toBe(true);
    expect(result.repair.before.constraints).toContainEqual(
      expect.objectContaining({ id: 'minimum-shooters', satisfied: false, actual: 3, required: 5 }),
    );
  });

  it('keeps an already-valid lineup unchanged even when another lineup scores higher', () => {
    const result = repair(intent({ minimumShooters: 1 }));

    expect(result.repair.swapCount).toBe(0);
    expect(result.repair.after.lineup.playerIds).toEqual(weakShootingLineup);
    expect(result.repair.removedPlayerIds).toEqual([]);
    expect(result.repair.addedPlayerIds).toEqual([]);
  });

  it('reports every metric delta and identifies the largest gain and tradeoff', () => {
    const result = repair(intent({ minimumShooters: 5 }));

    expect(result.repair.comparison.metrics).toHaveLength(7);
    expect(result.repair.comparison.metrics).toContainEqual(
      expect.objectContaining({ metric: 'shooting', delta: expect.any(Number) }),
    );
    expect(result.repair.comparison.largestGain?.delta).toBeGreaterThan(0);
    expect(result.repair.comparison.largestTradeoff?.delta).toBeLessThan(0);
  });

  it('is reproducible when the eligible pool is reordered', () => {
    const request = intent({ minimumShooters: 5 });
    const first = repair(request);
    const reordered = repair(request, [...DEMO_PLAYERS].reverse(), [...DEMO_PROFILES].reverse());

    expect(reordered.repair.after.lineup.playerIds).toEqual(first.repair.after.lineup.playerIds);
    expect(reordered.repair.comparison).toEqual(first.repair.comparison);
  });

  it('returns a clear infeasible result without changing the starting lineup', () => {
    const result = repairLineup({
      currentPlayerIds: weakShootingLineup,
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES.map((profile) => ({ ...profile, creation: 59.9 })),
      intent: intent({ minimumCreators: 5 }),
    });

    expect(result).toMatchObject({
      success: false,
      reason: 'infeasible',
      message: expect.stringContaining('No requirement was relaxed'),
    });
  });

  it('distinguishes an invalid starting lineup from an infeasible repair', () => {
    const result = repairLineup({
      currentPlayerIds: ['andre-okafor', 'darius-knox'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: intent(),
    });

    expect(result).toMatchObject({
      success: false,
      reason: 'invalid-input',
      issues: [expect.objectContaining({ code: 'INVALID_CURRENT_LINEUP' })],
    });
  });
});
