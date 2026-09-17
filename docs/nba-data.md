# NBA data snapshot and profile derivation

## Phase 8.2 current league snapshot

The current release freezes the official NBA league-roster payload on September 15, 2026. It
contains 598 unique identities across all 30 teams, including the offseason and supplemental roster
entries shown by NBA.com. Completed 2025–26 regular-season inputs match 489 identities. Applying the
unchanged 400-minute minimum produces 392 `box-score-profile-v1` profiles; 97 matched players are
below the minimum and 109 have no completed-season statistical row. All 206 unavailable identities
remain visible with a specific reason.

Roster sizes range from 16 to 25 because this is an offseason/training-camp snapshot rather than an
opening-night 15-plus-two-way limit. Eligible counts range from 10 to 17, so all current team pools
fit inside the engine's 18-player exhaustive bound. San Antonio remains the first/default pool with
the same 18 identities, 12 profiles, six unavailable players, and 792 searched combinations.
The v1 shooter and creator thresholds remain available as explicit hard rules, but current pools
start at zero for both—matching the Spurs precedent—because the fixed profile calibration does not
guarantee that every real roster contains a 75-point player in either role.

### Frozen source artifacts and provenance

- Roster identity, current team, listed position, NBA person ID, and supplemental status come from
  the [official NBA league roster](https://www.nba.com/players).
- Completed-season box-score inputs come from the
  [2025–26 Basketball Reference per-game table](https://www.basketball-reference.com/leagues/NBA_2026_per_game.html).
- True shooting, usage, assist, turnover, rebound, steal, block, and defensive box plus/minus inputs
  come from the
  [2025–26 Basketball Reference advanced table](https://www.basketball-reference.com/leagues/NBA_2026_advanced.html).

The source pages were retrieved September 15, 2026. Compact, deterministically ordered JSON extracts
are checked into `packages/nba-data/raw/current-2026-09-15`. The manifest records all three URLs and
SHA-256 hashes of the retrieved pages. The generated TypeScript artifact records the roster date,
retrieval date, statistical season, counts, source-row selection, and reconciliation outcome for
every identity. Neither the API nor browser makes a live provider request.

### Identity reconciliation and traded players

The generator joins normalized Unicode names after removing punctuation and common suffixes, then
requires either zero or one Basketball Reference identity. Multiple candidates are a build failure.
Players who entered the NBA before 2026 but have no 2025–26 row require an explicit confirmed-no-
sample entry; this prevents a spelling mismatch from being silently treated as missing basketball
evidence. The one non-mechanical statistical alias in this snapshot is documented explicitly: the
NBA roster's `Ronald Holland II` maps to Basketball Reference's `Ron Holland`. A separate display
override preserves the existing accented Spurs identity `David Jones García` where the league
payload uses `Garcia`. NBA person IDs make duplicate current-team membership a validation failure,
and generated player IDs remain team-scoped so the existing Spurs IDs stay stable.

For a player with multiple 2025–26 team stints, Basketball Reference publishes an aggregate row
labeled `2TM`, `3TM`, or `4TM` rather than the literal `TOT`. The generator treats that aggregate as
the season-total row and requires the per-game and advanced tables to choose the same row type. It
uses 61 such rows in this snapshot. If multiple aggregate rows exist, or multiple team stints exist
without an aggregate row, generation fails instead of choosing a stint.

### Validation and regeneration

Run `pnpm --filter @lineup-engine/nba-data snapshot:generate` after intentionally changing a frozen
input. Run `pnpm --filter @lineup-engine/nba-data snapshot:check` to validate reconciliation and
confirm that the checked-in application artifact exactly matches the same inputs. The repository's
top-level `pnpm check` includes the check-only command.

The generator fails on ambiguous or incomplete joins, duplicate NBA IDs, duplicate team membership,
unused reconciliation overrides, missing veteran no-sample decisions, incomplete required source
fields, missing teams, or stale output. Runtime snapshot validation additionally requires 30 teams,
complete provenance, one team membership per identity, profiles that belong to their team, and
exactly one available profile or unavailable reason for every roster row.

## Phase 8.1 current Spurs roster

The default team experience uses the 18-player San Antonio roster shown on the
[official Spurs team page](https://www.nba.com/team/1610612759), captured September 14, 2026.
Profiles use the completed
[2025–26 Basketball Reference per-game](https://www.basketball-reference.com/leagues/NBA_2026_per_game.html)
and [advanced](https://www.basketball-reference.com/leagues/NBA_2026_advanced.html) tables.

Four 2026 rookies—Ja'Kobi Gillespie, Maliq Brown, Tarris Reed Jr., and Jayden Quaintance—have no
completed NBA regular-season sample. David Jones García played 68 minutes and Jordan McLaughlin
played 282 minutes in 2025–26, both below the fixed 400-minute eligibility minimum. They remain visible in the roster but cannot be selected,
required, generated, repaired, or compared. The interface explains the absence rather than
inventing or over-interpreting ratings. The other 12 players are eligible, so team generation and
repair exhaustively search all 792 possible fives.

Tobias Harris and Taelon Peter changed teams during the offseason. Their profiles use their
completed 2025–26 Detroit and Indiana rows respectively. This is historical evidence, not a claim
that their performance will remain unchanged in San Antonio. Player profile metadata records
`basketball-reference-2025-26-v1`, while roster provenance remains tied to the dated official NBA
page.

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

Historical raw rows are checked into `packages/nba-data/src/snapshot-2024-25.ts`; Phase 8.2 raw
extracts and generated rows live under `packages/nba-data/raw/current-2026-09-15` and
`current-league.generated.ts`. Fixed
bounds convert each input to 0–100, values outside the bounds are clamped, weighted components are
combined, and final ratings are rounded to one decimal. The formulas do not depend on the other
players in the snapshot, so adding or removing a player cannot change anyone else's profile.

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

Team mode exhaustively evaluates all five-player combinations that have complete profiles. The 30
current teams evaluate 10–17 eligible players apiece; the Spurs pool evaluates 12, and the historical
team pools evaluate ten each. Current league mode can manually select any five of 598 roster
identities, of which 392 have eligible profiles. Historical league mode retains all 40 earlier
profiles. Generation and repair in either league pool now build a CP-SAT model with one selection
variable for every eligible player. Required/excluded players, shooter/creator counts, and all seven
supported metric minimums remain hard constraints. Team mode is unchanged and exhaustive.

The production solver budget is 10 seconds with one worker, a fixed seed, and a deterministic-work
limit. A deterministic 18-player exhaustive result is supplied as a known-valid incumbent. If
CP-SAT proves the weighted objective and canonical tie, the response is `optimal`; if it proves no
valid five exists, it is `infeasible`. Otherwise the response is `feasible-time-limit` and includes
the retained objective, a proven upper bound, relative gap, elapsed time, and whether the retained
incumbent came from CP-SAT or the bounded seed. On the 392-player balanced reference workflow the
portable WebAssembly solver currently retains the seed and reports the trivial 100-point upper
bound; this is full-pool modeling but not a claim of league-wide optimality.

The scorer itself is unchanged. Profile and metric values are represented in tenths, every v1
bonus/penalty and 0–100 clamp is encoded, metric scores use the same one-decimal rounding, and the
weighted objective uses the same four-decimal result. Repair first minimizes incoming players,
then maximizes that objective, then applies the canonical player-ID tie. Priorities with at most
nine decimal places receive the exact integer model; rarer higher-precision API inputs use the
honestly disclosed deterministic fallback. Solver-backed requests currently return the winner but
not two ranked alternatives because the budget is reserved for the primary proof search.

## Refresh strategy

Refreshes are explicit offline releases rather than live requests:

1. Download the official NBA league-roster page plus the completed-season Basketball Reference
   per-game and advanced pages. Record the roster and retrieval dates.
2. Run `scripts/extract-current-sources.mjs` to produce compact versioned JSON and a hashed manifest.
   Inspect roster changes, supplemental entries, and source coverage before accepting them.
3. Add explicit name overrides or confirmed-no-sample evidence where mechanical reconciliation is
   insufficient. Never resolve an ambiguous join by row order.
4. Run `snapshot:generate`, inspect aggregate/per-team counts, then run `snapshot:check` twice. The
   second run must produce no file change.
5. Run adapter validation, team coverage, traded-player, API, UI, persistence, and production-build
   checks. Exercise San Antonio plus representative small/large current rosters in the browser.
6. If inputs change, increment the source ID. If formulas or the 400-minute rule change, create a new
   methodology identifier and assess stored-version compatibility; never rewrite an existing label.

Missing required inputs exclude the snapshot from release. Runtime code never drops an individual
player with missing profile data and then calls the basketball request infeasible.
