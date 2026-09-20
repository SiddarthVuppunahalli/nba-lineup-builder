import type {
  EvaluatedPlayer,
  LineupAnalysis,
  LineupFinding,
  MetricScore,
} from '../domain/types.js';
import { CREATOR_THRESHOLD, SHOOTER_THRESHOLD } from './metrics.js';

function playerEvidence(metric: MetricScore) {
  return metric.evidence.filter((item) => item.kind === 'player-score');
}

export function deriveFindings(
  players: readonly EvaluatedPlayer[],
  analysis: Omit<LineupAnalysis, 'findings'>,
): LineupFinding[] {
  const findings: LineupFinding[] = [];
  const shooterIds = players
    .filter(({ profile }) => profile.shooting >= SHOOTER_THRESHOLD)
    .map(({ player }) => player.id);
  const creatorIds = players
    .filter(({ profile }) => profile.creation >= CREATOR_THRESHOLD)
    .map(({ player }) => player.id);

  if (shooterIds.length >= 4) {
    findings.push({
      id: 'spacing:strong',
      type: 'spacing',
      severity: 'strength',
      title: 'Strong spacing',
      description: `${shooterIds.length} players meet the shooting threshold, stretching help defense across the floor.`,
      affectedPlayerIds: shooterIds,
      evidence: analysis.shooting.evidence,
    });
  }

  if (creatorIds.length < 2) {
    findings.push({
      id: 'creation:insufficient',
      type: 'creation',
      severity: 'concern',
      title: 'Insufficient creation',
      description: `${creatorIds.length} player${creatorIds.length === 1 ? '' : 's'} meet the creation threshold; the lineup needs at least two reliable initiators for resilient half-court offense.`,
      affectedPlayerIds: creatorIds,
      evidence: analysis.creation.evidence,
    });
  } else {
    findings.push({
      id: 'creation:multiple',
      type: 'creation',
      severity: 'strength',
      title: 'Multiple creators',
      description: `${creatorIds.length} players can create advantages, reducing reliance on one primary initiator.`,
      affectedPlayerIds: creatorIds,
      evidence: analysis.creation.evidence,
    });
  }

  if (analysis.rebounding.score < 40) {
    findings.push({
      id: 'rebounding:weak',
      type: 'rebounding',
      severity: 'concern',
      title: 'Weak rebounding',
      description:
        'The lineup may struggle to finish defensive possessions and generate second chances.',
      evidence: playerEvidence(analysis.rebounding),
    });
  }

  if (analysis.interiorDefense.score < 60) {
    findings.push({
      id: 'interior-defense:limited',
      type: 'interior-defense',
      severity: 'concern',
      title: 'Limited interior defense',
      description: 'The lineup lacks a dependable back-line rim deterrent against paint pressure.',
      evidence: playerEvidence(analysis.interiorDefense),
    });
  }

  if (analysis.perimeterDefense.score >= 75 && analysis.switchability.score >= 75) {
    findings.push({
      id: 'switchability:versatile',
      type: 'switchability',
      severity: 'strength',
      title: 'Versatile perimeter defense',
      description:
        'Strong point-of-attack defense and switchability support aggressive matchup changes.',
      evidence: [...analysis.perimeterDefense.evidence, ...analysis.switchability.evidence],
    });
  }

  return findings;
}
