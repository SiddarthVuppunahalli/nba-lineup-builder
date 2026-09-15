# Session versions and comparison

Phase 7 introduced a tab-local decision trail. Phase 9 can now preserve that complete trail as an
explicitly named PostgreSQL-backed scenario.

## Session version behavior

- A user explicitly names and saves an analyzed, generated, or repaired five.
- Versions begin in React memory. When PostgreSQL is configured, saving their scenario makes the
  complete branch history recoverable after a refresh.
- Names are made unique within the selected team by adding a numeric suffix when necessary.
- Saving another result continues from the most recently saved version. Choosing **Branch from here** loads an earlier five into the manual builder and makes that version the parent of the next saved result.
- Branching never mutates or replaces the earlier version.
- Versions are scoped by team so lineups from different rosters are not compared accidentally.

Durable scenarios are scoped to an anonymous browser recovery key. Accounts and cross-browser
recovery remain out of scope. See [persistence](persistence.md).

## Full comparison

`POST /api/lineups/compare` accepts two five-player lineups and one structured intent. The deterministic engine independently analyzes both sides, reports players removed, added, and retained, compares all seven normalized metrics, identifies the largest gain and tradeoff, calculates weighted fit, and evaluates the same shooter, creator, and metric-minimum requirements against both lineups.

The comparison intent is shared by both sides and does not modify either saved version. Required and excluded player IDs are cleared by the comparison UI because they are generation eligibility rules rather than lineup-quality requirements; player membership is already shown explicitly in the change summary.

Invalid lineups and missing roster data stop the comparison rather than returning partial or misleading results. An all-zero priority set uses the documented balanced priority preset.
