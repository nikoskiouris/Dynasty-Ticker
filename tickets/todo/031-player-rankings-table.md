# 031 · Player Rankings page: ranked table + "how our algorithm works" footnote

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 3: Player Rankings page with ☰ and a table with columns:

| Player face | Player | Overall Rank | Position Rank | Age | Team |

Footnote: **"Our algorithm is based around …, …, …, and many other factors, updated daily."** Fill in the blanks with the factors the valuation really uses.

Today the board lives under Check a trade (`/players`) as a card list: `buildRankBoard()`, `rankView()`, `renderRanksMarkup()`, `renderRanksBody()`, `renderRankRow()`, `renderRanksShelf()` (top faces) and `renderRanksToolbar()` (search, position chips `RANK_POSITIONS` = ALL/QB/RB/WR/TE/PICK, format `RANK_FORMATS` = SF/1QB, paging `RANK_PAGE_SIZE` = 48) in `docs/modules/ranks.js`, painted by `renderRankHost()` / `renderRankSurfaces()` in `docs/app.js`. Position ranks come from `assignBoardRanks()` / `buildPositionBoard()` (`player-notes.js`) and `getPlayerPositionRankLabel()` / `refreshPlayerPositionRanks()` (app.js).

## Scope

- Make `/players` its own page (from ticket 024) showing a real `<table>`:
  - **Face** (`renderPlayerFace()`), **Player** (name, small position tag), **Overall Rank** (1…N by value), **Position Rank** (e.g. WR4), **Age** (one decimal or whole years, from `players[id].age` in `player_values.json` or `playerAgeForAsset()`), **Team** (NFL team abbreviation, `players[id].team`; "FA" when none).
  - **Value** column (the one price): **owner decision Nov 13: yes**. Same number as Trade Calc.
- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode. **Remove the SF/1QB toggle** (`RANK_FORMATS` chips in `renderRanksToolbar()`; owner decision Nov 13; the code path is removed by 044).
- Keep the ALL/QB/RB/WR/TE filters and search-by-name. **Keep picks** (owner decision Nov 13): keep the PICK filter, and on the ALL view picks appear in value order. Picks have no face (use the pick token), Age "—" and Team "—". Position Rank for a pick is its rank among picks (e.g. PICK3).
- Show 50 rows then "Show more" (or virtualise) – no jank on phones.
- Sticky header; sortable by Age and Team is a nice-to-have, default sort is Overall Rank.
- Clicking any player row (face or name) opens the player detail page (ticket 032).
- Footnote under the table, using the real factors from `PRICE_FACTORS_LINE` (`verdict-copy.js`) and `player-values/README.md`:
  > "Our algorithm is based around age, role and opportunity, how well a player scores, how often he plays, his NFL team and draft capital, and how long players at his position usually stay good, plus many other factors, updated daily."
  Link "How values work" to the existing explainer (`renderValueScaleExplainer()` in `value-scale.js`). Keep the freshness stamp (`renderValuesFreshness()`). Note: `.github/workflows/refresh-player-values.yml` refreshes values daily (cron `17 11 * * *`, 6:17 AM ET) on `develop`, but dynastyticker.com only picks them up when a release is cut (AGENTS.md "Live site releases"). "Updated daily" is only true on the live site if releases or the deploy schedule change; otherwise word it from the freshness stamp. Flag this to Niko in the PR.
- With a league connected, the existing owner tag ("on your team" / manager name, `ownerLine()`) may stay as a small badge.

## Out of scope

- Changing how values are computed. The player detail page (032).

## Acceptance criteria (manual QA)

- `/players` shows the table with all six columns; row 1 is the highest-valued player and his position rank reads e.g. "QB1".
- Ages and teams match Sleeper for 5 spot-checked players (e.g. Josh Allen, Ja'Marr Chase, Bijan Robinson, Brock Bowers, a rookie).
- Filtering WR shows only WRs with Overall Rank unchanged and Position Rank WR1…; there is no SF/1QB toggle anywhere.
- The PICK filter lists draft picks with values that match Trade Calc.
- Searching "bowers" finds Brock Bowers.
- Clicking a row opens his detail page; "Return to player rankings" (032) comes back to the same filter and scroll position.
- The footnote names the real factors and the freshness date is correct.
- 390 px: table fits without sideways scroll (hide Team or shrink faces on phones if needed; document the choice); 820/1280 fine.

## Dependencies

- 024, 025, 044.

## Technical notes

- Files: `docs/modules/ranks.js`, `docs/modules/player-notes.js`, `docs/modules/player-face.js`, `docs/modules/value-scale.js`, `docs/modules/verdict-copy.js` (`PRICE_FACTORS_LINE`), `docs/app.js` (`rankViewModel`, `renderRankHost`, `renderRankSurfaces`, `cachedRankRows`, `openPlayerBoard`, `ensureRankExtras`, `activeRankFormat`), `docs/styles.css`.
- Data: `docs/data/player_values.json` (`sf` map only, see 044; `players[id].age|team|position`), `docs/data/nfl_players_slim.json`; Sleeper `https://api.sleeper.app/v1/players/nfl` cached by `loadPlayersWithCache()`; faces from `sleepercdn.com` via `sleeperPlayerThumbUrl()`.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
