# Architecture

## Package boundaries

`apps/web` owns the React product experience. It consumes HTTP contracts but contains no basketball evaluation logic.

`apps/api` owns HTTP validation and orchestration. Routes stay thin and translate between external requests and application/domain results through a small lineup-pool service.

`packages/shared` contains only schemas and types that genuinely cross the web/API boundary.

`packages/basketball-engine` is pure TypeScript. It cannot import React, Express, database code, AI SDKs, or external NBA provider schemas.

`packages/nba-data` isolates checked source rows, snapshot metadata, and reproducible profile
normalization. It depends on basketball-engine domain types, while the engine remains unaware of
providers, seasons, and source formats.

## Dependency direction

Dependencies point inward toward stable contracts and domain logic:

```text
web -> shared <- api -> basketball-engine
                 |
                 +----> nba-data -> basketball-engine
```

The engine never imports either application.

Phase 6 adds an outward AI adapter inside `apps/api`. The provider receives natural-language text plus roster identity, then returns a candidate structured intent. The API validates that output against a strict provider schema and the shared HTTP contract before returning it to the browser. The browser applies the draft to the existing editable controls; generation and repair continue to call the same deterministic engine endpoints. The AI adapter never imports or invokes basketball scoring.

## Scale boundaries

Lineup generation is a stateless operation over an eligible player pool, profiles, and structured
intent. The Phase 4 evaluator exhaustively checks unique five-player combinations for pools of at
most 18 players, applies hard constraints, and ranks valid candidates with a deterministic weighted
objective. Team, league-snapshot, and demo-pool lookup remain in the API service rather than the
engine; Phase 8 reuses the evaluator behind the bounded league-search adapter described below.

Lineup repair uses the same engine boundaries and search bound. It adds the current five as domain input, minimizes replacements before considering the weighted objective, and returns a final analyzed candidate plus a basic metric comparison. The browser displays these results but does not calculate swaps, scores, or deltas.

Phase 7 moves arbitrary two-lineup comparison into a dedicated engine operation and thin API route. Both lineups are analyzed from roster profiles on the server, then evaluated against one shared structured intent. Named versions and parent links remain ephemeral browser state: they organize a user's current decision path but never become an alternate source of basketball calculations or imply durable persistence.

Phase 8 adds immutable lineup pools in the API service. Real team pools contain ten players and use
the existing exhaustive generator. The 40-player league snapshot is manually selectable in full,
but generation and repair build a deterministic 18-player shortlist before invoking the same
exhaustive evaluator. Search metadata crosses the API boundary so the UI can distinguish full-pool
exhaustion from a bounded best-found result. Analysis and comparison accept the full pool because
they evaluate user-supplied fives rather than enumerate combinations.

Phase 8.1 allows a roster pool to retain player identities that do not yet have an evidence-backed
profile. The API exposes those identities with an unavailable status and reason, while engine and
AI boundaries receive only profiled players. This prevents missing data from becoming fabricated
ratings or a whole-pool data failure. Current Spurs generation remains exhaustive over all 12
profiled players; the four unavailable rookies and two below-minimum samples are not silently
counted as searched.

The generator can initially run in the API process. If traffic or computation later requires workers, the same domain call can move behind a queue without changing its basketball logic. Roster and normalized player data are natural cache boundaries; no distributed infrastructure is needed for the MVP.

## Production serving

The development workspace keeps Vite and Express as separate processes. The production build is intentionally simpler: Vite emits static assets to `apps/web/dist`, and the Express service serves those assets alongside `/api`. Non-API HTML requests fall back to `index.html` so client-side routes remain refreshable; unknown API paths still return 404 instead of the web shell.

Hosting configuration uses the provider-standard `PORT`, with `API_PORT` retained as a local compatibility fallback. `HOST` defaults to `0.0.0.0`, and `WEB_DIST_DIR` can override the frontend build location. The API health route is the deployment readiness endpoint. This single-service topology is appropriate while the application is stateless and avoids production proxy or cross-origin configuration.
