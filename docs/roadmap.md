# Lineup Engine roadmap

Current post-8.3 scoring checkpoint: `lineup-analysis-v2-experimental-roles` uses 65 shooting / 60
creation after an accepted provisional calibration review. Earlier 75/75 references remain historical
decisions. No defensive thresholds or penalty magnitudes change. Profile derivation and eligibility
remain v1; saved history is preserved. Observed-lineup and representative cross-season validation
remain deferred. See [the current methodology](basketball-methodology.md).

This is the agreed continuation plan after Phase 3, committed as `c7f2c68`.
Implement one phase at a time and stop at each checkpoint for review before moving on.

## Product direction

Help users understand and improve a five-player lineup through a clear workflow:

**Intent → Generate → Validate → Adapt / repair → Compare → Explain**

- The basketball engine remains deterministic and independent of React, HTTP, AI, and data providers.
- Zod validates external data contracts. The engine owns basketball rules and scoring.
- AI interprets intent; it does not select players or decide whether a lineup is valid.
- Support both actual team rosters and hypothetical lineups across the league.
- Keep real NBA data in Phase 8. Fictional profiles remain useful for development, tests, and fallback.
- League mode evaluates basketball fit without salary-cap or trade restrictions.
- Keep authentication, rotations, live scores, betting, predictions, and distributed infrastructure outside the initial scope.

## Completed foundation

- Phase 1: workspace, React frontend, Express API, shared contracts, checks, and development configuration.
- Phase 2: domain models, fictional ten-player roster, seven metrics, validation, findings, and documented scoring rules.
- Phase 3: interactive manual lineup selection and server-side analysis with expandable evidence.

## Phase 3.5 — Theme and usability

Status: implemented and verified locally; ready for visual review before Phase 4.

- Establish a light cream background, ivory panels, muted coral actions/selections, and sage positive indicators.
- Use shared theme variables, readable typography, accessible contrast, visible keyboard focus, and responsive layouts.
- Handle team and roster loading, failures, and empty states explicitly, with retry controls.
- Explain formula weights and adjustments from engine-produced evidence; keep scoring out of React.
- Replace development-facing labels with product language and identify the fictional demo clearly.
- Add focused regression coverage for failure recovery and analysis state changes.

Checkpoint: automated checks pass; the manual workflow and desktop/mobile presentation are verified. Review the visual direction with the user before Phase 4.

Verification: 33 tests pass (17 engine, 9 API, 7 frontend); build, type checking, lint, and formatting pass. The browser workflow and expanded evidence were checked at desktop and phone widths. Replit verification remains a separate checkpoint.

## Phase 4 — Structured lineup generation

Status: implemented and verified locally; ready for checkpoint review.

- Define priorities as ranking preferences and constraints as hard requirements.
- Support shooter/creator counts, supported metric thresholds, required players, and excluded players.
- Specify defaults, conflicting inputs, deterministic ties, and unsupported basketball terms before implementing the form.
- Exhaustively search five-player combinations for a team-sized eligible pool.
- Return the highest-ranked valid result and useful alternatives where appropriate.
- Explain infeasible requests and offer explicit user-controlled changes; never silently relax requirements.
- Accept an eligible player pool at the engine boundary so future team and league modes share evaluation and validation.
- Define what terms such as small-ball and switch 1–4 can actually mean in the supported model.

Checkpoint: constraints, ranking, required/excluded players, ties, reproducibility, and infeasible requests have behavioral tests and a working UI.

Implementation decisions: priorities use finite 0–1 weights and a normalized weighted mean of the seven existing metric scores. The balanced preset weights all metrics equally; an all-zero request is converted to that preset. Shooter and creator requirements use the existing 75-point profile thresholds, while optional metric floors use the displayed normalized lineup scores. Search is exhaustive up to 18 eligible players, returns two alternatives at most, and breaks ties by canonical sorted player IDs independently of roster order. Infeasible results report how often each requirement rejected an otherwise eligible combination; this is diagnostic evidence, not a claim that the smallest conflicting requirement set was found.

## Phase 5 — Repair and basic comparison

Status: implemented and verified locally; ready for checkpoint review.

- Adapt an existing manual or generated lineup when requirements change.
- Respect locked/required players and exclusions.
- Prefer the fewest replacements, then optimize quality among equally small changes.
- Revalidate the result and show swaps, reasons, and constraints fixed.
- Bound any iterative repair attempts and return clear infeasible outcomes.
- Bring basic comparison forward: show before/after metrics and the largest tradeoff without requiring persistence.
- Keep final validation of generated results; do not manufacture invalid candidates merely to demonstrate repair.

Checkpoint: demonstrate build five → require more shooting → repair → inspect swaps → understand the defense/rebounding tradeoff.

