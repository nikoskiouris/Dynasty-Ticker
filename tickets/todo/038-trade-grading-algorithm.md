# 038 · Trade grading algorithm (shared by Recent Trades and Historical Data)

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 10 shows a **Trade grade** column on Recent Trades; sketch 11 asks for **best/worst trader** and the **all-time best/worst trade**. Both need one trade grade, computed one way. This ticket is the algorithm module only.

## Scope

New `docs/modules/trade-grade.js` exporting a pure function, e.g. `gradeTrade(trade, ctx) → { sides: [{ rosterId, received: [...], valueReceived, valueSent, net, grade, letter }], winnerRosterId, gapPct, tier, basis, notes }`.

- **Inputs:** a completed Sleeper trade transaction (`adds`, `drops`, `draft_picks`, `roster_ids`, `created`), and values. **Always the single 12-team SF PPR value set (044)**, whatever the league's own format.
- **Two lenses, labelled:**
  1. **Today's value (hindsight)** – every player at today's one price (`getAssetValue()`); picks already used are valued as the player drafted with them (via 034 draft picks), unused picks at today's pick price (`resolvePickAssetValue()`).
  2. **Value at the time** – if a price-history snapshot exists on or just before the trade date (`docs/data/price-history/`, 90-day retention, `fetchPriceHistory()`), use its `sf` map only (ignore `oneQb` in old snapshots); otherwise mark "no price from that date" (never guess; AGENTS.md "Truthful answers").
  Recent Trades shows both when available; all-time awards use hindsight (the only lens that covers every year) and say so.
- **Grade:** for each side, `net = valueReceived − valueSent` and `gapPct` as in `verdict-copy.js` (credited totals incl. the fewer-better-pieces extra from `package-value.js`). Letter scale tied to the same tiers as the fairness scale (029) so words agree: Even (≤5%) → B/B for both; Close (≤14%) → B+/B−; Unfair (≤28%) → A−/C; Lopsided → A/D, A+/F beyond ~60%. Document the exact table in the module header.
- Multi-team trades (3+ rosters): grade each roster on what it received vs sent.
- FAAB included in trades (`waiver_budget`) is shown but not valued unless a simple $→value rule is agreed (note in PR).
- Returns `notes` like "2 picks valued as the players later drafted".

## Out of scope

- Rendering (039, 041). Changing player prices (one price rule).

## Acceptance criteria (manual QA)

- Run the function from the browser console on 5 real trades from a known league (or temporary debug output on Recent Trades) and hand-check: sums match the values on Player Rankings; the side that got the better player package gets the better letter; an even swap is graded B/B.
- A 2024 rookie pick that became a now-valuable player is graded on that player.
- A trade older than the price-history window shows "no price from that date" for the at-the-time lens, never a made-up number.
- The letter for a trade agrees with the fairness-scale word for the same assets in Trade Calc.

## Dependencies

- 034 (transactions + drafts), 044. 029 for shared tier wording.

## Technical notes

- Files: new `docs/modules/trade-grade.js`; reuse `docs/modules/values.js` (`getAssetValue`, `resolvePickAssetValue`, `parsePickAssetId`, `fetchPriceHistory`), `docs/modules/package-value.js`, `docs/modules/verdict-copy.js` (`TIER_BANDS`, `percentMore`), `docs/modules/value-scale.js` (`normalizePriceHistory`, `playerSeries`). Old reference: `buildTransactionPlayerAsset()` / `buildTransactionPickAsset()` in `git show 42c6d66:docs/app.js`.
- Sleeper trade shape: `type: "trade"`, `status: "complete"`, `roster_ids`, `adds {player_id: roster_id}`, `drops {player_id: roster_id}`, `draft_picks [{season, round, roster_id (original), previous_owner_id, owner_id}]`, `waiver_budget [{sender, receiver, amount}]`, `created` (ms).
- No unit tests (repo policy). Manual hand-checks recorded in the PR + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.

## Implementation checkpoint · 2026-11-13

`docs/modules/trade-grade.js` added as the shared SF-only grade algorithm (commit `ee2ce6e`). Covers completed trades, hindsight and date-matched snapshot lenses, draft outcomes where attributable, missing prices, multi-team transfers, FAAB exclusion, and shared credited-total tiers. Still **Open**: manually compare at least five real trades and a drafted pick against Sleeper and the calculator; confirm chronological snapshot coverage and attach required demo. JavaScript syntax was checked; no test suite was created or run.
