import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import {
  METRIC_NAMES,
  type LineupIntent,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import { BALANCED_PRIORITIES, generateLineup } from './generate-lineup.js';

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

function successful(inputIntent: LineupIntent, players = DEMO_PLAYERS, profiles = DEMO_PROFILES) {
  const result = generateLineup({ players, profiles, intent: inputIntent });
  if (!result.success) throw new Error(`Expected success: ${JSON.stringify(result)}`);
  return result;
}

describe('generateLineup', () => {
  it('is reproducible and independent of eligible-pool ordering', () => {
    const request = intent({ minimumShooters: 3, minimumCreators: 1 });
    const first = successful(request);
    const repeated = successful(request);
    const reversed = successful(request, [...DEMO_PLAYERS].reverse(), [...DEMO_PROFILES].reverse());

    expect(repeated.winner.lineup.playerIds).toEqual(first.winner.lineup.playerIds);
    expect(reversed.winner.lineup.playerIds).toEqual(first.winner.lineup.playerIds);
    expect(reversed.alternatives.map((candidate) => candidate.lineup.playerIds)).toEqual(
      first.alternatives.map((candidate) => candidate.lineup.playerIds),
    );
  });

  it('returns only eligible candidates that obey player rules and hard constraints', () => {
    const result = successful(
      intent({
        minimumShooters: 3,
        minimumCreators: 1,
        metricMinimums: { perimeterDefense: 70 },
        requiredPlayerIds: ['andre-okafor'],
        excludedPlayerIds: ['nico-park'],
      }),
    );

    for (const candidate of [result.winner, ...result.alternatives]) {
      expect(new Set(candidate.lineup.playerIds).size).toBe(5);
      expect(candidate.lineup.playerIds).toContain('andre-okafor');
      expect(candidate.lineup.playerIds).not.toContain('nico-park');
      expect(candidate.constraints.every((constraint) => constraint.satisfied)).toBe(true);
      expect(candidate.constraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'minimum-shooters', required: 3 }),
          expect.objectContaining({ id: 'metric-minimum:perimeterDefense', required: 70 }),
        ]),
      );
    }
  });

  it('changes the winner when deliberately contrasting priorities', () => {
    const shooting = successful(
      intent({
        priorities: {
          ...Object.fromEntries(METRIC_NAMES.map((name) => [name, 0])),
          shooting: 1,
        } as LineupIntent['priorities'],
      }),
    );
    const rebounding = successful(
      intent({
        priorities: {
          ...Object.fromEntries(METRIC_NAMES.map((name) => [name, 0])),
          rebounding: 1,
        } as LineupIntent['priorities'],
      }),
    );

    expect(shooting.winner.lineup.playerIds).not.toEqual(rebounding.winner.lineup.playerIds);
    expect(shooting.winner.analysis.shooting.score).toBeGreaterThan(
      rebounding.winner.analysis.shooting.score,
    );
    expect(rebounding.winner.analysis.rebounding.score).toBeGreaterThan(
      shooting.winner.analysis.rebounding.score,
    );
  });

  it('uses the documented balanced preset when all weights are zero', () => {
    const zeroes = Object.fromEntries(
      METRIC_NAMES.map((name) => [name, 0]),
    ) as LineupIntent['priorities'];
    const result = successful(intent({ priorities: zeroes }));

    expect(result.usedBalancedDefault).toBe(true);
    expect(result.appliedPriorities).toEqual(BALANCED_PRIORITIES);
    expect(result.winner.objectiveScore).toBeGreaterThan(0);
  });

  it('reports infeasible requirements without relaxing them', () => {
    const result = generateLineup({
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES.map((profile) => ({ ...profile, creation: 59.9 })),
      intent: intent({ minimumCreators: 5 }),
    });

    expect(result).toMatchObject({
      success: false,
      reason: 'infeasible',
      message: expect.stringContaining('No requirement was relaxed'),
      constraintSummary: [
        expect.objectContaining({ constraintId: 'minimum-creators', failedCandidateCount: 252 }),
      ],
    });
  });

  it('distinguishes invalid player intent from missing profile data', () => {
    const unknown = generateLineup({
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: intent({ requiredPlayerIds: ['not-on-roster'] }),
    });
    const missing = generateLineup({
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES.filter((profile) => profile.playerId !== 'eli-mercer'),
      intent: intent(),
    });

    expect(unknown).toMatchObject({
      success: false,
      reason: 'invalid-input',
      issues: [expect.objectContaining({ code: 'UNKNOWN_REQUIRED_PLAYER' })],
    });
    expect(missing).toMatchObject({
      success: false,
      reason: 'data-error',
      issues: [expect.objectContaining({ code: 'MISSING_PROFILE' })],
    });
  });

  it('rejects non-finite and out-of-range intent values', () => {
    const result = generateLineup({
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
      intent: intent({
        priorities: { ...BALANCED_PRIORITIES, shooting: Number.NaN },
        metricMinimums: { creation: 101 },
      }),
    });

    expect(result).toMatchObject({
      success: false,
      reason: 'invalid-input',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_PRIORITY', metric: 'shooting' }),
        expect.objectContaining({ code: 'INVALID_METRIC_MINIMUM', metric: 'creation' }),
      ]),
    });
  });

  it('refuses pools beyond the documented exhaustive-search bound', () => {
    const players: Player[] = Array.from({ length: 19 }, (_, index) => ({
      id: `player-${index}`,
      name: `Player ${index}`,
      teamId: 'large-fixture',
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

    expect(generateLineup({ players, profiles, intent: intent() })).toMatchObject({
      success: false,
      reason: 'invalid-input',
      issues: [expect.objectContaining({ code: 'POOL_TOO_LARGE', maximum: 18 })],
    });
  });

  it('exhaustively selects the best known candidate and uses canonical ties', () => {
    const players: Player[] = ['f', 'e', 'd', 'c', 'b', 'a'].map((id) => ({
      id,
      name: id,
      teamId: 'fixture',
      position: 'G',
    }));
    const profiles: PlayerProfile[] = players.map((player, index) => ({
      playerId: player.id,
      shooting: index === 0 ? 10 : 80,
      creation: 70,
      playmaking: 70,
      rebounding: 70,
      perimeterDefense: 70,
      interiorDefense: 70,
      switchability: 70,
    }));
    const result = successful(
      intent({
        priorities: {
          ...BALANCED_PRIORITIES,
          creation: 0,
          playmaking: 0,
          rebounding: 0,
          perimeterDefense: 0,
          interiorDefense: 0,
          switchability: 0,
        },
      }),
      players,
      profiles,
    );

    expect(result.evaluatedCandidateCount).toBe(6);
    expect(result.winner.lineup.playerIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
