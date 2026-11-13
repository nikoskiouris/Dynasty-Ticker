# 029 · Trade Calc: symmetric fairness scale (Lopsided … Even … Lopsided)

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 2: under the two columns, a horizontal **slider/scale** with seven labelled stops:

`Lopsided · Unfair · Close · Even · Close · Unfair · Lopsided`

It is symmetric. A marker sits on the stop for the current trade, **leaning toward the side that wins** (left half = Team 1 gets more, right half = Team 2 gets more).

Today the verdict is a headline + meter bars: `renderDraftVerdict(view)` → `valueCalcVerdict()` (`value-calc.js`) → wording from `verdictCopy()` / `TIER_BANDS` (`verdict-copy.js`: within 5% "Fair trade", ≤14% "Fair, slight edge", ≤28% "Favors one side", above "Lopsided") and bars from `sharedBarSegments()` / `meterTrack()` / `calcPointer()` (`verdict-bars.js`). The crowd poll (`trade-poll.js`) already draws a nine-stop slider that can be reused visually.

## Scope

- Map the existing tiers to the sketch labels (one metric, one verdict – do not invent a second one):
  - **Even** = Fair trade (≤ 5%)
  - **Close** = Fair, slight edge (≤ 14%)
  - **Unfair** = Favors one side (≤ 28%)
  - **Lopsided** = Lopsided (> 28%)
- Render a 7-stop horizontal scale under the columns; the marker sits on the correct stop on the winning team's side, and moves smoothly as assets change (respect `prefers-reduced-motion`).
- Under the scale, one sentence from `verdictCopy()` that names the side: e.g. "Unfair · Team 1 receives 19% more". Keep the ⓘ explainer (`TIER_EXPLAINER`) and the "fewer, better pieces" fine print.
- Use the same labels anywhere the verdict appears: shared `/t/` page, OG card text (`netlify/functions`, `trade-share.js` `cardVerdict()` / `shareMessage()`), so a shared trade and the calculator never disagree. Old wording may stay in alt text if needed for existing cards; say so in the PR.
- Empty or one-sided trade: scale shows greyed with "Add players to both sides".
- Accessible: scale is a read-only `role="meter"` (or img with label) announcing "Unfair, favors Team 1".

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode. The scale always compares 12-team SF PPR values.

## Out of scope

- Changing the tier thresholds or the value model. Crowd voting.

## Acceptance criteria (manual QA)

- An even 1-for-1 (two players within 5%) shows the marker on **Even** (center).
- Adding a 2nd-round pick to one side moves the marker one or two stops toward the side that receives more and the sentence agrees.
- A clearly lopsided trade (a star for a late 2nd) puts the marker on the outer **Lopsided** stop on the winning side.
- Swapping sides mirrors the marker.
- The same trade opened via its `/t/` share link shows the same stop and words.
- Readable at 390 px (labels may abbreviate, but all 7 stops visible) and at 820/1280.

## Dependencies

- 027, 044.

## Technical notes

- Files: `docs/modules/verdict-copy.js` (`TIER_BANDS`, `verdictCopy`, `verdictCopyFor`, `barLabel`), `docs/modules/verdict-bars.js`, `docs/modules/value-calc.js` (`valueCalcVerdict`, `draftVerdictLabel`), `docs/modules/trade-share.js` (`cardVerdict`, `shareMessage`, `shareSummary`), `docs/app.js` (`renderDraftVerdict`, `renderSharedVerdictHead`, `sharedTotalsLine`, `renderDraftMeterWhy`), `netlify/functions/*` (share card), `docs/styles.css`.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
