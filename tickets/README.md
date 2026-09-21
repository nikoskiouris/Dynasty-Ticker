# Dynasty Ticker — Ticket Product Outline

Random user feedback, turned into tickets. **Do not delete ticket files.** When one ships, mark it Done and keep it for history.

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
| [004](004-buy-low-sell-high.txt) | Buy-low / sell-high targets | P0 |
| [005](005-win-now-targets.txt) | Win-now targets from this league | P1 |
| [006](006-late-season-win-now.txt) | Late-season win-now value | P2 |
| [007](007-assets-to-move-on.txt) | Assets to move on from for capital | P1 |
| [008](008-aging-stars-on-bad-teams.txt) | Target aging stars on tanking teams | P1 |
| [009](009-trade-match-false-needs.txt) | Trade match invents positional needs | P0 |
| [010](010-league-first-landing.txt) | League is the product; rather is not the homepage | P0 |
| [011](011-rather-pairing.txt) | Rather pairing still produces no-brainers | P1 |
| [012](012-trades-first-run.txt) | Trades page first-run is confusing | P0 |

## Done

| ID | Ticket | Priority | Shipped |
| --- | --- | --- | --- |
| [001](001-weekly-player-value.txt) | Weekly player value from matchup + usage | P0 | [#57](https://github.com/nikoskiouris/Dynasty-Ticker/pull/57) |
| [002](002-sit-start.txt) | Sit / start | P0 | [#60](https://github.com/nikoskiouris/Dynasty-Ticker/pull/60) |
| [003](003-future-dynasty-rankings.txt) | Future dynasty rankings (one year out, names not picks) | P0 | [#61](https://github.com/nikoskiouris/Dynasty-Ticker/pull/61) |
| [013](013-trade-desk-freeze.txt) | Deal finder / calculator freeze | P0 | [#64](https://github.com/nikoskiouris/Dynasty-Ticker/pull/64) |

## Shipped before this board

These were in the same player note. They never had ticket files. Git history has no deleted ticket files to restore. Do not rebuild them.

- **Tank / rebuild / contend.** Teams → Call. Playoff odds, lineup rank, age, and pick capital. Headline plus moves.
- **Ticker speed.** Loop is at least 50s, about 9s per name. That complaint is closed.
- **Calculator not on first paint.** Landing is jobs + username search, not the calculator. Remaining work is that “Make a trade” still opens the calculator, and the Trades tab still defaults to it. That leftover is ticket 012.

## Source

Unsolicited player note. Quotes in the tickets are from that note, cleaned up. Names they used as examples: Jeremiah Smith, Stefon Diggs, Mike Evans, Deebo Samuel, Nico Collins, Isaiah Likely, Dalton Kincaid.
