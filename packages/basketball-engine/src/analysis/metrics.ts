import type {
  EvaluatedPlayer,
  MetricEvidence,
  MetricName,
  MetricScore,
  PlayerProfile,
} from '../domain/types.js';
import { normalizeMetricScore } from './normalize-metric-score.js';

export const SHOOTER_THRESHOLD = 75;
export const CREATOR_THRESHOLD = 75;

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function valuesFor(players: readonly EvaluatedPlayer[], metric: MetricName): number[] {
  return players.map(({ profile }) => profile[metric]);
}

function playerEvidence(players: readonly EvaluatedPlayer[], metric: MetricName): MetricEvidence[] {
  return players.map(({ player, profile }) => ({
    id: `${metric}:player:${player.id}`,
    kind: 'player-score',
    label: player.name,
    value: profile[metric],
    description: `${player.name}'s normalized ${metric} profile score.`,
    playerId: player.id,
  }));
}

function adjustment(
  metric: MetricName,
  rule: string,
  value: number,
  label: string,
  description: string,
): MetricEvidence {
  return {
    id: `${metric}:rule:${rule}`,
    kind: 'rule-adjustment',
    label,
    value,
    description,
  };
}

function weightedComponent(
  metric: MetricName,
  key: string,
  label: string,
  value: number,
  weight: number,
): MetricEvidence {
  const points = value * weight;
  const format = (number: number) => Number(number.toFixed(4));
  return {
    id: `${metric}:weight:${key}`,
    kind: 'weighted-component',
    label: `${label} · ${format(weight * 100)}%`,
    value: points,
    description: `${format(value)} × ${format(weight * 100)}% = ${format(points)} points.`,
  };
}

function metricScore(evidence: MetricEvidence[]): MetricScore {
  // Player ratings are context. Only weighted contributions and adjustments form the score.
  const score = evidence.reduce(
    (total, item) => total + (item.kind === 'player-score' ? 0 : item.value),
    0,
  );
  return { score: normalizeMetricScore(score), evidence };
}

export function evaluateShooting(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'shooting');
  const shooterCount = scores.filter((score) => score >= SHOOTER_THRESHOLD).length;
  let spacingAdjustment = 0;
  let label = 'Neutral spacing';
  let description = `${shooterCount} players meet the ${SHOOTER_THRESHOLD}-point shooter threshold.`;

  if (shooterCount >= 4) {
    spacingAdjustment = 5;
    label = 'Four-player spacing bonus';
    description = `${shooterCount} credible shooters force the defense to cover most of the floor.`;
  } else if (shooterCount === 3) {
    spacingAdjustment = 2;
    label = 'Three-player spacing bonus';
    description = 'Three credible shooters provide a functional spacing floor.';
  } else {
    spacingAdjustment = -6 * (3 - shooterCount);
    label = 'Non-shooter spacing penalty';
    description = `Only ${shooterCount} players meet the shooter threshold, allowing extra defensive help.`;
  }

  return metricScore([
    ...playerEvidence(players, 'shooting'),
    weightedComponent('shooting', 'mean', 'Lineup average', mean(scores), 1),
    adjustment('shooting', 'spacing', spacingAdjustment, label, description),
  ]);
}

export function evaluateCreation(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'creation');
  const sorted = [...scores].sort((left, right) => right - left);
  const creatorCount = scores.filter((score) => score >= CREATOR_THRESHOLD).length;
  const creatorAdjustment = creatorCount >= 2 ? 4 : creatorCount === 0 ? -10 : 0;
  const topCreator = sorted[0] ?? 0;
  const secondCreator = sorted[1] ?? 0;
  const label =
    creatorCount >= 2
      ? 'Multiple-creator bonus'
      : creatorCount === 0
        ? 'No-primary-creator penalty'
        : 'Single-creator structure';
  const description =
    creatorCount >= 2
      ? 'Two or more high-level creators reduce dependence on one initiator.'
      : creatorCount === 0
        ? 'No player meets the creator threshold, making reliable advantage creation unlikely.'
        : 'One high-level creator carries most of the lineup creation burden.';

  return metricScore([
    ...playerEvidence(players, 'creation'),
    weightedComponent('creation', 'best', 'Best creator', topCreator, 0.5),
    weightedComponent('creation', 'second', 'Second creator', secondCreator, 0.3),
    weightedComponent('creation', 'mean', 'Lineup average', mean(scores), 0.2),
    adjustment('creation', 'creator-count', creatorAdjustment, label, description),
  ]);
}

