# November exchange holdout

A model combining trade quotes, expert ranks and football projections priced the sides of 292 accepted trades closer together than v5.3 did. Using the market price alone with the same calculator credit had the lowest average error on these trades.

| Method | League-balanced mean gap | Median trade gap | 75th-percentile trade gap |
| --- | ---: | ---: | ---: |
| v5.3 with reconstructed football inputs | 14.97% | 11.82% | 23.57% |
| Preselected combined model | 13.76% | 10.86% | 19.69% |
| Market price plus expert ranks | 13.69% | 10.78% | 19.69% |
| Market price plus football | 13.46% | 10.69% | 19.03% |
| Market price with calculator credit | 13.40% | 10.77% | 18.82% |
| Raw FantasyCalc quote sums | 13.75% | 11.34% | 19.21% |

For each trade, the error is the absolute difference between the two package prices divided by their sum. The primary metric averages errors within each league, then gives each league equal weight. All 0–100 boards use the same calculator with a 12.5% consolidation-credit share. The raw-quote baseline adds the dated FantasyCalc units on each side. The combined model's mean gap was 1.21 percentage points below v5.3 (95% paired league-bootstrap interval, 0.44 to 1.96 points below). It was 0.37 points above the market price with calculator credit (0.05 to 0.69 points above) and 0.01 points above raw quote sums (0.37 below to 0.40 above). The intervals resample entire leagues 4,000 times. The archive contains listed-price results and subgroups, including the 53 player-only deals and 29 involving a player in the top 12 by contemporaneous market quote. [Full results](november-holdout-results.json)

## What the earlier trades selected

Training used 559 fully priced exchanges in 174 leagues proposed after the August 26 preseason snapshot and completed before October 1. A further 688 October exchanges in 191 leagues selected the model. Trades spanning the split were excluded. Of 1,338 eligible transactions across the four prior league panels, 1,247 had quotes for every asset. Each proposal used the newest available FantasyCalc full-PPR, 12-team, two-QB board published strictly beforehand. Each daily board used the latest available football forecast and expert ranks at its publication time.

| Pricing method | August–September mean gap | October mean gap |
| --- | ---: | ---: |
| v5.3 reconstructed football and market blend | 13.034% | 14.961% |
| Market price | 12.324% | 13.596% |
| Market plus quarterback forecast adjustment | 12.316% | 13.592% |
| Market plus DynastyProcess ranks | 12.316% | 13.396% |
| Both adjustments | 12.302% | 13.394% |

**Football.** We compared a direct adjustment toward the football-only price, an adjustment capped in proportion to market price, and an adjustment for how a player's football forecast compares with those of similarly priced players at his position. We also evaluated the peer method separately for quarterbacks and non-quarterbacks. August–September trades set each method's weight from 0%, 5%, 10%, 15%, 25% and 40%. October selected the quarterback-only peer method at 5%. It compares the quarterback's football-price-to-market-price ratio with the median ratio of ten neighbors in quarterback market rank. The largest adjustment is 3.75% of the player's market price.

**Expert ranks.** Weekly DynastyProcess 2QB player ranks were mapped to the observed full-PPR player price distribution. An expert's third-ranked player receives the third-highest market price among players covered by both sources. Tied ranks average their corresponding market prices. We compared ranking all matched players together with ranking separately at each position. The tested weights were 0%, 12.5%, 25%, 37.5%, 50%, 75% and 100%. Earlier trades selected the across-position ranks at 12.5%. Picks retained their market price throughout.

On October's primary metric the combined adjustments edged the expert-only variant by **0.0025 percentage points**. We froze the combined formula before November grading. Correcting the historical identity crosswalk and prior-season statistics retained the same winning families, weights and overall candidate. The held-out November trades favored the simpler market price. The source timestamps are reconstructed from archived commits. In-season football uses pre-cutoff scoring, roster and projection records. Historical availability of a provider's entire production feed could not be established. [Football forecasts](weekly_origins.py) · [Weekly expert ranks](expert_origins.py) · [Parameter selection](fit_player_signals.py)

Changing the remaining-season forecast to archived ESPN projections gave gaps of 15.02% for v5.3, 13.78% for the combined model and 13.40% for the market price on the same 292 November deals. This sensitivity uses the original coefficients. Reproduce it by adding `--espn-remaining` to the weekly forecast command below and generating a separate set of price maps.

To rebuild the football and expert histories, fit the candidates, and export the five dated price maps for the November replay, run the following from the repository root. Python 3.10+ and Node.js are required. The cache stores the downloaded public data.

```sh
RUN=/tmp/dynasty-exchange-replay
mkdir -p "$RUN"
export PYTHONPATH=player-values
python3 player-values/research/weekly_origins.py --cache-dir "$RUN/cache" --output "$RUN/football-origins.json"
python3 player-values/research/expert_origins.py --cache-dir "$RUN/cache" --output "$RUN/expert-origins.json"
python3 player-values/research/fit_player_signals.py --cache-dir "$RUN/cache" \
  --origins "$RUN/football-origins.json" --experts "$RUN/expert-origins.json" --output-dir "$RUN"
```