Implementation decisions: repair evaluates the same bounded, exhaustive candidate set as generation. It ranks valid candidates first by the number of incoming players, then by the existing weighted objective, then by canonical sorted player IDs. A starting lineup that already satisfies the intent is retained with zero swaps. Required players and exclusions remain hard rules. Comparison reports all seven before/after metric deltas and identifies the largest positive change and largest decline; it does not create session history or persistence.

## Early deployment checkpoint — After Phase 5

Status: implemented, published, and verified through the Replit checkpoint.

- Add production build/start configuration, frontend serving, health checks, and environment configuration.
- Publish a preview and smoke-test the full core workflow.
- Add automated repository checks for build, tests, types, and lint.
- Offer curated demo scenarios so a visitor can start immediately.

Checkpoint: a useful preview link exists for feedback before the later integrations.

Implementation decisions: production uses one stateless service, with Express serving the built Vite app and retaining `/api/health` as the readiness endpoint. Hosting reads `PORT` and `HOST`, supports an optional web-build path override, and exits early for invalid ports. Replit receives separate build and start commands, while GitHub Actions runs tests, type checks, lint/format checks, and a production build on pushes and pull requests. Three curated starters cover immediate analysis, structured generation, and a shooting-repair tradeoff without adding alternate basketball logic. Creating the public Replit deployment remains a user-controlled publishing step because it can require account and billing choices.

## Phase 6 — Natural-language intent

Status: implemented and verified locally; ready for a configured-provider checkpoint review.

- Parse text into the same structured intent used by the form.
- Validate AI output, reject unsupported values, and handle ambiguity and provider errors.
- Show interpreted requirements for review and adjustment.
- Keep structured input usable when AI is unavailable.
- Store credentials in environment secrets and keep provider code behind an interface.

Checkpoint: equivalent text and structured requests use the same authoritative deterministic engine.

Implementation decisions: natural-language parsing is an optional API adapter, not an engine capability. The OpenAI Responses API uses strict structured output with `gpt-5.6-luna` as a configurable, cost-conscious default. Provider output is validated again for supported values, roster IDs, conflicting player rules, and consistent clarification state. Ambiguous or unsupported language returns questions with a conservative editable draft. Provider responses are not stored by the API request, and missing credentials or provider failures leave all structured generation and repair controls available. Users explicitly apply an interpretation before invoking the unchanged deterministic endpoints.

## Phase 7 — Full comparison and session versions

Status: implemented and verified locally; ready for checkpoint review.

- Compare any two lineups with player changes, metric deltas, constraint satisfaction, and tradeoffs.
- Keep named versions within the current session.
- Allow branching from earlier versions without losing the starting lineup.
- Clearly distinguish session-only versions from durable saving introduced in Phase 9.

Checkpoint: users can follow and compare their decisions across a session.

Implementation decisions: users explicitly name and save successful manual, generated, or repaired results. Versions are team-scoped React state and disappear on refresh or tab close; duplicate names receive numeric suffixes. The most recently saved version is the default parent, while **Branch from here** loads any earlier five without overwriting history and records it as the next version's parent. Full comparison is a deterministic engine/API operation over two valid fives and one shared editable intent. It reports added, removed, and retained players, all seven metric deltas, largest gain and tradeoff, weighted fit, and shooter/creator/metric-minimum satisfaction on both sides. Required/excluded IDs are not comparison criteria because they are generation eligibility rules. Durable persistence remains Phase 9.

## Phase 8 — Real NBA data and both modes

Status: implemented and verified locally; ready for checkpoint review.

- Verify source feasibility, especially inputs needed for defensive metrics, before building the adapter.
- Import real identities and dated rosters, initially as a manageable season snapshot.
- Derive profiles reproducibly, documenting sources, missing data, limitations, and refresh strategy.
- Display season/source information and preserve seeded demo fallback.
- Team mode: select and generate within an actual roster.
- League mode: search players and select any five across teams, sharing constraints, scoring, repair, and comparison.
- Use a bounded deterministic league search; do not enumerate every league-wide combination.
- Benchmark bounded search against exhaustive results on small pools. Distinguish search exhaustion from proven infeasibility and do not claim guaranteed global optimality.

Checkpoint: both modes support the full workflow with documented data provenance and acceptable generation time.

Implementation decisions: the first immutable snapshot covers the ten highest-minute 2024–25
players from Boston, Denver, New York, and Oklahoma City, while the fictional roster remains an
explicit fallback. Fixed, versioned formulas derive all seven profiles from checked-in per-game and
advanced inputs. Defensive ratings are disclosed box-score/position proxies because stable,
complete tracking inputs were not feasible for the first adapter. Team search remains exhaustive.
League generation and repair use a deterministic 18-player shortlist and exhaust its 8,568 fives;
responses disclose pool coverage and never claim global optimality or proven infeasibility when the
full eligible pool was not searched. See [NBA data documentation](nba-data.md).

