import { describe, expect, it } from 'vitest';
import { DEMO_PLAYERS, DEMO_PROFILES } from '../demo/demo-roster.js';
import { analyzeLineup } from './analyze-lineup.js';
import { CREATOR_THRESHOLD, SCORING_VERSION, SHOOTER_THRESHOLD } from './metrics.js';

describe('experimental offensive role calibration', () => {
  it('versions scoring independently of unchanged player profiles', () => {
    expect(SCORING_VERSION).toBe('lineup-analysis-v2-experimental-roles');
    expect(SHOOTER_THRESHOLD).toBe(65);
    expect(CREATOR_THRESHOLD).toBe(60);
  });
  it('includes exact boundaries and leaves non-offensive metrics unchanged', () => {
    const players = DEMO_PLAYERS.slice(0, 5);
    const original = DEMO_PROFILES.slice(0, 5);
    const profiles = original.map((p, i) => ({
      ...p,
      shooting: [64.9, 65, 65.1, 40, 40][i]!,
      creation: [59.9, 60, 60.1, 40, 40][i]!,
    }));
    const input = { players, playerIds: players.map((p) => p.id) };
    const result = analyzeLineup({ ...input, profiles });
    const before = analyzeLineup({ ...input, profiles: original });
    expect(result.success).toBe(true);
    expect(before.success).toBe(true);
    if (!result.success || !before.success) return;
    expect(result.analysis.shooting.score).toBe(49);
    expect(result.analysis.creation.evidence).toContainEqual(
      expect.objectContaining({ id: 'creation:rule:creator-count', value: 4 }),
    );
    expect(result.analysis.findings).toContainEqual(
      expect.objectContaining({
        id: 'creation:multiple',
        affectedPlayerIds: [players[1]!.id, players[2]!.id],
      }),
    );
    for (const key of [
      'playmaking',
      'rebounding',
      'perimeterDefense',
      'interiorDefense',
      'switchability',
    ] as const)
      expect(result.analysis[key]).toEqual(before.analysis[key]);
  });
});
