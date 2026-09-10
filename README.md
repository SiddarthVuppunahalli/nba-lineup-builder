# Lineup Engine

Lineup Engine is a portfolio-quality full-stack application for turning basketball intent into valid, explainable NBA lineups. The product will eventually follow this workflow:

```text
Intent -> Generate -> Evaluate -> Validate -> Repair -> Explain
```

This repository currently contains **Phase 3.5: Theme and usability**. It includes deterministic lineup validation and analysis over a fictional demo roster, exposed through a real API and an interactive React experience. The builder uses a cream, coral, and sage theme, explicit loading/empty/error states with retry controls, and weighted calculation evidence for every metric. It deliberately does not include generation, AI, persistence, or real NBA data yet.

See the [revised roadmap](docs/roadmap.md) for the agreed remaining phases and checkpoints, and the [theme guide](docs/theme.md) for reusable visual styles.

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

Import the GitHub repository into Replit and click **Run**. The included `.replit` file starts the full workspace and exposes the web app. No secrets or database are required for the current demo. This is development configuration; production serving and publishing are planned at the early deployment checkpoint after Phase 5. Track local and Replit verification separately.

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

## Current limitations

The application currently analyzes only manually selected lineups against fictional profiles. Basketball metrics are transparent heuristics rather than predictive professional models. Phase 4 will introduce structured priorities, constraints, exhaustive candidate generation, and deterministic ranking.
