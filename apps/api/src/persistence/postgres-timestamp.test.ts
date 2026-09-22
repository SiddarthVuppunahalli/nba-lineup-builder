import { describe, expect, it } from 'vitest';
import { savedScenarioSchema, savedScenarioSummarySchema } from '@lineup-engine/shared';

import { toIsoTimestamp } from './postgres-timestamp.js';

describe('PostgreSQL timestamp normalization', () => {
  it('converts driver-style timestamps to API ISO timestamps', () => {
    expect(toIsoTimestamp('2026-09-21 22:27:51.311+00')).toBe('2026-09-21T22:27:51.311Z');
    expect(toIsoTimestamp('2026-09-21 15:27:51.311-07')).toBe('2026-09-21T22:27:51.311Z');
    expect(toIsoTimestamp('2026-09-21T22:27:51.311Z')).toBe('2026-09-21T22:27:51.311Z');
  });

  it('produces timestamps accepted by saved-scenario response contracts', () => {
    const createdAt = toIsoTimestamp('2026-09-21 22:27:51.311+00');
    expect(
      savedScenarioSummarySchema.safeParse({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'My lineup',
        teamId: 'nba-2026-27-sas',
        versionCount: 1,
        createdAt,
        updatedAt: createdAt,
      }).success,
    ).toBe(true);
    expect(savedScenarioSchema.shape.createdAt.safeParse(createdAt).success).toBe(true);
  });
});
