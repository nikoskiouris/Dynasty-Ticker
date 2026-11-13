# 041 · All-time awards I: best/worst manager, trader, drafter, and the all-time best/worst trade

**Status:** Open · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 11 asks to **"implement an algorithm"** to find: best/worst **manager**, best/worst **trader**, best/worst **drafter**, best/worst lineup setter, best/worst waiver work, and the **all-time best/worst trade**. This ticket covers manager, trader, drafter and best/worst trade; lineup setter and waiver work are ticket 042. Results render in the Awards section of Historical Data (040).

Every award is a heuristic score, not a fact or a probability (AGENTS.md "Label uncertainty"). Each award card shows the winner, the loser, the number behind it, and an ⓘ with the formula in plain words.

## Scope

Pure functions in a new `docs/modules/league-awards.js`, all keyed by franchise/manager (`franchise.js`):

1. **Best / worst trader** – sum of hindsight `net` value from every trade the manager made (038 `gradeTrade()`), plus count and win rate (share of trades where they were the winning side). Rank by total net; ties broken by win rate. Minimum 3 trades to qualify (show "not enough trades" otherwise).
2. **All-time best / worst trade** – the single trade with the largest hindsight `net` for one side (best trade = that side's manager; worst = the other side). Show the full trade card from 039.
3. **Best / worst drafter** – for every rookie/startup draft pick (034 drafts): `pickValue = today's value of the drafted player` vs `expected = average today's value of players taken within ±3 picks of that slot across all league drafts` (or the pick's slot price from `pick-projection.js` if too few drafts). Drafter score = sum(pickValue − expected) / picks, with hits ("steals": biggest surplus pick) and busts listed. Exclude the current season's draft if players have <1 season (label "too early").
4. **Best / worst manager** – composite, shown with its parts:
   - Results 50%: all-time win %, playoff appearances, titles (title = 3 playoff apps), finals.
   - Points 20%: all-time PF per game vs league average (luck-neutral).
   - Roster building 30%: trader score + drafter score + waiver score (042) normalised to z-scores.
   Show the breakdown so a reader can disagree with the weights; document weights in the module header and PR.

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode. Every award valued in players uses that single set.

## Out of scope

- Lineup setter and waiver work (042). UI layout of the Historical page (040).

## Acceptance criteria (manual QA)

- On a real multi-season league, the best trader's top trade appears in Recent Trades with an A-range grade; totals in the ⓘ add up when checked by hand for one manager.
- The worst drafter's listed "busts" are players taken early who have low value today (sanity check against Player Rankings).
- Managers below the minimum sample are shown as "not enough data", never ranked last.
- Changing seasons available (e.g. a league with 2 seasons) still produces sensible awards or "not enough history".
- Every award card states the basis (e.g. "Graded on today's values").

## Dependencies

- 034, 038, 040, 044 (Awards section). Waiver part of the manager composite needs 042 (render without it, labelled, until 042 lands).

## Technical notes

- Files: new `docs/modules/league-awards.js`; reuse `docs/modules/trade-grade.js` (038), `docs/modules/values.js`, `docs/modules/pick-projection.js`, `docs/modules/franchise.js`, `docs/app.js` (`buildSeasonSnapshot` for results).
- Sleeper: `/league/<id>/drafts`, `/draft/<id>/picks`, transactions, brackets (via 034).
- No unit tests (repo policy). Hand-check the numbers for one manager per award and paste the check in the PR + demo video.

## Size estimate

**L**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
