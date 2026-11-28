# Learning exchange prices from completed dynasty trades

The v5.3 board uses trade quotes for 75% of a player's estimate when a football estimate is also available. The calculator applies 12.5% of its bounded consolidation adjustment. We selected those two parameters on accepted trades. The first controls how individual prices track what managers pay. The second affects the totals when a manager trades several pieces for a more valuable asset. It leaves each asset's listed price intact.

## Training sample and dates

We started with the public league IDs from 200 recent KeepTradeCut trade database rows visible on November 28, 2026. Of 169 unique Sleeper IDs, 14 supplied 220 completed exchanges in the study window after league and trade filters. These exchanges were verified through Sleeper's transaction feed. The KTC page identified leagues. Their earlier transactions came directly from Sleeper. The sample favors active leagues that appeared on the recent-trades page. [Collection and source](accepted-player-exchanges.md) · [Fixed league list](ktc-sleeper-leagues-20261128.txt)

We required 12-team managed dynasty with one QB slot, one superflex slot, full PPR, four points per passing TD, zero positional reception bonuses and no starting IDP slots. Each exchange had exactly two trade partners, identifiable assets received on both sides, reciprocal ownership transfers, and zero FAAB. Starter and bench counts could vary. Sleeper transaction IDs were deduplicated. Excluding every league ID in either older research panel left 212 trades in 13 KTC-sourced leagues. We sorted these league IDs by SHA-256 of `ktc-credit-v1` plus the ID, then reserved the first four for the November holdout. Each league stayed entirely on one side of this split. This avoids training directly on the same league's behavior, although different leagues can share managers. [League and exchange filters](market_packages.py) · [Training script](fit_exchange.py)

Training minimized the absolute difference between the two credited totals divided by their sum. We averaged that quantity within each league, then gave each league equal weight. An exchange worth 60 against 40 has a 20% gap on this metric. A verdict displayed to a manager can instead report the 50% difference relative to the lower-valued side. Accepted trades supply observed exchange ratios. They do not record rejected offers, privately expected draft slots or which manager benefited more.

### Market weight

We reconstructed a football and market board using inputs published by August 26, then evaluated proposals made after that origin and completed before September 22 at 06:00 UTC. We held the calculator's previous 25% credit share fixed while varying the market weight on the same assets. The development panel supplied 117 of 124 eligible offers. The KTC training leagues supplied 21 of 22. The 138 priced exchanges came from 61 distinct leagues. Every candidate used the same football estimates, the same normalized quote scale and the same sample. [Preseason inputs and reconstruction](preseason-trades.md)

| Market weight | League-balanced mean gap | Median gap |
| ---: | ---: | ---: |
| 25% | 22.36% | 16.91% |
| 50% | 17.20% | 12.98% |
| **75%** | **14.73%** | **9.99%** |

The 75% setting had the smallest training loss among the three candidate blends. The candidate grid retained a football contribution. This experiment measures prices on exchanges and cannot establish that the same weight best forecasts production.

### Consolidation credit

Next we compared five credit shares on unequal packages proposed and completed from September 22 at 06:00 UTC through October 31 in the nine KTC training leagues. Archived FantasyCalc quotes had to be available before a proposal and at most seven days old. Of 30 eligible offers, 27 had prices for every piece. A late-season football board for those dates was unavailable, so this stage used the market component. It prices a future pick by its observed draft year and round.

| Credit share | Training mean gap, leagues equally weighted |
| ---: | ---: |
| 0% | 11.18% |
| **12.5%** | **10.95%** |
| 25% | 11.12% |
| 37.5% | 11.77% |
| 50% | 12.70% |

We then scored **14 November unequal packages in the four reserved leagues**. With no credit the league-balanced mean was 18.45%, with the previous 25% share it was 18.53%, and with the fitted 12.5% share it was 18.43%. The median gap moved from 16.06% at the previous share to 16.25% at the fitted share. The fitted 75th percentile was 27.18%. The holdout distinguishes typical trade variation from a precise fair price. It offers little precision about the best share. We fit one parameter across package types.

