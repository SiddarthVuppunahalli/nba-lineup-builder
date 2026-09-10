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

type ProfileMetric = Exclude<MetricName, never>;

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function valuesFor(players: readonly EvaluatedPlayer[], metric: ProfileMetric): number[] {
  return players.map(({ profile }) => profile[metric]);
}

function playerEvidence(
  players: readonly EvaluatedPlayer[],
  metric: ProfileMetric,
): MetricEvidence[] {
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

function metricScore(score: number, evidence: MetricEvidence[]): MetricScore {
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

  return metricScore(mean(scores) + spacingAdjustment, [
    ...playerEvidence(players, 'shooting'),
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
  const score = topCreator * 0.5 + secondCreator * 0.3 + mean(scores) * 0.2 + creatorAdjustment;
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

  return metricScore(score, [
    ...playerEvidence(players, 'creation'),
    adjustment('creation', 'creator-count', creatorAdjustment, label, description),
  ]);
}

export function evaluatePlaymaking(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'playmaking');
  const sorted = [...scores].sort((left, right) => right - left);
  const score = mean(scores) * 0.5 + (sorted[0] ?? 0) * 0.3 + (sorted[1] ?? 0) * 0.2;

  return metricScore(score, playerEvidence(players, 'playmaking'));
}

export function evaluateRebounding(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'rebounding');
  const sorted = [...scores].sort((left, right) => right - left);
  const topTwoAverage = mean(sorted.slice(0, 2));
  const weakRebounderCount = scores.filter((score) => score < 50).length;
  const weakLinkPenalty = weakRebounderCount >= 3 ? -5 : 0;

  return metricScore(mean(scores) * 0.65 + topTwoAverage * 0.35 + weakLinkPenalty, [
    ...playerEvidence(players, 'rebounding'),
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
  const score = mean(scores) * 0.6 + strongest * 0.25 + weakest * 0.15;

  return metricScore(score, playerEvidence(players, 'perimeterDefense'));
}

export function evaluateInteriorDefense(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'interiorDefense');
  const sorted = [...scores].sort((left, right) => right - left);
  const score = (sorted[0] ?? 0) * 0.55 + (sorted[1] ?? 0) * 0.25 + mean(scores) * 0.2;

  return metricScore(score, playerEvidence(players, 'interiorDefense'));
}

export function evaluateSwitchability(players: readonly EvaluatedPlayer[]): MetricScore {
  const scores = valuesFor(players, 'switchability');
  const weakest = Math.min(...scores);
  const limitedDefenderCount = scores.filter((score) => score < 55).length;
  const mismatchPenalty = limitedDefenderCount * -4;

  return metricScore(mean(scores) * 0.75 + weakest * 0.25 + mismatchPenalty, [
    ...playerEvidence(players, 'switchability'),
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
