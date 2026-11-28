# November 28, 2026 player board

The audited v5.1 board prices 507 players and 24 picks for 12-team, full-PPR superflex dynasty. At 04:07 UTC, six players scored in the 90s and another twelve scored from 87 to just under 90. Gibbs and Smith-Njigba tie at the displayed precision. The audit corrected four prices below the top 20. The previous column shows the v4 prices before the upper score bands were recalibrated. The last column uses KeepTradeCut's superflex, half-PPR, no-TE-premium player ranks from the same date. All ranks exclude draft picks. [Audited snapshot](../../docs/data/price-history/202611280407.json) · [Previous snapshot](../../docs/data/price-history/202611280342.json) · [KeepTradeCut rankings](https://keeptradecut.com/dynasty-rankings?format=2)

| Rank | Player | Pos. | New value | Previous value | Previous rank | KTC rank |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Jahmyr Gibbs | RB | 98.90 | 75.20 | 1 | 1 |
| 2 | Jaxon Smith-Njigba | WR | 98.90 | 75.15 | 2 | 2 |
| 3 | Bijan Robinson | RB | 96.53 | 62.98 | 3 | 5 |
| 4 | Josh Allen | QB | 94.85 | 60.70 | 4 | 3 |
| 5 | Ja'Marr Chase | WR | 93.80 | 59.67 | 5 | 4 |
| 6 | Amon-Ra St. Brown | WR | 90.28 | 56.19 | 6 | 9 |
| 7 | Trevor Lawrence | QB | 89.57 | 53.81 | 7 | 13 |
| 8 | Joe Burrow | QB | 88.69 | 49.50 | 8 | 7 |
| 9 | CeeDee Lamb | WR | 88.54 | 48.74 | 9 | 11 |
| 10 | Puka Nacua | WR | 88.32 | 47.69 | 10 | 16 |
| 11 | Christian McCaffrey | RB | 87.71 | 44.69 | 11 | 43 |
| 12 | Drake Maye | QB | 87.61 | 44.19 | 12 | 17 |
| 13 | James Cook III | RB | 87.54 | 43.85 | 13 | 22 |
| 14 | Kenneth Walker III | RB | 87.51 | 43.72 | 14 | 14 |
| 15 | Patrick Mahomes | QB | 87.35 | 42.89 | 15 | 21 |
| 16 | Brock Purdy | QB | 87.34 | 42.87 | 16 | 10 |
| 17 | Chris Olave | WR | 87.15 | 41.92 | 17 | 36 |
| 18 | Tee Higgins | WR | 87.07 | 41.52 | 18 | 35 |
| 19 | Dak Prescott | QB | 86.47 | 40.94 | 19 | 50 |
| 20 | Trey McBride | TE | 84.39 | 39.96 | 20 | 15 |

## How to read the gaps

- **Amon-Ra St. Brown at 90.28 and Joe Burrow at 88.69** illustrate the two upper bands. With 104 of 272 NFL games still to start, the historical 90 benchmark was 202.05 expected discounted PPR above replacement. St. Brown cleared it at 203.05. Burrow's estimate of 178.89 puts him among the strong early startup picks. The 48th-ranked player scored 58.94, the 100th scored 31.09 and the 240th scored 4.20.
- **Josh Allen for James Cook III and a 2027 first** changed from even to favoring Cook and the pick. The new prices are 94.85 for Allen, 87.54 for Cook and 44.80 for the first. After the calculator's consolidation credit, the two sides are 101.53 and 132.34. Bringing elite and high-80s assets closer together changes what an additional pick can buy.
- **Gibbs for Garrett Wilson and DeVonta Smith** now grades even. The two receivers sum to 112.38 and the calculator gives Gibbs a consolidation credit on top of his 98.90. Combinations of good starters can compete with a single elite asset. The [completed-trade analysis](package-scale.md) measures this behavior on actual exchanges.
- **A change to one player's market quote** does not move the historical reference. Doubling Gibbs's quote with the rest of the inputs fixed left the other 506 players and all 24 picks at their original prices.

## Differences worth watching

Fourteen players appear in both top 20s. Full PPR gives productive receivers more value, the finite horizon emphasizes production through 2028, and the market component draws on FantasyCalc. These choices help explain differences, but a disagreement with the crowd can also expose a weak forecast.

| Player | Model | KTC | What the model sees |
| --- | ---: | ---: | --- |
| Lamar Jackson | 94 | 27 | On IR with 80.08 PPR in five games and no weekly starting forecast across Baltimore's six remaining games. His remaining lineup contribution is zero. The market contribution is 18.40 of his 33.68. A healthy return would change his long-term outlook materially. |
| Christian McCaffrey | 11 | 43 | His 143.1 estimated PPR over seven remaining games contributes 33.04 to his 87.71. The prior year's 416.6 PPR also supports the two-season outlook at age 30. Managers with a rebuilding roster may put less value on this season. |
| Caleb Williams | 29 | 6 | His remaining-season projection is 109.0 PPR. He had played eight games out of 11 for Chicago. Our forward estimate reflects that missed production and puts less weight on seasons beyond 2028 than a longer-horizon dynasty manager might. |
| Jonah Coleman | 86 | 44 | He had scored 89.3 PPR in Denver's last four games. His coming games contribute 15.20 of a 37.91 price. His shorter NFL record supplies limited evidence for sustained future production. |

We also tried counting missed games at half weight in the future estimate for players on IR. In the held-out 2023 group, that raised absolute error from 4.41 to 4.99 PPR above replacement across 73 players. Only eight were quarterbacks. The evidence supported retaining the existing treatment. [IR investigation](utility-scale.md)

No individual rank adjustment was made from the KTC comparison. See the [algorithm and underlying studies](../README.md) for how age, draft capital, current availability and missing evidence enter the price.
