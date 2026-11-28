# Dynasty player values

Dynasty Ticker estimates the trade value of a player or a rookie pick in **12-team, full-PPR superflex dynasty**. Each team starts one QB, two RBs, three WRs, one TE, one RB/WR/TE flex and one superflex. A reception earns one point at every position.

## Reading a price

A **50** represents about **181 expected, discounted PPR points above replacement** over the remaining regular season and the following two seasons. A **100** represents 361.37 points, the median best preseason estimate in the two historical seasons used to set the scale. The benchmark stays fixed as players change teams, gain starting jobs or get injured. Player and pick prices stop at 100 and are published to the hundredth. Packages and rosters can exceed 100.

On November 28, 2026, Jahmyr Gibbs led the board at 75.20, followed by Jaxon Smith-Njigba at 75.15. Moving only Gibbs’s external quote in a sensitivity check left every other price intact. Headroom also varies with the NFL calendar because fewer usable games remain late in a season. The [current top 20 and KeepTradeCut comparison](research/november-board.md) show how those differences affect trade offers.

## From football and market evidence to a price

| Evidence | How it enters the estimate |
| --- | --- |
| Remaining regular season | Project unplayed games and optimize all 108 starters. Remove the player and refill every slot. The drop in PPR is his immediate lineup advantage. This portion gets full weight. |
| Next two seasons | Forecast sustainable production from projected and observed scoring. Adjust for positional depth, age and historical production of similarly ranked players. Weight next season by 0.85 and the following season by 0.7225. |
| Draft capital | For first- and second-year NFL players, position and draft round contribute to the future estimate. The draft-cohort share starts at up to 65% for rookies and up to 25% in year two, fading as they play. |
| Market | Use FantasyCalc dynasty quotes for 12 teams, two QBs and full PPR as a superflex market proxy. Translate quotes into historically comparable lineup surplus using the outcomes of players selected at different startup-draft slots. |

**Football.** Sum the projected surplus across the three seasons. A curve fitted to achieved outcomes adjusts for differences between expected and realized production at different levels. For example, a 44.13-point raw forecast maps to 62.44 expected surplus PPR, while 396.02 maps to 344.93. This prices some upside for reserves and accounts for uncertainty in elite forecasts. [Calibration and holdout](research/utility-scale.md) · [League lineup design and worked replacement example](research/format-design.md)

The remaining-season forecast uses available Sleeper weekly projections, recent scoring, availability and the team's NFL schedule. Games that have started contribute no new lineup value. For the long-term estimate, the season projection carries six games of weight and last season's total carries up to eight. Current-season production is annualized across elapsed team games. The model uses an even split between the player's own age-adjusted surplus and that of comparable players by position and rank. [In-season forecast study](research/inseason-forecast.md) · [Future production study](research/future-blend.md) · [Age and draft evidence](research/production-evidence.md)

**Market.** The market curve links an archived May 2026 FantasyCalc price distribution to 20,098 selections in 65 historical full-PPR superflex startup drafts. Each draft band has an observed first-season surplus and a discounted two-season future surplus. Today's general market quote is interpolated between these fixed bands. The fraction of league games left scales only the current-season part of the comparable players' value. A rookie pick's price represents the amount of player value its quote can buy. This makes it possible to price picks without forecasting the identity, position or NFL production of an unknown rookie. [Startup calibration](research/market-reference.md) · [FantasyCalc source and settings](https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&numTeams=12&ppr=1)

**Combining evidence.** With both sources present, the estimate is 75% calibrated football and 25% market-implied surplus. The market share is a judgment about the role of current trade demand. Players with only one source use that source at full weight. An observed forecast of zero above replacement counts as football evidence. An unsupported asset receives no published price. Each priced pick uses its own market quote. The final expected surplus determines the score, and the four displayed contributions sum to the published player price. The calculator separately credits consolidation when comparing packages.

## Validation

- **Future football outcomes.** Fit the scale on 2018 and 2020 forecasts and assess 2023 predictions against NFL outcomes through 2025. Average tier-spacing error was 1.05 points, compared with 4.09 for the previous model after fitting its best multiplier on the development sample. For 72 predetermined one-for-two comparisons, mean absolute package-gap error improved from 34.52 to 33.27 points. Individual bench-player absolute error increased from 7.47 to 8.41. The historical benchmark uses only two development seasons. [Scale study](research/utility-scale.md)
- **Actual trades.** A frozen preseason 2026 board priced 117 subsequent accepted exchanges. Across 72 unequal packages, the median gap between sides went from 17.0% to 16.2%. Across all 117 trades, both models gave 16.9%. FantasyCalc's unadjusted quote totals were closer on that sample. Most unequal packages contained rookie picks, and an accepted trade can reflect individual team goals. [Combined preseason replay](research/preseason-trades.md) · [Earlier player-only trades](research/trade-spacing.md) · [Market quotes on 855 accepted trades](research/market-packages.md)
- **Current market comparisons.** KeepTradeCut publishes a crowd-ranked superflex board with half-PPR scoring. Its player-only ranks help identify differences worth investigating. The current head-to-head shows how the finite forecast horizon and injury assumptions affect particular players. [November comparison](research/november-board.md)

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

Pass `--save-inputs /tmp/dynasty-inputs.json` to the value builder to retain the normalized observations. The board records the model version, source retrieval time, input coverage, replacement thresholds and score anchors. Sleeper projections and FantasyCalc quotes omit per-player update timestamps. Insufficient feed coverage stops publication. Rankings and league views read the same board as the calculator. Dated trade links retain their archived prices. Price trends restart with the first v4 snapshot because the formula changed.
