# Dynasty Ticker: ticket board

Every ticket is one Markdown file:
- **[`todo/`](todo/)** holds what is still to build.
- **[`done/`](done/)** holds what has shipped, or was closed as superseded.

**Do not delete ticket files.** A finished ticket moves to `done/` and stays there for history.

## Rule: when a ticket is finished

In the **same PR or commit as the work**, the implementer (Chief Of Staff, Claude, or anyone else) must:

1. **Move the file:** `git mv tickets/todo/<NNN-name>.md tickets/done/`
2. **Stamp it:** add `Done: <YYYY-MM-DD>, <PR or commit link>` on the line under the ticket's title, and set **Status** to `Done`. Keep the rest of the file.
3. **Update this README:** move the row from **To do** to **Done**, point its link at `done/`, and fill in the Done column.

A ticket that is dropped without being built goes to `done/` too. Its Status is `Superseded`, it gets a `Superseded` section explaining why, and its row goes under **Closed**.

Every ticket in `todo/` ends with the same three steps under "When this ticket is done". AGENTS.md carries the same rule.

## Product rule: one value system (owner, Nov 13, 2026)

Dynasty Ticker is optimized for **12-team Superflex PPR dynasty** values. There is one value system, built for that format, and nothing else:
- no 1QB values,
- no other league sizes,
- no TE premium or other scoring toggles,
- no redraft, keeper or other alternate value modes.

A connected league of any shape still loads. Every price, rank, verdict and grade uses the one value set, and the UI says so. Ticket [044](todo/044-one-value-system-12-team-sf-ppr.md) collapses the code onto that one set. Every ticket that shows a value repeats this rule.

## UI redesign (owner sketches, Nov 13, 2026): tickets 024–045

Niko sketched the site he wants in 11 drawings:
- a Home tool picker,
- Trade Calc,
- Player Rankings and a player page,
- League History: username → league → hub → Standings, My Team, Recent Trades, Historical Data,
- one ☰ slide-out menu that reaches all of them.

Each ticket stands alone, so it can go to Chief Of Staff or Claude.

Repo policy applies: **no unit tests and no automated test suites**. Acceptance is manual QA at 390, 820 and 1280 px, plus the demo video AGENTS.md requires.

### Owner decisions (Nov 13, 2026)

- **"Give real trade advice" (030):** use existing logic only. AI comes later and is out of scope for now.
- **Rankings table (031):** has a **Value** column and **keeps picks**. **No 1QB toggle.**
- **Features the sketches don't show** are **deleted for now** (ticket [045](todo/045-delete-features-not-in-sketches.md)): Find a trade, shop a player, buy-low/sell-high, win-now targets, move-on, next move, the contend/rebuild call, hot on Sleeper, the landing example trade, crowd call, and the **sample league**. Restore any of them from git history; 045's PR records the last SHA for each.
- **Share a trade is kept**: the Share button, `/t/` links and the share card.
- **One value system:** 12-team Superflex PPR dynasty only (ticket 044).

### Suggested order and dependencies

