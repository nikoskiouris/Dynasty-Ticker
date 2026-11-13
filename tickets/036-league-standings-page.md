# 036 · Standings page: live standings with luck factor

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 8: **League Name** header, **live standings**, a **luck factor (+/- vs. expected W/L)**, "etc."

A lot already exists on My team: `renderStandingsRoom()`, `renderStandingsPanel(model, sim)`, `renderStandingsRow()`, `renderPlayoffOddsPanel()`, `renderOddsRow()` in `docs/app.js`, backed by `docs/modules/standings.js`: `buildSeasonModel()` computes W-L-T, PF, PA, all-play record (`allPlayRecord`, `allPlayPct`), `expectedWins`, `luck = headToHeadWins − expectedWins`, `streak`, `pointsLeftOnBench`; `simulateSeason()` (4,000 runs, `SIM_ITERATIONS`) gives playoff and bye odds; `formatLuck()` / `luckClass()` format luck.

## Scope

- `/l/:leagueId/standings` page with League Name header and a "← League" link to the hub.
- Standings table (one row per team, sorted by the league's own tiebreak, `compareStandings()`): rank, team (avatar + name + manager), **W-L(-T)**, **PF**, **PA**, **Luck** (+/- wins vs. all-play expected, coloured green/red, e.g. "+1.8"), **All-play record**, **Streak**, **Playoff odds %** (and bye odds when the league has byes). Divisions grouped when the league uses them.
- "Live": during a game week, refresh current-week matchups every ~2 minutes while the tab is visible (`handleLiveVisibility()` pattern) and show "Live · week 11" with in-progress points; stop when hidden.
- An ⓘ that explains luck in plain words: "If you'd played every team every week, you'd have X wins. You actually have Y. Luck = Y − X."
- Extras worth including if cheap ("etc."): points left on bench, highest/lowest week score so far, playoff line marker, clinched/eliminated tags (`playoffLockStatus()`).
- My team row highlighted.

## Out of scope

- All-time standings (Historical Data, 040).

## Acceptance criteria (manual QA)

- Records, PF and PA match Sleeper's standings for the sample league and one real league.
- Luck values sum to roughly zero across the league and the ⓘ explanation is understandable.
- During a live Sunday window, points update without a reload; switching tabs pauses polling (Network tab).
- Before week 1 (or a league with no games yet) the page says standings start after week 1 instead of showing zeros.
- 390 px: the table scrolls inside its container or collapses secondary columns; no page-level sideways scroll.

## Dependencies

- 024, 033, 035 (hub link). Uses current-season matchups (already loaded by `loadSeasonWeeks()`; 034 for caching).

## Technical notes

- Files: `docs/modules/standings.js`, `docs/app.js` (`renderStandingsRoom`, `renderStandingsPanel`, `renderStandingsRow`, `renderPlayoffOddsPanel`, `getSeasonModel`, `getSimulation`, `buildSimPriors`, `formatLuck`, `luckClass`, `stopLivePolling`, `handleLiveVisibility`), `docs/styles.css`.
- Sleeper: `/league/<id>/matchups/<week>`, `/league/<id>/rosters` (`settings.wins|losses|fpts|fpts_against|ppts`), `/state/nfl` for current week.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**
