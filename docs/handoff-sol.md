# Lineup Engine — implementation handoff for GPT-5.6 Sol

## Purpose and current checkpoint

Continue the existing project efficiently, preserving its architecture and agreed scope. This document is a handoff, not an instruction to implement every remaining phase at once.

- Repository: `C:/Users/sidda/projects/nba-lineup-builder`.
- Phase 3.5 is committed as `5f6631b` (`feat: refresh lineup theme and improve analysis usability`).
- Previous checkpoint: `c7f2c68` (Phase 3 manual builder).
- Working tree was clean before this handoff document was added. Inspect it again before editing; do not overwrite subsequent user changes.
- Phase 4 has not started. The user requested this handoff to switch implementation work away from Astra because of usage limits.
- The roadmap still marks Phase 3.5 as ready for visual review. A commit alone is not evidence of explicit design approval. If the user asks to proceed to Phase 4, treat that as authorization and do not ask for the same approval again.

## Read first, then inspect only the relevant code

1. [Roadmap](roadmap.md): authoritative agreed phase sequence and checkpoints.
2. [Architecture](architecture.md): dependency boundaries.
3. [Basketball methodology](basketball-methodology.md): current scoring rules.
4. [Theme guide](theme.md): visual direction to preserve.
5. [README](../README.md): setup, commands, current limitations.

The repository and these documents are sufficient to continue. Historical conversations are optional context, not a prerequisite. Resolve any conflict against the user's latest instructions and current code.

## What exists

| Location                     | Responsibility                                                      |
| ---------------------------- | ------------------------------------------------------------------- |
| `apps/web`                   | React/Vite interface, TanStack Query, React Hook Form, React Router |
| `apps/api`                   | Express HTTP boundary and application services                      |
| `packages/shared`            | Shared Zod request/response schemas and derived types               |
| `packages/basketball-engine` | Pure TypeScript validation, scoring, findings, and evidence         |
| `packages/nba-data`          | Planned for Phase 8; does not exist yet                             |

Current product: choose five players from the fictional ten-player Metro City Meteors roster, analyze through the API, inspect seven metrics and their explanations, and see strengths/concerns.

Current endpoints:

- `GET /api/health`
- `GET /api/teams`
- `GET /api/teams/:teamId/players`
- `POST /api/lineups/analyze`

Phase 3.5 added cream/ivory surfaces, coral actions and selections, sage positive indicators, explicit team/roster loading and empty states, retry controls, and clearer metric calculations. Existing scoring rules were preserved.

## Critical implementation details

- The browser never calculates basketball scores or constraint results. Zod validates contracts; the domain engine owns basketball meaning.
- `MetricEvidence.kind` now supports `player-score`, `weighted-component`, and `rule-adjustment` in both domain types and shared schemas.
- The engine sums weighted components and adjustments. Player ratings are contextual evidence and must not be added a second time.
- Metric scores are clamped to 0–100 and rounded to one decimal. The UI displays that score and the engine-produced contribution breakdown.
- Credible shooter and high-level creator thresholds are both 75; reuse existing constants.
- Selecting/deselecting a player clears the previous analysis. A late result from an earlier selection must not reappear.
- Frontend test cleanup is explicitly registered in `apps/web/src/test/setup.ts`; Vitest globals are disabled. Preserve this when adding tests.
- API application services currently import demo data directly. Preserve the separation between an eligible player pool and the generator when adding generation.

Useful entry points:

- `packages/basketball-engine/src/domain/types.ts`
- `packages/basketball-engine/src/domain/validation.ts`
- `packages/basketball-engine/src/analysis/analyze-lineup.ts`
- `packages/basketball-engine/src/analysis/metrics.ts`
- `packages/basketball-engine/src/demo/demo-roster.ts`
- `packages/shared/src/lineup-api.ts`
- `apps/api/src/app.ts`
- `apps/api/src/services/demo-lineup-service.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/features/lineup-builder/LineupBuilderPage.tsx`
- `apps/web/src/features/lineup-builder/AnalysisPanel.tsx`
- `apps/web/src/features/lineup-builder/MetricCard.tsx`
- `apps/web/src/styles.css`

