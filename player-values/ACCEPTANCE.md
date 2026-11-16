# Acceptance criteria

This folder owns Dynasty Ticker's player-value system.

- There is one published value snapshot: `docs/data/player_values.json`.
- The Players page, calculator, league roster, trade finder, and team-impact tools all read that snapshot.
- Connecting a league cannot change a player's published value.
- TE premium, RB premium, half-PPR/full-PPR switches, star multipliers, crowd-vote shifts, and league-specific overlays do not reprice players.
- Full PPR is the only scoring model, and it counts offensive productivity only. Defensive stats, return scores, and opponent defense do not change a price.
- Only 12-team Superflex PPR dynasty values are published. League settings never select another value set.
- Future picks may differ by format because the rookie-QB opportunity set differs.
- Missing players are explicitly unavailable; the app does not invent a position/age fallback price.
- The build uses football data, not another dynasty-ranking provider or an existing fantasy-market price.
- Model inputs, assumptions, validation, data freshness, and known gaps are documented and emitted in the snapshot.
- A failed refresh never overwrites the last valid snapshot.
- Replacement points per game are above zero for QB, RB, WR, and TE in the Superflex reference league.
- Early firsts are worth at least as much as mid firsts, and mid firsts at least as much as late firsts.
- Inactive or long-gone players are not given a positive price.
- Every price is the sum of the forecast seasons listed beside it.
- A player is priced from his own career. A namesake's record or a wrong upstream id is never used, and a draftee from years ago who never played is not priced as a rookie.
- Age comes from the birthday, not a stale whole number.
- A better season never lowers a price.
- A missed season lowers a price. It does not end the forecast.
- On the day a rookie can first play, he is worth what his pick was.
- A price does not jump when the season turns over, and a new model version is not shown as every player moving.
- The forecast is rebuilt at past kickoffs from earlier games only and must beat "he repeats last season" at one, three, five, and eight seasons. The saved report must be for the model that ships.
