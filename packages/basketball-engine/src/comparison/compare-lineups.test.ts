import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type { LineupIntent } from '../domain/types.js';
import { compareLineups } from './compare-lineups.js';

const intent: LineupIntent = {
  priorities: {
    shooting: 1,
    creation: 1,
    playmaking: 1,
    rebounding: 1,
    perimeterDefense: 1,
    interiorDefense: 1,
    switchability: 1,
  },
  minimumShooters: 3,
  minimumCreators: 1,
  metricMinimums: { shooting: 80 },
  requiredPlayerIds: [],
  excludedPlayerIds: [],
};

describe('compareLineups', () => {
  it('compares player changes, metrics, fit, and requirement satisfaction', () => {
    const result = compareLineups({
      beforePlayerIds: ['andre-okafor', 'darius-knox', 'owen-price', 'luca-hayes', 'theo-grant'],
      afterPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.comparison.removedPlayerIds).toEqual([
      'andre-okafor',
      'darius-knox',
      'luca-hayes',
      'owen-price',
    ]);
    expect(result.comparison.addedPlayerIds).toEqual([
      'eli-mercer',
      'jordan-vega',
      'malik-rhodes',
      'samir-cole',
    ]);
    expect(result.comparison.retainedPlayerIds).toEqual(['theo-grant']);
    expect(result.comparison.comparison.metrics).toHaveLength(7);
    expect(result.comparison.comparison.largestGain?.delta).toBeGreaterThan(0);
    expect(result.comparison.before.constraints).toContainEqual(
      expect.objectContaining({ id: 'metric-minimum:shooting', satisfied: false }),
    );
    expect(result.comparison.after.constraints).toContainEqual(
      expect.objectContaining({ id: 'metric-minimum:shooting', satisfied: true }),
    );
  });

  it('returns which side is invalid instead of comparing partial data', () => {
    const result = compareLineups({
      beforePlayerIds: ['jordan-vega'],
      afterPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent,
    });

    expect(result).toMatchObject({ success: false, reason: 'invalid-before' });
  });

  it('uses balanced priorities when every comparison weight is zero', () => {
    const result = compareLineups({
      beforePlayerIds: ['andre-okafor', 'darius-knox', 'owen-price', 'luca-hayes', 'theo-grant'],
      afterPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: {
        ...intent,
        priorities: Object.fromEntries(
          Object.keys(intent.priorities).map((key) => [key, 0]),
        ) as LineupIntent['priorities'],
      },
    });

    expect(result).toMatchObject({ success: true, usedBalancedDefault: true });
  });

  it('rejects invalid comparison requirements at the domain boundary', () => {
    const result = compareLineups({
      beforePlayerIds: ['andre-okafor', 'darius-knox', 'owen-price', 'luca-hayes', 'theo-grant'],
      afterPlayerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: { ...intent, minimumShooters: 6 },
    });

    expect(result).toMatchObject({
      success: false,
      reason: 'invalid-intent',
      issues: [expect.objectContaining({ code: 'INVALID_COUNT' })],
    });
  });
});
