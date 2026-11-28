# Market conversion and accepted trades in 2026

The first study checks the v4 conversion of external quotes into expected lineup production. The conversion was fitted using historical startup picks, their subsequent production, and a May 2026 quote board. The following transactions occurred after that calibration sample. Each side is valued using only the market component. A second study below measures how v5 changes the calculator's package totals later in the season. A separate preseason comparison evaluates the combined football and market model. [Full preseason comparison](preseason-trades.md)

| Sample | Priced trades | Median absolute gap, raw quotes | Median absolute gap, converted | Median bias toward more pieces, raw | Median bias toward more pieces, converted |
| --- | ---: | ---: | ---: | ---: | ---: |
| All | 855 | 9.2% | 11.7% | — | — |
| Unequal numbers of pieces | 479 | 9.8% | 10.3% | +9.1% | +0.5% |
| Unequal, players only | 51 | 9.7% | 13.9% | +8.5% | +2.8% |
| Two for one | 208 | 11.1% | 14.6% | +9.3% | −1.2% |

For each completed trade, absolute gap is the absolute difference between the two listed totals divided by their sum. Signed bias uses the same denominator and subtracts the smaller package's total from the total on the side receiving more assets. Positive bias means the side with more pieces carried more estimated value. Converting quotes brought the median signed gap closer to zero in each package group, while increasing the median absolute gap. Individual deals differed in both directions. The calculation uses the sum of asset prices before any calculator package credit.

