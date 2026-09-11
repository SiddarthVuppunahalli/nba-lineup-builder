# Architecture

## Package boundaries

`apps/web` owns the React product experience. It consumes HTTP contracts but contains no basketball evaluation logic.

`apps/api` owns HTTP validation and orchestration. Routes stay thin and translate between external requests and application/domain results through a small demo lineup service.

`packages/shared` contains only schemas and types that genuinely cross the web/API boundary.

`packages/basketball-engine` is pure TypeScript. It cannot import React, Express, database code, AI SDKs, or external NBA provider schemas.

`packages/nba-data` will be introduced in Phase 8 to isolate external data adapters and profile normalization.

## Dependency direction

Dependencies point inward toward stable contracts and domain logic:

```text
web -> shared <- api -> basketball-engine
```

The engine never imports either application.

## Scale boundaries

Lineup generation is a stateless operation over an eligible player pool, profiles, and structured intent. Phase 4 exhaustively evaluates unique five-player combinations for pools of at most 18 players, applies hard constraints, and ranks valid candidates with a deterministic weighted objective. The team ID and demo-data lookup remain in the API service rather than the engine. Larger league-wide search is intentionally deferred to the bounded-search design in Phase 8.

Lineup repair uses the same engine boundaries and search bound. It adds the current five as domain input, minimizes replacements before considering the weighted objective, and returns a final analyzed candidate plus a basic metric comparison. The browser displays these results but does not calculate swaps, scores, or deltas.

The generator can initially run in the API process. If traffic or computation later requires workers, the same domain call can move behind a queue without changing its basketball logic. Roster and normalized player data are natural cache boundaries; no distributed infrastructure is needed for the MVP.

## Production serving

The development workspace keeps Vite and Express as separate processes. The production build is intentionally simpler: Vite emits static assets to `apps/web/dist`, and the Express service serves those assets alongside `/api`. Non-API HTML requests fall back to `index.html` so client-side routes remain refreshable; unknown API paths still return 404 instead of the web shell.

Hosting configuration uses the provider-standard `PORT`, with `API_PORT` retained as a local compatibility fallback. `HOST` defaults to `0.0.0.0`, and `WEB_DIST_DIR` can override the frontend build location. The API health route is the deployment readiness endpoint. This single-service topology is appropriate while the application is stateless and avoids production proxy or cross-origin configuration.
