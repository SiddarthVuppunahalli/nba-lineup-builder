import {
  countPlayersAtThreshold,
  CREATOR_THRESHOLD,
  SHOOTER_THRESHOLD,
} from '../analysis/metrics.js';
import {
  METRIC_NAMES,
  type ConstraintResult,
  type LineupAnalysis,
  type LineupIntent,
  type PlayerProfile,
} from '../domain/types.js';

const metricLabels = {
  shooting: 'Shooting',
  creation: 'Creation',
  playmaking: 'Playmaking',
  rebounding: 'Rebounding',
  perimeterDefense: 'Perimeter defense',
  interiorDefense: 'Interior defense',
  switchability: 'Switchability',
} as const;

export function evaluateLineupConstraints(
  profiles: readonly PlayerProfile[],
  analysis: LineupAnalysis,
  intent: LineupIntent,
): ConstraintResult[] {
  const shooterCount = countPlayersAtThreshold(profiles, 'shooting', SHOOTER_THRESHOLD);
  const creatorCount = countPlayersAtThreshold(profiles, 'creation', CREATOR_THRESHOLD);
  const results: ConstraintResult[] = [
    {
      id: 'minimum-shooters',
      kind: 'minimum-shooters',
      label: 'Credible shooters',
      satisfied: shooterCount >= intent.minimumShooters,
      actual: shooterCount,
      required: intent.minimumShooters,
      description: `${shooterCount} of 5 players meet the ${SHOOTER_THRESHOLD}-point shooting threshold; ${intent.minimumShooters} required.`,
    },
    {
      id: 'minimum-creators',
      kind: 'minimum-creators',
      label: 'High-level creators',
      satisfied: creatorCount >= intent.minimumCreators,
      actual: creatorCount,
      required: intent.minimumCreators,
      description: `${creatorCount} of 5 players meet the ${CREATOR_THRESHOLD}-point creation threshold; ${intent.minimumCreators} required.`,
    },
  ];

  for (const metric of METRIC_NAMES) {
    const minimum = intent.metricMinimums[metric];
    if (minimum === undefined) continue;
    const actual = analysis[metric].score;
    results.push({
      id: `metric-minimum:${metric}`,
      kind: 'metric-minimum',
      metric,
      label: `${metricLabels[metric]} score`,
      satisfied: actual >= minimum,
      actual,
      required: minimum,
      description: `${metricLabels[metric]} is ${actual} / 100; ${minimum} required.`,
    });
  }

  return results;
}
