# Lineup Engine

Lineup Engine is a portfolio-quality full-stack application for turning basketball intent into valid, explainable NBA lineups. The product will eventually follow this workflow:

```text
Intent -> Generate -> Evaluate -> Validate -> Repair -> Explain
```

This repository currently contains **Phase 1: Application foundation**. It deliberately does not include lineup analysis, generation, AI, persistence, or real NBA data yet.

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

The basketball engine is kept independent of React, Express, databases, AI providers, and external NBA data formats. See [docs/architecture.md](docs/architecture.md) for boundary and scaling details.

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

Import the GitHub repository into Replit and click **Run**. The included `.replit` file starts the full workspace and exposes the web app. No secrets or database are required for Phase 1.

## Quality commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## Current API

- `GET /api/health` — reports API readiness

## Current limitations

Only the application shell and package boundaries exist. Basketball metrics will be transparent heuristics rather than predictive professional models. Phase 2 will introduce the domain model and static demo data before any lineup-building UI is added.