## Phase 8.1 — Spurs-first current roster

Status: implemented and verified locally; ready for checkpoint review.

- Make San Antonio the default real team and preserve all 18 identities from the official roster
  snapshot dated September 14, 2026.
- Pair current-roster identities with completed 2025–26 regular-season profiles rather than
  presenting offseason projections as observed NBA data.
- Keep players without a completed NBA sample visible, explain why they are unavailable, and never
  synthesize ratings for them.
- Exhaustively search every profiled Spurs player; do not apply the league shortlist to team mode.
- Preserve the Phase 8 historical sample, league workflow, fictional fallback, manual builder, and
  Phase 3.5 visual theme.

Checkpoint: the current Spurs roster is the default experience, all roster identities are
accounted for, and every eligible Spurs five is evaluated with documented provenance.

Implementation decisions: 12 of the 18 current players have at least 400 completed-season NBA
minutes and produce versioned profiles. Ja'Kobi Gillespie, Maliq Brown, Tarris Reed Jr., and Jayden
Quaintance have no 2025–26 NBA sample; David Jones García's 68 minutes and Jordan McLaughlin's 282
minutes are below the minimum. All six remain visible but ineligible. Tobias Harris and Taelon Peter use their 2025–26 Detroit and
Indiana statistics respectively because profiles describe the most recent completed season, not a
projection of their new team context. The 12-player eligible pool has 792 unique fives and is
searched exhaustively.
Because the v1 role thresholds were calibrated for the earlier demo workflow and no current Spurs
profile reaches the 75-point creator threshold, the Spurs form starts with no hard shooter or
creator minimum. The seven metrics remain equally weighted, and users can opt into either hard
requirement without the product silently changing its meaning.

## Phase 8.2 — Current league-wide roster data

Status: implemented and verified locally; ready for checkpoint review.

- Expand the dated current-roster snapshot from San Antonio to all 30 NBA teams while keeping the
  Spurs-first default experience.
- Add a reproducible offline snapshot generator instead of maintaining the league dataset as a
  hand-edited collection of TypeScript rows.
- Use completed 2025–26 regular-season inputs for player profiles. For players traded during that
  season, prefer the season-total (`TOT`) row when it exists so one player has one statistical
  profile independent of current team.
- Keep every current-roster identity visible. Players without a completed NBA sample, required
  source fields, or the documented minimum sample remain unavailable with a specific reason; do
  not invent ratings or silently omit them.
- Reconcile identity differences explicitly, including suffixes, accents, duplicate names,
  two-way contracts, and offseason team changes. Fail the snapshot build on unresolved or
  ambiguous joins.
- Retain the existing 400-minute eligibility threshold unless league-wide validation produces a
  documented reason to revise it as a separately versioned methodology decision.
- Keep team generation and repair exhaustive whenever the eligible roster fits the engine's
  supported bound. Report roster, eligible, unavailable, and searched-player counts for every
  team.
- Preserve the historical Phase 8 snapshot, fictional fallback, manual builder, Phase 9
  persistence, and Phase 3.5 theme.

Checkpoint: a reproducible checked-in snapshot accounts for the current rosters of all 30 teams;
every identity is either profiled or has an explicit unavailable reason; team-mode coverage is
accurate; the Spurs experience and existing workflows remain unchanged.

Suggested implementation defaults: use versioned raw-source artifacts and a generator that emits
deterministic application data; keep runtime operation network-free; record source URLs, retrieval
date, roster date, season, profile methodology, and reconciliation outcomes. Add aggregate and
per-team validation tests so duplicate IDs, unaccounted players, ambiguous joins, incomplete
provenance, or non-reproducible output fail before release.

Implementation decisions: the dated September 15, 2026 official NBA league-roster payload contains
598 identities across 30 teams. Completed 2025–26 Basketball Reference per-game and advanced rows
produce 392 profiles at the unchanged 400-minute minimum; 206 players remain visible with an
explicit no-sample or below-minimum reason. Basketball Reference labels aggregate traded-player
rows `2TM`, `3TM`, or `4TM`; the generator treats those 61 rows as the requested season-total policy
and never selects a single-team stint instead. Versioned JSON extracts, source hashes, explicit
identity exceptions, and a check-only generator keep runtime operation network-free and make stale
or non-reproducible output a release failure. Every current team has 10–17 eligible profiles and is
therefore searched exhaustively within the existing engine bound. The full current league pool
retains the Phase 8 bounded 18-player shortlist; full-pool optimization remains Phase 8.3.
Current pools inherit the Spurs default of zero hard shooter and creator requirements because the v1
role thresholds are not guaranteed on every real roster; users can still opt into either unchanged
75-point rule explicitly.

## Phase 8.3 — Full-pool league optimization

