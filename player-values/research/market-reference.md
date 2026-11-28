# How a trade quote becomes expected lineup points

This study documents the production-based market conversion through v5.2. V5.3 retains the source quote bands and prices them on an exchange scale. [Current method and evidence](pick-packages.md)

The earlier chart used a fixed conversion from a quote to the achieved production of historically comparable startup picks. Players with football and market evidence receive 75% calibrated football surplus and 25% market-implied surplus. Players with one source use the available estimate. A pick with a direct quote uses the same conversion as the market component of a player. Missing pick quotes leave the pick unpriced.

## Source observations

The quote archive committed on May 29, 2026 contains 398 NFL player quotes under the provider’s dynasty, two-QB, 12-team, full-PPR settings. Two-QB pricing approximates the market for this site’s superflex league. We sorted those player quotes and recorded the median in each of eleven startup-rank bands. For example, players ranked 31–48 had a median quote of 4,205.5. This reference stays fixed between daily refreshes. The archive establishes when the quotes were available. It does not identify the timestamp of each underlying trade. [Archived quotes](https://github.com/stranger9977/dynasty-dashboard/blob/2f6d6516c98c87f6e301b88bac5720d1ecb12b2f/data/seed/fantasycalc.parquet) · [Archived request settings](https://github.com/stranger9977/dynasty-dashboard/blob/2f6d6516c98c87f6e301b88bac5720d1ecb12b2f/ingestion/fantasycalc.py)

We used public Sleeper startup draft lists for June through August of 2019 and 2020. We verified completed drafts in leagues with 12 teams, one QB, one superflex, full PPR, no extra positional reception bonus, four-point passing TDs and standard passing, rushing and receiving yardage points. The underlying leagues varied in flex and bench depth. We used regular non-auction startups that included rookies, selected at least 180 eligible offensive players and were marked as ordinary lineup leagues in the draft lists. We retained 40 drafts from 2019 and 25 from 2020. The source script identifies the public sheet for each year. [Startup draft lists](https://gist.github.com/Adeiko/8beaebfd10c71eb5658a3c2b878e0b74) · [Sleeper draft API](https://docs.sleeper.com/#drafts)

For each draft, we grouped picked NFL players by their offensive selection number. We linked player IDs to nflverse and measured actual lineup PPR above replacement over the next three regular seasons. We normalized the 16-game seasons to 17 games. Players who did not score surplus received zero in that season. There were 20,098 selection observations, including 24 unresolved player IDs assigned zero. These counts include the same player in multiple drafts. Outcomes were averaged within each draft and rank band, then within each year, then equally across the two years. Only 21 and 11 drafts respectively reached the last rank band. The sample has two distinct NFL starting seasons. [Player crosswalk](https://github.com/dynastyprocess/data/blob/d78f87cf9f6923f1654205ba93079835c01b7023/files/db_playerids.csv) · [NFL outcomes](https://github.com/nflverse/nflverse-data/releases/tag/stats_player)

## Price calculation

For each quote we linearly interpolate the current and future parts of the historical outcome. At 4,205.5, the historical first-season surplus was 59.82 PPR and the next two seasons contributed a combined 83.63 PPR after discounting. At the start of the season that quote represents 143.45 estimated PPR surplus. With 104 of 272 league games still unstarted, it represents 106.50. Only the first-season portion shrinks. The adjacent rank 9–16 and 17–30 future estimates are pooled in proportion to band width where sample noise reversed their order. The curve starts at zero and extends proportionally above its highest quote anchor.

The accepted-trade audit measures how this conversion changes package spacing. A chart that better estimates football utility can still differ from what managers paid. [Utility calibration](utility-scale.md) · [Market conversion on subsequent accepted trades](market-packages.md)

Reproduce the quote and outcome knots with the command below. DuckDB reads the archived Parquet source only for this research. The daily valuation model uses the Python standard library. Alternatively, pass `--quotes-csv FILE` with the source’s `fc_value` and `position` columns.

```sh
python3 player-values/research/market_calibration.py
```
