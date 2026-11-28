# Replaying the locked model in additional Sleeper leagues

We fixed the market weight at 75% when football and market inputs are both available, and the consolidation credit share at 12.5%, before collecting this panel. The comparison measures the gap between the packages managers actually exchanged. A smaller absolute gap means the model placed their packages closer together. These data contain only completed trades. [Coefficient selection](fit_exchange.py)

## League selection and dates

We started from the 169 public Sleeper leagues discovered on KeepTradeCut. One manager per seed yielded only 21 new eligible leagues, so we expanded to up to seven users per seed, ordered by the SHA-256 hash of the public Sleeper user ID. This produced 1,182 distinct discovery users. We excluded the 172 users from all 14 format-eligible KTC seeds and fetched the remaining users' 2026 NFL leagues. We removed every league ID on the KTC list and both earlier research lists. We then sorted candidate leagues by SHA-256 of league ID and skipped any with a user from the 172-member exclusion list. All 87 new eligible leagues passed the membership check. Their frozen ID list contains zero duplicates or IDs from the three earlier lists. This protects against repeated league IDs and overlap with the KTC fitting and held-out managers. The panel still comes from a connected public league network. [87 frozen league IDs](external-exchange-leagues-20261128.txt) · [Discovery algorithm](external_exchange_leagues.py) · [KTC seed IDs](ktc-sleeper-leagues-20261128.txt) · [Earlier panel](market-leagues-2026.txt) · [Earlier additional panel](market-leagues-independent-2026.txt)

Scoring uses the previous study's exact league filter, including 12 teams, full PPR, one QB plus one superflex, four-point passing touchdowns, zero TE reception bonus and no best ball. We compared the locked model with the v5.2 release and the simple sum of archived market quotes on the same fully priced exchanges. Absolute gap is the absolute difference between the side totals divided by their sum. The August 26 football and market snapshot prices subsequent proposals completed before September 22 at 06:00 UTC. The second window runs from then through November 27. It uses quotes archived before the offer, at most seven days old, with the market-only conversion and package calculator. Archived weekly football projections were unavailable. [Inputs and dates](preseason_trade_fit.py) · [Quote chronology and league filters](market_packages.py) · [Replay and groups](pick_packages.py)

## Results

The 87 leagues supplied 844 completed exchanges from August 18 through November 27, with 82 leagues contributing at least one. The two replay windows with archived prices fully covered 129 of 141 qualifying early offers and 608 of 623 later offers. Trades before the August 26 snapshot fall outside both windows.

| Window and exchange | Priced trades | Leagues | v5.2 median gap | Locked model median gap | Raw quote median gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| August snapshot, all | 129 | 51 | 17.1% | 10.8% | 11.7% |
| August snapshot, one player for picks | 44 | 25 | 22.6% | 13.9% | 13.9% |
| August snapshot, players only | 27 | 19 | 19.4% | 7.8% | 8.1% |
| Later market-only, all | 608 | 81 | 16.8% | 11.1% | 11.5% |
| Later market-only, one player for picks | 166 | 66 | 18.7% | 11.5% | 11.5% |
| Later market-only, one player for multiple picks | 46 | 32 | 19.8% | 10.2% | 10.7% |
| Later market-only, players only | 134 | 41 | 36.1% | 20.8% | 20.7% |
| Later market-only, top-12 player alone for players + picks | 13 | 13 | 10.3% | 2.9% | 4.9% |

In the full early replay of one player for picks, the median signed gap moved from 8.9% favoring the player to 0.2% favoring the picks. The later market-only replay moved from 11.0% to 3.3% favoring the player. Each window had just one player traded alone for two seconds. Those two cases were Derrick Henry in September and Saquon Barkley in October. Early elite deals remain sparse, with zero top-six players exchanged alone for players plus picks. [Henry exchange 1403958163086065664](https://api.sleeper.app/v1/league/1313635230862561280/transactions/1) · [Barkley exchange 1420611557745774592](https://api.sleeper.app/v1/league/1312145077413371904/transactions/7)

### How much consolidation credit?

Holding the listed prices fixed isolated the effect of the credit. In 317 fully priced later unequal exchanges from 71 leagues, the 12.5% share had a league-balanced mean absolute gap of 13.54%. Zero credit yielded 14.25% and the former 25% share yielded 13.28%. The paired change from the former share to the locked share was +0.26 percentage points, with a 95% league-bootstrap interval of −0.03 to +0.57. The per-trade medians were 9.30% and 9.37% for the locked and former shares. The broader price change improved agreement. This panel leaves the magnitude of the consolidation credit uncertain.

Among priced unequal offers, the locked credit yielded median gaps of 9.36% in leagues with nine or fewer starters (92 offers), 8.98% in start-ten leagues (177) and 11.68% in leagues starting eleven or more (48). These groups can differ in the packages traded. The model used the same 12-team superflex PPR prices in each group.

### Special league rules

Sleeper metadata does not capture every house rule. One league named “Pirate & Protect” recorded Gibbs for Cade Otton in October and then Gibbs for Mason Taylor two weeks later. We retained all 87 leagues in the primary results. In a follow-up sensitivity check we removed that league, the two with “Devy” in their names, and the one named “Empire 101”. Across the remaining 119 priced early offers the median gap fell from 16.5% to 10.1%. Across the 550 priced later offers it fell from 14.3% to 9.5%. On 315 unequal later offers the locked credit's league-balanced gap was still 0.26 points higher than with the former share. League names are an incomplete indicator of house rules. [Gibbs for Otton, transaction 1413238304719052800](https://api.sleeper.app/v1/league/1313246727599325184/transactions/4) · [Gibbs for Taylor, transaction 1418126747936768000](https://api.sleeper.app/v1/league/1313246727599325184/transactions/6)

## Reproduction

The frozen ID list reproduces the selected panel even as public memberships change. From the repository root, run the following command to collect the transactions and replay both windows. The output includes price coverage, signed bias for picks, rare player tiers and credit comparisons. Set the cache path to a local directory.

```sh
PYTHONPATH=player-values python player-values/research/external_exchange_replay.py --cache-dir /tmp/market-exchange-audit
```

For the special-rule sensitivity check append `--exclude-league 1313246727599325184 --exclude-league 1312187313677152256 --exclude-league 1312494723964878848 --exclude-league 1312148576893140993`.
