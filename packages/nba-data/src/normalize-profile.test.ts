import { describe, expect, it } from 'vitest';

import { derivePlayerProfile } from './normalize-profile.js';
import type { RawSeasonPlayer } from './types.js';

const raw: RawSeasonPlayer = {
  teamAbbreviation: 'TST',
  name: 'Test Player',
  position: 'SF',
  games: 70,
  minutesPerGame: 32,
  threePointPct: 0.38,
  threePointAttemptsPerGame: 6,
  trueShootingPct: 0.61,
  usagePct: 24,
  assistPct: 22,
  turnoverPct: 11,
  reboundsPerGame: 6,
  defensiveReboundPct: 18,
  stealPct: 1.8,
  blockPct: 1.5,
  defensiveBoxPlusMinus: 1,
};

describe('profile normalization', () => {
  it('is reproducible and returns bounded one-decimal ratings', () => {
    const first = derivePlayerProfile('test-player', raw);
    const second = derivePlayerProfile('test-player', raw);
    expect(first).toEqual(second);
    for (const value of Object.values(first).filter((item) => typeof item === 'number')) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(String(value).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('uses position context only for defensive proxy metrics', () => {
    const guard = derivePlayerProfile('guard', { ...raw, position: 'PG' });
    const center = derivePlayerProfile('center', { ...raw, position: 'C' });
    expect(guard.shooting).toBe(center.shooting);
    expect(guard.creation).toBe(center.creation);
    expect(center.interiorDefense).toBeGreaterThan(guard.interiorDefense);
  });
});
