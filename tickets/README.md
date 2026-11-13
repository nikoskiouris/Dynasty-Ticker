# Dynasty Ticker — Ticket Product Outline

Random user feedback, turned into tickets. **Do not delete ticket files.** When one ships, mark it Done and keep it for history. Tickets 015 and later come from the owner's product direction (AGENTS.md, Product purpose) and from gaps found while checking it. Where an older ticket's fix conflicts with that direction, the ticket carries a `Superseded` note.

The product already has a league desk, a tank/contend call, trade match, a calculator, find-deals, a landing “rather” duel, weekly start chance on the roster, sit/start this week, and next-year 1sts/2nds with Dynasty Nerds mock names.

This outline is leftover work plus the tickets we already shipped.

## How to read this

Each file in this folder is one ticket: title, status, why, what to build, and how to know it is done.

- **Open** — still to build.
- **Done** — shipped. File stays. Do not rebuild unless the leftover note says so.

## When a ticket ships

1. Set `Status` to `Done` in the ticket file. Keep the rest of the file.
2. Add a `Shipped` line with the PR (`#57`).
3. Move the row from Open to Done in this README. Link the PR.
4. Do not delete the file.

## Open

| ID | Ticket | Priority |
| --- | --- | --- |
| [006](006-late-season-win-now.txt) | Late-season win-now value | P2 |
| [014](014-redraft-values.txt) | Redraft rest-of-season values | P1 |
| [021](021-navigation-decision-tree.txt) | Navigation decision tree: trustworthy verdict, Find a trade that answers, one nav, a player page | P0 |
| [024](024-redesign-routes-and-page-shells.md) | Redesign foundation: new page map, routes, empty page shells | P0 |
| [025](025-global-slide-out-menu.md) | Global slide-out menu (☰ drawer) on every page | P0 |
| [026](026-home-tool-picker.md) | Home page: "Which tool to use?" tool picker | P0 |
| [027](027-trade-calc-two-column-layout.md) | Trade Calc: Team 1 Receives / Team 2 Receives columns | P0 |
| [028](028-trade-calc-smart-search.md) | Trade Calc: one smart search bar | P1 |
| [029](029-trade-calc-fairness-scale.md) | Trade Calc: symmetric Lopsided…Even…Lopsided fairness scale | P0 |
| [030](030-trade-calc-real-trade-advice.md) | Trade Calc: "New: Give real trade advice" | P1 |
| [031](031-player-rankings-table.md) | Player Rankings table + algorithm footnote | P0 |
| [032](032-player-detail-page.md) | Full-screen player detail page + Return to player rankings | P1 |
| [033](033-league-history-username-and-league-picker.md) | League History: Sleeper username → select league | P0 |
| [034](034-league-history-data-layer.md) | League History data layer: all seasons, matchups, transactions, drafts | P0 |
| [035](035-league-hub.md) | League hub: What to see? + RECENT WINNER banner | P0 |
| [036](036-league-standings-page.md) | Standings page with luck factor | P1 |
| [037](037-league-my-team-page.md) | My Team page: stats and player superlatives | P1 |
| [038](038-trade-grading-algorithm.md) | Trade grading algorithm | P0 |
| [039](039-league-recent-trades-page.md) | Recent Trades page: search + trade grades | P1 |
| [040](040-historical-data-page-all-time-records.md) | Historical Data: All-Time records page | P1 |
| [041](041-awards-manager-trader-drafter.md) | Awards I: manager, trader, drafter, best/worst trade | P1 |
| [042](042-awards-lineup-setter-and-waivers.md) | Awards II: lineup setter, waiver work | P2 |
| [043](043-retire-old-navigation-and-redirects.md) | Retire three-tab desk: redirects, homes for orphaned features | P1 |

## Done

