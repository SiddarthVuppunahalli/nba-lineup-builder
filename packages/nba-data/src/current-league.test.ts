import { describe, expect, it } from 'vitest';

import { BALANCED_PRIORITIES, generateLineup } from '@lineup-engine/basketball-engine';

import { CURRENT_GENERATION_COUNTS, CURRENT_PLAYERS } from './current-league.generated.js';
import {
  NBA_CURRENT_LEAGUE_POOL,
  NBA_CURRENT_SOURCE,
  NBA_CURRENT_TEAM_POOLS,
} from './current-league.js';
import { validateCurrentSnapshot } from './validate-current-snapshot.js';
import type { SnapshotSource } from './types.js';

describe('current league snapshot', () => {
  it('accounts for every identity across all 30 current teams', () => {
    expect(NBA_CURRENT_TEAM_POOLS).toHaveLength(30);
    expect(NBA_CURRENT_LEAGUE_POOL.players).toHaveLength(598);
    expect(NBA_CURRENT_LEAGUE_POOL.profiles).toHaveLength(392);
    expect(CURRENT_GENERATION_COUNTS.unavailableProfiles).toBe(206);
    expect(new Set(NBA_CURRENT_LEAGUE_POOL.players.map((player) => player.id)).size).toBe(598);
    expect(
      NBA_CURRENT_TEAM_POOLS.every(
        (pool) => pool.profiles.length >= 5 && pool.profiles.length <= 18,
      ),
    ).toBe(true);
  });

  it('records complete dated provenance without changing the scoring methodology', () => {
    expect(NBA_CURRENT_SOURCE).toMatchObject({
      snapshotDate: '2026-09-15',
      retrievalDate: '2026-09-15',
      rosterDate: '2026-09-15',
      statisticsSeason: '2025-26',
      methodologyVersion: 'box-score-profile-v1',
      minimumProfileMinutes: 400,
      reconciliationVersion: 'nba-bref-name-reconciliation-v1',
    });
    expect(NBA_CURRENT_SOURCE.sourceUrls).toHaveLength(3);
  });

  it('uses aggregate season-total rows for traded players', () => {
    const buddyHield = CURRENT_PLAYERS.find((player) => player.name === 'Buddy Hield');
    expect(buddyHield?.stats).toMatchObject({
      sourceTeam: '2TM',
      rowSelection: 'season-total',
    });
    expect(CURRENT_GENERATION_COUNTS.seasonTotalRows).toBe(61);
  });

  it('records explicit reconciliation and precise unavailability evidence', () => {
    expect(CURRENT_PLAYERS.find((player) => player.name === 'Ronald Holland II')).toMatchObject({
      reconciliation: expect.stringContaining('Ronald Holland II'),
      stats: expect.objectContaining({ sourceName: 'Ron Holland' }),
    });
    expect(
      NBA_CURRENT_LEAGUE_POOL.profileUnavailableReasons?.get('nba-2026-27-ind-tyrese-haliburton'),
    ).toContain('Achilles');
  });

  it('searches varying eligible team pools exhaustively', () => {
    for (const abbreviation of ['CHI', 'ATL']) {
      const pool = NBA_CURRENT_TEAM_POOLS.find(
        (candidate) => candidate.team.abbreviation === abbreviation,
      )!;
      const profileIds = new Set(pool.profiles.map((profile) => profile.playerId));
      const result = generateLineup({
        players: pool.players.filter((player) => profileIds.has(player.id)),
        profiles: pool.profiles,
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
      if (result.success) {
        expect(result.evaluatedCandidateCount).toBe(abbreviation === 'CHI' ? 252 : 6_188);
      }
    }
  });

  it('fails validation for duplicate membership, unaccounted rows, and missing provenance', () => {
    const first = NBA_CURRENT_TEAM_POOLS[0]!;
    const second = NBA_CURRENT_TEAM_POOLS[1]!;
    expect(() =>
      validateCurrentSnapshot(
        [
          { ...first, players: [...first.players, first.players[0]!] },
          ...NBA_CURRENT_TEAM_POOLS.slice(1),
        ],
        NBA_CURRENT_SOURCE,
        599,
      ),
    ).toThrow(/Duplicate roster ID/);

    const duplicatePlayer = first.players.find(
      (player) => !first.profiles.some((profile) => profile.playerId === player.id),
    )!;
    const duplicateMembership = [
      first,
      { ...second, players: [...second.players, duplicatePlayer] },
      ...NBA_CURRENT_TEAM_POOLS.slice(2),
    ];
    expect(() => validateCurrentSnapshot(duplicateMembership, NBA_CURRENT_SOURCE, 599)).toThrow(
      /belongs to 2 teams/,
    );

    const missingReason = new Map(first.profileUnavailableReasons);
    const unavailableId = first.players.find(
      (player) => !first.profiles.some((profile) => profile.playerId === player.id),
    )!.id;
    missingReason.delete(unavailableId);
    expect(() =>
      validateCurrentSnapshot(
        [
          { ...first, profileUnavailableReasons: missingReason },
          ...NBA_CURRENT_TEAM_POOLS.slice(1),
        ],
        NBA_CURRENT_SOURCE,
        598,
      ),
    ).toThrow(/not uniquely accounted/);

    const missingRetrievalDate: SnapshotSource = { ...NBA_CURRENT_SOURCE };
    delete missingRetrievalDate.retrievalDate;
    expect(() =>
      validateCurrentSnapshot(NBA_CURRENT_TEAM_POOLS, missingRetrievalDate, 598),
    ).toThrow(/provenance is incomplete/);
  });
});