## Selecting the held leagues

We used roster and format information to select leagues before reading their November transactions. The four earlier manifests contained 245 eligible leagues and 2,641 current Sleeper owners or co-owners. We sorted those managers by the SHA-256 hash of a fixed prefix and their public ID, and looked up the other 2026 leagues of the first 720. After excluding every league ID in the prior manifests, all 232 new eligible leagues fit the prespecified 250-league limit. Each is a managed 12-team full-PPR dynasty league with one QB slot, one superflex, four-point passing touchdowns, zero positional reception premium and no starting IDPs. Other roster slots and scoring settings can differ. [Selection code](collect_november_holdout.py) · [Frozen league IDs](november-holdout-leagues.txt)

The new leagues contained 445 completed two-manager exchanges proposed and completed between November 1 and November 27, inclusive, in UTC. We required reciprocal asset ownership, no FAAB and full identification of both sides. We removed 146 trades where either roster lacked a current owner or included a manager from the earlier panels, leaving 299 trades in 116 leagues. Membership comes from the November 28 roster snapshot. Manager turnover and relationships across leagues are possible. This is a retrospectively held-out network sample of completed deals. It does not measure rejected offers or subsequent NFL outcomes. [Frozen transactions](november-holdout-trades.json)

## Pricing the held trades

We locked the combined formula using earlier trades before evaluating it on this sample. A vintage correction then replaced a later player-ID crosswalk with date-pinned identifiers and prior-season statistics. The formula and its coefficients stayed fixed. Each trade used the last common market board strictly before its proposal, with a seven-day age limit. Each daily board used already available football and expert inputs. Seven trades had an asset missing its market quote. The 292 fully priced exchanges came from 113 leagues and used 28 daily boards. Picks were priced by year and round. The published results compare the same deals across all models. [Football input vintages](weekly_origins.py) · [Expert input vintages](expert_origins.py) · [Replay](grade_november_holdout.py)

The validator accepts daily model maps keyed by the same valuation timestamps in milliseconds as the raw quote archive. Each map uses Sleeper player IDs and pick keys in the form `pick:2027:2`. From the root, with the dated maps in `$RUN`, the following command reproduces the primary score and paired intervals.

```sh
python3 player-values/research/grade_november_holdout.py \
  --market "$RUN/quotes.json" --candidate both \
  --boards "both=$RUN/both.json" --boards "v53=$RUN/v53.json" \
  --boards "market=$RUN/market.json" --boards "expert=$RUN/expert.json" \
  --boards "football=$RUN/football.json" --output "$RUN/results.json"
```

For a fresh collection, run `python3 player-values/research/collect_november_holdout.py --cache-dir /tmp/holdout-cache --output-dir /tmp/holdout-export`. League membership can change after the retrieval date. The checked-in league and transaction manifests preserve the original sample.

## Confirmation in different leagues

We froze a second league sample before the first result was available. The selection used the next 720 managers in the original hash order and excluded all 232 leagues and all observed managers from the first sample. In total, 4,759 previous managers were excluded. The second sample contained 179 new eligible leagues. Of 292 eligible exchanges, 87 involved a previous or unidentified manager. The remaining 205 offers came from 83 leagues. Five lacked a raw quote for at least one asset. This sample uses the same dates and archived prices as the first holdout. Its participating leagues and observed managers are distinct. [League IDs](november-confirmation-leagues.txt) · [Transactions](november-confirmation-trades.json)

We locked the market-price model with the existing package credit as the confirmation candidate before grading this sample. Its primary comparator was v5.3. Across 200 priced trades, the estimated improvement was 0.43 percentage points, with a 95% paired league-bootstrap interval ranging from 1.54 points better to 0.69 points worse. The 20 trades involving a top-12 player are included in that total. The competitors changed order across the two held groups. [Confirmation results](november-confirmation-results.json)

| Method | League-balanced mean gap | Median trade gap |
| --- | ---: | ---: |
| Preselected market price with calculator credit | 14.33% | 10.84% |
| v5.3 | 14.76% | 12.56% |
| Combined market, expert and football model | 14.16% | 10.32% |
| Raw FantasyCalc quote sums | 14.45% | 10.45% |

The second sample contained 19 eligible two-for-ones with a player alone on one side and a player plus a cheaper asset on the other. The cheaper asset was a pick in ten trades and a player in nine. Using contemporaneous quoted units, the league-balanced absolute error in the inferred add-on relative to the single player's quote was 57.27% for the market-price model, 54.41% for v5.3 and 57.99% for the combined model. This small comparison gives little precision about the price of any particular pick. [Add-on replay](implied_asset_replay.mjs)

To reproduce the confirmation, run the same grading command with `--deals player-values/research/november-confirmation-trades.json --candidate market` and the `market`, `v53` and `both` board arguments. The collector's `--confirmation` flag selects the second sample.
