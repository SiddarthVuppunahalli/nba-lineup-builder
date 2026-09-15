import { describe, expect, it } from 'vitest';

import { BALANCED_PRIORITIES, generateLineup } from '@lineup-engine/basketball-engine';

import { SPURS_CURRENT_POOL } from './spurs-current.js';

describe('current Spurs pool', () => {
  it('keeps the full dated roster while separating players without completed-season profiles', () => {
    expect(SPURS_CURRENT_POOL.players).toHaveLength(18);
    expect(SPURS_CURRENT_POOL.profiles).toHaveLength(12);
    expect(SPURS_CURRENT_POOL.source.snapshotDate).toBe('2026-09-14');
    expect(SPURS_CURRENT_POOL.players.map((player) => player.name)).toEqual(
      expect.arrayContaining([
        'Victor Wembanyama',
        "De'Aaron Fox",
        'Stephon Castle',
        "Ja'Kobi Gillespie",
      ]),
    );
    expect(
      SPURS_CURRENT_POOL.profileUnavailableReasons?.get('nba-2026-27-sas-david-jones-garcia'),
    ).toContain('below the 400-minute minimum');
    expect(
      SPURS_CURRENT_POOL.profileUnavailableReasons?.get('nba-2026-27-sas-jordan-mclaughlin'),
    ).toContain('below the 400-minute minimum');
  });

  it('exhaustively generates from every current player with a completed-season profile', () => {
    const profileIds = new Set(SPURS_CURRENT_POOL.profiles.map((profile) => profile.playerId));
    const eligiblePlayers = SPURS_CURRENT_POOL.players.filter((player) =>
      profileIds.has(player.id),
    );
    const result = generateLineup({
      players: eligiblePlayers,
      profiles: SPURS_CURRENT_POOL.profiles,
      intent: {
        priorities: BALANCED_PRIORITIES,
        minimumShooters: 0,
        minimumCreators: 0,
        metricMinimums: {},
        requiredPlayerIds: [],
        excludedPlayerIds: [],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.evaluatedCandidateCount).toBe(792);
  });
});
