# 037 · My Team page: team name, interesting stats and player superlatives

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 9: **Team Name** header, then **interesting stats and superlatives about the players** on my team.

Today My team (`renderTeamsPage()`) shows roster value and grade (`renderRosterSheet()`, `evaluateRosterStrength()`, `renderPowerDashboard()`), picks, a contend/rebuild window call (`renderWindowCallDashboard()`, `window-call.js`), standings and playoff odds, "move on from" (`renderMoveOn()`, `move-on.js`) and next move (`renderNextMove()`).

## Scope

- `/l/:leagueId/team` with Team Name (+ avatar, manager, record) and "← League".
- **Team stat strip:** total roster value and league rank, starting-lineup rank (`buildOptimalStartingLineup()`), average age of starters vs league average, draft-pick capital rank. (No contend/rebuild call: the window call is deleted by 045.)
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
- Keep roster value and picks. **Delete, don't move:** window call, move-on, next move, power dashboard extras (owner decision Nov 13, ticket 045).
- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode.
- "Viewing as" switch to look at another team's page (`renderLensPicker()`).

## Out of scope

- Trade ideas ("Find a trade") are deleted (ticket 045). They may come back later.

## Acceptance criteria (manual QA)

- My team shows my team name and record; superlatives name real players with numbers that match Sleeper (spot-check MVP points and bench points).
- Superlatives that lack data are hidden, never shown as zero or "undefined".
- Switching "Viewing as" to another team updates everything.
- Every player face opens the player page.
- 390/820/1280 px, no sideways scroll.

## Dependencies

- 024, 033, 035, 044, 045; tenure/draft/waiver superlatives need 034.

## Technical notes

- Files: `docs/app.js` (`renderTeamsPage`, `renderRosterSheet`, `renderRosterDirectory`, `buildPowerProfiles`, `summarizeRosterAssets`, `buildOptimalStartingLineup`, `getLensRoster`, `renderLensPicker`), `docs/modules/roster-markup.js`, `docs/modules/lineup.js`, `docs/modules/value-scale.js`.
- Sleeper: rosters, matchups (`starters_points`, `players_points`), `/players/nfl` (injury status), transactions + drafts via 034.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
