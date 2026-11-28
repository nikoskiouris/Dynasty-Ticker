# Week 12 evidence for the next two seasons

Dak Prescott and Caleb Williams had similar prior-season PPR totals (323.78 and 325.18) and 2026 season projections (303.88 and 299.34) on November 28. Their current results differed substantially. Prescott had 270.30 points in 12 appearances and Williams had 155.98 in eight. In the initial board, the blended estimates of sustainable production were 346.49 and 289.03 season points. Williams had the higher age-retention factor, 0.815 versus Prescott's 0.650. The difference in playing time and scoring outweighed the age adjustment.

## Historical check

At the beginning of Week 12 in 2020, 2021 and 2023, estimate player PPR lineup surplus in the *following two complete seasons*. For example, the 2023 forecast is evaluated on 2024 and 2025. Each comparison runs the same positional replacement calculation, age and rank adjustments, early-career draft component, and two-year discount. The only difference is how the input estimate combines the published preseason forecast, prior-season production, and current production through Week 11. Each blend assigns six games of weight to the preseason forecast and adjusts current production for elapsed team games. The first three columns vary the maximum weight for the prior season.

The evaluation includes the preseason top 32 QBs, 48 RBs, 64 WRs and 24 TEs per season. Selection precedes the observed outcomes. All available preseason players enter the replacement calculation. For scoring the outcomes, the best legal superflex lineups use the entire realized player pool. Players who disappear in either future season earn zero for that season. The error measure is mean absolute error in annual full-PPR surplus points, with year two receiving 85% of the weight of year one. Lower values are better. [Preseason archives and identity matching](ranking-holdout.md) · [nflverse weekly and season scoring](https://github.com/nflverse/nflverse-data/releases/tag/stats_player)

| Group | Player-seasons | Prior weight 8 | Prior weight 4 | Prior weight 0 | Preseason alone | Current pace alone |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 504 | 26.8 | 26.8 | 27.0 | 28.7 | 27.7 |
| QBs | 96 | 37.7 | 37.4 | 37.9 | 40.6 | 39.1 |
| QBs aged 26 or younger | 43 | 41.9 | 40.8 | 39.0 | 46.5 | 39.9 |
| QBs aged 31 through 34 | 16 | 27.0 | 27.9 | 30.3 | 26.7 | 33.3 |
| Players pacing at least 35% above the preseason forecast | 58 | 36.4 | 36.4 | 38.1 | 33.3 | 43.2 |

Removing the prior season improved the younger QB group's estimates but worsened estimates for QBs aged 31–34 and players pacing well above projections. The broad sample showed little sensitivity between the three blends. These results support keeping the existing prior-season weight in the future component. The in-season lineup component has a shorter prediction horizon and can react differently.

This is a descriptive comparison across three forecast origins with overlapping outcome seasons and repeat players. The age subgroups are small. The 2020 NFL schedule contained 16 games, whereas the deployed model annualizes current production on a 17-game basis. The high-pace group uses estimated scheduled team games and reflects both playing time and scoring. The study assesses subsequent NFL production. Dynasty market prices also reflect the value managers assign to seasons beyond this two-year sample.

Run `python3 player-values/research/future_blend.py` from the repository root to reproduce the comparison. The command reuses the ranking audit's source cache. Supply `--cache-dir DIR` to select another directory.
