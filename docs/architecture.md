# Architecture

## Package boundaries

`apps/web` owns the React product experience. It consumes HTTP contracts but contains no basketball evaluation logic.

`apps/api` owns HTTP validation and orchestration. Routes should stay thin and translate between external requests and application/domain results.

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

Lineup generation will be designed as a stateless operation over a roster, profiles, and structured intent. It can initially run in the API process. If traffic or computation later requires workers, the same domain call can move behind a queue without changing its basketball logic. Roster and normalized player data are natural cache boundaries; no distributed infrastructure is needed for the MVP.
