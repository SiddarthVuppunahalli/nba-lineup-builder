# Durable scenario persistence

New versions use `lineup-analysis-v2-experimental-roles` (shooters 65, creators 60). Existing
`lineup-analysis-v1` snapshots remain readable and immutable: reopening and updating an owned
scenario preserves stored analysis, timestamps, and identifiers. Appended versions use current
scoring. Profile/data identifiers are unchanged; no database migration is required. Fresh analysis,
repair, generation, comparison, or save-as-new uses current rules, not legacy execution.

Phase 9 adds optional PostgreSQL storage without making the lineup builder depend on a database.

## Setup

1. Provision PostgreSQL and set `DATABASE_URL` in the local environment or Replit Secrets.
2. Build and start the application normally. When `DATABASE_URL` is configured, startup applies
   all pending migrations before the API accepts traffic.
3. Use `pnpm db:migrate` when you want to apply migrations manually before startup or verify them
   from a development shell.

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

When PostgreSQL is available, **Save version** creates a scenario automatically or updates the
active scenario with the complete version history. The Compare page can rename or explicitly sync
that scenario and reopen other saved scenarios. Reopening restores its team, current selection,
active branch parent, and ordered version history. Without PostgreSQL, the same action remains
tab-local and does not make a network persistence request.

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

Phase 8.2 current-team versions use the data identifier
`nba-rosters-2026-09-15-bref-2025-26-v1:2026-09-15:box-score-profile-v1`. Because selections and
analysis are stored as snapshots, expanding the mutable roster catalog does not rewrite existing
fictional or historical versions.

Phase 8.3 does not persist solver internals or mutable roster references. A league result is saved
through the same generated/repaired version contract: selected IDs, recomputed analysis, structured
intent, repair swaps when present, data version, and `lineup-analysis-v1` scoring version. Reopening
a saved solver-produced current-league five therefore does not require CP-SAT to reproduce an old
search; its immutable basketball snapshot remains interpretable even if a later solve finds a
better incumbent.

## Limits

- A scenario can contain at most 100 versions.
- Durable saving requires an explicitly configured and migrated PostgreSQL database.
- Phase 9 does not add user accounts, collaboration, public sharing, automatic background saves, or
  abandoned anonymous-session cleanup.
