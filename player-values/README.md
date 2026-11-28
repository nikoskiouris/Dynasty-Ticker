# Dynasty player values

Dynasty Ticker estimates the trade value of a player or a rookie pick in **12-team, full-PPR superflex dynasty**. Each team starts one QB, two RBs, three WRs, one TE, one RB/WR/TE flex and one superflex. A reception earns one point at every position.

## Reading a price

**90 and above** is the elite group in a 12-team superflex startup. **87 to just under 90** is a strong building block, the sort of player a manager can build around with an early startup pick. These are historical reference levels. The number of players who qualify can vary with the strength of a class, injuries and the time of year.

Every asset is priced from its estimated discounted PPR above replacement over the remaining regular season and the next two. Historical benchmarks translate that estimate to the 0–100 scale. For example, **90** corresponds to the estimated output typical of an approximately seventh-ranked startup asset at the same stage of the season. The model interpolates between reference points and tapers toward 100 for exceptional estimates. Further down the board the price is proportional to the estimated surplus. A market quote change for one player cannot reset anyone else's score.

Players, picks, the rankings and the calculator use one published value, rounded to the hundredth. The calculator adds the individual prices, then applies its disclosed consolidation credit. The [November 28 board and trade examples](research/november-board.md) show what the scale means in practice.

## From football and market evidence to a price

| Evidence | How it enters the estimate |
| --- | --- |
| Remaining regular season | Project unplayed games and optimize all 108 starters. Remove the player and refill every slot. The drop in PPR is his immediate lineup advantage. This portion gets full weight. |
| Next two seasons | Forecast sustainable production from projected and observed scoring. Adjust for positional depth, age and historical production of similarly ranked players. Weight next season by 0.85 and the following season by 0.7225. |
| Draft capital | For first- and second-year NFL players, position and draft round contribute to the future estimate. The draft-cohort share starts at up to 65% for rookies and up to 25% in year two, fading as they play. |
| Market | Use FantasyCalc dynasty quotes for 12 teams, two QBs and full PPR as a superflex market proxy. Translate quotes into historically comparable lineup surplus using the outcomes of players selected at different startup-draft slots. |

**Football.** Sum the projected surplus across the three seasons. A curve fitted to achieved outcomes adjusts for differences between expected and realized production at different levels. For example, a 44.13-point raw forecast maps to 62.44 expected surplus PPR, while 396.02 maps to 344.93. This prices some upside for reserves and accounts for uncertainty in elite forecasts. [Calibration and holdout](research/utility-scale.md) · [League lineup design and worked replacement example](research/format-design.md)

The remaining-season forecast uses available Sleeper weekly projections, recent scoring, availability and the team's NFL schedule. Games that have started contribute no new lineup value. For the long-term estimate, the season projection carries six games of weight and last season's total carries up to eight. Completed games count as soon as the opening week is underway. For players with recorded points and appearances, the model annualizes current production over the games their club has finished. It uses a week-based estimate if the club schedule is missing. A player who appears in 18 games after a trade is evaluated on a 17-game scoring horizon. The model uses an even split between the player's own age-adjusted surplus and that of comparable players by position and rank. [In-season forecast study](research/inseason-forecast.md) · [Future production study](research/future-blend.md) · [Age and draft evidence](research/production-evidence.md)

**Market.** The market curve links an archived May 2026 FantasyCalc price distribution to 20,098 selections in 65 historical full-PPR superflex startup drafts. Each draft band has an observed first-season surplus and a discounted two-season future surplus. Today's general market quote is interpolated between these fixed bands. The fraction of league games left scales only the current-season part of the comparable players' value. A rookie pick's price represents the amount of player value its quote can buy. This makes it possible to price picks without forecasting the identity, position or NFL production of an unknown rookie. [Startup calibration](research/market-reference.md) · [FantasyCalc source and settings](https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&numTeams=12&ppr=1)

**Combining evidence.** With both sources present, the estimate is 75% calibrated football and 25% market-implied surplus. The market share is a judgment about the role of current trade demand. Players with only one source use that source at full weight. An observed forecast of zero above replacement counts as football evidence. An unsupported asset receives no published price. Each priced pick uses its own market quote. The final expected surplus determines the score. The model allocates it across the four displayed factors in proportion to their contributions to that surplus, rounding them to sum to the published price. The calculator separately credits consolidation when comparing packages.

## Validation

- **Score bands.** The medians around historical ranks 21, 7 and 3 define 87, 90 and 95 at three stages of the season. Interpolation uses unplayed regular-season games, so an asset can move as its remaining opportunity and outlook change. Historical and current boards can be compared against those same reference groups. [Score-band study](research/elite-score-bands.md) · [Package replay](research/package-scale.md)
- **Underlying football estimate.** Fit the scale on 2018 and 2020 forecasts and assess 2023 predictions against NFL outcomes through 2025. Average tier-spacing error was 1.05 points, compared with 4.09 for the previous model after fitting its best multiplier on the development sample. For 72 predetermined one-for-two comparisons, mean absolute package-gap error improved from 34.52 to 33.27 points. Individual bench-player absolute error increased from 7.47 to 8.41. Those errors are expressed in v4 units. [Scale study](research/utility-scale.md)
- **Earlier v4 trade audit.** A frozen preseason 2026 board priced 117 subsequent accepted exchanges. Across 72 unequal packages, the median gap between sides went from 17.0% to 16.2%. Across all 117 trades, both models gave 16.9%. FantasyCalc's unadjusted quote totals were closer on that sample. Most unequal packages contained rookie picks, and an accepted trade can reflect individual team goals. [Combined preseason replay](research/preseason-trades.md) · [Earlier player-only trades](research/trade-spacing.md) · [Market quotes on 855 accepted trades](research/market-packages.md)
- **Current market comparisons.** KeepTradeCut publishes a crowd-ranked superflex board with half-PPR scoring. Its player-only ranks help identify differences worth investigating. The current head-to-head shows how the finite forecast horizon and injury assumptions affect particular players. [November comparison](research/november-board.md)
- **Independent trade replay.** An additional 18 leagues supplied 31 accepted trades the model could price. Across 17 unequal packages, the median gap was 9.8% with the published settings, 10.3% with a 50% market weight and 11.1% without the consolidation credit. Across all 31 trades the 50% market weight had the smaller gap. We kept the 25% weight given the small sample and mixed results. [Sample and sensitivity analysis](research/package-scale.md)
- **Later trades in the independent panel.** Across 182 subsequent accepted deals, the market component and calculator produced a 15.6% median gap, compared with 8.9% using the external trade quotes directly. Among 109 unequal offers, adding consolidation credit left the median absolute gap at 15.3% and shifted the signed gap toward the smaller side. The study reconstructs four public offers with dated inputs. [Model replay and transactions](research/market-packages.md#independent-late-season-replay) · [Historical site grades on archived boards](research/archived-trade-replay.md)

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
