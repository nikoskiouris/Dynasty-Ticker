# Do the distances between prices fit actual player packages?

A ranking can put three players in the right order and still overprice the top player relative to the other two together. We measured the difference between the total prices on the two sides of **completed trades**, using prices reconstructed from forecasts published before the transactions. This comparison covers the football component. Exact-format market quotes and pick prices at these origins were unavailable.

## League selection and timing

The starting population was the Dynasty Dealer archive of randomly sampled public Sleeper leagues. We intersected the league IDs in its 2024 superflex study with the IDs of 12-team leagues in its 2024 trading study. We sorted that intersection by SHA-256 of `2024-spacing-v1` followed by the ID, then took the first 216. League selection used no prices, player names or package balance. For each candidate, Sleeper's own league settings had to show dynasty, 12 teams, one QB, one superflex, full PPR, no reception bonuses specific to RB/WR/TE and managed lineups. This yielded 57 league-seasons in 2024. We checked their linked predecessor leagues independently and found 38 eligible in 2023. The dataset covers leagues represented in both published studies and linked predecessors that survived into 2024. [Sampling archive and license](https://doi.org/10.5281/zenodo.23813187) · [Sleeper league and transaction endpoints](https://docs.sleeper.com/)

We queried Sleeper transaction periods 0, 1 and 2. We required a completed two-manager trade in which every incoming player left the other roster. We excluded picks, FAAB and incomplete deals. Preseason prices use the August 21, 2024 ESPN stat forecast and the September 1, 2023 FantasyPros forecast, prior-season NFL results and known draft and biographical details. We required trades to be proposed and completed after each forecast archive commit. We first counted trades completed before league-wide opening kickoff, then extended the same frozen board through 06:00 UTC on the Tuesday following Week 2. This longer window includes information that became available after pricing. [ESPN 2024 input](https://github.com/xitij/espn-projection-scraper/tree/c8082cd1424fb6cd5eaf0cb11c65b85942981e79/src/projections/2024) · [FantasyPros 2023 input](https://github.com/Saurabh1975/ffb-streamlit/blob/1bb6d3f9f579c350de2afff862921b755d2c442b/Data/fpros_projections.csv) · [Projection scoring and identity matching](ranking-holdout.md)

The sample allows different numbers of WR and ordinary flex starters and different passing TD values. These are real 12-team superflex, full-PPR trades. Of the 33 player-only trades through Week 2, 16 came from four-point passing-TD leagues. Seven had the reference QB/RB/WR/TE/FLEX/SF counts and three had both those counts and four-point passing TDs. Trades may reflect injuries, roster limits, title windows, private preferences or information unavailable to the forecast. Only accepted deals appear. Those limitations prevent interpreting an exact match as a uniquely fair price.

## What was measured

For each trade with positive published estimates for every player in both models, sum **listed individual prices** on each side. Compute absolute gap as `abs(left − right) / (left + right)`. For unequal packages, compute signed bias as `(more-player side − fewer-player side) / (left + right)`. For example, sides worth 60 and 40 have a 20% absolute gap. A negative bias means the pricing system gave the side with more players the lower total. This measures asset-price spacing directly and excludes the calculator's separate package adjustment. The price unit cancels out of both metrics. A model with lower error on one-for-one deals alone can still assign unusable prices to two-for-one deals.

Run with Python 3.10+, Git and the repository history containing v3 commit `cb822a483f1cc421152f94a08c573a562e7d77c0` and v4 commit `7837cf04672c393355c50dc6bacfc8f056f0a2ee`. The [audit script](trade_spacing.py) loads both fixed implementations and evaluates only their common priced trades. Downloads are cached locally. No manager identifiers or names are included in the report.

```sh
python3 player-values/research/trade_spacing.py
```

## Results

Each pair shows v3 followed by v4. The through-Week-2 rows include the preseason trades.

| Season and trade window | Fully priced / eligible | Median absolute gap, v3 → v4 | Unequal deals | Median more-player bias, v3 → v4 | Two-for-ones | Median two-player bias, v3 → v4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 before kickoff | 5 / 5 | 35.8% → 36.9% | 1 | −3.5% → +1.3% | 1 | −3.5% → +1.3% |
| 2023 through Week 2 | 13 / 14 | 16.5% → 10.1% | 6 | −15.1% → −6.4% | 3 | −13.6% → −7.2% |
| 2024 before kickoff | 14 / 15 | 34.2% → 22.2% | 6 | −12.8% → −7.4% | 4 | −11.9% → −6.1% |
| 2024 through Week 2 | 18 / 19 | 32.5% → 19.2% | 7 | −0.5% → +0.2% | 4 | −11.9% → −6.1% |

In 2024 the preseason median gap fell 12.0 percentage points. In the five preseason 2023 deals it rose 1.1 points. In the larger windows both years had smaller median gaps. The two-player side of a two-for-one was still priced below the single player at the median in each full window. With three and four such exchanges, respectively, that evidence cannot establish the right package adjustment.

Neither version used these exchanges for fitting. V4's football scale used the 2018 and 2020 forecast origins and NFL outcomes ending in 2022. Earlier development of other football components examined overlapping seasons, so the comparison is a dated check on the new scale. It does not reproduce a model published to managers in 2023. [Scale fitting and held-out NFL outcomes](utility-scale.md)
