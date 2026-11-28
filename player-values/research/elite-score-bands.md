# Calibrating the 90s and high 80s

The rating uses historical estimates of how much a top player adds to a 12-team superflex PPR lineup. The top of the November 28, 2026 board has six players in the 90s and twelve more from 87.00 through 89.99. The August 26 preseason board had seven and fifteen, respectively. These are the same two-decimal prices that enter the calculator.

## Building the historical reference

We reconstructed 2018 and 2020 preseason and week-13 football forecasts using the inputs available at each cutoff. We ranked the resulting estimates of three-season PPR above replacement. To estimate a representative full-board distribution, we paired each forecast rank with the historical market component for the same startup rank. The result gives football evidence 75% and the startup market reference 25%. This approximation captures the spread of the combined signals. It cannot reproduce an individual historic player's market quote. In particular, real draft ranks and forecast ranks often disagree. [Historical football forecasts and targets](utility-scale.md) · [Historical startup outcomes and market weights](market-reference.md)

For preseason we used the full current-season outlook. For the late-season reference we used the week-13 forecasts. To construct a reference with no regular-season games remaining, we removed the current-season contribution from those same week-13 players and held their future outlooks fixed. This last reference is a scenario using information known at week 13. The median at each reference rank across the two seasons produced the following fixed thresholds in expected, discounted PPR above replacement.

| Remaining share of NFL schedule | 87 points, reference rank 21 | 90 points, reference rank 7 | 95 points, reference rank 3 |
| --- | ---: | ---: | ---: |
| Full season | 185.58 | 241.85 | 282.47 |
| One third | 145.95 | 198.89 | 214.95 |
| None | 117.94 | 151.35 | 164.83 |

The model interpolates between schedule phases. A forecast refresh never sets the thresholds from that day's leaders. The percentage of the schedule remaining matters because an equally talented player has fewer current-season points left to earn in November than in August.

Below 87, the scale is proportional to expected PPR surplus. Between 87, 90 and 95, it interpolates linearly between the corresponding thresholds. Beyond 95, a smooth curve gradually narrows price differences and reaches 100 at 501.36 PPR of expected surplus. That ceiling comes from the median annual mean of the top three *realized* three-season surpluses for 2000–16 starting seasons, normalized to a 17-game equivalent. One hundred remains available for an exceptional forecast. The curve and published values preserve the ordering of distinct estimates up to rounding. [Value model](../dynasty_calibration.py) · [Ceiling calculation](utility_scale.py)

## Where players landed

Counts use prices rounded to two decimals. The 2018, 2020 and 2023 rows combine football and market evidence by matching ranks. The 2026 rows use date-specific football and market inputs matched to individual players. The 2023 season was excluded when fitting the PPR thresholds. These comparisons measure how the prices distribute across the scale. They provide no new validation of NFL prediction accuracy. [August 2026 archive](preseason-trades.md) · [November input sources](../README.md)

| Season and cutoff | Highest | 12th | 48th | 90.00–100 | 87.00–89.99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2018 preseason, development | 97.01 | 88.25 | 55.86 | 7 | 12 |
| 2018 week 13, development | 98.52 | 89.26 | 61.03 | 7 | 16 |
| 2020 preseason, development | 98.70 | 89.00 | 58.29 | 6 | 16 |
| 2020 week 13, development | 97.65 | 88.13 | 61.57 | 6 | 12 |
| 2023 preseason | 97.05 | 89.40 | 57.89 | 11 | 13 |
| 2023 week 13 | 98.77 | 88.56 | 63.96 | 8 | 12 |
| August 26, 2026, preseason | 97.69 | 88.22 | 59.70 | 7 | 15 |
| November 28, 2026, 03:50 UTC | 98.90 | 87.61 | 58.94 | 6 | 12 |

No tested board reached 100. In the November snapshot, the first two players had estimated surpluses only 0.175 PPR apart and both rounded to 98.90. The third player was 96.53. Under an alternative exponential curve the first two would have scored 99.73 and 99.72. The selected curve keeps more space above a strong observed board while permitting genuine ties at the hundredth.

## Trade-offs lower on the board

We also considered keeping prices near their old units through approximately rank 48, then increasing them sharply toward the 87-point threshold. In the November sample that version priced ranks 48, 96 and 240 at 37.67, 21.13 and 2.68. The selected proportional segment prices them at 58.94, 33.06 and 4.20. Multiplying all values under 87 by the same phase-specific rate preserves their ratios to one another. It also gives them more purchasing power relative to a 95-point star than the lower-priced alternative. The accepted-package audit favored the proportional segment. Its gaps were closer to those observed with the previous value scale. [Accepted trade comparisons](package-scale.md)

An 87 is a historically strong asset on this rating curve. It does not mean an 87% success probability. The scoring bands express the requested interpretation of the price. They were selected using only two NFL origins for the phase thresholds. Real boards can have more or fewer players in each band as player merit and forecast uncertainty change.

Reproduce the phase thresholds and board profiles with `python player-values/research/elite_score_bands.py`. Use `--live-input FILE` to include the normalized input saved by `build_trade_values.py --save-inputs FILE`, and `--cache-dir DIR` to reuse downloaded historical sources.
