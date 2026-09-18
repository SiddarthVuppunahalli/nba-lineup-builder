import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type { LineupIntent, Player, PlayerProfile } from '../domain/types.js';
import { generateLineup } from '../generation/generate-lineup.js';
import { repairLineup } from '../repair/repair-lineup.js';
import { generateLeagueLineup, repairLeagueLineup } from './league-search.js';

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
  it('matches exhaustive hard role constraints at the experimental boundaries', async () => {
    const players = DEMO_PLAYERS.slice(0, 8);
    const profiles = DEMO_PROFILES.slice(0, 8).map((p, i) => ({
      ...p,
      shooting: i < 2 ? 64.9 : 65,
      creation: i < 2 ? 59.9 : 60,
    }));
    const boundaryIntent = { ...intent, minimumShooters: 5, minimumCreators: 5 };
    const exhaustive = generateLineup({ players, profiles, intent: boundaryIntent });
    const solved = await generateLeagueLineup({ players, profiles, intent: boundaryIntent });
    expect(exhaustive.success).toBe(true);
    expect(solved.success).toBe(true);
    if (!exhaustive.success || !solved.success) return;
    expect(solved.winner.lineup.playerIds).toEqual(exhaustive.winner.lineup.playerIds);
    expect(solved.winner.analysis).toEqual(exhaustive.winner.analysis);
    expect(solved.winner.objectiveScore).toBe(exhaustive.winner.objectiveScore);
    expect(solved.search.solverStatus).toBe('optimal');
    expect(solved.winner.lineup.playerIds).not.toContain(players[0]!.id);
    expect(solved.winner.lineup.playerIds).not.toContain(players[1]!.id);
  }, 30_000);
  it('matches exhaustive generation when the full pool fits within the bound', async () => {
    const exhaustive = generateLineup({ players: DEMO_PLAYERS, profiles: DEMO_PROFILES, intent });
    const league = await generateLeagueLineup({
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent,
    });
    expect(exhaustive.success).toBe(true);
    expect(league.success).toBe(true);
    if (!exhaustive.success || !league.success) return;
    expect(league.winner.lineup.playerIds).toEqual(exhaustive.winner.lineup.playerIds);
    expect(league.search.strategy).toBe('cp-sat');
    expect(league.search.optimalityGuaranteed).toBe(true);
  });

  it('uses the full pool deterministically regardless of input ordering', async () => {
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
    const first = await generateLeagueLineup({ players, profiles, intent });
    const second = await generateLeagueLineup({
      players: [...players].reverse(),
      profiles: [...profiles].reverse(),
      intent,
    });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.winner.lineup.playerIds).toEqual(second.winner.lineup.playerIds);
    expect(first.search.searchedPlayerCount).toBe(30);
    expect(first.search.strategy).toBe('cp-sat');
    expect(first.search.solverStatus).toMatch(/optimal|feasible-time-limit/);
    if (!first.search.optimalityGuaranteed) {
      expect(first.search.objectiveBound).toBeGreaterThanOrEqual(first.winner.objectiveScore);
      expect(first.search.objectiveGap).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);

  it('labels infeasibility only after the full-pool solver proves it', async () => {
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
    const result = await generateLeagueLineup({
      players,
      profiles,
      intent: { ...intent, minimumShooters: 5 },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('infeasible');
    if (result.reason === 'infeasible' && 'search' in result) {
      expect(result.search.solverStatus).toBe('infeasible');
    }
  });

  it('matches exhaustive canonical tie behavior', async () => {
    const players: Player[] = Array.from({ length: 8 }, (_, index) => ({
      id: `tie-${index}`,
      name: `Tie ${index}`,
      teamId: 'tie-team',
      position: 'G',
    }));
    const profiles: PlayerProfile[] = players.map((player) => ({
      playerId: player.id,
      shooting: 70,
      creation: 70,
      playmaking: 70,
      rebounding: 70,
      perimeterDefense: 70,
      interiorDefense: 70,
      switchability: 70,
    }));
    const exhaustive = generateLineup({ players, profiles, intent });
    const solved = await generateLeagueLineup({ players, profiles, intent });
    expect(exhaustive.success).toBe(true);
    expect(solved.success).toBe(true);
    if (!exhaustive.success || !solved.success) return;
    expect(solved.winner.lineup.playerIds).toEqual(exhaustive.winner.lineup.playerIds);
    expect(solved.search.solverStatus).toBe('optimal');
    expect(solved.search.canonicalTieProven).toBe(true);
  });

  it('matches exhaustive fewest-swaps repair on a team-sized fixture', async () => {
    const currentPlayerIds = DEMO_PLAYERS.slice(0, 5).map((player) => player.id);
    const repairIntent = {
      ...intent,
      minimumShooters: 4,
    };
    const exhaustive = repairLineup({
      currentPlayerIds,
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: repairIntent,
    });
    const solved = await repairLeagueLineup({
      currentPlayerIds,
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: repairIntent,
    });
    expect(exhaustive.success).toBe(true);
    expect(solved.success).toBe(true);
    if (!exhaustive.success || !solved.success) return;
    expect(solved.repair.after.lineup.playerIds).toEqual(exhaustive.repair.after.lineup.playerIds);
    expect(solved.repair.swapCount).toBe(exhaustive.repair.swapCount);
    expect(solved.search.minimumSwapsProven).toBe(true);
  });

  it('retains the honest deterministic fallback when an exact solver model is unavailable', async () => {
    const players: Player[] = Array.from({ length: 24 }, (_, index) => ({
      id: `fallback-${index}`,
      name: `Fallback ${index}`,
      teamId: 'fallback-team',
      position: 'G',
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
    const result = await generateLeagueLineup({
      players,
      profiles,
      intent: {
        ...intent,
        priorities: { ...intent.priorities, shooting: 0.12345678901 },
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.search.strategy).toBe('bounded-shortlist');
    expect(result.search.solverStatus).toBe('fallback');
    expect(result.search.optimalityGuaranteed).toBe(false);
    expect(result.search.fallbackReason).toMatch(/priority precision/i);
  }, 15_000);

  it('keeps an excluded current player available for before/after league repair evidence', async () => {
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
    const result = await repairLeagueLineup({
      currentPlayerIds: players.slice(0, 5).map((player) => player.id),
      players,
      profiles,
      intent: { ...intent, excludedPlayerIds: [players[0]!.id] },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.repair.before.lineup.playerIds).toContain(players[0]!.id);
    expect(result.repair.after.lineup.playerIds).not.toContain(players[0]!.id);
    expect(result.search.strategy).toBe('cp-sat');
  });
});
