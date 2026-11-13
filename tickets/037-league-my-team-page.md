# 037 · My Team page: team name, interesting stats and player superlatives

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 9: **Team Name** header, then **interesting stats and superlatives about the players** on my team.

Today My team (`renderTeamsPage()`) shows roster value and grade (`renderRosterSheet()`, `evaluateRosterStrength()`, `renderPowerDashboard()`), picks, a contend/rebuild window call (`renderWindowCallDashboard()`, `window-call.js`), standings and playoff odds, "move on from" (`renderMoveOn()`, `move-on.js`) and next move (`renderNextMove()`).

## Scope

- `/l/:leagueId/team` with Team Name (+ avatar, manager, record) and "← League".
- **Team stat strip:** total roster value and league rank, starting-lineup rank (`buildOptimalStartingLineup()`), average age of starters vs league average, draft-pick capital rank, contend/rebuild call (one line from `window-call.js`).
- **Player superlatives** (cards, each with face + one-line why), computed from the roster + this season's matchups + values:
  - MVP – most fantasy points started for you this season.
  - Most valuable asset – highest dynasty value.
  - Riser / Faller – biggest value change over the price-history window (`playerValueTrend()`).
  - Bench warmer – most points left on your bench.
  - Iron man – most games started; Injury bug – most games missed.
  - Oldest / youngest starter; best value for age.
  - Longest tenured – on this franchise the longest (needs 034 transactions/drafts; hide if not loaded).
  - Best draft pick on the roster / best waiver pickup on the roster (needs 034; hide if not loaded).
- **Roster table:** grouped by position with face, age, value, position rank, points this season.
- Keep the existing capabilities that have no other home (roster value, picks, window call, move-on). Say in the PR where each went.
- "Viewing as" switch to look at another team's page (`renderLensPicker()`).

## Out of scope

- Trade ideas ("Find a trade") – see ticket 043 for where they go.

## Acceptance criteria (manual QA)

- My team shows my team name and record; superlatives name real players with numbers that match Sleeper (spot-check MVP points and bench points).
- Superlatives that lack data are hidden, never shown as zero or "undefined".
- Switching "Viewing as" to another team updates everything.
- Every player face opens the player page.
- 390/820/1280 px, no sideways scroll.

## Dependencies

- 024, 033, 035; tenure/draft/waiver superlatives need 034.

## Technical notes

- Files: `docs/app.js` (`renderTeamsPage`, `renderRosterSheet`, `renderRosterDirectory`, `renderPowerDashboard`, `renderWindowCallDashboard`, `renderMoveOn`, `renderNextMove`, `buildPowerProfiles`, `summarizeRosterAssets`, `buildOptimalStartingLineup`, `getLensRoster`, `renderLensPicker`), `docs/modules/roster-markup.js`, `docs/modules/lineup.js`, `docs/modules/window-call.js`, `docs/modules/move-on.js`, `docs/modules/value-scale.js`.
- Sleeper: rosters, matchups (`starters_points`, `players_points`), `/players/nfl` (injury status), transactions + drafts via 034.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**
