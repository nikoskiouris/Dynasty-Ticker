# Dynasty player values

Dynasty Ticker estimates the trade value of a player or a rookie pick in **12-team, full-PPR superflex dynasty**. Each team starts one QB, two RBs, three WRs, one TE, one RB/WR/TE flex and one superflex. A reception earns one point at every position.

## Reading a price

The board publishes one trade price per asset. A quoted player takes the price implied by his 12-team, two-QB, full-PPR FantasyCalc quote. A player without a quote takes the price implied by his projected PPR above replacement. A pick uses its own quote for its year, round and slot when available. A 2028 pick quoted today already reflects the wait until its draft.

In the market component, two assets with a combined quote of 4,000 have the same listed value as a single asset quoted at 4,000. This proportional relationship holds through the historical top-three startup quote (10,069 = 95 points). Above 95 the scale tapers to 100. The calculator can separately credit consolidation when it compares complete packages.

## From football and market evidence to a price

| Evidence | How it enters the estimate |
| --- | --- |
| Remaining regular season | Project unplayed games and optimize all 108 starters. Remove the player and refill every slot. The drop in PPR is his immediate lineup advantage. This portion gets full weight. |
| Next two seasons | Forecast sustainable production from projected and observed scoring. Adjust for positional depth, age and historical production of similarly ranked players. Weight next season by 0.85 and the following season by 0.7225. |
| Draft capital | For first- and second-year NFL players, position and draft round contribute to the future estimate. The draft-cohort share starts at up to 65% for rookies and up to 25% in year two, fading as they play. |
| Market | Use FantasyCalc dynasty quotes for 12 teams, two QBs and full PPR as a superflex market proxy. Translate quotes to a common exchange scale, using historical startup bands to match them with football estimates. |

**Football.** Sum the projected surplus across the three seasons. A curve fitted to achieved outcomes adjusts for differences between expected and realized production at different levels. For example, a 44.13-point raw forecast maps to 62.44 expected surplus PPR, while 396.02 maps to 344.93. This prices some upside for reserves and accounts for uncertainty in elite forecasts. [Calibration and holdout](research/utility-scale.md) · [League lineup design and worked replacement example](research/format-design.md)

The remaining-season forecast uses available Sleeper weekly projections, recent scoring, availability and the team's NFL schedule. Games that have started contribute no new lineup value. For the long-term estimate, the season projection carries six games of weight and last season's total carries up to eight. Completed games count as soon as the opening week is underway. For players with recorded points and appearances, the model annualizes current production over the games their club has finished. It uses a week-based estimate if the club schedule is missing. A player who appears in 18 games after a trade is evaluated on a 17-game scoring horizon. The model uses an even split between the player's own age-adjusted surplus and that of comparable players by position and rank. [In-season forecast study](research/inseason-forecast.md) · [Future production study](research/future-blend.md) · [Age and draft evidence](research/production-evidence.md)

**Market.** Frozen May 2026 median quotes of 5,673, 8,715 and 10,069 represent the startup bands containing ranks 21, 7 and 3. Their scores are proportional to the quotes (53.52, 82.23 and 95). The football component maps historical three-season surplus at the same startup ranks and stage of the season onto those scores. The market conversion uses the same benchmarks. Up to 95 points, multiplying the raw quote by 95 / 10,069 gives the board price. Higher prices taper toward 100. Only the football estimate is a forecast of NFL production. [Startup reference data](research/market-reference.md)

**Choosing the trade price.** On v5.5, the market quote supplies the entire price whenever it is available. The football forecast supplies the price when a quote is missing. Player pages show which source set the price and the football estimate when one is available. A measured zero above replacement is football evidence. Rookie picks use the quote for their year, round and projected slot. The calculator can also show the raw quote comparison when it points to a different side or verdict band.

## Validation

