# November 28, 2026 player board

The top 20 use the native 0–100 model for 12-team, full-PPR superflex dynasty at 03:42 UTC. The previous column scores the same observations with v3. KTC ranks are from its superflex, half-PPR, no-TE-premium player board on the same date. All ranks below exclude draft picks. [Native board](../../docs/data/price-history/202611280342.json) · [Previous board](../../docs/data/price-history/202611280329.json) · [KeepTradeCut rankings](https://keeptradecut.com/dynasty-rankings?format=2)

| Rank | Player | Pos. | New value | Previous value | Previous rank | KTC rank |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Jahmyr Gibbs | RB | 75.20 | 100.00 | 1 | 1 |
| 2 | Jaxon Smith-Njigba | WR | 75.15 | 98.64 | 2 | 2 |
| 3 | Bijan Robinson | RB | 62.98 | 78.93 | 4 | 5 |
| 4 | Josh Allen | QB | 60.70 | 80.32 | 3 | 3 |
| 5 | Ja'Marr Chase | WR | 59.67 | 74.87 | 5 | 4 |
| 6 | Amon-Ra St. Brown | WR | 56.19 | 69.69 | 6 | 9 |
| 7 | Trevor Lawrence | QB | 53.81 | 63.33 | 8 | 13 |
| 8 | Joe Burrow | QB | 49.50 | 58.35 | 11 | 7 |
| 9 | CeeDee Lamb | WR | 48.74 | 61.50 | 9 | 11 |
| 10 | Puka Nacua | WR | 47.69 | 63.65 | 7 | 16 |
| 11 | Christian McCaffrey | RB | 44.69 | 46.98 | 23 | 43 |
| 12 | Drake Maye | QB | 44.19 | 59.55 | 10 | 17 |
| 13 | James Cook III | RB | 43.85 | 50.87 | 15 | 22 |
| 14 | Kenneth Walker III | RB | 43.72 | 49.72 | 16 | 14 |
| 15 | Patrick Mahomes | QB | 42.89 | 50.94 | 14 | 21 |
| 16 | Brock Purdy | QB | 42.87 | 51.05 | 13 | 10 |
| 17 | Chris Olave | WR | 41.92 | 48.32 | 19 | 36 |
| 18 | Tee Higgins | WR | 41.52 | 46.65 | 24 | 35 |
| 19 | Dak Prescott | QB | 40.94 | 51.44 | 12 | 50 |
| 20 | Trey McBride | TE | 39.96 | 48.36 | 18 | 15 |

## What the prices change

- **Josh Allen for James Cook III and a 2027 first.** V3 favored Allen by 20% after the calculator's consolidation credit. V4 prices Allen at 60.70, Cook at 43.85 and the unspecified first at 21.21. The credited totals are **66.00 against 65.06**. The calculator grades this even.
- **Jahmyr Gibbs for Bijan Robinson and a 2027 second.** The premium on Gibbs falls from 18% to 11% after the package adjustment. Two backs can swap places relative to other positions because the size and timing of their lineup surplus affect their price.
- **Sensitivity to a single quote.** Doubling Gibbs's external quote with his football evidence and the entire rest of the board fixed raises him from 75.20 to 87.71. Zero of 505 other players and zero of 24 picks move. Under v3, 394 other players and all 24 picks repriced.

## Differences worth watching

Fourteen players appear in both top 20s. Full PPR gives productive receivers more value, the finite horizon emphasizes production through 2028, and the market component draws on FantasyCalc. These choices help explain differences, but a disagreement with the crowd can also expose a weak forecast.

| Player | Model | KTC | What the model sees |
| --- | ---: | ---: | --- |
| Lamar Jackson | 94 | 27 | On IR with 80.08 PPR in five games and no weekly starting forecast across Baltimore's six remaining games. His remaining lineup contribution is zero. The market contribution is 8.72 of his 15.95. A healthy return would change his long-term outlook materially. |
| Christian McCaffrey | 11 | 43 | His 143.1 estimated PPR over seven remaining games contributes 16.84 to his 44.69. The prior year's 416.6 PPR also supports the two-season outlook at age 30. Managers with a rebuilding roster may put less value on this season. |
| Caleb Williams | 29 | 6 | His remaining-season projection is 109.0 PPR. He had played eight games out of 11 for Chicago. Our forward estimate reflects that missed production and puts less weight on seasons beyond 2028 than a longer-horizon dynasty manager might. |
| Jonah Coleman | 86 | 44 | He had scored 89.3 PPR in Denver's last four games. His coming games contribute 7.20 of a 17.95 price. His shorter NFL record supplies limited evidence for sustained future production. |

We also tried counting missed games at half weight in the future estimate for players on IR. In the held-out 2023 group, that raised absolute error from 4.41 to 4.99 PPR above replacement across 73 players. Only eight were quarterbacks. The evidence supported retaining the existing treatment. [IR investigation](utility-scale.md)

No individual rank adjustment was made from the KTC comparison. See the [algorithm and underlying studies](../README.md) for how age, draft capital, current availability and missing evidence enter the price.