| ID | Ticket | Priority | Shipped |
| --- | --- | --- | --- |
| [001](001-weekly-player-value.txt) | Weekly player value from matchup + usage | P0 | [#57](https://github.com/nikoskiouris/Dynasty-Ticker/pull/57) |
| [002](002-sit-start.txt) | Sit / start | P0 | [#60](https://github.com/nikoskiouris/Dynasty-Ticker/pull/60) |
| [003](003-future-dynasty-rankings.txt) | Future dynasty rankings (one year out, names not picks) | P0 | [#61](https://github.com/nikoskiouris/Dynasty-Ticker/pull/61) |
| [004](004-buy-low-sell-high.txt) | Buy-low / sell-high targets | P0 | [#221](https://github.com/nikoskiouris/Dynasty-Ticker/pull/221) |
| [005](005-win-now-targets.txt) | Win-now targets from this league | P1 | [#223](https://github.com/nikoskiouris/Dynasty-Ticker/pull/223) |
| [007](007-assets-to-move-on.txt) | Assets to move on from for capital | P1 | [#222](https://github.com/nikoskiouris/Dynasty-Ticker/pull/222) |
| [008](008-aging-stars-on-bad-teams.txt) | Target aging stars on tanking teams | P1 | [#223](https://github.com/nikoskiouris/Dynasty-Ticker/pull/223) |
| [009](009-trade-match-false-needs.txt) | Trade match invents positional needs | P0 | [#77](https://github.com/nikoskiouris/Dynasty-Ticker/pull/77) |
| [010](010-league-first-landing.txt) | League is the product; rather is not the homepage | P0 | [#81](https://github.com/nikoskiouris/Dynasty-Ticker/pull/81) |
| [011](011-rather-pairing.txt) | Rather pairing still produces no-brainers | P1 | [#81](https://github.com/nikoskiouris/Dynasty-Ticker/pull/81) |
| [012](012-trades-first-run.txt) | Trades page first-run is confusing | P0 | [#77](https://github.com/nikoskiouris/Dynasty-Ticker/pull/77) |
| [013](013-trade-desk-freeze.txt) | Deal finder / calculator freeze | P0 | [#64](https://github.com/nikoskiouris/Dynasty-Ticker/pull/64) |
| [015](015-trade-survives-connect.txt) | A trade you built survives connecting Sleeper | P0 | [#97](https://github.com/nikoskiouris/Dynasty-Ticker/pull/97) |
| [016](016-one-price-every-screen.txt) | One price for a player on every screen | P0 | [#111](https://github.com/nikoskiouris/Dynasty-Ticker/pull/111) |
| [017](017-ideas-explain-why.txt) | Trade ideas say what they do and why the other team says yes | P1 | [#220](https://github.com/nikoskiouris/Dynasty-Ticker/pull/220) |
| [018](018-returning-manager-resume.txt) | Returning manager lands back on their league and team | P1 | [#213](https://github.com/nikoskiouris/Dynasty-Ticker/pull/213) |
| [019](019-describe-a-trade.txt) | Describe a trade in plain words and the calculator builds it | P1 | [#193](https://github.com/nikoskiouris/Dynasty-Ticker/pull/193) |
| [020](020-three-tabs.txt) | Simplify to three tabs: Check a trade, Find a trade, My team | P0 | [#195](https://github.com/nikoskiouris/Dynasty-Ticker/pull/195) |
| [022](022-player-values-backtested.txt) | Player values are a forecast that is checked against history | P0 | [#284](https://github.com/nikoskiouris/Dynasty-Ticker/pull/284) |
| [023](023-crowd-trade-call.txt) | Crowd call: other managers drag one slider to say who a trade favors | P1 | [#282](https://github.com/nikoskiouris/Dynasty-Ticker/pull/282) |

## UI redesign (owner sketches, Nov 13, 2026): tickets 024–043

Niko sketched the site he wants in 11 drawings: a Home tool picker, Trade Calc, Player Rankings and a player page, and League History (username → league → hub → Standings, My Team, Recent Trades, Historical Data), all reached from one ☰ slide-out menu. These tickets are Markdown (`.md`); older tickets stay `.txt`. Each one stands alone, so it can go to Chief Of Staff or Claude. Repo policy applies: **no unit tests or automated suites**. Acceptance is manual QA at 390, 820 and 1280 px, plus the demo video required by AGENTS.md.

This set is newer owner direction than tickets 020 (three tabs) and 021 (navigation decision tree). Where they conflict, follow this set. Ticket 043 adds the `Superseded` notes.

### Suggested order and dependencies

| Step | Ticket | Size | Depends on | Can run in parallel with |
| --- | --- | --- | --- | --- |
| 1 | [024](024-redesign-routes-and-page-shells.md) Routes and page shells | L | none | none; do it first |
| 2 | [025](025-global-slide-out-menu.md) Global menu | M | 024 | 026, 027, 031, 033 |
| 2 | [026](026-home-tool-picker.md) Home tool picker | S | 024, 025 | 027, 031, 033 |
| 2 | [027](027-trade-calc-two-column-layout.md) Trade Calc columns | M | 024 | 025, 031, 033 |
| 2 | [031](031-player-rankings-table.md) Player Rankings table | M | 024, 025 | 027, 033 |
| 2 | [033](033-league-history-username-and-league-picker.md) Username → league | M | 024, 025 | 027, 031 |
| 3 | [029](029-trade-calc-fairness-scale.md) Fairness scale | M | 027 | 028, 032, 034 |
| 3 | [028](028-trade-calc-smart-search.md) Smart search | M | 027 | 029, 032, 034 |
| 3 | [032](032-player-detail-page.md) Player detail page | L | 024, 031 | 028, 029, 034 |
| 3 | [034](034-league-history-data-layer.md) League data layer | L | 033 | 028, 029, 032 |
| 4 | [035](035-league-hub.md) League hub | M | 033, 034 | 030, 036, 038 |
| 4 | [038](038-trade-grading-algorithm.md) Trade grading | M | 034 (029 wording) | 035, 036, 037 |
| 4 | [030](030-trade-calc-real-trade-advice.md) Trade advice | L | 027, 029 | 035–038 |
| 5 | [036](036-league-standings-page.md) Standings + luck | M | 033, 035 | 037, 039 |
| 5 | [037](037-league-my-team-page.md) My Team superlatives | M | 033, 035 (034 for some) | 036, 039 |
| 5 | [039](039-league-recent-trades-page.md) Recent Trades | M | 034, 035, 038 | 036, 037 |
| 6 | [040](040-historical-data-page-all-time-records.md) Historical Data page | L | 034, 035, 036 | 041 (after its shell) |
| 6 | [041](041-awards-manager-trader-drafter.md) Awards I | L | 034, 038, 040 | 042 |
| 6 | [042](042-awards-lineup-setter-and-waivers.md) Awards II | M | 034, 040 | 041 |
| 7 | [043](043-retire-old-navigation-and-redirects.md) Retire old nav + redirects | M | 024–042 | none; do it last |

Sizes: S is about half a day, M is 1–2 days, and L is 3 or more days for one agent. All 20 tickets touch `docs/app.js` or sit next to it. Keep new pages in their own `docs/modules/*.js` files to limit merge conflicts.

### Open questions for Niko (each ticket repeats its own)

- 030: what "real trade advice" means. Default: counter-offer plus team-fit advice built from existing logic, with no paid AI.
- 031: whether to add a Value column to the rankings table, and whether to keep picks and the 1QB toggle.
- 031: values refresh daily on `develop`, but the live site updates only when a release is cut. Decide whether the "updated daily" footnote needs a deploy change.
- 043: where Find a trade, buy-low/sell-high, win-now targets and "hot on Sleeper" live, since the sketches don't show them.

## Shipped before this board

These were in the same player note. They never had ticket files. Git history has no deleted ticket files to restore. Do not rebuild them.

- **Tank / rebuild / contend.** Teams → Call. Playoff odds, lineup rank, age, and pick capital. Headline plus moves.
- **Ticker speed.** Loop is at least 50s, about 9s per name. That complaint is closed.
- **Calculator not on first paint.** Landing is jobs + username search, not the calculator. Trades opens on Partners. Ticket 012 tracks that first screen. *Superseded by #92: Trade opens on the calculator for everyone, before or after a league.*

## Source

Unsolicited player note. Quotes in the tickets are from that note, cleaned up. Names they used as examples: Jeremiah Smith, Stefon Diggs, Mike Evans, Deebo Samuel, Nico Collins, Isaiah Likely, Dalton Kincaid.