- **The v5.5 pricing decision.** A chronological replay compared football, independent expert ranks and quote prices. Separate November samples measured accepted trades in leagues held out from the fit. [Results on accepted trades](research/november-holdout.md) · [Comparison to other calculators and an example trade](research/calculator-comparison.md)

- **Trade prices and accepted offers.** The v5.3 calibration uses dated prices and completed two-manager exchanges from public Sleeper leagues. The studies report separate results for the combined football and market model and for periods where only pre-trade market quotes exist. [Training results](research/pick-packages.md) · [Independent 87-league replay](research/external-exchange-validation.md) · [Direct trades and crowd comparison](research/accepted-player-exchanges.md)

- **Underlying football estimate.** Fit the scale on 2018 and 2020 forecasts and assess 2023 predictions against NFL outcomes through 2025. Average tier-spacing error was 1.05 points, compared with 4.09 for the previous model after fitting its best multiplier on the development sample. For 72 predetermined one-for-two comparisons, mean absolute package-gap error improved from 34.52 to 33.27 points. Individual bench-player absolute error increased from 7.47 to 8.41. Those errors are expressed in v4 units. [Scale study](research/utility-scale.md)
- **Earlier v4 trade audit.** A frozen preseason 2026 board priced 117 subsequent accepted exchanges. Across 72 unequal packages, the median gap between sides went from 17.0% to 16.2%. Across all 117 trades, both models gave 16.9%. FantasyCalc's unadjusted quote totals were closer on that sample. Most unequal packages contained rookie picks, and an accepted trade can reflect individual team goals. [Combined preseason replay](research/preseason-trades.md) · [Earlier player-only trades](research/trade-spacing.md) · [Market quotes on 855 accepted trades](research/market-packages.md)
- **Current market comparisons.** KeepTradeCut publishes a crowd-ranked superflex board with half-PPR scoring. Its player-only ranks help identify differences worth investigating. The current head-to-head shows how the finite forecast horizon and injury assumptions affect particular players. [November comparison](research/november-board.md)
- **Earlier v5 independent trade replay.** An additional 18 leagues supplied 31 accepted trades the model could price. Across 17 unequal packages, the median gap was 9.8% with the then-published settings, 10.3% with a 50% market weight and 11.1% without the consolidation credit. Across all 31 trades the 50% market weight had the smaller gap. That release retained a 25% market weight. [Sample and sensitivity analysis](research/package-scale.md)
- **Later trades in the independent panel.** Across 182 subsequent accepted deals, the old v5.2 market component and calculator produced a 15.6% median gap. With market inputs alone, v5.3 produced 8.3% including package credit and raw quotes yielded 8.9%. [Version-specific results](research/pick-packages.md) Under v5.2, among 109 unequal offers, adding consolidation credit left the median absolute gap at 15.3% and shifted the signed gap toward the smaller side. The study reconstructs four public offers with dated inputs. [Model replay and transactions](research/market-packages.md#independent-late-season-replay) · [Historical site grades on archived boards](research/archived-trade-replay.md)

## Refresh and inspect

From the repository root:

```sh
python3 scripts/update_nfl_draft_picks.py
python3 player-values/build_trade_values.py
python3 scripts/check_market_files.py --fail-on-age
python3 scripts/build_sitemap.py
python3 scripts/archive_price_snapshot.py
node scripts/publish_market_blobs.mjs --check-only
```

Pass `--save-inputs /tmp/dynasty-inputs.json` to the value builder to retain the normalized observations. The board records the model version, source retrieval time, input coverage, replacement thresholds and score anchors. Sleeper projections and FantasyCalc quotes omit per-player update timestamps. Insufficient feed coverage stops publication. Rankings and league views read the same board as the calculator. Dated trade links retain their archived prices. Price trends compare snapshots from the same model version. The v5.2 board uses completed club games in the future-production estimate. [Dated prices](../docs/data/price-history/202611280420.json) · [Historical schedule comparison](research/future-blend.md#completed-club-games)
