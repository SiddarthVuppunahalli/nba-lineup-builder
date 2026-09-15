# Lineup Engine — Phase 8.2 implementation handoff

## Purpose and current checkpoint

Continue the existing project from the committed Phase 9 checkpoint and implement Phase 8.2 only.
This is a focused handoff, not authorization to begin Phase 8.3 or Phase 10.

- Repository: `C:/Users/sidda/projects/nba-lineup-builder`.
- Phase 8.1 is committed as `7e968ab` (`feat: add current Spurs roster and exhaustive team search`).
- Phase 9 is committed as `ac5bfa9` (`feat: add durable scenario persistence`).
- Inspect the current branch, log, and working tree before editing. Preserve any later user changes.
- The roadmap intentionally places 8.2 and 8.3 with the real-data work even though they are being
  implemented after Phase 9. Build forward from Phase 9; do not branch from Phase 8.1.

## Read first

1. [Roadmap](roadmap.md): authoritative scope, order, defaults, and checkpoints.
2. [Architecture](architecture.md): package and persistence boundaries.
3. [NBA data documentation](nba-data.md): current sources, formulas, limitations, and refresh rules.
4. [Basketball methodology](basketball-methodology.md): authoritative scoring behavior.
5. [Persistence documentation](persistence.md): stored snapshots and anonymous recovery.
6. [Theme guide](theme.md): visual direction to preserve.
7. [README](../README.md): setup, commands, endpoints, and current limitations.

The repository and these documents are sufficient context. Resolve routine implementation choices
with the roadmap's suggested defaults and document substantive decisions.

## Current product and boundaries

The application supports manual analysis, structured generation and repair, natural-language intent,
comparison, session versions, and optional PostgreSQL persistence. San Antonio is the default current
team. The real-data package also contains a historical four-team snapshot and a fictional fallback.

The current Spurs roster contains 18 identities. Twelve have profiles derived from completed
2025–26 statistics and at least 400 minutes; the other six remain visible with explicit unavailable
reasons. Team search is exhaustive. Existing league generation uses a deterministic 18-player
shortlist and truthfully does not claim global optimality when the full eligible pool was not
searched.

Preserve these dependency rules:

- `apps/web` displays server results and owns no basketball scoring logic.
- `apps/api` validates HTTP contracts and orchestrates pools, engine calls, AI, and persistence.
- `packages/shared` contains only cross-boundary schemas and types.
- `packages/basketball-engine` remains pure and provider-, HTTP-, UI-, AI-, and database-independent.
- `packages/nba-data` owns source rows, snapshot metadata, reconciliation, and reproducible profile
  derivation.
- Saved versions store snapshots and data/scoring identifiers rather than references to mutable
  roster records.

## Next implementation scope — Phase 8.2 only

Deliver current league-wide roster data for all 30 NBA teams. Keep the current scoring formulas,
400-minute eligibility default, Spurs-first experience, manual builder, and Phase 9 persistence.

### Data pipeline and provenance

- Add a reproducible offline snapshot generator; do not depend on live network requests at runtime.
- Capture dated current rosters for every team and completed 2025–26 regular-season inputs.
- Prefer a traded player's season-total (`TOT`) statistical row when available.
- Version and record source URLs, retrieval date, roster date, source season, and methodology.
- Emit deterministic checked-in application data. Re-running from the same inputs must produce no
  diff.
- Do not change `box-score-profile-v1` silently. Any formula or eligibility-policy change requires
  evidence, documentation, new version identifiers, and compatibility consideration for Phase 9.

### Identity reconciliation and unavailable players

- Account for every current-roster identity across all 30 teams.
- Normalize and reconcile suffixes, accents, punctuation, duplicate names, two-way players, and
  offseason team changes explicitly.
- Treat an ambiguous or unresolved join as a build/validation failure rather than guessing.
- Keep players without sufficient or complete evidence visible with a precise unavailable reason.
  Never synthesize ratings, silently drop them, or turn missing data into a basketball-infeasible
  result.

### Product integration

- Expose all current teams and rosters through the existing pool/API boundary.
- Keep San Antonio selected by default and preserve its existing 18 identities and eligibility
  behavior unless corrected by clearly documented source evidence.
- Keep team generation and repair exhaustive whenever the eligible roster fits the supported engine
  bound.
- Show accurate roster, eligible, unavailable, and searched-player counts and current data
  provenance for every team.
- Preserve the historical four-team snapshot and fictional demo fallback.
- Ensure saved current-team scenarios can still be created, updated, listed, and reopened with
  interpretable version metadata.

### Acceptance criteria

- All 30 teams are present and every roster identity is uniquely accounted for as profiled or
  explicitly unavailable.
- Duplicate IDs, duplicate team membership, ambiguous joins, missing provenance, and unaccounted
  roster rows fail validation.
- Same-input generation is deterministic and reproducible.
- Traded-player handling uses the documented season-total policy and is covered by focused tests.
- Team-mode search coverage is correct for teams with varying eligible/unavailable counts.
- The Spurs default, manual workflow, generation, repair, comparison, natural-language draft flow,
  session versions, and persistence remain functional.
- Data documentation states sources, dates, counts, limitations, reconciliation rules, and refresh
  procedure.
- Relevant package, API, and frontend behavioral tests pass, followed by the full repository check.
- Exercise representative teams plus San Antonio in the browser at desktop and narrow widths.
- Stop at the Phase 8.2 checkpoint. Do not implement CP-SAT or otherwise begin Phase 8.3.

## Phase 8.3 is explicitly deferred

Phase 8.3 will replace the bounded league shortlist with full-pool optimization, preferably CP-SAT
after a feasibility spike. It must preserve exact scoring semantics, disclose proof/time-limit status,
benchmark against exhaustive fixtures, keep a bounded fallback, and pass a Replit deployment check.
Do not pull solver dependencies or solver-specific contract changes into Phase 8.2.

After Phase 8.3, revalidate Phase 9 with expanded current rosters and solver-produced lineups before
starting Phase 10.

## Verification and working style

Use PowerShell in the repository. The workspace uses `pnpm@11.19.0`.

```powershell
pnpm install
pnpm check
pnpm dev
```

Phase 9's last recorded verification passed 108 tests, type checks, ESLint, Prettier, and production
builds. Browser checks covered the Spurs manual workflow, session history, the unconfigured-database
state, and a narrow viewport. A live PostgreSQL migration was not run without `DATABASE_URL`; the
repository-backed API tests covered ownership, create/list/load/update, and immutable versions.

Run targeted checks while iterating, then the full check at the checkpoint. Do not auto-commit,
push, publish, begin Phase 8.3, or perform unrelated refactors. Summarize sources, dataset counts,
substantive decisions, limitations, verification evidence, and remaining work when handing back.
