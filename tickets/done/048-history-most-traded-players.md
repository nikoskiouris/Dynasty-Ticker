# 048 · League History: drop the head-to-head pair list, add "Most traded players" and "Major players traded"

Done: 2026-11-16, [#394](https://github.com/nikoskiouris/Dynasty-Ticker/pull/394)

**Status:** Done · **Priority:** P2 · **Size:** S · **Owner:** Cursor

## Context / owner decision

Niko, Nov 16, 2026, asked for two changes on the Historical Data page (`/l/<id>/history`):

1. Remove the long per-pair list under the head-to-head grid (collapsible rows such as "▶ zim8box vs. LoganHix13 · 3 games (0–3)"). Keep the head-to-head grid itself.
2. Add a simple "Most traded players" section: the league's top 5 players by number of completed trades they moved in.
3. Follow-up, same day: in the same panel, a "Major players traded" list. It shows the star players who have been traded in this league: traded players ranked by today's dynasty value, top 5.

## Change

- `docs/modules/league-rivalries-page.js`: the "Matchup details" heading and the `<details>` pair list are gone. Grid cells are plain records now (they used to link to the removed rows); each keeps its spoken "X versus Y: W wins, L losses, T ties" label. `headToHeadHistory` and `rivalryHighlights` are unchanged; the grid and Rivalries still use them.
- `docs/modules/league-most-traded.js` (new): counts, per player, the completed Sleeper trades (`type: "trade"`, `status: "complete"`) he appears in, from the transactions the history page already loads. A player counts once per trade, whether listed in `adds`, `drops` or both. Trades are de-duplicated by transaction ID. Draft picks and FAAB are not players and do not count. Sort: count descending, then name, top 5. Names come from the price snapshot, then the Sleeper player record. Each name links to `/player/<id>/<slug>`. All Sleeper-derived text is escaped.
- "Major players traded" (same panel, same counting rules): every traded player with a price in the snapshot the app already loads (`docs/data/player_values.json`, 12-team Superflex PPR), sorted by today's value, then times traded, then name. Top 5 rows show the name (linked), the value and "N trades". A player without a price is left out. The value is only read for display and ranking; no price changes.
- Empty states: "No completed trades with players in N loaded seasons." when nothing was traded, and "Trades are not available from Sleeper for these seasons." when no season's transactions loaded.
- `docs/styles.css`: removed the dead `.league-rivalry-detail*` and grid-link rules; added `.league-most-traded` rules using the shared `--line` token.

No player value, ranking or trade-grade logic changed.

## Acceptance (observable)

- On `/l/<id>/history` the head-to-head grid still shows every manager's record; no "▶ A vs. B · N games" rows follow it.
- A "Most traded players" panel lists up to 5 players with rank, a linked name and "N trades"; ties are ordered by name.
- A "Major players traded" list beside it (stacked on phones) shows up to 5 traded players with the highest current value, each with value and "N trades".
- A player link opens that player's page.
- At 390 and 1280 wide the panel fits with no horizontal page overflow.