## Product decisions already agreed

- Support team mode and hypothetical league-wide mode eventually. Real NBA data remains in Phase 8; do not pull it forward just to make Phase 4 more attractive.
- Team mode uses one real roster; league mode can select any five across teams. No salary cap, trade legality, fantasy, or betting features.
- Exhaustive search suits a team-sized pool. League generation later needs bounded deterministic search and honest disclosure that global optimality is not guaranteed.
- Priorities are soft preferences; constraints are hard requirements. Do not silently relax constraints.
- Repair primarily adapts an existing lineup after requirements change. Prefer the fewest swaps, then optimize quality among equally small changes.
- Bring basic before/after comparison into Phase 5. Full comparison/session versions remain Phase 7; durable saving remains Phase 9.
- AI arrives in Phase 6 and only interprets natural language into structured intent. The deterministic engine remains authoritative.
- Early production preview follows Phase 5; final polish/deployment verification remains Phase 10.
- Preserve the cream/coral/sage visual direction. Use the darker ink variants for readable text and solid buttons.

## Next implementation scope — Phase 4 only, when requested

Deliver a complete structured generation workflow using the fictional roster. Keep the manual builder usable.

### A. Define the intent contract

Introduce a validated intent with metric priorities, supported minimum shooter/creator counts, supported lineup metric minimums, and required/excluded player IDs. Keep domain types independent of Zod and HTTP; share only actual API contracts through `packages/shared`.

The following are suggested implementation defaults, not previously finalized product decisions. Resolve them briefly in the implementation summary and document the choice rather than seeking approval for every routine detail:

- Priorities: finite weights from 0 to 1; rank using a normalized weighted mean of the existing seven metric scores.
- Defaults: a documented balanced preset. Define explicitly whether all-zero weights are rejected or converted to that preset; do not divide by zero.
- Counts: integers from 0 to 5; metric minimums: finite values from 0 to 100.
- Minimum scores refer to the existing normalized lineup metrics so the displayed score and constraint result agree.
- Unknown IDs, duplicate required/excluded IDs, IDs in both lists, or more than five required players receive clear validation errors.
- Use explicit metric names instead of an undefined generic defense score or defender count.
- Do not offer claims such as small-ball or switching 1–4 until the model has an explicit supported definition. A switchability threshold alone is not a matchup-coverage model.

### B. Generate, validate, and rank in the engine

- Accept an eligible pool of players/profiles plus structured intent. Do not bake a team ID, Express request, or external data provider into the algorithm.
- Enumerate unique five-player combinations for team-sized pools, respecting required/excluded players.
- Reuse analysis and write independently testable constraint evaluators.
- Rank only valid candidates using the documented objective. Canonicalize IDs and define a stable tie-breaker independent of input ordering.
- Return the winning lineup, analysis, objective score, and per-constraint results. Limit optional alternatives to a small documented number.
- Separate invalid requests, missing profile/data failures, and valid-but-infeasible requests.
- For a fully searched pool, explain which requirements exclude candidates without falsely claiming to have found a minimal conflicting set.
- Do not silently discard players with missing profiles and then report a basketball request as infeasible.
- Protect against accidental oversized pools with a documented bound or explicit unsupported result. Do not build the full league optimizer in Phase 4.

### C. Add the real API and UI workflow

- Add `POST /api/lineups/generate` only once domain generation exists.
- Validate requests and responses with shared schemas; keep routes thin and orchestration in a service.
- Add a structured form with understandable preference and requirement controls, plus required/excluded players.
- Show the generated five, their analysis, and requirement satisfaction. Reuse the existing visual language and metric components.
- Handle loading, retry, malformed intent, impossible requests, and stale results after changes.
- Make reset/default controls clear. Preserve manual lineup selection and analysis.
- No AI, repair implementation, real-data integration, database, or production deployment in this phase.

