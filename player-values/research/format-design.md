# Valuing a player in 12-team superflex PPR dynasty

The unit of football value is the extra PPR production a player makes available to a starting lineup. For this board, assume 12 teams each start 1 QB, 2 RBs, 3 WRs, 1 TE, 1 ordinary flex and 1 superflex. The three WRs and ordinary flex are design assumptions. An extra reception earns one point at any eligible position. Use Sleeper's supplied full-PPR forecast directly when available. Standard scoring commonly assigns four points per passing TD, six per rushing or receiving TD, and one per 25 passing or 10 rushing/receiving yards. [Sleeper scoring guide](https://sleeper.com/blog/how-fantasy-football-scoring-systems-work/)

## Research and implementation plan

1. **Translate projected points into lineup points.** Bryant's value-based drafting ties a player's worth to what the league can get in his place. Baseline choice depends on scoring and roster demand. Calculate starting-lineup value on the entire eligible player pool. Fill the 84 fixed slots, then the 12 RB/WR/TE flex slots, then the 12 QB/RB/WR/TE superflex slots in descending projected points. This order works because each later flexible slot accepts a superset of the earlier flexible slot's positions. [Bryant, Principles of Value-Based Drafting](https://www.footballguys.com/article/2019-value-based-drafting) · [Sleeper roster eligibility](https://support.sleeper.com/en/articles/4172355-how-can-i-add-additional-roster-positions)
2. **Measure the cost of losing the player.** Compare the best league-wide starting total with and without the player, allowing everyone else to move between eligible slots. This gives a common unit across positions and lets a receiver replace a quarterback at superflex. It measures starter advantage. The cost of actually acquiring a backup on waivers also depends on roster depth and managers' choices. Petersen defines bench-player replacement and next-player drop-off as distinct quantities. Becker and Sun demonstrate the importance of evaluating fantasy decisions against feasible lineups. [Petersen, Player Evaluation](https://isaactpetersen.github.io/Fantasy-Football-Analytics-Textbook/player-evaluation.html) · [Becker and Sun, Journal of Quantitative Analysis in Sports](https://doi.org/10.1515/jqas-2013-0009)
3. **Add a dynasty horizon.** A season forecast alone cannot distinguish two equally productive players with different future prospects. Estimate the portion of a player's production that carries into later seasons and discount those seasons explicitly. Keep the score attributable to its inputs. Use chronological data to assess any proposed weights. The scoring rules and the lineup mathematics establish neither the forecast weights nor a dynasty discount rate.
4. **Verify scarcity before judging rankings.** Compare projected lineup behavior to historical ranges, check the effect of removing a real starter, and inspect sensitivity to individual factors. Evaluate ranking accuracy or trade fit on outcomes dated after the information used to make each estimate. The historical exercise below calibrates the size and direction of lineup effects. It uses actual season totals and cannot establish predictive accuracy or fair trade prices.

## Historical lineup check

For each 2020–2025 season, take all regular-season QB, RB, WR and TE rows from the nflverse season-level player file, sort by total `fantasy_points_ppr`, then apply the slot allocation above. The table shows the number of QBs in the optimal 108-player pool and the largest unselected total by position. These columns describe the remaining player pool. Flexible-slot reassignment can produce a different effective replacement. [nflverse season summary CSVs, stats_player_reg_YEAR.csv](https://github.com/nflverse/nflverse-data/releases/tag/stats_player)

| Season | Starting QBs | QB points | RB points | WR points | TE points |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2020 | 24 | 173.72 | 158.10 | 161.20 | 145.30 |
| 2021 | 24 | 180.92 | 148.60 | 150.24 | 151.70 |
| 2022 | 24 | 164.78 | 158.50 | 156.00 | 139.50 |
| 2023 | 22 | 156.38 | 156.40 | 157.20 | 137.30 |
| 2024 | 24 | 163.36 | 157.90 | 155.60 | 141.50 |
| 2025 | 24 | 160.70 | 145.40 | 138.80 | 131.40 |
| Median | 24 | 164.07 | 157.15 | 155.80 | 140.50 |

In 2023, Gabe Davis and Rashid Shaheed filled the final two superflex spots. Removing Josh Allen's 392.64 points and rebuilding the lineup lowered the best total from 25,183.20 to 24,947.76, a loss of 235.44 points. The best legal substitute added 157.20 points through a WR. Subtracting the next available QB's 156.38 would overstate Allen's contribution by 0.82. This also supplies a reproducible hand-check for the scoring engine. [2023 season data](https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_2023.csv)

Changing the assumptions changes the baseline. In the same six seasons, a two-WR, single-flex setup started 21–24 QBs and left a median 170.85 points at WR. A three-WR, two-flex setup started 24 QBs every year and left a median 140.20 points at WR. The shipped board uses the single specified format. Season totals absorb injuries, missed games and different season lengths. A weekly managed league can substitute on a bye or injury, so these totals represent a season-level reference for the model.