export function evaluatePlaymaking(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'playmaking');
  const sorted = [...scores].sort((left, right) => right - left);
  return metricScore([
    ...playerEvidence(players, 'playmaking'),
    weightedComponent('playmaking', 'mean', 'Lineup average', mean(scores), 0.5),
    weightedComponent('playmaking', 'best', 'Best playmaker', sorted[0] ?? 0, 0.3),
    weightedComponent('playmaking', 'second', 'Second playmaker', sorted[1] ?? 0, 0.2),
  ]);
}

export function evaluateRebounding(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'rebounding');
  const sorted = [...scores].sort((left, right) => right - left);
  const topTwoAverage = mean(sorted.slice(0, 2));
  const weakRebounderCount = scores.filter((score) => score < 50).length;
  const weakLinkPenalty = weakRebounderCount >= 3 ? -5 : 0;

  return metricScore([
    ...playerEvidence(players, 'rebounding'),
    weightedComponent('rebounding', 'mean', 'Lineup average', mean(scores), 0.65),
    weightedComponent('rebounding', 'top-two', 'Top two average', topTwoAverage, 0.35),
    ...(weakLinkPenalty === 0
      ? []
      : [
          adjustment(
            'rebounding',
            'weak-links',
            weakLinkPenalty,
            'Team rebounding penalty',
            `${weakRebounderCount} players score below 50, increasing the burden on the frontcourt.`,
          ),
        ]),
  ]);
}

export function evaluatePerimeterDefense(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'perimeterDefense');
  const sorted = [...scores].sort((left, right) => right - left);
  const strongest = sorted[0] ?? 0;
  const weakest = sorted.at(-1) ?? 0;
  return metricScore([
    ...playerEvidence(players, 'perimeterDefense'),
    weightedComponent('perimeterDefense', 'mean', 'Lineup average', mean(scores), 0.6),
    weightedComponent('perimeterDefense', 'best', 'Strongest defender', strongest, 0.25),
    weightedComponent('perimeterDefense', 'weakest', 'Weakest defender', weakest, 0.15),
  ]);
}

export function evaluateInteriorDefense(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'interiorDefense');
  const sorted = [...scores].sort((left, right) => right - left);
  return metricScore([
    ...playerEvidence(players, 'interiorDefense'),
    weightedComponent('interiorDefense', 'best', 'Strongest defender', sorted[0] ?? 0, 0.55),
    weightedComponent('interiorDefense', 'second', 'Second defender', sorted[1] ?? 0, 0.25),
    weightedComponent('interiorDefense', 'mean', 'Lineup average', mean(scores), 0.2),
  ]);
}

export function evaluateSwitchability(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'switchability');
  const weakest = Math.min(...scores);
  const limitedDefenderCount = scores.filter((score) => score < 55).length;
  const mismatchPenalty = limitedDefenderCount * -4;

  return metricScore([
    ...playerEvidence(players, 'switchability'),
    weightedComponent('switchability', 'mean', 'Lineup average', mean(scores), 0.75),
    weightedComponent('switchability', 'weakest', 'Weakest switch defender', weakest, 0.25),
    ...(mismatchPenalty === 0
      ? []
      : [
          adjustment(
            'switchability',
            'mismatch-risk',
            mismatchPenalty,
            'Mismatch penalty',
            `${limitedDefenderCount} player${limitedDefenderCount === 1 ? '' : 's'} score below 55 and may be targeted after a switch.`,
          ),
        ]),
  ]);
}

export function countPlayersAtThreshold(
  profiles: readonly PlayerProfile[],
  metric: 'shooting' | 'creation',
  threshold: number,
): number {
  return profiles.filter((profile) => profile[metric] >= threshold).length;
}
