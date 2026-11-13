# 039 · Recent Trades page: league trade log with search and trade grades

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 10: header **"<League Name> Trades"**, a **"Search a player"** bar, and a **list of trades** with a **Trade grade** column.

Before #195 the app had a trade log ("Activity", `renderTradeLogDesk()` in `git show 42c6d66:docs/app.js`); it was removed. Today nothing lists league trades.

## Scope

- `/l/:leagueId/trades` with "← League".
- List of completed trades, newest first: date, the two (or more) teams with avatars, what each received (faces, names, picks as "2026 1st (from Team X)"), each side's value, and the **Trade grade** per side (letter + winner highlight) from ticket 038. Toggle "Graded on: Today's value / Value at the time" when both exist.
- **"Search a player"** bar filters to trades involving that player or pick (type-ahead from players seen in this league's trades).
- Filters: season (current by default, previous seasons when 034 has loaded them), team.
- Tap a trade → expands to show the grade math and a "Open in Trade Calc" button (prefill via `tradeHref()`; don't overwrite an existing draft without the undo notice).
- Empty state: "No trades yet this season" with a link to older seasons.

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode.

## Out of scope

- All-time best/worst trades and trader rankings (041).

## Acceptance criteria (manual QA)

- The list matches the trades in the Sleeper app for this league (count and contents) for the current season.
- Searching "Bijan" shows only trades with Bijan Robinson; clearing the search restores the list.
- Grades show for every trade and match 038's rules; picks used in past drafts are shown as the drafted player.
- "Open in Trade Calc" opens the trade with the correct sides.
- 390/820/1280 px; long multi-asset trades wrap cleanly.

## Dependencies

- 034, 038, 035 (hub link).

## Technical notes

- Files: new `docs/modules/trade-log.js` suggested; `docs/modules/history-route.js` (`tradeHref`), `docs/modules/player-face.js`, `docs/modules/values.js` (`formatPickBucketLabel`), `docs/app.js` (`addDraftAsset`, `replaceDraft`, undo notice).
- Sleeper: `/league/<id>/transactions/<round>` (type `trade`), users/rosters for names.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