| Step | Ticket | Size | Depends on | Can run in parallel with |
| --- | --- | --- | --- | --- |
| 1 | [024](todo/024-redesign-routes-and-page-shells.md) Routes and page shells | L | none | none; do it first |
| 1b | [044](todo/044-one-value-system-12-team-sf-ppr.md) One value system: 12-team SF PPR | L | 024 | 045 |
| 1b | [045](todo/045-delete-features-not-in-sketches.md) Delete features the sketches don't show (incl. sample league) | L | 024 | 044 |
| 2 | [025](todo/025-global-slide-out-menu.md) Global menu | M | 024 | 026, 027, 031, 033 |
| 2 | [026](todo/026-home-tool-picker.md) Home tool picker | S | 024, 025, 044, 045 | 027, 031, 033 |
| 2 | [027](todo/027-trade-calc-two-column-layout.md) Trade Calc columns | M | 024, 044 | 025, 031, 033 |
| 2 | [031](todo/031-player-rankings-table.md) Player Rankings table | M | 024, 025, 044 | 027, 033 |
| 2 | [033](todo/033-league-history-username-and-league-picker.md) Username → league | M | 024, 025 | 027, 031 |
| 3 | [029](todo/029-trade-calc-fairness-scale.md) Fairness scale | M | 027, 044 | 028, 032, 034 |
| 3 | [028](todo/028-trade-calc-smart-search.md) Smart search | M | 027 | 029, 032, 034 |
| 3 | [032](todo/032-player-detail-page.md) Player detail page | L | 024, 031, 044 | 028, 029, 034 |
| 3 | [034](todo/034-league-history-data-layer.md) League data layer | L | 033 | 028, 029, 032 |
| 4 | [035](todo/035-league-hub.md) League hub | M | 033, 034 | 030, 036, 038 |
| 4 | [038](todo/038-trade-grading-algorithm.md) Trade grading | M | 034, 044 (029 wording) | 035, 036, 037 |
| 4 | [030](todo/030-trade-calc-real-trade-advice.md) Trade advice (no AI) | M | 027, 029, 044, 045 | 035–038 |
| 5 | [036](todo/036-league-standings-page.md) Standings + luck | M | 033, 035 | 037, 039 |
| 5 | [037](todo/037-league-my-team-page.md) My Team superlatives | M | 033, 035, 044, 045 (034 for some) | 036, 039 |
| 5 | [039](todo/039-league-recent-trades-page.md) Recent Trades | M | 034, 035, 038 | 036, 037 |
| 6 | [040](todo/040-historical-data-page-all-time-records.md) Historical Data page | L | 034, 035, 036 | 041 (after its shell) |
| 6 | [041](todo/041-awards-manager-trader-drafter.md) Awards I | L | 034, 038, 040, 044 | 042 |
| 6 | [042](todo/042-awards-lineup-setter-and-waivers.md) Awards II | M | 034, 040 | 041 |
| 7 | [043](todo/043-retire-old-navigation-and-redirects.md) Retire old nav + redirects | M | 024–042, 044, 045 | none; do it last |

Sizes: S is about half a day, M is 1–2 days, and L is 3 or more days for one agent. Nearly every ticket touches `docs/app.js`. Keep new pages in their own `docs/modules/*.js` files to limit merge conflicts.

### Still open for Niko

- 031: values refresh daily on `develop`, but the live site updates only when a release is cut. Decide whether the "updated daily" footnote needs a deploy change.

## To do

| ID | Ticket | Priority | Size |
| --- | --- | --- | --- |
| [024](todo/024-redesign-routes-and-page-shells.md) | Redesign foundation: new page map, routes, and empty page shells | P0 | L |
| [025](todo/025-global-slide-out-menu.md) | Global slide-out menu (hamburger drawer) on every page | P0 | M |
| [026](todo/026-home-tool-picker.md) | Home page: "Which tool to use?" tool picker | P0 | S |
| [027](todo/027-trade-calc-two-column-layout.md) | Trade Calc: "Team 1 Receives" / "Team 2 Receives" two-column layout | P0 | M |
| [028](todo/028-trade-calc-smart-search.md) | Trade Calc: one "smart search bar" at the top | P1 | M |
| [029](todo/029-trade-calc-fairness-scale.md) | Trade Calc: symmetric fairness scale (Lopsided … Even … Lopsided) | P0 | M |
| [030](todo/030-trade-calc-real-trade-advice.md) | Trade Calc: "New: Give real trade advice" button (existing logic, no AI) | P1 | M |
| [031](todo/031-player-rankings-table.md) | Player Rankings page: ranked table + "how our algorithm works" footnote | P0 | M |
| [032](todo/032-player-detail-page.md) | Player detail page (full screen) with "Return to player rankings" | P1 | L |
| [033](todo/033-league-history-username-and-league-picker.md) | League History entry: "Enter your Sleeper username" → "Select your league" | P0 | M |
| [034](todo/034-league-history-data-layer.md) | League History data layer: all seasons, matchups, transactions, drafts (cached) | P0 | L |
| [035](todo/035-league-hub.md) | League hub: League Name, "What to see?" and the RECENT WINNER banner | P0 | M |
| [036](todo/036-league-standings-page.md) | Standings page: live standings with luck factor | P1 | M |
| [037](todo/037-league-my-team-page.md) | My Team page: team name, interesting stats and player superlatives | P1 | M |
| [038](todo/038-trade-grading-algorithm.md) | Trade grading algorithm (shared by Recent Trades and Historical Data) | P0 | M |
| [039](todo/039-league-recent-trades-page.md) | Recent Trades page: league trade log with search and trade grades | P1 | M |
| [040](todo/040-historical-data-page-all-time-records.md) | Historical Data page: "<League Name> All-Time" records and timelines | P1 | L |
| [041](todo/041-awards-manager-trader-drafter.md) | All-time awards I: best/worst manager, trader, drafter, and the all-time best/worst trade | P1 | L |
| [042](todo/042-awards-lineup-setter-and-waivers.md) | All-time awards II: best/worst lineup setter and best/worst waiver work | P2 | M |
| [043](todo/043-retire-old-navigation-and-redirects.md) | Retire the three-tab desk: old nav, rail, redirects, clean-up | P1 | M |
| [044](todo/044-one-value-system-12-team-sf-ppr.md) | One value system: 12-team Superflex PPR dynasty only | P0 | L |
| [045](todo/045-delete-features-not-in-sketches.md) | Delete features the sketches don't show (Find a trade, buy-low/sell-high, win-now, hot on Sleeper, and the rest) | P1 | L |

