import type { LineupIntentDto } from '@lineup-engine/shared';

export const intentMetrics = [
  ['shooting', 'Shooting'],
  ['creation', 'Creation'],
  ['playmaking', 'Playmaking'],
  ['rebounding', 'Rebounding'],
  ['perimeterDefense', 'Perimeter defense'],
  ['interiorDefense', 'Interior defense'],
  ['switchability', 'Switchability'],
] as const;

export const balancedIntent: LineupIntentDto = {
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
  metricMinimums: {},
  requiredPlayerIds: [],
  excludedPlayerIds: [],
};