Status: implemented and verified locally; live Replit publication remains a user-controlled
platform checkpoint. Phase 9 persistence has been revalidated with a generated current-league
lineup.

- Replace the 18-player league shortlist as the primary optimizer with a solver that considers
  every eligible player in the current league snapshot.
- Start with a CP-SAT feasibility spike. Model one binary selection variable per eligible player,
  require exactly five selections, and encode required/excluded players, shooter/creator counts,
  and supported metric minimums as hard constraints.
- Preserve exact equivalence with the existing deterministic scoring and constraint semantics,
  including rounding, thresholds, bonuses, penalties, and canonical tie behavior. Do not introduce
  a second basketball model merely to suit the solver.
- Compare solver results with exhaustive generation on small and team-sized fixtures, including
  ties and deliberately infeasible requests.
- Apply a documented production time limit. Report **optimal** or **infeasible** only when the
  solver proves it; otherwise return the best candidate found with its bound/gap and a clear
  time-limit status.
- Keep a deterministic bounded-search fallback for environments where the solver is unavailable,
  and preserve its honest non-optimality disclosure.
- Verify that the chosen solver and native/runtime dependencies build and start in the deployed
  Replit environment before treating the implementation as authoritative.
- Preserve manual league selection, team-mode exhaustive search, structured and natural-language
  intent, repair, comparison, persistence, and the existing theme.

Checkpoint: league generation and repair consider the entire eligible current-player pool within a
documented time budget, match exhaustive results on validation fixtures, disclose proof or search
limits accurately, deploy successfully on Replit, and reopen persisted solver-produced scenarios
with interpretable data and scoring versions.

Implementation decisions: use the portable `or-tools-wasm` 0.9.1 CP-SAT build because the native
Node release candidate had no usable Windows prebuild, while the WebAssembly package supports both
Node and Linux without a platform-specific install. The exact integer model preserves v1
one-decimal metrics, four-decimal weighted fit, threshold adjustments, clamps, hard constraints,
repair swap priority, and canonical ties. Production uses a 10-second, single-worker, fixed-seed
budget plus a deterministic-work limit. `optimal` requires proof of both the weighted objective and
canonical tie; `infeasible` requires a solver proof. Limited runs expose incumbent, bound, gap, and
incumbent source. The former 18-player search remains a deterministic seed/fallback, not the
primary model. The current 392-player balanced reference run models all players but presently keeps
the seed with a 100-point bound, so it is explicitly not globally optimal. Live Replit deployment
was not performed because publishing/deployment requires explicit approval; the checked Node 22
configuration, portable package runtime, production build, and local start are the pre-deployment
evidence.

Implementation sequence note: Phases 8.2 and 8.3 were identified after Phase 9 was completed. Build
them on top of the Phase 9 commit rather than branching from Phase 8.1, then run a focused Phase 9
integration regression after Phase 8.3. This avoids maintaining parallel changes across the shared
contracts, API, web workflow, documentation, and dependencies.

## Phase 9 — Persistence

Status: implemented and verified locally; ready for a configured-PostgreSQL checkpoint review.

- Introduce PostgreSQL and Drizzle with proper migrations.
- Save scenarios, versions, generation intent, selections, analysis, and repair history.
- Record data and scoring versions so historical analyses remain interpretable.
- Provide clear save/load recovery and a simple anonymous/demo-session model.

Checkpoint: a saved scenario can be reopened with understandable version history.

Implementation decisions: persistence is optional so an unconfigured preview retains the complete
stateless workflow. A browser-generated anonymous recovery key scopes scenarios; only its SHA-256
digest is stored, and losing browser storage loses access because Phase 9 does not introduce
accounts. Saving is explicit rather than automatic. Each immutable version snapshot stores its
selection, parent, source, API-recomputed analysis, optional structured intent, optional repair
swaps, and data/scoring versions. PostgreSQL access sits behind a repository boundary, Drizzle owns
the checked-in schema and migration, and HTTP behavior is tested through an in-memory repository.
See [persistence documentation](persistence.md).

## Phase 10 — Final polish and portfolio presentation

- Finish accessibility, responsive layouts, failure handling, and restrained motion.
- Complete setup/deployment instructions, methodology, architecture, screenshots, and a concise demo script.
- Verify a production deployment that works without visitor setup.

Checkpoint: a visitor understands the product and completes the main workflow independently.

## Working checkpoints and Replit learning

- At each phase: summarize changes and limitations, run relevant checks, review the experience, and commit before continuing.
- Phase 3.5: practice one focused UI change in Replit when the environment is available.
- Phases 4–5: exercise logs, runtime behavior, and failure cases.
- Phase 6: configure AI secrets.
- Phases 8–9: verify data and database environment configuration.
- Early preview and Phase 10: verify publishing and smoke tests.
- Track platform checkpoints separately from feature completion. Local verification does not imply Replit verification.
