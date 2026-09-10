import { describe, expect, it } from 'vitest';

import { validateLineup } from './validation.js';

describe('validateLineup', () => {
  it('rejects a lineup with fewer than five players', () => {
    const result = validateLineup(['one', 'two', 'three', 'four']);

    expect(result).toEqual({
      valid: false,
      issues: [
        {
          code: 'INVALID_PLAYER_COUNT',
          message: 'A lineup must contain exactly 5 players; received 4.',
          expected: 5,
          received: 4,
        },
      ],
    });
  });

  it('rejects a lineup with more than five players', () => {
    const result = validateLineup(['one', 'two', 'three', 'four', 'five', 'six']);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toMatchObject({
        code: 'INVALID_PLAYER_COUNT',
        expected: 5,
        received: 6,
      });
    }
  });

  it('rejects duplicate players and reports each duplicate once', () => {
    const result = validateLineup(['one', 'two', 'one', 'two', 'five']);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({
        code: 'DUPLICATE_PLAYER',
        message: 'A lineup cannot contain the same player more than once: one, two.',
        duplicatePlayerIds: ['one', 'two'],
      });
    }
  });

  it('creates a typed lineup while preserving player order', () => {
    const playerIds = ['one', 'two', 'three', 'four', 'five'];

    expect(validateLineup(playerIds)).toEqual({
      valid: true,
      lineup: { playerIds },
    });
  });
});
