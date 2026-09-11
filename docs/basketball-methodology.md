# Basketball Analysis Methodology

Phase 2 uses transparent heuristics over fictional 0–100 player profile scores. These rules are designed to be understandable and deterministic, not to predict game outcomes.

## Thresholds

- Credible shooter: shooting score at least 75
- High-level creator: creation score at least 75

## Lineup metrics

### Shooting

Start with the mean player shooting score. Add 5 points for four or five credible shooters, add 2 for three, or subtract 6 for each shooter below the three-shooter floor.

### Creation

Weight the best creator at 50%, the second at 30%, and the lineup mean at 20%. Add 4 points when at least two players meet the creator threshold; subtract 10 when nobody does. This reflects the nonlinear value of having a second reliable initiator.

### Playmaking

Weight the lineup mean at 50%, the best playmaker at 30%, and the second-best at 20%. This rewards connective passing without treating every player as equally responsible for initiation.

### Rebounding

Weight the lineup mean at 65% and the top-two rebounder average at 35%. Subtract 5 points when at least three players score below 50, representing an excessive team rebounding burden.

### Perimeter defense

Weight the lineup mean at 60%, the strongest defender at 25%, and the weakest at 15%. Both a stopper and the player opponents are most likely to target matter.

### Interior defense

Weight the best interior defender at 55%, the second-best at 25%, and the lineup mean at 20%. Rim protection often depends more on the strongest back-line defenders than on a simple five-player average.

### Switchability

Weight the lineup mean at 75% and the weakest player at 25%. Subtract 4 points for every player below 55 because one pronounced mismatch can undermine a switching scheme.

## Findings

Findings are derived from the same metric results and thresholds used above:

- strong spacing when at least four players meet the shooter threshold
- insufficient creation when fewer than two meet the creator threshold
- weak rebounding when the lineup score is below 60
- limited interior defense when the lineup score is below 60
- versatile perimeter defense when both perimeter defense and switchability reach 75

Every metric retains player scores, weighted components, and rule adjustments as structured evidence. Each weighted component records its source value and percentage in its description and its contribution in `value`. The engine adds the weighted contributions and rule adjustments to obtain the score; player ratings remain contextual evidence and are not added again.

Final scores are limited to 0–100 and rounded to one decimal. Expanded metric cards display the calculation separately from player ratings, including the final normalized score. Contribution displays use up to four decimal places. These Phase 3.5 improvements preserve the existing scoring rules and keep all basketball calculations in the engine.

## Structured generation

Phase 4 ranks valid lineups with a normalized weighted mean of the seven lineup metric scores. Priority weights range from 0 to 1. The balanced preset assigns every metric a weight of 1; an all-zero set also uses that preset so the objective never divides by zero.

Minimum shooter and creator counts are hard requirements and reuse the 75-point thresholds above. Optional metric minimums are also hard requirements and apply directly to the normalized scores displayed by the product. Required and excluded players are eligibility rules, not score adjustments. No requirement is silently relaxed.

For a team-sized pool, the engine evaluates every unique five-player combination after exclusions, retains only candidates satisfying every hard requirement, and sorts them by objective score. Equal objectives are resolved by sorted player IDs, making results independent of input order. Exhaustive generation is capped at 18 eligible players; larger-pool search remains a later phase.

## Repair and comparison

Repair applies the same intent validation, constraints, metric analysis, objective, exhaustive-search bound, and deterministic tie-breaking as generation. It orders valid candidates by the fewest players added to the current lineup, then by weighted objective score. This makes preservation of the existing five authoritative: if it already satisfies the new intent, repair returns zero changes even when another valid lineup has a higher objective score.

The comparison contains the before and after value for each of the seven normalized lineup metrics and a one-decimal delta. The largest gain is the greatest positive delta; the largest tradeoff is the greatest negative delta. These are descriptive changes in the existing heuristic scores, not predictions of game outcomes.

## Limitations

The demo roster and profiles are fictional. The scores are curated to exercise the engine and should not be interpreted as professional scouting grades. Phase 8 will introduce reproducible profile derivation from a documented external data source while preserving these domain boundaries.
