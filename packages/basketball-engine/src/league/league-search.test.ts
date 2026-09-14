import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type { LineupIntent, Player, PlayerProfile } from '../domain/types.js';
import { generateLineup } from '../generation/generate-lineup.js';
import {
  generateLeagueLineup,
  LEAGUE_SHORTLIST_SIZE,
  repairLeagueLineup,
} from './league-search.js';

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
  minimumShooters: 0,
  minimumCreators: 0,
  metricMinimums: {},
  requiredPlayerIds: [],
  excludedPlayerIds: [],
};

describe('league search', () => {
  it('matches exhaustive generation when the full pool fits within the bound', () => {
    const exhaustive = generateLineup({ players: DEMO_PLAYERS, profiles: DEMO_PROFILES, intent });
    const league = generateLeagueLineup({ players: DEMO_PLAYERS, profiles: DEMO_PROFILES, intent });
    expect(exhaustive.success).toBe(true);
    expect(league.success).toBe(true);
    if (!exhaustive.success || !league.success) return;
    expect(league.winner.lineup.playerIds).toEqual(exhaustive.winner.lineup.playerIds);
    expect(league.search.exhausted).toBe(true);
    expect(league.search.optimalityGuaranteed).toBe(true);
  });

  it('uses the same deterministic shortlist regardless of input ordering', () => {
    const players: Player[] = Array.from({ length: 30 }, (_, index) => ({
      id: `player-${String(index).padStart(2, '0')}`,
      name: `Player ${index}`,
      teamId: `team-${index % 3}`,
      position: index % 5 === 0 ? 'C' : 'G',
    }));
    const profiles: PlayerProfile[] = players.map((player, index) => ({
      playerId: player.id,
      shooting: 40 + index,
      creation: 70 - index,
      playmaking: 50 + (index % 15),
      rebounding: 40 + (index % 20),
      perimeterDefense: 45 + (index % 18),
      interiorDefense: 35 + (index % 25),
      switchability: 55 + (index % 10),
    }));
    const first = generateLeagueLineup({ players, profiles, intent });
    const second = generateLeagueLineup({
      players: [...players].reverse(),
      profiles: [...profiles].reverse(),
      intent,
    });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.winner.lineup.playerIds).toEqual(second.winner.lineup.playerIds);
    expect(first.search.searchedPlayerCount).toBe(LEAGUE_SHORTLIST_SIZE);
    expect(first.search.exhausted).toBe(false);
    expect(first.search.optimalityGuaranteed).toBe(false);
  });

  it('does not label a bounded miss as proven infeasibility', () => {
    const players: Player[] = Array.from({ length: 24 }, (_, index) => ({
      id: `large-${index}`,
      name: `Large ${index}`,
      teamId: 'league',
      position: 'G',
    }));
    const profiles: PlayerProfile[] = players.map((player) => ({
      playerId: player.id,
      shooting: 60,
      creation: 60,
      playmaking: 60,
      rebounding: 60,
      perimeterDefense: 60,
      interiorDefense: 60,
      switchability: 60,
    }));
    const result = generateLeagueLineup({
      players,
      profiles,
      intent: { ...intent, minimumShooters: 5 },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('search-limit');
  });

  it('keeps an excluded current player available for before/after league repair evidence', () => {
    const players: Player[] = Array.from({ length: 24 }, (_, index) => ({
      id: `repair-${index}`,
      name: `Repair ${index}`,
      teamId: `team-${index % 3}`,
      position: index % 5 === 0 ? 'C' : 'G',
    }));
    const profiles: PlayerProfile[] = players.map((player, index) => ({
      playerId: player.id,
      shooting: 50 + index,
      creation: 50 + index,
      playmaking: 50 + index,
      rebounding: 50 + index,
      perimeterDefense: 50 + index,
      interiorDefense: 50 + index,
      switchability: 50 + index,
    }));
    const result = repairLeagueLineup({
      currentPlayerIds: players.slice(0, 5).map((player) => player.id),
      players,
      profiles,
      intent: { ...intent, excludedPlayerIds: [players[0]!.id] },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.repair.before.lineup.playerIds).toContain(players[0]!.id);
    expect(result.repair.after.lineup.playerIds).not.toContain(players[0]!.id);
    expect(result.search.exhausted).toBe(false);
  });
});