## Player-for-pick and elite-player packages

The previously published independent Sleeper panel allows a separate comparison of v5.2 with v5.3. The August replay uses both football and market inputs in a frozen board. The later replay uses time-matched archived **market quotes only**. Each model uses its own pricing method and package adjustment. The table gives the **median absolute gap** for the same fully priced exchanges. Each group's observations can also appear in a larger group. [Panel and timing](market-packages.md#independent-late-season-replay) · [Replay](pick_packages.py)

| Independent panel | Deals | Old credited gap | New listed gap | New credited gap | Raw quotes |
| --- | ---: | ---: | ---: | ---: | ---: |
| August board through Week 2, all | 31 of 32 | 13.0% | 9.3% | 9.5% | 11.2% |
| August board, one player for picks | 8 | 27.2% | 7.3% | 7.3% | 8.4% |
| Weeks 3–12, all | 182 of 188 | 15.6% | 8.9% | 8.3% | 8.9% |
| Weeks 3–12, players only | 37 | 15.6% | 9.2% | 9.7% | 9.2% |
| Weeks 3–12, one player for picks | 44 | 17.6% | 9.8% | 8.4% | 9.8% |
| Weeks 3–12, one player for multiple picks | 14 | 22.5% | 8.6% | 7.1% | 8.6% |
| Weeks 3–12, unequal packages including a top-12 player | 12 | 9.1% | 4.3% | 5.1% | 4.3% |
| Weeks 3–12, top-12 player alone for players plus picks | 3 | 3.5% | 2.3% | 1.9% | 2.3% |

All eight August player-for-picks deals involved a single pick. The later independent group had one player-for-exactly-two-seconds trade, Mike Evans for 2028 and 2029 seconds. The old model favored Evans by 16.9% of the combined total and the new market-only replay favored the picks by 17.3%. Across five such deals in the larger discovery panel, the median absolute gap increased from 8.6% to 20.3%. The broader multipick result and a particular two-second exchange can differ substantially. [Evans transaction 1414115321823928320](https://api.sleeper.app/v1/league/1312282839038857216/transactions/5) · [Williams and Gibbs comparables](accepted-player-exchanges.md)

Elite groups use the player quote rank immediately before the proposal. An alternative candidate used the same 75% market blend with the 17–30, 4–8 and 1–3 rank bands priced at 87, 90 and 95 points. On the 12 later unequal independent deals including a top-12 player, that compressed scale gave an 11.0% median credited gap against 5.1% with the proportional scale, with credit held at 12.5% in both. The independent panel held zero top-three uneven packages. The later development panel contained three top-three players traded alone for a mix of players and picks. Their credited median went from 7.0% on v5.2 to 4.4% on v5.3. For all 20 deals of that shape involving a top-12 player, it went from 7.3% to 5.1%. These offers inform elite package spacing. They cannot establish the price of a specific Gibbs trade.

The existing panels were previously examined during development of earlier models. They give a chronological price replay with different league IDs from the new KTC credit training set. A prospective test on untouched future proposals would provide stronger evidence. FantasyCalc's inputs can overlap these manager networks. The archived quote and commit had to precede the offer to prevent any tested transaction from setting its own price.

## Reproduction

Run from the repository root with Python 3.10+, Node.js, Git history containing the baseline releases, and network access. The first command fetches the fixed KTC league panel, the earlier discovery panel and the dated research inputs. It prints train and holdout metrics and the two selected parameters. The later commands reproduce the separate panel replay. To examine all discovery subgroups, omit `--independent-panel` from the export command and use a separate export path.

```sh
python3 player-values/research/fit_exchange.py
python3 player-values/research/market_packages.py --independent-panel --later-packages --save-deals /tmp/dynasty-independent.json
python3 player-values/research/pick_packages.py /tmp/dynasty-independent.json
python3 player-values/research/pick_packages.py /tmp/dynasty-independent.json --late-market
```
