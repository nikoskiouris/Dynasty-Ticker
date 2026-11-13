# 004 · Buy-low and sell-high targets

Done: 2026-11-12, [#221](https://github.com/nikoskiouris/Dynasty-Ticker/pull/221) (landed as commit [88060d7](https://github.com/nikoskiouris/Dynasty-Ticker/commit/88060d7906df814a09a7e46f066dcf96b19a35a0))

Superseded: 2026-11-13. The owner removed this feature (ticket 045). Restore it from git at df93556; see the 045 restore table.

## Status
Done

## Priority
P0 — starred in the note

## Shipped
#221

## Area
Trades / Teams

## Description
From this league’s rosters, list names to buy low and names to sell high. Each row needs a why that is not “the computer likes this player.”

Buy low: market (desk/Sleeper/KTC) is behind recent usage, situation, or schedule. Owner in this league is someone who might actually move them.

Sell high: market is ahead of usage, age, situation, or a spike that will not last. They are on a roster in this league.

Tie the list to the user’s window (contend vs tank) so a rebuilder is not told to buy a 29-year-old spike.

## Why
“Buy low sell high targets” — called out as something that would set the product apart.

## Current product
Find deals can shop or acquire a name you pick. Trade match pairs holes and surplus. Neither publishes a buy-low / sell-high board. Values are market blends, not “price vs production.”

## Acceptance
- A short buy-low list and sell-high list for this league, with owner + one-line why.
- Lists change with the user’s tank/contend call.
- Empty league / no market data: honest empty state, not filler names.

## Superseded
Owner decision, Nov 13, 2026: features the redesign sketches do not show are deleted for now (ticket [045](045-delete-features-not-in-sketches.md)). This feature shipped as linked above, then was removed in [836aabe](https://github.com/nikoskiouris/Dynasty-Ticker/commit/836aabef15100e37fe4daab726bfa9cf6ab7cb2c). Restore with `git show df93556:<path>` using the 045 restore table.
