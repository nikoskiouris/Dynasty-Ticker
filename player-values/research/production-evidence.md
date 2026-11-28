# Evidence for the football inputs

The research question was whether recent production, positional aging and rookie draft round can inform the football component of a 12-team superflex PPR price. Season production is measured in full-PPR points per *scheduled team game* (16 before 2021, then 17). This counts missed games and players who leave the league. The outcomes in this study measure NFL production. Completed-trade prices and trade outcomes fall outside its scope.

Run `python player-values/research/production_evidence.py` from the repository root. It downloads four public CSVs into `~/.cache/dynasty-production-evidence/`, prints source hashes and produces all results below. Pass `--cache DIR` to choose a different cache. The study uses regular-season outcomes through 2024. [nflverse seasonal statistics](https://github.com/nflverse/nflverse-data/releases/tag/player_stats) · [Player identities](https://github.com/nflverse/nflverse-data/releases/tag/players) · [NFL draft](https://github.com/nflverse/nflverse-data/releases/tag/draft_picks)

## Next-season error

We selected each season’s top 48 QBs, 72 RBs, 96 WRs and 24 TEs by season PPR points. The selection was made before observing the following season. A player with no follow-up production contributed zero. The first forecast repeated the last season. The second forecast used the historical mean for the player’s position and prior finish tier (four equal-sized tiers per position). The third used players within two years of the same age in that tier, shrunk toward the broader tier with 12 prior observations. Age was measured on September 1. We fitted both cohort forecasts exclusively on outcomes through 2018, then evaluated the 2019–24 outcomes. Smaller mean absolute errors are better.

| Position | Held-out player-seasons | Repeat prior season | Finish tier | Finish tier and age |
| --- | ---: | ---: | ---: | ---: |
| All | 1,440 | 4.111 | 3.778 | 3.705 |
| QB | 288 | 4.884 | 4.736 | 4.686 |
| RB | 432 | 4.277 | 3.745 | 3.701 |
| WR | 576 | 3.788 | 3.517 | 3.414 |
| TE | 144 | 3.355 | 3.001 | 2.918 |

The larger improvement came from allowing last year’s finish to regress toward its historical cohort. Adding age lowered error by another 0.073 PPR points per scheduled game. These are repeated player-seasons, so sampling uncertainty should not be estimated as though each row represented a different player. The exercise excludes players entering the NFL and deep reserves outside the selection thresholds.

## Independent preseason projection check

We compared a FantasyPros statistical forecast archived September 3, 2020 with repeating 2019 production for the same players. Offensive stat projections were re-scored using one point per reception, four per passing TD, six per rushing or receiving TD, 0.04 per passing yard, 0.1 per rushing or receiving yard, and −2 per interception or fumble lost. Two-point conversions were unavailable in the forecast. We matched on normalized name and position against the prior season’s roster. Of 240 eligible incumbents, 223 had a unique projection match. This single-season comparison checks whether preseason forecasts contribute information. It does not measure the accuracy of Sleeper’s current projections. [Archived preseason input and timestamp](https://github.com/fantasydatapros/data/commit/e36e1de3303de41ab92993cf1d764afdeb117407)

| Position | Matched | Repeat prior season MAE | Preseason projection MAE |
| --- | ---: | ---: | ---: |
| All | 223 | 4.126 | 3.364 |
| QB | 45 | 4.564 | 2.799 |
| RB | 67 | 4.291 | 3.928 |
| WR | 87 | 4.020 | 3.436 |
| TE | 24 | 3.224 | 2.588 |

## Future starter production

For the following estimates, we used fixed illustrative starter cutoffs of QB24, RB36, WR48 and TE12. Flexible slots and bench depth can shift the marginal player. We computed positive PPR points above the boundary for each season. For 2000–16 starters, we divided the group’s total surplus one and two years later by its surplus in the original season. Both follow-up seasons end by 2018. These ratios include role changes, missed time and departures, as well as aging. Applying them to future years leaves the current-season forecast intact.

| Position | Age 20–24 | 25–27 | 28–30 | 31–33 | 34+ |
| --- | --- | --- | --- | --- | --- |
| QB | .84 / .79 | .86 / .76 | .81 / .70 | .78 / .63 | .61 / .53 |
| RB | .78 / .68 | .74 / .51 | .49 / .29 | .33 / .14 | .00 / .00 |
| WR | .88 / .83 | .70 / .63 | .74 / .59 | .57 / .40 | .46 / .16 |
| TE | .72 / .75 | .64 / .56 | .59 / .44 | .58 / .41 | .65 / .36 |

The 34+ RB cell contains only one player-season. Older TE cells contain 17 and 10 observations. Adjacent bands need smoothing in production, particularly for RBs and TEs. Age, role security and initial talent are correlated, so these ratios should not be read as causal effects of birthdays. The CLI prints counts for every cell.

## Rookie opportunity

The NFL draft study followed the full 2000–16 classes at the four offensive positions through their first three seasons. Players who never made an appearance contributed zero. One player with reported NFL appearances and no usable identity link was excluded. The table gives mean surplus *per scheduled game* in career years two and three. Each mean includes the many draftees who generated zero surplus. [Independent early-career draft-capital study](https://www.thefantasyfootballers.com/articles/draft-capital-its-correlation-to-early-career-fantasy-production/)

| Position | NFL first round | Second | Third | Fourth or later |
| --- | --- | --- | --- | --- |
| QB | 2.30 / 2.80 | .71 / 1.10 | .70 / .46 | .08 / .17 |
| RB | 3.57 / 4.82 | 2.47 / 1.81 | 1.54 / 1.53 | .27 / .27 |
| WR | 2.21 / 2.67 | 1.05 / 1.58 | .52 / .70 | .18 / .18 |
| TE | .51 / 1.14 | .47 / .27 | .50 / .51 | .03 / .15 |

These estimates can supply a prospect prior for a player with little NFL history. The small cohorts for early-round TEs and QBs and changing NFL usage limit their precision. Undrafted and pre-draft prospects are outside the cohort. None of these results establishes a unique optimal trade-price weight.

As a chronological check, we applied those estimated means to 312 players in the 2019–22 NFL drafts and measured their mean seasons-two-and-three surplus through 2024. Root mean squared error fell from 2.094 for the position-only mean to 1.854 with position and NFL round. QB improved from 3.112 to 2.815, RB from 2.068 to 1.736 and WR from 2.127 to 1.902. TE worsened slightly, from 0.560 to 0.576 across 58 players. This supports giving tight end draft capital less influence and interpreting individual round differences cautiously.

## Future production by current positional rank

A player can finish below the current starting lineup and still win a larger role in a later season. To estimate that upside, we ranked NFL players by position and full-PPR production in each regular season from 2000 through 2016. We scaled 16-game totals to a 17-game equivalent and calculated each season’s positional replacement levels using the 12-team lineup optimizer. For each player, we measured the positive surplus in each of the next two seasons relative to those seasons’ own replacement levels. An absent player contributed zero. The two outcomes were averaged with weights of 1 and 0.85. All outcomes were known by the end of 2018.

| Prior positional finish | QB | RB | WR | TE |
| --- | ---: | ---: | ---: | ---: |
| 1–3 | 115.1 | 108.9 | 111.8 | 58.1 |
| 4–6 | 86.7 | 76.1 | 90.2 | 29.2 |
| 7–12 | 65.0 | 65.5 | 67.0 | 18.9 |
| 13–18 | 48.7 | 40.0 | 52.6 | 8.3 |
| 19–24 | 33.7 | 20.0 | 44.5 | 8.6 |
| 25–30 | 16.4 | 20.8 | 30.3 | 4.9 |
| 31–36 | 8.0 | 17.3 | 31.8 | 2.5 |
| 37–48 | 5.3 | 11.2 | 17.8 | 1.6 |
| 49–64 | 2.6 | 8.5 | 13.4 | 0.9 |
| 65–96 | 3.3 | 3.7 | 8.5 | 0.4 |

The model pools adjacent rank bands where sampling noise reverses their order and interpolates between their centers. Its future production estimate combines 50% individual retained surplus and 50% age-adjusted positional cohort surplus before any rookie adjustment. The equal weights in this internal blend are a modeling choice. The cohort inputs come from completed-season ranks, while values apply them to estimated production ranks, which adds uncertainty.
