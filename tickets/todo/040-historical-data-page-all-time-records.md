# 040 · Historical Data page: "<League Name> All-Time" records and timelines

**Status:** Open · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 11: **"<League Name> All-Time"** with **tons of cool data**. Niko: "this page should have a ton of stuff." This ticket builds the page and the record book; the manager awards (best/worst manager, trader, drafter, lineup setter, waiver work, best/worst trade) are tickets 041 and 042 and render into sections this page provides.

Existing pieces: `buildSeasonSnapshot()` already returns per season `champion`, `runnerUp`, `regularLeader`, `pointsLeader`, `potentialPointsLeader`, `consolationWinner`, `cellar`, `scoringAverage`, `scoringSpread`, `parityScore`, `tradeCount`, `tradedPickCount`. Before #195 there was a Hall/History room (`renderHallRoom()`, `renderHallBoard()`, `renderHistoryComparisonPanel()`, `renderManagerComparisonBody()`, `renderManagerHeatRow()` and `loyalty.js` `formatRecordLine()` / `winPctFromRecord()` – see `git show 42c6d66:docs/app.js` and `git show 42c6d66:docs/modules/loyalty.js`) that can be mined for ideas and code.

## Scope

`/l/:leagueId/history` with "← League", season-range note ("2021–2026 · 6 seasons"), loading progress from 034, and these sections (each a card; hide any card whose data is missing):

1. **Champions wall** – every season: champion, runner-up, regular-season #1, points leader, last place (toilet bowl / consolation winner where the league has one).
2. **All-time standings** – per manager (franchise key from `franchise.js`, so renamed teams merge): seasons, W-L-T, win %, PF, PA, playoff appearances, titles, finals, average finish, all-time luck (sum of 036's luck).
3. **Record book** – highest single-week score, lowest single-week score, biggest blowout, closest game, highest season PF, most points in a loss, fewest in a win, longest win/lose streak, best/worst regular-season record. Each record names team, season and week.
4. **Head-to-head grid** – manager × manager all-time record (tap a cell for the game list).
5. **Rivalries** – most-played pairing, most lopsided pairing, most playoff meetings.
6. **League trends** – per season: average score, parity score, number of trades, waiver moves, traded picks (small charts).
7. **Awards** – placeholder section filled by 041/042 (best/worst manager, trader, drafter, lineup setter, waiver work, all-time best/worst trade).
8. **Trophy case per manager** – click a manager → mini-profile: titles, best season, worst season, favourite trade partner, most-owned player across seasons.

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode. (applies to any value-based stat)

## Out of scope

- The award algorithms (041, 042). Seasons beyond what Sleeper's `previous_league_id` chain returns.

## Acceptance criteria (manual QA)

- For a league with ≥3 seasons, champions per season match Sleeper's brackets; all-time W-L for two managers matches a manual sum of their seasons.
- A manager who renamed their team appears once with combined totals; a takeover (orphan team) is attributed to the new manager from the takeover season (`takeoverForRoster()`).
- Record book entries link to the right season/week and are correct for 3 spot-checked records.
- Head-to-head cell for two managers matches the count of their matchups.
- The page shows a progress line while older seasons load and stays usable meanwhile.
- 390 px: cards stack, grid scrolls inside its card; 820/1280 fine.

## Dependencies

- 034 (all seasons' matchups, brackets, transactions), 035, 036 (luck per season).

## Technical notes

- Files: new `docs/modules/league-history-page.js` (+ `league-records.js` for pure computations) suggested; `docs/app.js` (`buildSeasonSnapshot`, `buildSeasonStandings`, `buildBracketFinishMap`, `buildConsolationWinner`, `compareRegularSeasonRows`, `compareSeasonFinishRows`, `getHistoryEntryByLeagueId`, `getHistoryRosterInfo`, `getFranchiseIndex`, `buildManagerKey`), `docs/modules/franchise.js`, `docs/modules/standings.js` (`buildSeasonModel` per season for luck/all-play).
- Sleeper: matchups for every week of every season, `winners_bracket` / `losers_bracket`, users/rosters per season, transactions (counts).
- No unit tests (repo policy). Manual QA (spot-checks against Sleeper) + demo video.

## Size estimate

**L**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
