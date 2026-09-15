# Durable scenario persistence

Phase 9 adds optional PostgreSQL storage without making the lineup builder depend on a database.

## Setup

1. Provision PostgreSQL and set `DATABASE_URL` in the local environment or Replit Secrets.
2. Run `pnpm db:migrate` once for the database and again whenever new migrations are added.
3. Build and start the application normally.

The checked-in Drizzle schema and migrations create `saved_scenarios` and
`saved_scenario_versions`. The API reports whether persistence is configured through
`GET /api/persistence/status`. When no database URL is present, analysis, generation, repair,
comparison, and tab-local versions continue to work; durable controls explain that storage is not
configured.

## Anonymous ownership and recovery

The browser creates a random anonymous recovery key and retains it in local storage. API requests
send that key in `X-Lineup-Session`; the server stores only its SHA-256 digest. There are no accounts
or shared links in this phase. Clearing browser storage, changing browsers, or losing the key loses
access to its scenarios even though the database rows remain. This is intentionally a simple demo
session model, not authentication.

Saving a scenario creates or replaces one complete scenario snapshot. Reopening restores its team,
current selection, active branch parent, and ordered version history. Users explicitly update a
loaded scenario; tab-local edits are not silently written to the database.

## Historical interpretability

Each stored version contains:

- its five player IDs, name, source, and parent link;
- an API-recomputed lineup analysis;
- the structured intent for generated and repaired versions;
- starting players and swaps for repaired versions;
- the immutable pool snapshot, profile-methodology, and scoring-version identifiers.

The API recomputes analysis while saving and rejects unknown or invalid lineups. This keeps the
deterministic engine authoritative and prevents client-supplied scores from becoming historical
records. A future scoring migration can display the stored result under its original version rather
than silently reinterpreting it with new rules.

## Limits

- A scenario can contain at most 100 versions.
- Durable saving requires an explicitly configured and migrated PostgreSQL database.
- Phase 9 does not add user accounts, collaboration, public sharing, automatic background saves, or
  abandoned anonymous-session cleanup.
