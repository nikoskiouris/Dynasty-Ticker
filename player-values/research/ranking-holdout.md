# Historical ranking audit

Run the [audit CLI](ranking_holdout.py) from the repository root with Python 3.10 or later. It downloads the pinned preseason snapshots and player ID crosswalk plus the nflverse regular-season outcome files. Downloads are cached locally for reuse. Each row reports hits, surplus captured, Spearman correlation and position counts.

```sh
python3 player-values/research/ranking_holdout.py
```

Pass `--cache-dir PATH` to use an alternate download directory.

**Question.** Could the football component of the new dynasty board identify players who would deliver the most extra full-PPR starting-lineup points over two seasons? Run the production `dynasty_value.value_board` function with `season_week=1`, an empty pick dictionary and three forecast origins. Each projection file was committed before that season's opening game. The NFL outcomes used to derive the age and prospect priors end before these forecasts.

| Origin | Archived forecast | Eligible players with a positive projection | GSIS IDs matched |
| --- | --- | ---: | ---: |
| August 31, 2021 | [ESPN preseason stat lines](https://github.com/xitij/espn-projection-scraper/tree/53ab555546889571c8e7395e1f484c8310605f9e/src/projections/2021) | 432 | 432 |
| September 1, 2023 | [FantasyPros preseason stat lines](https://github.com/Saurabh1975/ffb-streamlit/blob/1bb6d3f9f579c350de2afff862921b755d2c442b/Data/fpros_projections.csv) | 594 | 591 |
| August 21, 2024 | [ESPN preseason stat lines](https://github.com/xitij/espn-projection-scraper/tree/c8082cd1424fb6cd5eaf0cb11c65b85942981e79/src/projections/2024) | 503 | 503 |

**Inputs.** Select ESPN's season forecast row (`statSourceId=1`, regular-season aggregate period 0) for the archive year. Score projected pass/rush/receiving yards at 0.04/0.10/0.10, TDs at 4/6/6, interceptions and lost fumbles at −2, and receptions at 1. Add two points per projected conversion when the source supplies it. The 2023 file omits conversions. Keep positive forecasts at QB/RB/WR/TE. For duplicate 2023 rows with the same identity, keep the larger forecast. The board gets each player's prior *completed* season PPR and games, age on September 1 and known NFL draft year/round/pick. Match ESPN IDs or unambiguous normalized names to GSIS IDs. Use the modern crosswalk only for identity and fixed biographical facts. Leave current-year NFL results empty. The three unresolved names remain in the 2023 input board with unknown outcomes treated as zero. Their preseason projections were all under 12 points. [ESPN stat IDs](https://github.com/cwendt94/espn-api/blob/master/espn_api/football/constant.py) · [Player ID crosswalk](https://github.com/dynastyprocess/data/blob/master/files/db_playerids.csv)

**Target.** For each of the next two NFL seasons, take every eligible regular-season player in nflverse, including later rookies absent from the forecast. Allocate the best 108 starters under the board's 12-team lineup. For each selected player, remove the player and fill all slots again. The decrease in total PPR is the player's realized marginal contribution. Unselected players receive zero. Sum the first season's marginal contribution plus 0.85 times the second season's. The 2023 and 2024 windows share the 2024 outcome year, so the three windows are dependent. [nflverse regular season player totals](https://github.com/nflverse/nflverse-data/releases/tag/stats_player) · [League allocation and worked example](format-design.md)

**Comparisons.** Rank the same preseason player pool by prior-season total PPR, raw preseason projected PPR, or projected single-season marginal contribution. The latter re-solves the lineup after removing a player using projected points. The dynasty board is sorted by the integer prices from the production function. For each method, count how many of the actual top 48 appear in its predicted top 48. Calculate surplus captured as their aggregate realized two-season contribution divided by the best possible top 48. Compute Spearman rank correlation on the 150 players with the highest preseason projected PPR, using average ranks for ties and zero for unpriced players. Restricting correlation to that group reduces the influence of agreement about low-opportunity reserves. A useful dynasty ranking should distinguish the players likely to matter to a manager.

The archived projection pool covered 48, 46 and 48 of the actual top 48 respectively. It covered 137/148, 139/151 and 135/147 of all players with positive two-season contribution. Keep the entire realized league in the target and count future breakouts missed by the input board as misses.

**Scope.** A complete pre-kickoff FantasyCalc market board verified for twelve teams, superflex, full PPR and dynasty was unavailable for these origins. Market quotes were missing for every row. Thus the audit tests the actual football-only valuation path, employs alternative projections to historical Sleeper snapshots, and has no pick-price or accepted-trade target. Two seasons of lineup contribution capture only part of the horizon a dynasty manager buys.

## Original November 28 board

Each cell gives the top-48 hit count, followed by the percentage of ideal top-48 surplus captured. Mean correlation weights each origin equally.

| Ranking | 2021–22 | 2023–24 | 2024–25 | Total hits of 144 | Mean Spearman |
| --- | ---: | ---: | ---: | ---: | ---: |
| New model, football inputs | 30 / 76.3% | 26 / 76.0% | 25 / 70.5% | 81 | 0.570 |
| Raw preseason projection | 30 / 80.0% | 28 / 75.6% | 32 / 78.7% | 90 | 0.581 |
| Single-season projected marginal points | 30 / 78.5% | 24 / 70.4% | 24 / 69.5% | 78 | 0.537 |
| Prior-season total PPR | 26 / 65.9% | 24 / 70.2% | 25 / 67.8% | 75 | 0.366 |

The new model captured 74.3% of attainable two-year surplus on average and produced 390, 455 and 417 positive prices respectively. Raw preseason projections captured 78.1%. Across the three top-48 lists, the new model selected 35 QBs and 57 WRs. The realized totals were 49 QBs and 47 WRs. Raw preseason PPR selected 70 QBs. This directional error is particularly large in 2024, when the model selected 11 QBs against 19 in the realized group.

An earlier development run with provisional age assumptions produced 82 hits. The reported run incorporates cohorts estimated from earlier NFL seasons. These same audit seasons were observed during development and rerun, so a new season would provide a stronger prospective check. This result supports using more information than prior-year production, while raw preseason projections remain the strongest aggregate benchmark in this sample.

## Additional origin evaluated after the model was frozen

On September 3, 2020, a FantasyPros archive recorded a preseason board with 598 distinct eligible positive forecasts. Using the same scoring and matching procedure as 2023, 596 linked to GSIS IDs, and the model priced 431. The input pool contained 46 of the eventual top 48 players and 136 of the 151 players with positive two-year surplus. The two unresolved players each projected below 12 PPR points. The 2020 regular season lasted 16 games, which also limits direct comparison to the predominantly 17-game years. [2020 forecast archive](https://github.com/fantasydatapros/data/blob/e36e1de3303de41ab92993cf1d764afdeb117407/fantasypros/fp_projections.csv)

| Ranking | Top-48 hits | Two-year surplus captured | Rank correlation within preseason top 150 |
| --- | ---: | ---: | ---: |
| New model, football inputs | 27 | 67.8% | 0.506 |
| Raw preseason projection | 26 | 71.7% | 0.527 |
| Single-season projected marginal points | 26 | 63.8% | 0.454 |
| Prior-season total PPR | 26 | 65.4% | 0.395 |

This final comparison used the frozen model before any end-to-end results from the 2020 origin had been calculated. The source's single-season projection accuracy had already been examined, and the 2020–21 and 2021–22 outcome windows share 2021. The new model found one more top-48 player than each comparator. Raw projected points still captured more total surplus. Across all four origins, the new board identified 108 of 192 top-48 entries, compared with 116 for raw preseason projections, 104 for preseason projected marginal points and 101 for prior-season PPR. The model selected 45 QBs across these groups against 65 realized, while raw projections selected 94.


## Recheck after the in-season and QB age revisions

At the preseason cutoff, every regular-season game remains available. The corrected lineup forecast therefore uses the original preseason production estimate. The QB retention revision also applies at this cutoff. Running the same CLI on the revised model gave the following results.

| Forecast origin | Top-48 hits | Two-year surplus captured | Rank correlation in preseason top 150 |
| --- | ---: | ---: | ---: |
| 2020 | 26 | 64.4% | .502 |
| 2021 | 30 | 76.3% | .600 |
| 2023 | 26 | 76.0% | .555 |
| 2024 | 25 | 70.5% | .552 |

The revised board identified 107 of 192 top-48 entries. The original found 108 and raw preseason PPR found 116. In the 2020 top 48, Odell Beckham Jr. displaced Aaron Rodgers after the late-career QB adjustment. That lowered the share of realized two-season surplus captured from 67.8% to 64.4%. This is a repeat of the same audit. The [in-season study](inseason-forecast.md) evaluates the new remaining-season estimator at its actual decision point.
