# 032 · Player detail page (full screen) with "Return to player rankings"

Done: 2026-11-14, [#289](https://github.com/nikoskiouris/Dynasty-Ticker/pull/289)

**Status:** Done · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 4: clicking a player on Player Rankings opens a page where **the entire screen shows great data on that player**, with a **top-right "Return to player rankings"** button. Clicking it goes back to the rankings.

Today `/player/:sleeperId/:slug` exists but only selects a row and shows a card above the board: `openPlayerPage(assetId)` sets `state.ranks.selectedId`, and `renderRankCard()` in `ranks.js` shows value, tier (`renderValueTierBadge()`), trend sparkline (`renderValueSparkline()`, `renderValueTrend()` from price history), role line (`roleLine()`), last-season stat line (`formatPlayerDetail()` / `formatSeasonStats()` in `player-notes.js`), NFL draft line (`lookupNflDraftPick()`), and owner in a connected league (`ownerLine()`).

## Scope

A dedicated full-screen player page with:

- **Header:** large face, name, position, NFL team, age, years of experience, NFL draft slot ("2023 R1 P8" from `draftPick` / `nfl_draft_picks.json`), injury status from Sleeper.
- **Value block:** value, Overall Rank and Position Rank (same numbers as the table), tier badge (12-team SF PPR value only, ticket 044; no 1QB value), value trend sparkline over the price-history window (`docs/data/price-history/`, 90-day retention, `playerValueTrend()`), "updated" stamp.
- **Why this value:** the forecast seasons from `player_values.json` `players[id].forecast.sf` (season, expected points above replacement, discount) as a small bar chart – "how much of his value is this year vs. later" – plus the model `confidence` label and `components` in plain words (recent PPG, role/opportunity per game, availability). Label it as a forecast, not a promise.
- **Production:** this season and last season fantasy line (`formatSeasonStats()`), games played; weekly points if cheaply available from Sleeper stats.
- **Comparables:** 3 players just above and below in value (`priceNeighbors()` in `trade-talk.js`) – each clickable.
- **Actions:** "Add to a trade" (opens Trade Calc with him on Team 1, `addDraftFromPlayers()`), and with a league connected, "Owned by <manager>".
- **Top-right "Return to player rankings"** button: returns to `/players` restoring the previous filter, search and scroll (use the history state, `restoreHistoryScroll()`); browser Back does the same.
- Direct link/reload to `/player/<id>/<slug>` works; unknown id shows the existing "We can't find that player" state.
- Page title/OG description name the player.

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode.

## Out of scope

- News feeds, social posts, paid stats APIs.

## Acceptance criteria (manual QA)

- Clicking Ja'Marr Chase on rankings opens a full page about him (rankings table no longer visible).
- Value, overall rank and position rank match the rankings table; the forecast seasons add up to his value (within rounding, per `player-values/README.md`).
- A rookie shows his NFL draft slot and a "rookie, little NFL data" label rather than empty stats.
- "Return to player rankings" (top-right) returns to rankings with the same filter and scroll; Back does too.
- "Add to a trade" opens Trade Calc with him in Team 1 Receives and any existing draft kept.
- Reloading the player URL renders the same page.
- 390/820/1280 px, no sideways scroll; button reachable without scrolling on phones.

## Dependencies

- 024, 031, 044.

## Technical notes

- Files: `docs/modules/ranks.js` (`renderRankCard`, `roleLine`, `marketTape`), `docs/modules/player-notes.js`, `docs/modules/value-scale.js`, `docs/modules/trade-talk.js` (`priceNeighbors`), `docs/modules/history-route.js` (`player` route, `playerSlug`), `docs/app.js` (`openPlayerPage`, `applyPlayerRoute`, `canonicalizePlayerUrl`, `focusColdPlayerHeading`, `ensureRankExtras`), new `docs/modules/player-page.js` suggested.
- Data: `docs/data/player_values.json` (`players[id]`: `age`, `team`, `position`, `experience`, `draftPick`, `confidence`, `components`, `forecast`, `lastSeason`), `docs/data/price-history/*.json`, `docs/data/nfl_draft_picks.json`, Sleeper `/players/nfl` (injury_status). If `loadTrendingPlayers()` is deleted by 045, don't revive it here, Sleeper stats `https://api.sleeper.app/v1/stats/nfl/regular/<season>` if used (unofficial – cache, fail soft).
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**L**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
