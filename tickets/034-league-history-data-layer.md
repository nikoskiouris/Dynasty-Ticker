# 034 · League History data layer: all seasons, matchups, transactions, drafts (cached)

**Status:** Open · **Priority:** P0 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketches 7–11 (hub, Standings, My Team, Recent Trades, Historical Data) all need league data the app does not load today. #195 cut the history loaders. This ticket brings back one shared, cached data layer so the page tickets (035–042) only compute and render.

What exists now (`docs/app.js`):
- `loadLeagueCoreData(leagueId)` – league, users, rosters, traded_picks, drafts, winners_bracket, losers_bracket.
- `loadLeagueHistoryContext()` – walks `previous_league_id` back up to `MAX_HISTORY_SEASONS` (= 6, `constants.js`) and stores `state.leagueHistory` entries (`buildLeagueHistoryEntry()`).
- `loadSeasonWeeks()` – current-season `matchups/<week>` only.
- `buildSeasonSnapshot()` / `buildSeasonStandings()` / `buildBracketFinishMap()` / `buildConsolationWinner()` – per-season standings, champion, runner-up, points leaders, potential points (`ppts`).
- `franchise.js` – `buildFranchiseIndex()`, `resolveFranchiseManagerKey()`, takeovers: maps rosters across seasons to the same person.
- `state.transactions` / `transactionsLoaded` exist in `state.js` but nothing fills them.

What was cut and can be recovered for reference from git (`git show 42c6d66:docs/app.js`, the parent of #195): `loadLeagueTransactions()`, `loadLeagueHistoryTransactions()`, `buildTransactionWeeks()`, `dedupeTransactions()`, `dedupeTransactionsByLeague()`, `getArchiveTradeTransactions()`, `buildTransactionPlayerAsset()`, `buildTransactionPickAsset()`, `formatTransactionDate()`, `buildManagerHistoryLens()`; modules `league-board.js`, `loyalty.js`.

## Scope

New module (suggested `docs/modules/league-archive.js`) exposing, per league chain (current + up to N previous seasons):

- `seasons[]`: league settings, users, rosters, brackets (already loaded via core data).
- `matchups[season][week]` for every completed week of every season (`/league/<id>/matchups/<week>`): `roster_id`, `matchup_id`, `points`, `starters`, `starters_points`, `players`, `players_points`.
- `transactions[season]` for every week (`/league/<id>/transactions/<round>`), deduped, typed (`trade`, `waiver`, `free_agent`, `commissioner`), with `adds`, `drops`, `draft_picks`, `waiver_budget`, `settings.waiver_bid`, `status` (only `complete`), timestamps.
- `drafts[season]` with picks (`/draft/<draft_id>/picks`) incl. `pick_no`, `round`, `roster_id`, `picked_by`, `player_id`, `metadata`.
- Manager identity across seasons via `franchise.js` (one person = one key even if team names change; handle orphan takeovers).
- Lazy & progressive: hub needs only core + brackets; Standings needs current matchups; Recent Trades needs current + last season transactions; Historical Data loads everything with a visible progress line ("Loading 2023 season… 3 of 5").
- Cache in IndexedDB/localStorage keyed by league_id + season; completed seasons never refetch; current season refetches after 6 hours or on manual refresh. Chunk requests (`mapInChunks()`) to stay polite to Sleeper (~ ≤ 10 concurrent).
- Partial failure is shown, not hidden: e.g. "2022 trades unavailable from Sleeper".
- Raise `MAX_HISTORY_SEASONS` only if load time stays OK (measure; note in PR).

## Out of scope

- Any rendering (other tickets). Values at the time of past trades (see 038).

## Acceptance criteria (manual QA)

- With a 3+ season dynasty league, the browser Network tab shows each completed season's matchups/transactions fetched once; a reload serves them from cache.
- A console helper (e.g. `window.__dtArchive`) or a temporary debug panel shows season count, weeks, trades, waiver moves and drafts per season that match what Sleeper shows in its app for 2 spot-checked seasons.
- Switching leagues never shows the previous league's data (stale-load guards like `playersLoadStale()`).
- Turning the network off after a first load: hub and history still render from cache with a "saved data" note.
- A league whose older season has been deleted loads what it can and names the gap.

## Dependencies

- 033 (league selected). Unblocks 035–042.

## Technical notes

- Sleeper endpoints (public, read-only, documented at https://docs.sleeper.com): `/league/<id>`, `/league/<id>/users`, `/league/<id>/rosters`, `/league/<id>/matchups/<week>`, `/league/<id>/transactions/<round>`, `/league/<id>/traded_picks`, `/league/<id>/drafts`, `/draft/<id>/picks`, `/league/<id>/winners_bracket`, `/league/<id>/losers_bracket`, `/state/nfl`.
- Files: `docs/app.js` (`loadLeagueCoreData`, `loadLeagueHistoryContext`, `loadSeasonWeeks`, `runLeagueLoad`, `resetSeasonState`, `invalidateSeasonCaches`), `docs/modules/sleeper.js` (`apiGetWithRetry`, `mapInChunks`, `previousLeagueId`, `sleeperLeaguePath`), `docs/modules/franchise.js`, `docs/modules/state.js`, `docs/modules/constants.js` (`MAX_HISTORY_SEASONS`), `docs/modules/sample-league.js` (the sample league invents people; history must use the same invented names).
- No unit tests (repo policy). Manual QA (Network tab + Sleeper app spot-checks) + demo video.

## Size estimate

**L**
