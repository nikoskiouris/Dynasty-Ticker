# Acceptance criteria

This folder owns Dynasty Ticker's player-value system.

- There is one published value snapshot: `docs/data/player_values.json`.
- The Players page, calculator, league roster, trade finder, team-impact tools, and Python CLI all read that snapshot.
- Connecting a league cannot change a player's published value.
- TE premium, RB premium, half-PPR/full-PPR switches, star multipliers, crowd-vote shifts, and league-specific overlays do not reprice players.
- Full PPR is the only scoring model.
- Superflex vs 1QB changes QB scarcity. RB/WR/TE player values are identical across those formats.
- Future picks may differ by format because the rookie-QB opportunity set differs.
- Missing players are explicitly unavailable; the app does not invent a position/age fallback price.
- The build uses football data, not another dynasty-ranking provider or an existing fantasy-market price.
- Model inputs, assumptions, validation, data freshness, and known gaps are documented and emitted in the snapshot.
- A failed refresh never overwrites the last valid snapshot.
