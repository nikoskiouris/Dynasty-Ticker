# 042 · All-time awards II: best/worst lineup setter and best/worst waiver work

**Status:** Open · **Priority:** P2 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Second half of sketch 11's algorithm list: **best/worst lineup setter** and **best/worst waiver work**. Renders in the Awards section of Historical Data (040) next to 041's awards and feeds 041's manager composite.

## Scope

In `docs/modules/league-awards.js` (shared with 041):

1. **Lineup setter (efficiency)** – for every regular-season week of every season: `actual = sum(starters_points)`, `optimal = best legal lineup from players_points` using the league's slots (`chooseBestLineup()` in `lineup.js`, `getStarterRosterSlots()`, `assetCanFillRosterSlot()`). Efficiency = Σactual / Σoptimal. Also: points left on bench total, "games lost to bench" (weeks where optimal would have beaten the opponent's actual score). Best = highest efficiency, worst = lowest. Cross-check with Sleeper's `ppts` (potential points) on rosters where available; if Sleeper's number differs, prefer ours and note it.
2. **Waiver work** – from 034 transactions of type `waiver` and `free_agent`: for each added player, points he scored **in that manager's starting lineup** while on the roster (from matchups `starters_points`) + his value today if still rostered by them. Score = total started points from pickups (and FAAB spent per started point where the league uses FAAB). List best pickup ever per manager. Min 5 adds to qualify.
- Each award card: winner, loser, the number, ⓘ formula, and the best example (e.g. "2024 week 6: left 41 pts on bench").

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode. (waiver "value today" uses that set)

## Out of scope

- The other awards (041). Page layout (040).

## Acceptance criteria (manual QA)

- For one manager and one week, hand-compute optimal lineup vs actual and match the tool (paste in PR).
- League with IDP or unusual slots (SUPER_FLEX, REC_FLEX, WRRB_FLEX) computes legal optimal lineups.
- "Best pickup ever" for a manager is a plausible waiver add and his started points match Sleeper's weekly scores for 2 weeks.
- Managers below minimums show "not enough data".

## Dependencies

- 034 (matchups all seasons, transactions), 040.

## Technical notes

- Files: `docs/modules/league-awards.js`, `docs/modules/lineup.js` (`chooseBestLineup`, `LINEUP_STATE_LIMIT`), `docs/app.js` (`getStarterRosterSlots`, `getAllowedPositionsForSlot`, `assetCanFillRosterSlot`, `normalizeRosterSlot`, `computeOptimalPointsForSide`), `docs/modules/standings.js` (`pointsLeftOnBench` logic).
- Sleeper: `/league/<id>/matchups/<week>` (`starters`, `starters_points`, `players`, `players_points`), `/league/<id>` (`roster_positions`, `settings.waiver_type`, `waiver_budget`), transactions.
- No unit tests (repo policy). Manual hand-check in the PR + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
