# Lineup Engine

Lineup Engine is a portfolio-quality full-stack application for turning basketball intent into valid, explainable NBA lineups. The product will eventually follow this workflow:

```text
Intent -> Generate -> Evaluate -> Validate -> Repair -> Explain
```

This repository currently contains **Phase 7: Full comparison and session versions**. It includes deterministic lineup validation, analysis, exhaustive generation, minimal-change repair, and arbitrary two-lineup comparison over a fictional demo roster, exposed through a real API and an interactive React experience. Users can name results, branch from earlier versions, and compare their decision path for the current browser session. The optional AI assistant still only translates plain-language requests into editable structured intent; it never selects players or evaluates basketball fit. Three curated examples and the cream, coral, and sage theme remain intact.

See the [revised roadmap](docs/roadmap.md) for the agreed remaining phases and checkpoints, and the [theme guide](docs/theme.md) for reusable visual styles.

For continuation in a new task, use the [Sol implementation handoff](docs/handoff-sol.md), which records the Phase 3.5 checkpoint and the bounded Phase 4 specification.

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
packages/nba-data           Added in a later data phase
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

## Current limitations

The application currently uses fictional profiles and exhaustively searches team-sized pools only (at most 18 eligible players). Basketball metrics and comparisons are transparent heuristics rather than predictive professional models. Natural-language interpretation requires a separately configured provider credential and supports only the documented intent vocabulary. Named versions last only for the current browser tab; real NBA data, league-wide search, durable persistence, and silent constraint relaxation remain outside the current phase.
