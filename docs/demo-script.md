# Lineup Engine demo script

This walkthrough takes about four minutes and uses the fictional Demo pool so the result is stable.

## 1. Establish the product

Open the landing page, scroll to the three workflow cards, and explain that the engine separates
basketball evaluation from the interface, API, NBA data, AI interpretation, and persistence.

## 2. Build a starting five

Open **Build**, choose **Demo**, and select **Analyze balanced five**. Point out the selected five,
seven lineup metrics, expandable evidence, findings, and the data/search disclosure. Save the result
as `Balanced start`.

## 3. Repair for a new intent

Choose **Repair this lineup**. Confirm that the starting five is still present. Describe a stronger
shooting intent or open **Configure intent**, adjust a requirement, and optionally add a required or
excluded player with the compact player-rule picker. Run the repair.

Show the before/after swap summary first, then the largest gain and tradeoff, every metric delta,
requirements fixed, weighted fit, and solver/search disclosure. Use **Back to editing** to demonstrate
focus returning to the intent controls. Save the repaired result as `Spacing repair`.

## 4. Compare the decision path

Open **Compare versions**. Explain that saved scenarios and tab-local versions now live in one place.
Select `Balanced start` as the starting version and `Spacing repair` as the compared version. The
orange pair cards make the direction explicit. Run the comparison.

Show players out/in/kept, both weighted-fit values, the largest gain and tradeoff, all metric deltas,
and requirement satisfaction for both lineups. Use **Back to selection**, then **Branch from here**
to demonstrate non-destructive version branching.

## 5. Close with trust boundaries

Open the data/search disclosure and one metric-evidence disclosure. Explain that AI only translates
language into editable intent; deterministic code selects and scores lineups. League optimization
reports proof, time-limit, gap, or fallback status honestly. Durable scenarios require PostgreSQL,
and anonymous recovery is tied to the browser key.

## Demo caveats

- Do not imply that heuristic ratings are predictions or professional scouting grades.
- Do not claim a league result is globally optimal unless the displayed solver status proves it.
- Without PostgreSQL, versions last only for the current tab.
- Without an AI credential, use the structured controls.
- Public deployment, media/data licensing review, and final accessibility audit remain pending.
