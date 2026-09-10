import { describe, expect, it } from 'vitest';

import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import type { LineupAnalysis } from '../domain/types.js';
import { analyzeLineup } from './analyze-lineup.js';

const spacingLineup = ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'];

function analyze(playerIds: readonly string[]): LineupAnalysis {
  const result = analyzeLineup({
    playerIds,
    players: DEMO_PLAYERS,
    profiles: DEMO_PROFILES,
  });

  if (!result.success) {
    throw new Error(`Expected analysis to succeed: ${JSON.stringify(result.issues)}`);
  }

  return result.analysis;
}

describe('analyzeLineup', () => {
  it('returns every normalized metric with player-level evidence', () => {
    const analysis = analyze(spacingLineup);
    const metrics = [
      analysis.shooting,
      analysis.creation,
      analysis.playmaking,
      analysis.rebounding,
      analysis.perimeterDefense,
      analysis.interiorDefense,
      analysis.switchability,
    ];

    for (const metric of metrics) {
      expect(metric.score).toBeGreaterThanOrEqual(0);
      expect(metric.score).toBeLessThanOrEqual(100);
      expect(metric.evidence.filter((item) => item.kind === 'player-score')).toHaveLength(5);
    }
  });

  it('scores a high-shooting lineup above a low-shooting lineup', () => {
    const highShooting = analyze(spacingLineup);
    const lowShooting = analyze([
      'andre-okafor',
      'darius-knox',
      'owen-price',
      'luca-hayes',
      'theo-grant',
    ]);

    expect(highShooting.shooting.score).toBe(91.2);
    expect(highShooting.shooting.score).toBeGreaterThan(lowShooting.shooting.score);
  });

  it('derives strong-spacing and multiple-creator findings from evaluated metrics', () => {
    const analysis = analyze(spacingLineup);

    expect(analysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spacing:strong',
          severity: 'strength',
          title: 'Strong spacing',
        }),
        expect.objectContaining({
          id: 'creation:multiple',
          severity: 'strength',
          title: 'Multiple creators',
        }),
      ]),
    );
  });

  it('flags a lineup without enough creators', () => {
    const analysis = analyze([
      'samir-cole',
      'eli-mercer',
      'theo-grant',
      'andre-okafor',
      'darius-knox',
    ]);

    expect(analysis.findings).toContainEqual(
      expect.objectContaining({
        id: 'creation:insufficient',
        severity: 'concern',
        affectedPlayerIds: [],
      }),
    );
  });

  it('flags weak rebounding and limited interior defense', () => {
    const analysis = analyze([
      'jordan-vega',
      'malik-rhodes',
      'eli-mercer',
      'nico-park',
      'samir-cole',
    ]);

    expect(analysis.rebounding.score).toBeLessThan(60);
    expect(analysis.interiorDefense.score).toBeLessThan(60);
    expect(analysis.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(['rebounding:weak', 'interior-defense:limited']),
    );
  });

  it('recognizes a switchable perimeter defense lineup', () => {
    const analysis = analyze([
      'jordan-vega',
      'malik-rhodes',
      'eli-mercer',
      'theo-grant',
      'darius-knox',
    ]);

    expect(analysis.findings).toContainEqual(
      expect.objectContaining({
        id: 'switchability:versatile',
        severity: 'strength',
      }),
    );
  });

  it('weights an elite interior anchor more heavily than the lineup average', () => {
    const playerIds = ['andre-okafor', 'jordan-vega', 'malik-rhodes', 'nico-park', 'samir-cole'];
    const analysis = analyze(playerIds);
    const rawAverage =
      DEMO_PROFILES.filter((profile) => playerIds.includes(profile.playerId))
        .map((profile) => profile.interiorDefense)
        .reduce((sum, score) => sum + score, 0) / playerIds.length;

    expect(analysis.interiorDefense.score).toBeGreaterThan(rawAverage);
  });

  it('returns a typed failure for a player outside the supplied roster', () => {
    const result = analyzeLineup({
      playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'unknown-player'],
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES,
    });

    expect(result).toEqual({
      success: false,
      issues: [
        {
          code: 'UNKNOWN_PLAYER',
          message: 'The roster does not contain: unknown-player.',
          playerIds: ['unknown-player'],
        },
      ],
    });
  });

  it('returns a typed failure when a selected player has no profile', () => {
    const result = analyzeLineup({
      playerIds: spacingLineup,
      players: DEMO_PLAYERS,
      profiles: DEMO_PROFILES.filter((profile) => profile.playerId !== 'eli-mercer'),
    });

    expect(result).toEqual({
      success: false,
      issues: [
        {
          code: 'MISSING_PROFILE',
          message: 'No basketball profile is available for: eli-mercer.',
          playerIds: ['eli-mercer'],
        },
      ],
    });
  });

  it('produces identical analysis for identical input', () => {
    expect(analyze(spacingLineup)).toEqual(analyze(spacingLineup));
  });
});
