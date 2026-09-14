import { describe, expect, it } from 'vitest';

import { BALANCED_PRIORITIES, generateLineup } from '@lineup-engine/basketball-engine';

import { NBA_2024_25_LEAGUE_POOL, NBA_2024_25_TEAM_POOLS } from './snapshot-2024-25.js';

describe('2024-25 snapshot', () => {
  it('contains four ten-player dated team rosters and one 40-player league pool', () => {
    expect(NBA_2024_25_TEAM_POOLS).toHaveLength(4);
    expect(NBA_2024_25_TEAM_POOLS.every((pool) => pool.players.length === 10)).toBe(true);
    expect(NBA_2024_25_LEAGUE_POOL.players).toHaveLength(40);
    expect(NBA_2024_25_LEAGUE_POOL.source.snapshotDate).toBe('2025-04-13');
  });

  it('has exactly one profile with traceable metadata for every player', () => {
    const profileById = new Map(
      NBA_2024_25_LEAGUE_POOL.profiles.map((profile) => [profile.playerId, profile]),
    );
    expect(profileById.size).toBe(NBA_2024_25_LEAGUE_POOL.players.length);
    for (const player of NBA_2024_25_LEAGUE_POOL.players) {
      expect(profileById.get(player.id)?.metadata).toEqual({
        sourceSeason: '2024-25',
        sourceId: 'basketball-reference-2024-25-v1',
        methodologyVersion: 'box-score-profile-v1',
      });
    }
  });

  it('keeps the default Boston request feasible under the versioned profile calibration', () => {
    const boston = NBA_2024_25_TEAM_POOLS.find((pool) => pool.team.abbreviation === 'BOS')!;
    const tatum = boston.profiles.find((profile) => profile.playerId.endsWith('jayson-tatum'))!;

    expect(tatum.creation).toBeGreaterThanOrEqual(75);
    expect(
      boston.profiles.filter((profile) => profile.shooting >= 75).length,
    ).toBeGreaterThanOrEqual(3);

    expect(
      generateLineup({
        players: boston.players,
        profiles: boston.profiles,
        intent: {
          priorities: BALANCED_PRIORITIES,
          minimumShooters: 3,
          minimumCreators: 1,
          metricMinimums: {},
          requiredPlayerIds: [],
          excludedPlayerIds: [],
        },
      }).success,
    ).toBe(true);
  });
});