## Done

| ID | Ticket | Priority | Done |
| --- | --- | --- | --- |
| [001](done/001-weekly-player-value.md) | Weekly player value from matchup and usage | P0 | 2026-09-18, [#57](https://github.com/nikoskiouris/Dynasty-Ticker/pull/57) |
| [002](done/002-sit-start.md) | Sit / start | P0 | 2026-09-20, [#60](https://github.com/nikoskiouris/Dynasty-Ticker/pull/60) |
| [003](done/003-future-dynasty-rankings.md) | Future dynasty rankings: names one year out, not pick labels | P0 | 2026-09-20, [#61](https://github.com/nikoskiouris/Dynasty-Ticker/pull/61) |
| [004](done/004-buy-low-sell-high.md) | Buy-low and sell-high targets | P0 | 2026-11-12, [#221](https://github.com/nikoskiouris/Dynasty-Ticker/pull/221) (landed as commit [88060d7](https://github.com/nikoskiouris/Dynasty-Ticker/commit/88060d7906df814a09a7e46f066dcf96b19a35a0)) |
| [005](done/005-win-now-targets.md) | Win-now targets inside this league | P1 | 2026-11-12, [#223](https://github.com/nikoskiouris/Dynasty-Ticker/pull/223) (landed as commit [e34d44f](https://github.com/nikoskiouris/Dynasty-Ticker/commit/e34d44ffd8da5d7114d551198a44096fdc3073cd)) |
| [007](done/007-assets-to-move-on.md) | Assets to move on from for capital | P1 | 2026-11-12, [#222](https://github.com/nikoskiouris/Dynasty-Ticker/pull/222) (landed as commit [894d018](https://github.com/nikoskiouris/Dynasty-Ticker/commit/894d0186e9ba3d87f8889cd0dbbd62e55be68886)) |
| [008](done/008-aging-stars-on-bad-teams.md) | Target aging stars on tanking teams in this league | P1 | 2026-11-12, [#223](https://github.com/nikoskiouris/Dynasty-Ticker/pull/223) (landed as commit [e34d44f](https://github.com/nikoskiouris/Dynasty-Ticker/commit/e34d44ffd8da5d7114d551198a44096fdc3073cd)) |
| [009](done/009-trade-match-false-needs.md) | Trade match invents positional needs | P0 | 2026-09-21, [#77](https://github.com/nikoskiouris/Dynasty-Ticker/pull/77) |
| [010](done/010-league-first-landing.md) | League is the product; rather is not the homepage | P0 | 2026-09-21, [#81](https://github.com/nikoskiouris/Dynasty-Ticker/pull/81) |
| [011](done/011-rather-pairing.md) | Rather pairing still produces no-brainers | P1 | 2026-09-21, [#81](https://github.com/nikoskiouris/Dynasty-Ticker/pull/81) |
| [012](done/012-trades-first-run.md) | Trades page first-run: not the calculator, and actually readable | P0 | 2026-09-21, [#77](https://github.com/nikoskiouris/Dynasty-Ticker/pull/77) |
| [013](done/013-trade-desk-freeze.md) | Deal finder / trade calculator freeze the tab | P0 | 2026-09-20, [#64](https://github.com/nikoskiouris/Dynasty-Ticker/pull/64) |
| [015](done/015-trade-survives-connect.md) | A trade you built survives connecting Sleeper | P0 | 2026-09-25, [#97](https://github.com/nikoskiouris/Dynasty-Ticker/pull/97) |
| [016](done/016-one-price-every-screen.md) | One price for a player on every screen | P0 | 2026-09-28, [#111](https://github.com/nikoskiouris/Dynasty-Ticker/pull/111) |
| [017](done/017-ideas-explain-why.md) | Trade ideas say what they do for you and why the other team would say yes | P1 | 2026-11-12, [#220](https://github.com/nikoskiouris/Dynasty-Ticker/pull/220) (landed as commit [3202e4a](https://github.com/nikoskiouris/Dynasty-Ticker/commit/3202e4a5e5b6fc91aa5c75e535b2527fd6ca44b2)) |
| [018](done/018-returning-manager-resume.md) | A returning manager lands back on their league and team | P1 | 2026-11-12, [#213](https://github.com/nikoskiouris/Dynasty-Ticker/pull/213) (landed as commit [da936aa](https://github.com/nikoskiouris/Dynasty-Ticker/commit/da936aafcbd522f2ac768ffa3cc7a1b59292fabd)) |
| [019](done/019-describe-a-trade.md) | Describe a trade in plain words and the calculator builds it | P1 | 2026-10-29, [#193](https://github.com/nikoskiouris/Dynasty-Ticker/pull/193) |
| [020](done/020-three-tabs.md) | Simplify to three tabs: Check a trade, Find a trade, My team | P0 | 2026-10-30, [#195](https://github.com/nikoskiouris/Dynasty-Ticker/pull/195) |
| [022](done/022-player-values-backtested.md) | Player values are a forecast that is checked against history | P0 | 2026-11-12, [#284](https://github.com/nikoskiouris/Dynasty-Ticker/pull/284) |
| [023](done/023-crowd-trade-call.md) | Crowd call: other managers drag one slider to say who a trade favors | P1 | 2026-11-12, [#282](https://github.com/nikoskiouris/Dynasty-Ticker/pull/282) (landed as commit [2a97de5](https://github.com/nikoskiouris/Dynasty-Ticker/commit/2a97de5732d85c0c77a4a8a22b40969a1d76de38)) |

Several PRs above (#213, #220–#223, #282) show as closed on GitHub, but their work landed on `develop` as the linked commits.

## Closed (superseded, not built)

| ID | Ticket | Closed |
| --- | --- | --- |
| [006](done/006-late-season-win-now.md) | Late-season win-now value | Superseded 2026-11-13 |
| [014](done/014-redraft-values.md) | Redraft rest-of-season values (not dynasty KTC) | Superseded 2026-11-13 |
| [021](done/021-navigation-decision-tree.md) | Navigation decision tree: trustworthy verdict, Find a trade that answers, one nav, a player page | Superseded 2026-11-13 |

## Shipped before this board

These were in the same player note. They never had ticket files, and git history has no deleted ticket files to restore. Do not rebuild them.

- **Tank / rebuild / contend.** Teams → Call. Playoff odds, lineup rank, age, and pick capital. Headline plus moves. *(The Call is deleted by 045, Nov 13, 2026.)*
- **Ticker speed.** The loop is at least 50s, about 9s per name. That complaint is closed.
- **Calculator not on first paint.** The landing is jobs + username search, not the calculator, and Trades opens on Partners. Ticket 012 tracks that first screen. *Superseded by #92: Trade opens on the calculator for everyone, before or after a league.*

## Source

Tickets 001–014 come from an unsolicited player note; quotes are cleaned up. The note's example names were Jeremiah Smith, Stefon Diggs, Mike Evans, Deebo Samuel, Nico Collins, Isaiah Likely and Dalton Kincaid. Tickets 015–023 come from the owner's product direction (AGENTS.md). Tickets 024–045 come from the owner's Nov 13, 2026 sketches and decisions. Old tickets were converted from `.txt` to Markdown on Nov 13, 2026; their text is unchanged except for the added Done, Closed and Superseded lines.