### D. Acceptance criteria

- Repeated identical inputs produce the same selected IDs and ranking.
- Reordering the eligible pool does not change winners or tie-breaking.
- Every returned lineup has five unique eligible players, contains required players, and excludes forbidden players.
- Every returned candidate satisfies all hard requirements; each result has understandable constraint evidence.
- Changing priorities changes ranking appropriately on deliberately contrasting fixtures.
- Impossible requests fail clearly without silent relaxation; invalid IDs and missing profiles are distinguishable.
- Ranking handles default/all-zero weights as documented and rejects non-finite/out-of-range values.
- Small known fixtures prove exhaustive selection finds the best valid candidate under the specified objective.
- The original manual workflow, retry states, metric evidence, theme, and responsive behavior remain intact.
- Add meaningful domain, API, and frontend behavior tests. Avoid tests that merely copy the implementation.
- Run build, tests, type checking, and lint. Exercise the generation workflow in a browser, including one infeasible request and a narrow viewport.
- Update the roadmap and README, summarize remaining work, and stop at the Phase 4 checkpoint. Do not proceed into Phase 5 automatically.

## Verification baseline and local environment

Last verified during Phase 3.5 implementation (not rerun for this documentation-only handoff):

- 33 tests passed: 17 engine, 9 API, 7 frontend.
- Build, type checking, lint, and formatting passed.
- Desktop/mobile manual flow, expanded weighted evidence, keyboard focus, and selection changes were checked in a real browser with no recorded browser warnings/errors.
- Core text contrast was checked for the main theme pairs. This was not a complete accessibility audit.
- Real data, AI, persistence, production serving, and Replit publishing remain unimplemented/unverified.

Use PowerShell in the repository. Node.js is installed. Project package-manager version is `pnpm@11.19.0`; a user-level installation was added at `%APPDATA%/npm`. Normal `pnpm` should work; use `pnpm.cmd` if PowerShell script execution blocks the `.ps1` launcher. Do not alter execution policy just to run this project.

```powershell
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm typecheck
pnpm lint
```

The web development URL is `http://localhost:5173`; Vite proxies `/api` to port 3001. A prior task may have left development servers running; inspect listeners before starting duplicates. Browser tab IDs and process IDs are session-specific and must not be assumed.

Tool caveats observed in the prior environment:

- Restricted execution sometimes produced `spawn EPERM` for test/build subprocesses. Retry with the tool's authorized subprocess access rather than changing application code to hide an environment restriction.
- If `pnpm exec prettier` cannot resolve the executable, the installed formatter can be invoked as `node node_modules/prettier/bin/prettier.cjs`.
- Vite emitted non-fatal annotation warnings from Zod dependency comments. Do not change dependencies solely to silence those warnings.
- Generated `dist` and TypeScript build metadata are ignored; do not commit generated output.

## Efficient working style

- Suggested starting setting: GPT-5.6 Sol, medium reasoning effort. This is workflow advice, not a requirement to alter model settings automatically or a promise of quota savings.
- Summarize the focused scope, implement it, then verify. Do not repeatedly reread the entire repository or historical conversation.
- Use brief progress updates and document substantive decisions. Resolve routine choices within the agreed scope autonomously.
- Do not spawn agents, add large frameworks, or perform unrelated refactors unless the user explicitly asks.
- Run targeted checks while iterating, then the required full checks at the checkpoint. Repeat checks only when changes or failures justify it.
- Preserve user changes. Do not auto-commit, push, or publish merely because the previous phase was committed by the user.
- If a hard issue remains after focused diagnosis, summarize the reproducer, attempted fixes, and exact uncertainty for a targeted review rather than restarting the entire project.
- Treat this as one phase of a longer project. The [roadmap](roadmap.md) retains the later work and Replit learning checkpoints.
