# 035 · League hub: League Name, "What to see?" and the RECENT WINNER banner

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 7: after choosing username + league:

- **League Name** header (with league avatar).
- **"What to see?"** with four buttons: **Standings**, **My Team**, **Recent Trades**, **Historical Data**.
- A big banner: **"RECENT WINNER: ★ <champion> ★"** – the last completed season's champion.

Today `/l/:leagueId` opens My team (`renderTeamsPage()`); the header is `renderLeagueHero()` (`#hero-title`, `#league-avatar`); the current champion helper is `resolveCurrentChampion()` (current season only) and `buildSeasonSnapshot()` gives `champion` per season from the winners bracket.

## Scope

- `/l/:leagueId` renders the hub:
  - Header: league avatar + name, season and format chip ("12-team · SF · PPR"), plus the one-line 044 caveat when the league differs ("Values are built for 12-team Superflex PPR dynasty"); a small "Change league" link back to `/leagues`.
  - "What to see?" – four large buttons to `/l/:id/standings`, `/l/:id/team`, `/l/:id/trades`, `/l/:id/history`, each with a one-line teaser (e.g. Standings: "You're 7-3, 2nd"; My Team: your team name; Recent Trades: "4 trades this month"; Historical Data: "5 seasons of records") – teasers may show "…" while data loads.
  - Banner "RECENT WINNER: ★ <team name> ★" with manager avatar and season ("2025 champion"). Use the most recent **completed** season's winners bracket (`playoffFinish === 1`); if the current season is complete, use it. If the league has no completed season yet: "No champion yet – first season in progress".
- "My team" is the roster tied to the username from ticket 033; show "Viewing as <team>" with a change option.

## Out of scope

- The four sub-pages (036–042).

## Acceptance criteria (manual QA)

- `/l/<id>` shows the league name, four buttons and the champion banner; the champion matches Sleeper's playoff bracket for that season (spot-check 2 leagues incl. the sample league).
- A first-year league shows the "no champion yet" banner.
- Each button opens its page; Back returns to the hub.
- Reloading `/l/<id>` works without going through the username step.
- 390 px: buttons are a 2×2 grid or stacked, banner readable; 820/1280 fine.

## Dependencies

- 024, 033, 034 (prior seasons' brackets).

## Technical notes

- Files: `docs/app.js` (`renderLeagueHero`, `resolveCurrentChampion`, `buildSeasonSnapshot`, `buildBracketFinishMap`, `renderTeamIdentity`, `managerForRosterId`), `docs/modules/franchise.js`, `docs/modules/league-format.js`, `docs/ui/league.html`, new `docs/modules/league-hub.js` suggested.
- Sleeper: `/league/<id>/winners_bracket` (`p: 1` row's `w` is the champion roster_id), `/league/<id>/users` (`metadata.team_name`, avatar), `previous_league_id` chain.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
