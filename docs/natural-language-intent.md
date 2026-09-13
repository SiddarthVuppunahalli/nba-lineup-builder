# Natural-language intent

Phase 6 adds an optional translation layer over the existing structured lineup intent. It helps users fill the form; it does not choose players, score a lineup, relax constraints, or replace deterministic validation.

## Supported interpretation

The interpreter can map language to:

- priorities for the seven existing metrics;
- minimum credible-shooter and high-level-creator counts;
- numeric 0–100 floors for the seven existing lineup scores;
- required and excluded players from the supplied roster.

Priority language maps to the form’s `Important`, `Helpful`, and `Ignore` values. Unmentioned priorities retain the balanced default. Shooter and creator defaults remain three and one. Metric floors are omitted unless the user supplies a supported numeric requirement.

Terms outside the current basketball model—such as pace, chemistry, salary, trade legality, small-ball, or switching particular positions—are not assigned invented definitions. The interpreter returns `needs_clarification`, concise questions, and a conservative draft that the user may edit or ignore.

## Trust boundary

The API sends the request and eligible roster identities to a provider behind `NaturalLanguageIntentInterpreter`. The provider must return strict structured output. The application validates that output again with Zod, confirms roster IDs and player-rule consistency, and then returns an editable draft to the browser. A user must apply the draft before generation or repair. Those actions use the same shared intent schema and deterministic engine endpoints as manual structured input.

Provider requests set `store: false`. Errors expose stable application codes rather than provider details:

- `AI_UNAVAILABLE` when no provider is configured;
- `AI_PROVIDER_ERROR` when the provider request fails;
- `AI_INVALID_OUTPUT` when output cannot pass the application boundary.

## Configuration

Set `OPENAI_API_KEY` as a local or hosting-platform secret; never commit it. `OPENAI_INTENT_MODEL` optionally overrides the default `gpt-5.6-luna`. When no key is present, the status endpoint reports the feature unavailable and the structured controls remain fully usable.
