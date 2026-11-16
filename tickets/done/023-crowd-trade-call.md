# 023 · Crowd call: other managers drag one slider to say who a trade favors

Done: 2026-11-12, [#282](https://github.com/nikoskiouris/Dynasty-Ticker/pull/282) (landed as commit [2a97de5](https://github.com/nikoskiouris/Dynasty-Ticker/commit/2a97de5732d85c0c77a4a8a22b40969a1d76de38))

Superseded: 2026-11-13. The owner removed this feature (ticket 045). Restore it from git at df93556; see the 045 restore table.

## Status
Done

## Shipped
#282

## Priority
P1

## Area
`docs/modules/trade-poll.js`, `netlify/lib/trade-poll.js`, `netlify/functions/trade-poll.js`, `docs/app.js`, `docs/styles.css`, `netlify.toml`

## Description
Owner request (Nov 9, 2026): managers go to Reddit to ask "who wins this trade?". Let them ask here instead. Any complete trade (a shared /t/<code> link or the trade being built) shows a "Crowd call" panel. Voters drag one slider with nine stops, outside in from each team: Veto, Clear winner, Unfair but OK, Slight edge, and Even in the middle.

## Why
AGENTS.md: the market price, team fit, and why the other manager says yes stay separate questions. Crowd opinion is a fourth, labeled one. It sits under the market verdict and never changes a price (one price; evidence is not proof).

## Acceptance
- A recipient of /t/<code> drags the slider, reads the stop in words ("Clear winner · Gets Jahmyr Gibbs +1"), votes, then sees the split, the middle vote, and their own vote.
- Before voting only the vote count shows, so the split does not anchor the vote.
- Under five votes the panel says it is too few to call. A crowd split across the middle reads Even.
- Same assets and format are one poll, whatever order, price date, or which side shared it. Mirrored links read the votes from their own chair.
- A voter can change their vote; it still counts once. One network address adds at most three voters to one trade.
- Reloading keeps "Your vote". Building or editing a trade keeps the draft; the poll follows the trade on screen.
- Works at 390, 820 and 1280 wide with no sideways scroll. The slider works by touch, mouse, and arrow keys, and reads its stop to screen readers.
- No price module reads poll data.

## Leftover
- Votes are stored per trade in Netlify Blobs ("trade-polls") and need VISIT_SALT; without it the panel says crowd votes are unavailable.
- Not built: a public feed of trades asking for votes (the Reddit-style front page), comments, or voter reputation.

## Superseded
Owner decision, Nov 13, 2026: features the redesign sketches do not show are deleted for now (ticket [045](045-delete-features-not-in-sketches.md)). This feature shipped as linked above, then was removed in [d02415e](https://github.com/nikoskiouris/Dynasty-Ticker/commit/d02415e70225897fe63648cd3c5754405a153571). Restore with `git show df93556:<path>` using the 045 restore table.
