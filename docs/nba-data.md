# NBA data snapshot and profile derivation

## Phase 8 snapshot

The first real-data release is a deliberately manageable, immutable 2024–25 regular-season
snapshot. It contains the ten players with the most minutes for each of Boston, Denver, New York,
and Oklahoma City (40 players total), using the team represented by each source row. The snapshot
date is April 13, 2025, the end of the regular season.

The application also keeps the seeded Metro City roster as an explicitly fictional fallback. It is
never labeled as NBA data.

## Sources and provenance

- Player identity, team, position, games, minutes, per-game box score, shooting, and advanced inputs
  originate from [Basketball Reference's 2024–25 season tables](https://www.basketball-reference.com/leagues/NBA_2025.html).
- The checked values were selected from the public 2024–25 per-game and advanced CSV extracts in
  [ruwzeta/NBA-Analytics](https://github.com/ruwzeta/NBA-Analytics). The application does not fetch
  that repository or Basketball Reference at runtime.
- The [NBA Stats glossary](https://www.nba.com/stats/help/glossary) was used to assess richer defense
  inputs such as defended field-goal percentage, rim attempts, deflections, and defensive rating.
  NBA notes that tracking is not available for all games. Automated access was also not dependable
  enough for the application runtime, so those fields are not silently mixed into this snapshot.

Every normalized profile records `sourceSeason`, `sourceId`, and `methodologyVersion`. The web API
also returns the source label, source URL, season, and snapshot date for the selected pool.

## Reproducible profile method (`box-score-profile-v1`)

Raw rows are checked into `packages/nba-data/src/snapshot-2024-25.ts`. Fixed bounds convert each
input to 0–100, values outside the bounds are clamped, weighted components are combined, and final
ratings are rounded to one decimal. The formulas do not depend on the other players in the
snapshot, so adding or removing a player cannot change anyone else's profile.

| Profile           | Inputs and weights                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Shooting          | 15-point participation baseline, 3P% 30%, 3PA/game 40%, true shooting 15%                      |
| Creation          | usage percentage 55%, assist percentage 35%, turnover control 10%                              |
| Playmaking        | assist percentage 70%, assist-to-turnover percentage proxy 30%                                 |
| Rebounding        | defensive rebound percentage 65%, rebounds per 36 minutes 35%                                  |
| Perimeter defense | steal percentage 45%, defensive box plus/minus 35%, position context 20%                       |
| Interior defense  | block percentage 50%, defensive rebound percentage 30%, position context 20%                   |
| Switchability     | defensive box plus/minus 40%, steal percentage 25%, block percentage 15%, position context 20% |

The exact fixed bounds and position values live in `normalize-profile.ts` and have behavioral tests.

## Defensive limitations

The three defensive ratings are transparent box-score proxies, not matchup grades. Defensive box
plus/minus is team- and role-dependent; steals and blocks miss positioning and deterrence; listed
position is only coarse context. The product must not use these values to claim that a player can
guard a specific opponent or switch specific positions. A later data version may incorporate
tracking only if coverage, licensing, stable access, and missing-value behavior are verified first.

## Team and league search

Team mode exhaustively evaluates all five-player combinations from the selected ten-player roster.
League mode can manually select any five from all 40 players. Generation and repair first build the
same deterministic 18-player shortlist from required/current players, active priorities, hard
requirements, and individual profile relevance, then exhaustively evaluate its 8,568 possible
fives with the existing engine.

If all eligible players fit inside the bound, the response marks the search exhausted and the
result is globally optimal for that pool. Otherwise it reports the best result found in the
shortlist, with `optimalityGuaranteed: false`. A bounded search that finds no valid lineup returns a
search-limit result, not a claim that the full league request is infeasible.

## Refresh strategy

Refreshes are explicit offline releases rather than live requests:

1. Export completed-season per-game and advanced tables and record the source URLs and retrieval
   date.
2. Join rows by player and represented team, resolve traded-player rows explicitly, and select the
   intended rotation cutoff by total minutes.
3. Update the raw snapshot rows and source metadata without changing the normalization method.
4. Run adapter bounds/provenance tests, the small-pool exhaustive benchmark, all API/UI tests, and a
   production build.
5. If inputs or formulas change, increment `sourceId` or `methodologyVersion`; never rewrite the
   meaning of an existing version label.

Missing required inputs exclude the snapshot from release. Runtime code never drops an individual
player with missing profile data and then calls the basketball request infeasible.
