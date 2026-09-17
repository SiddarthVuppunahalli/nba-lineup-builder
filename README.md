# Lineup Engine

Lineup Engine is a portfolio-quality full-stack application for turning basketball intent into valid, explainable NBA lineups. The product will eventually follow this workflow:

```text
Intent -> Generate -> Evaluate -> Validate -> Repair -> Explain
```

This repository currently contains **Phase 8.3 on top of Phase 9 persistence**. The default
experience includes all 18 players on the dated 2026–27 San Antonio roster and evidence-backed
profiles for the 12 players with at least 400 completed 2025–26 NBA minutes. All 30 dated current
team rosters are available: 598 identities are accounted for, 392 have eligible profiles, and 206
remain visible with explicit unavailable reasons. Every current team has at most 17 eligible players,
so team generation is exhaustive. Current league generation and repair model all 392 eligible
profiles with a portable CP-SAT solver and disclose proof, time-limit, bound/gap, and fallback
status. The deterministic 18-player search remains a seed and fallback. The earlier four-team
historical snapshot, historical league mode, and fictional fallback remain available. Search
coverage, unavailable-player reasons, data provenance, defensive proxy limitations, and profile
formulas are visible and documented.
When PostgreSQL is configured, named scenarios preserve selections, version branches, intent,
analysis, repair history, and data/scoring versions across browser refreshes.

See the [revised roadmap](docs/roadmap.md) for the agreed remaining phases and checkpoints, and the [theme guide](docs/theme.md) for reusable visual styles.

The existing [implementation handoff](docs/implementation-handoff.md) records the earlier Phase 8.2
checkpoint; the roadmap and current repository now carry the Phase 8.3 decisions.

## Architecture

```text
apps/web                    React product interface
    |
    | HTTP + shared schemas
    v
apps/api                    Express API boundary
    |
    v
packages/basketball-engine Pure TypeScript basketball domain

packages/shared             Cross-boundary request/response schemas
packages/nba-data           Dated NBA snapshot and profile normalization
```

The basketball engine is kept independent of React, Express, databases, AI providers, and external NBA data formats. See [docs/architecture.md](docs/architecture.md) for boundary and scaling details and [docs/basketball-methodology.md](docs/basketball-methodology.md) for every Phase 2 scoring rule.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer

## Local setup

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:5173`. Vite proxies `/api` requests to the API at `http://localhost:3001`.

Natural-language interpretation is optional. Add `OPENAI_API_KEY` to your local environment or Replit Secrets to enable it. Never commit the key. `OPENAI_INTENT_MODEL` defaults to `gpt-5.6-luna`; see [the intent documentation](docs/natural-language-intent.md) for the supported language and trust boundary. Without a key, every structured workflow remains available.

Durable scenario saving is also optional. Set `DATABASE_URL`, run `pnpm db:migrate`, and restart the
service to enable it. Without a database, session versions and every basketball workflow remain
available. See [persistence setup and recovery behavior](docs/persistence.md).

### Replit checkpoint

Import the GitHub repository into Replit and click **Run**. The included `.replit` file builds the workspace and starts the production service on the assigned port. For a public preview, choose an Autoscale deployment because the application includes API routes, then publish from Replit. No secrets or database are required for the current demo. Publishing can involve account or billing choices, so public-link creation remains a manual checkpoint.

## Production preview

Build and start the same single service used by a host:

```bash
pnpm build
pnpm start
```

The server uses `PORT` (default `3001`) and `HOST` (default `0.0.0.0`). It serves the built web application and API together, including `GET /api/health`. Copy `.env.example` when local overrides are useful. `pnpm preview` combines build and start for a clean local smoke test.

Repository automation in `.github/workflows/quality.yml` verifies tests, types, lint/formatting, and the production build on pushes and pull requests.

## Quality commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## Current API

- `GET /api/health` — reports API readiness
- `GET /api/teams` — lists available demo teams
- `GET /api/teams/:teamId/players` — returns the selected roster and profiles
- `POST /api/lineups/analyze` — validates and evaluates a five-player lineup
- `POST /api/lineups/generate` — generates and ranks a lineup from structured intent
- `POST /api/lineups/repair` — finds the fewest changes satisfying updated intent
- `POST /api/lineups/compare` — compares two valid fives against shared requirements
- `GET /api/intents/status` — reports whether natural-language interpretation is configured
- `POST /api/intents/interpret` — returns a validated, editable structured-intent draft
- `GET /api/persistence/status` — reports whether durable scenario storage is configured
- `GET /api/scenarios` — lists scenarios owned by the anonymous browser recovery key
- `GET /api/scenarios/:scenarioId` — reloads one scenario and its ordered version history
- `POST /api/scenarios` — saves a new complete scenario snapshot
- `PUT /api/scenarios/:scenarioId` — updates an owned scenario snapshot

## Current limitations

The official current-roster snapshot is an offseason/training-camp view dated September 15, 2026;
team membership and roster sizes can change before opening night. The Spurs roster includes four
2026 rookies without completed NBA profiles and two players below the 400-minute sample minimum;
they are visible but ineligible rather than assigned unreliable ratings. Defensive
ratings are box-score/position proxies, and every basketball metric remains a transparent heuristic
rather than a prediction or professional scouting grade. League generation and repair model all
392 eligible current players, but a limited run can retain the deterministic 18-player seed; global
optimality is guaranteed only when the response reports an `optimal` proof. Natural-language
interpretation still requires a separately configured credential. Durable saving requires a
configured, migrated PostgreSQL database.
Anonymous recovery is tied to the browser's local key; Phase 9 does not include accounts, sharing,
cross-browser recovery, or automatic abandoned-session cleanup.

See [docs/nba-data.md](docs/nba-data.md) for sources, exact derivation, missing-data rules, search
semantics, and the refresh procedure.
