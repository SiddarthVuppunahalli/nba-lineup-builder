# Lineup Engine

Lineup Engine is a portfolio-quality full-stack application for turning basketball intent into valid, explainable NBA lineups. The product will eventually follow this workflow:

```text
Intent -> Generate -> Evaluate -> Validate -> Repair -> Explain
```

This repository currently contains the **early deployment checkpoint after Phase 5**. It includes deterministic lineup validation, analysis, exhaustive generation, and minimal-change repair over a fictional demo roster, exposed through a real API and an interactive React experience. Users can build manually, generate from structured intent, or adapt a manual/generated five after requirements change. Three curated examples let a visitor jump directly into analysis, generation, or a repair tradeoff. The builder preserves the cream, coral, and sage theme, explicit loading/empty/error states with retry controls, and calculation evidence for every metric and constraint.

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

## Current limitations

The application currently uses fictional profiles and exhaustively searches team-sized pools only (at most 18 eligible players). Basketball metrics and comparisons are transparent heuristics rather than predictive professional models. It does not yet support AI intent, full arbitrary/session comparison, real NBA data, league-wide search, persistence, or silent constraint relaxation; those remain in later roadmap phases. Production serving is configured, but a public Replit URL must be created and verified from the owner’s Replit account.
