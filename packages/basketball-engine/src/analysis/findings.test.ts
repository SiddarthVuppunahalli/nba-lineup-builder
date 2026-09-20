import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type {
  EvaluatedPlayer,
  LineupAnalysis,
  MetricEvidence,
  MetricScore,
} from '../domain/types.js';
import { deriveFindings } from './findings.js';

const players: EvaluatedPlayer[] = DEMO_PLAYERS.slice(0, 5).map((player) => {
  const profile = DEMO_PROFILES.find((candidate) => candidate.playerId === player.id);

  if (!profile) {
    throw new Error(`Missing demo profile for ${player.id}`);
  }

  return { player, profile };
});

function metric(score: number, evidence: MetricEvidence[] = []): MetricScore {
  return { score, evidence };
}

function analysis(
  overrides: Partial<Omit<LineupAnalysis, 'findings'>> = {},
): Omit<LineupAnalysis, 'findings'> {
  return {
    shooting: metric(50),
    creation: metric(50),
    playmaking: metric(50),
    rebounding: metric(50),
    perimeterDefense: metric(50),
    interiorDefense: metric(50),
    switchability: metric(50),
    ...overrides,
  };
}

const evidence = (id: string): MetricEvidence => ({
  id,
  kind: 'weighted-component',
  label: id,
  value: 1,
  description: id,
});

describe('deriveFindings strength boundaries', () => {
  it('adds connected playmaking at 65 and preserves its metric evidence', () => {
    const playmakingEvidence = [evidence('playmaking-evidence')];
    const findings = deriveFindings(
      players,
      analysis({ playmaking: metric(65, playmakingEvidence) }),
    );

    expect(findings).toContainEqual(
      expect.objectContaining({
        id: 'playmaking:connected',
        type: 'playmaking',
        severity: 'strength',
        evidence: playmakingEvidence,
      }),
    );
  });

  it('does not add connected playmaking below 65', () => {
    const findings = deriveFindings(players, analysis({ playmaking: metric(64.9) }));

    expect(findings.map(({ id }) => id)).not.toContain('playmaking:connected');
  });

  it('adds a paint-and-glass foundation when both metrics reach 60', () => {
    const interiorEvidence = evidence('interior-evidence');
    const reboundingEvidence = evidence('rebounding-evidence');
    const findings = deriveFindings(
      players,
      analysis({
        interiorDefense: metric(60, [interiorEvidence]),
        rebounding: metric(60, [reboundingEvidence]),
      }),
    );

    expect(findings).toContainEqual(
      expect.objectContaining({
        id: 'paint-and-glass:foundation',
        type: 'interior-defense',
        severity: 'strength',
        evidence: [interiorEvidence, reboundingEvidence],
      }),
    );
  });

  it.each([
    { interiorDefense: 59.9, rebounding: 60 },
    { interiorDefense: 60, rebounding: 59.9 },
  ])(
    'does not add a paint-and-glass foundation at $interiorDefense interior defense and $rebounding rebounding',
    ({ interiorDefense, rebounding }) => {
      const findings = deriveFindings(
        players,
        analysis({
          interiorDefense: metric(interiorDefense),
          rebounding: metric(rebounding),
        }),
      );

      expect(findings.map(({ id }) => id)).not.toContain('paint-and-glass:foundation');
    },
  );
});
