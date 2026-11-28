# How the full board priced subsequent 2026 trades

The forecast time was **August 26, 2026 at 07:58:34 UTC**. The comparison uses the same player pool, scoring rules, independent market quotes and deals for each model. The historical check asks whether the values managers exchanged were closer together under the new price spacing. Managers may rationally accept an unequal exchange.

## What was known on August 26

- A Git snapshot committed August 24 contained position-by-position season stat projections. We computed full PPR from passing, rushing, receiving and turnover stats, including four-point passing TDs. The source's printed fantasy total uses different scoring. [Archived FantasyPros stat lines](https://github.com/mborysiak/Fantasy_Football/tree/04f5ae4b6ad1fd9af06d43c1bd32ae861d933f07/Data/OtherData/FantasyPros_Projections)
- An August 26 archive contained 398 player quotes and 28 pick quotes with a retrieval timestamp and the exact FantasyCalc dynasty, 12-team, two-QB, one-PPR query. The audit pairs them with a player's 2025 NFL results, birth date and NFL draft information. It uses the preseason model entry point and has no 2026 NFL scoring observations. The combined pool contains 513 players. [Archived quotes](https://github.com/perczakp/nfl-hirek/blob/9c3a7d3e753c0c1d241db3125e2154a3c978738c/fantasycalc-values.json) · [nflverse season statistics](https://github.com/nflverse/nflverse-data/releases/tag/stats_player)
- Both the historical v3 implementation and the native v4 received these inputs. The third comparison simply sums the quoted FantasyCalc units. We compared listed prices before any calculator consolidation credit. Each future pick uses the quoted price for its year and round without an assumed early or late slot. [Previous implementation](https://github.com/nikoskiouris/Dynasty-Ticker/tree/cb822a483f1cc421152f94a08c573a562e7d77c0/player-values)

The panel contains public Sleeper leagues verified as 12-team, managed, full-PPR superflex dynasty. It is a network sample. Lineup depth and scoring bonuses can differ across leagues. Select completed two-manager exchanges proposed after the forecast timestamp. Retain a deal only if all three price sources can price every asset. The first window ends at opening kickoff. The extended window includes both NFL Weeks 1 and 2 and uses the same August 26 forecasts throughout. [League panel](market-leagues-2026.txt) · [Sampling and exclusions](market_packages.py)

## Results

The gap is the absolute difference in the two package totals divided by their sum. This definition removes any advantage from quoting the same prices in smaller units. These are the median gaps over completed trades.

| Cutoff | Fully priced | Prior v3 | Native v4 | Unadjusted market quotes |
| --- | ---: | ---: | ---: | ---: |
| Before opening kickoff, all deals | 65 of 66 | 15.0% | 16.2% | 7.5% |
| Before opening kickoff, unequal piece counts | 42 | 14.6% | 13.9% | 7.7% |
| Through Week 2, all deals | 117 of 124 | 16.9% | 16.9% | 9.5% |
| Through Week 2, unequal piece counts | 72 | 17.0% | 16.2% | 9.8% |

Running the same 72 unequal packages through the actual calculator, including its credit for consolidation, produced a median gap of 18.9% under v3 and 16.6% under v4. Under v4 the median signed gap shifted from 2.3% toward the larger package before the credit to 2.0% toward the smaller package after it.

The broader window covered 53 leagues. Seventy of its 72 unequal packages contained picks. On those 72 deals, v4 valued the side with more pieces 2.3% higher at the median, compared with 0.1% for v3 and 7.3% for raw quotes. Football and market data made the side totals modestly closer on unequal packages, while using market quotes alone came closest to the observed exchanges. Weekly news, roster needs and managers' preferences affect accepted offers. The overlapping windows contain many of the same transactions and offer no evidence about rejected offers. The [football-only holdout](utility-scale.md) measures subsequent NFL lineup contribution separately.

Run the following from the repository root. The first command downloads the panel and caches the dated market and trade observations.

```sh
python3 player-values/research/market_packages.py --save-deals /tmp/dynasty-accepted-trades.json
python3 player-values/research/preseason_trade_fit.py /tmp/dynasty-accepted-trades.json
```
