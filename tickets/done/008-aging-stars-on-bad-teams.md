# 008 · Target aging stars on tanking teams in this league

Done: 2026-11-12, [#223](https://github.com/nikoskiouris/Dynasty-Ticker/pull/223) (landed as commit [e34d44f](https://github.com/nikoskiouris/Dynasty-Ticker/commit/e34d44ffd8da5d7114d551198a44096fdc3073cd))

Superseded: 2026-11-13. The owner removed this feature (ticket 045). Restore it from git at df93556; see the 045 restore table.

## Status
Done

## Priority
P1

## Shipped
#223

## Area
Trades → Partners / win-now board

## Description
Scan this league for teams that are bad / tanking and still hold older production (Mike Evans type). Those are the names a contender should be calling about.

Must use this league’s rosters, records, and Call (tank vs all-in), not a national “buy Evans” article.

## Why
“Going off the trade targets you could similarly analyze which teams suck and have older guys like Mike Evans who you should target based on your league itself.”

## Current product
Trade match does contend-rebuild pairing and age flags. It does not publish “this tank still has Evans.” Need detection is also wrong (ticket 009), so the pairing can chase the wrong position.

## Acceptance
- Contender: a list of aging/win-now names on tank or last-place rosters, with owner.
- Those names are actually on those rosters in the loaded league.
- Rebuilders do not get told to acquire those same names.

## Superseded
Owner decision, Nov 13, 2026: features the redesign sketches do not show are deleted for now (ticket [045](045-delete-features-not-in-sketches.md)). This feature shipped as linked above, then was removed in [836aabe](https://github.com/nikoskiouris/Dynasty-Ticker/commit/836aabef15100e37fe4daab726bfa9cf6ab7cb2c). Restore with `git show df93556:<path>` using the 045 restore table.
