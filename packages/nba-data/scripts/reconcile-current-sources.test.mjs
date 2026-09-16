import { describe, expect, it } from 'vitest';

import {
  normalizeName,
  requireUnambiguousCandidate,
  selectSeasonRow,
} from './reconcile-current-sources.mjs';

describe('current source reconciliation', () => {
  it('normalizes accents, punctuation, and suffixes without choosing between duplicate candidates', () => {
    expect(normalizeName("David Jones García Jr.")).toBe('davidjonesgarcia');
    expect(() =>
      requireUnambiguousCandidate('Duplicate Name', ['first-player', 'second-player']),
    ).toThrow(/Ambiguous join/);
  });

  it('prefers one aggregate season-total row and fails unsafe multi-team selections', () => {
    const rows = [
      { playerKey: 'player01', team_name_abbr: '2TM' },
      { playerKey: 'player01', team_name_abbr: 'ATL' },
      { playerKey: 'player01', team_name_abbr: 'GSW' },
    ];
    expect(selectSeasonRow(rows, 'player01')).toMatchObject({
      selection: 'season-total',
      row: { team_name_abbr: '2TM' },
    });
    expect(() =>
      selectSeasonRow(
        rows.filter((row) => row.team_name_abbr !== '2TM'),
        'player01',
      ),
    ).toThrow(/No season-total row/);
  });
});

