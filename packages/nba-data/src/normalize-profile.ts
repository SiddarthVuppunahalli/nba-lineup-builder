import type { PlayerProfile } from '@lineup-engine/basketball-engine';

import type { RawSeasonPlayer } from './types.js';

function scale(value: number, low: number, high: number): number {
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}

function weighted(parts: readonly [number, number][]): number {
  const value = parts.reduce((sum, [item, weight]) => sum + item * weight, 0);
  return Number(Math.max(0, Math.min(100, value)).toFixed(1));
}

function positionValue(position: string, values: Record<string, number>): number {
  const positions = position.split('-');
  return Math.max(...positions.map((item) => values[item] ?? 50));
}

export function derivePlayerProfile(playerId: string, raw: RawSeasonPlayer): PlayerProfile {
  const reboundRate = raw.minutesPerGame ? (raw.reboundsPerGame / raw.minutesPerGame) * 36 : 0;
  const assistTurnoverRatio = raw.turnoverPct ? raw.assistPct / raw.turnoverPct : raw.assistPct;
  const defensiveImpact = scale(raw.defensiveBoxPlusMinus, -2.5, 4);
  const stealImpact = scale(raw.stealPct, 0.8, 4);
  const blockImpact = scale(raw.blockPct, 0, 8);

  return {
    playerId,
    shooting: weighted([
      [100, 0.15],
      [scale(raw.threePointPct, 0.27, 0.43), 0.3],
      [scale(raw.threePointAttemptsPerGame, 0, 8), 0.4],
      [scale(raw.trueShootingPct, 0.5, 0.68), 0.15],
    ]),
    creation: weighted([
      [scale(raw.usagePct, 10, 34), 0.55],
      [scale(raw.assistPct, 3, 38), 0.35],
      [scale(18 - raw.turnoverPct, 0, 14), 0.1],
    ]),
    playmaking: weighted([
      [scale(raw.assistPct, 5, 45), 0.7],
      [scale(assistTurnoverRatio, 0.5, 3), 0.3],
    ]),
    rebounding: weighted([
      [scale(raw.defensiveReboundPct, 7, 32), 0.65],
      [scale(reboundRate, 3, 16), 0.35],
    ]),
    perimeterDefense: weighted([
      [stealImpact, 0.45],
      [defensiveImpact, 0.35],
      [positionValue(raw.position, { PG: 85, SG: 85, SF: 80, PF: 60, C: 40 }), 0.2],
    ]),
    interiorDefense: weighted([
      [blockImpact, 0.5],
      [scale(raw.defensiveReboundPct, 7, 32), 0.3],
      [positionValue(raw.position, { PG: 20, SG: 25, SF: 45, PF: 70, C: 90 }), 0.2],
    ]),
    switchability: weighted([
      [defensiveImpact, 0.4],
      [stealImpact, 0.25],
      [blockImpact, 0.15],
      [positionValue(raw.position, { PG: 55, SG: 70, SF: 85, PF: 80, C: 60 }), 0.2],
    ]),
    metadata: {
      sourceSeason: '2024-25',
      sourceId: 'basketball-reference-2024-25-v1',
      methodologyVersion: 'box-score-profile-v1',
    },
  };
}
