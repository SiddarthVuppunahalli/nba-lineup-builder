# Lineup Engine roadmap

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

## Phase 9 — Persistence

- Introduce PostgreSQL and Drizzle with proper migrations.
- Save scenarios, versions, generation intent, selections, analysis, and repair history.
- Record data and scoring versions so historical analyses remain interpretable.
- Provide clear save/load recovery and a simple anonymous/demo-session model.

Checkpoint: a saved scenario can be reopened with understandable version history.

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