For example, the first covered two-for-one involving players only was Jacoby Brissett and Chuba Hubbard for Travis Etienne on August 20. Their pre-trade external quotes summed to 3,200 on the two-player side against 2,799 for Etienne. The calibrated market-only prices summed to 16.72 against 27.78, reversing the advantage. This is a single example of how the nonlinear conversion changes package spacing. [Original league transaction feed, transaction 1396211989520351232](https://api.sleeper.app/v1/league/1389361967482802176/transactions/1)

## Sampling and provenance

The discovery seeds were seven leagues listed in an external public repository. We enumerated the seed leagues' public managers and their 2026 leagues, then repeated that step once from the 28 first-pass leagues with eligible scoring and roster slots. The two passes yielded 3,636 unique league IDs and 123 candidates with 12 teams, dynasty settings, one QB, one superflex, one point per reception, four per passing TD, no position-specific reception bonuses and no starting IDP slots. Membership in the fixed candidate list was determined before evaluating package prices. The analysis rechecks each league's own metadata and excludes best ball, leaving 111 managed leagues. Other lineup slots, yardage bonuses and roster rules vary. This connected sample reflects active managers and surviving leagues. [Published seed IDs](https://github.com/dereksdatuh/DynastyLeagues/blob/b65aaaa9c5e918511d6fb2e7d66d0a2bacc9d85e/data/leagues.json) · [Fixed candidate IDs](market-leagues-2026.txt) · [Sleeper API](https://docs.sleeper.com/)

The study includes transactions created at or after August 18 at 08:00 UTC and completed before November 28 at 00:00 UTC. Periods 0 through 12 are deduplicated by transaction ID. Every deal must be completed, have two trade partners, contain at least one asset on each side and directly transfer each player or pick between those partners. Trades involving FAAB are excluded. Random future picks are represented by year and round. The 902 eligible transactions came from 106 leagues. Of those, 855 had positive quotes for every piece on both sides.

Every reference price came from an archived 12-team, two-QB, full-PPR dynasty FantasyCalc response. We chose the last snapshot for which both the external retrieval timestamp and the Git commit timestamp precede the transaction creation time. A snapshot could be at most seven days old. The source stores a generic quote for a pick's year and round, and we use that quote without inferring its eventual slot. For the conversion, the current-season horizon is a full season before Week 1, then approximated by the fraction of NFL weeks still unplayed at the start of that transaction period. The transactions give us accepted exchange ratios. They contain no rejected offers, and unknown future draft slots or a manager's time horizon can explain some price differences. [Pinned quote archive](https://github.com/perczakp/nfl-hirek/blob/7fc7ef55133fb57de3cfabf0954b9999b56b68d1/fantasycalc-values.json) · [Archive collection settings](https://github.com/perczakp/nfl-hirek/blob/7fc7ef55133fb57de3cfabf0954b9999b56b68d1/scripts/update-fantasycalc.js)

Run `python3 player-values/research/market_packages.py --save-deals /tmp/dynasty-2026-deals.json` from the repository root. The [study CLI](market_packages.py) stores source downloads in a local cache. The optional export contains the complete eligible set before applying quote coverage, including public IDs, dates and the assets on each side. It can be reused for evaluations with other strictly pre-trade price boards.

## V5 package prices after Week 2

We evaluated 705 completed trades from 105 leagues with proposals from September 22 at 06:00 UTC through November 27. These offers follow the preseason study window. We compared candidate scale shapes on this panel when selecting v5, so it serves as retrospective sensitivity evidence. For each archived quote, both versions received the same market-derived PPR estimate. The remaining-season fraction uses the number of NFL weeks left at the start of the quote's week, with Tuesday 06:00 UTC week boundaries. We ran each release's JavaScript calculator using its own highest player price on the full quote board. All results below include the calculator's credit for consolidation. The top-six and top-12 groups use the pre-proposal FantasyCalc player ranks on the same archived day. [Preseason study window](package-scale.md) · [Quote archive](https://github.com/perczakp/nfl-hirek/blob/7fc7ef55133fb57de3cfabf0954b9999b56b68d1/fantasycalc-values.json)

| Group | Trades | Leagues | Median absolute gap, v4 / v5 | Median signed gap toward larger package, v4 / v5 |
| --- | ---: | ---: | ---: | ---: |
| All | 705 | 105 | 11.7% / 11.9% | — |
| Unequal piece counts | 386 | 99 | 9.9% / 10.1% | −3.4% / −3.4% |
| One for three or more | 83 | 50 | 7.7% / 7.5% | −2.7% / −1.8% |
| Unequal, players only | 44 | 31 | 12.7% / 11.5% | −0.5% / −0.6% |
| Unequal, includes a top-six player | 25 | 22 | 6.4% / 7.6% | +0.3% / +5.7% |
| Unequal, includes a top-12 player | 52 | 37 | 7.0% / 7.3% | +1.4% / +5.7% |

The typical gap on unequal packages changed by 0.2 percentage points. In trades involving highly valued players, the larger package gained value relative to the concentrated side. Only one top-six trade and six top-12 trades contained players alone. Pick slots, roster needs and player projections during this period could materially affect those exchanges. The November 28 full board illustrates the tradeoff. Garrett Wilson (55.98) plus DeVonta Smith (56.40) totaled 112.38 against Jahmyr Gibbs (98.90) plus 14.00 in consolidation credit. The generic second- and third-round picks from all three future years combined totaled 43.29. Gibbs retained a substantial advantage in that offer. These are live-board examples. They were excluded from the historical observations. [November 28 player and pick prices](../../docs/data/price-history/202611280356.json)

Reproduce the historical table with `python3 player-values/research/market_packages.py --later-packages`. Use `--cache-dir DIR` to reuse source downloads. This command uses Python, Node.js and the Git history containing the v4 release. [Study CLI](market_packages.py)

## Independent late-season replay

The separate 34-league panel was selected before inspecting these offers. Its existing full-model study used proposals through September 22 at 06:00 UTC. We extended collection through November 27 and reserved proposals from September 22 at 06:00 UTC onward for this check. Of 188 later eligible deals, 182 from 29 leagues had a positive dated quote for every asset. Each quote was archived before the proposal and at most seven days old. Each pick received its generic year-and-round quote. The later replay applies the current model's market conversion and the production calculator on the full quote board. Historical weekly projection inputs for the combined model were unavailable for this comparison. [League selection](package-scale.md) · [Public league IDs](market-leagues-independent-2026.txt) · [Pinned quote archive](https://github.com/perczakp/nfl-hirek/blob/7fc7ef55133fb57de3cfabf0954b9999b56b68d1/fantasycalc-values.json)

The table gives median absolute gaps as a share of both sides' combined total. For comparison, we also reran the combined model with the August 26 football and market inputs on the earlier offers. The two windows use different inputs and contain disjoint transactions.

| Model and group | Priced deals | Listed gap | With package credit | Raw quote gap |
| --- | ---: | ---: | ---: | ---: |
| August forecast through Week 2, all | 31 of 32 | 14.0% | 13.0% | 11.2% |
| August forecast through Week 2, unequal packages | 17 | 11.1% | 9.8% | 16.4% |
| Weeks 3–12 market component, all | 182 of 188 | 15.4% | 15.6% | 8.9% |
| Weeks 3–12 market component, unequal packages | 109 | 15.3% | 15.3% | 8.8% |
| Weeks 3–12 market component, unequal player-only | 9 | 16.2% | 15.7% | 4.5% |
| Weeks 3–12 market component, unequal with a top-12 quoted player | 12 | 14.2% | 9.1% | 4.3% |

On the 109 later unequal exchanges, the larger package's signed median gap moved from −0.9% at listed prices to −4.5% after credit. The 95% league-bootstrap interval for the change in median absolute gap ran from −1.5 to +1.6 percentage points across 28 contributing leagues. Raw quotes were closer overall and favored the larger package by 7.8% at the median. Credit drew the sides closer on the 12 top-player offers. These observations give little basis for retuning the 25% credit share. The v5.2 cap addresses sharp changes when the best assets have nearly equal prices. It left the reported later-window medians unchanged at one decimal place. The leagues share a discovery network, and only accepted offers are observed. FantasyCalc derives quotes from real fantasy trades, which makes observed exchange ratios its explicit target. Its source leagues may overlap this panel. Selecting quotes archived before the proposal rules out incorporating that particular future trade. Dynasty Ticker also targets three-season lineup production, which this comparison cannot measure. [FantasyCalc methodology](https://fantasycalc.com/about) · [NFL outcome study](utility-scale.md) · [Package adjustment study](package-scale.md)

### Rebuilt two-for-ones

- On August 26, Bucky Irving was worth 45.48 on the reconstructed combined board. Cam Ward (31.52) and a 2027 third (5.48) totaled 37.00. The calculator added 1.37 to Irving for a credited total of 46.85. This was the earliest fully priced two-for-one in the August panel. [Transaction 1398375135756476416](https://api.sleeper.app/v1/league/1350657154389938176/transactions/1)
- On September 2, Puka Nacua (96.71) was traded for Quinshon Judkins (49.17) and CeeDee Lamb (85.50). The v5.1 calculator credited Nacua 12.29. The v5.2 cap reduced that premium to 11.21, the price difference between Nacua and Lamb. The two-player side led 134.67 to 107.92. This was the first covered player-only two-for-one in that window. [Transaction 1401006819047919616](https://api.sleeper.app/v1/league/1335672248664621056/transactions/1)
- On September 23, the market component priced A.J. Brown at 49.68 and Bryce Young plus a 2027 third at 62.65 + 5.39. Young was the most valuable individual asset, and the package received no credit on either side. This was the first covered later two-for-one involving a pick. [Transaction 1408480989671342080](https://api.sleeper.app/v1/league/1312279710746562560/transactions/3)
- On October 11, the market component priced RJ Harvey at 25.07 against Mike Washington Jr. (13.12) and Darren Waller (4.74). Crediting Harvey 1.19 widened his lead to 26.26 against 17.86. This was the first covered later player-only two-for-one. [Transaction 1414878725199171584](https://api.sleeper.app/v1/league/1318915386460094464/transactions/5)

Run from the repository root with Python 3.10+, Node.js and the repository's Git history. The first command caches the API inputs, exports all 238 eligible transactions before quote matching, and prints the later-window comparisons and examples. The second reuses the export for the August combined-model comparison. [August input dates and sources](preseason-trades.md)

```sh
python3 player-values/research/market_packages.py --independent-panel --later-packages --save-deals /tmp/dynasty-independent-full.json
python3 player-values/research/package_scale.py /tmp/dynasty-independent-full.json --current-weight-check
```
