# Market-first player value preview

The preview cuts the gap between Bijan Robinson and Joe Burrow from 14.58 to 6.47 points. The current model had the lower pricing error on later accepted trades, so the evidence favors keeping the current board in production.

## How players move

Both boards use the same November 28 observations. Replaying v5.3 on the preview inputs reproduced all 531 prior asset prices. The preview puts three players above 92. The largest gap in its top ten is 8.96 points, between Allen and Chase.

| Preview rank | Player | Current value | Preview value |
| ---: | --- | ---: | ---: |
| 1 | Jahmyr Gibbs | 99.05 | 97.82 |
| 2 | Jaxon Smith-Njigba | 99.05 | 97.66 |
| 3 | Josh Allen | 97.05 | 95.15 |
| 4 | Ja’Marr Chase | 92.69 | 86.19 |
| 5 | Bijan Robinson | 92.42 | 84.31 |
| 6 | Joe Burrow | 77.84 | 77.84 |
| 7 | Brock Bowers | 63.07 | 69.63 |
| 8 | Caleb Williams | 62.33 | 69.52 |
| 9 | Amon-Ra St. Brown | 75.18 | 69.40 |
| 10 | CeeDee Lamb | 68.69 | 67.12 |

Across the 2027 pick options, the current calculator comes closest to even with Burrow plus a mid-second for Bijan. The preview comes closest with a late fourth. With a whole-round 2027 fourth, the preview credits Bijan’s side at 85.32 and Burrow’s side at 85.90. Those are calculator estimates. The direct market search returned one straight swap in the target scoring format on April 28 and no matching three-asset Burrow-plus-pick deal in that format. A single April exchange gives little evidence for a November price. [All 507 players](../../pr-artifacts/market-first-board.csv) · [Straight swaps](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=2&maxPlayers=2&side1=9833&side2=1002) · [Three-asset transactions](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=3&maxPlayers=3&side1=9833&side2=1002)

## What the forecast earns

Put the FantasyCalc quote and the football forecast on the 0–100 scale independently. Start at the market price and move a fitted fraction of the way to the football price. With just one source, use its full price. The selected fraction is zero. Quotes price 396 players and all 24 picks on this board. Football forecasts price the other 111 players.

We used the August 26 forecast for all replayed trades. It has 513 players, 398 player quotes and 28 pick quotes. We fit the weight to completed trades in the original discovery panel and the designated KTC training leagues between the forecast and September 10 at 00:20 UTC. We then scored the fixed choice on later trades proposed and completed before September 22 at 06:00 UTC in separate leagues from the independent and external panels. We excluded offers crossing a boundary, duplicate transaction IDs and trades with unquoted or unsupported assets. All models saw the same trades and used the same calculator package credit. [Forecast sources](preseason-trades.md) · [League panels and eligibility](external-exchange-validation.md)

The error is the absolute difference between the two adjusted sides divided by their sum. We average trades within each league, then give each league equal weight. A smaller value means the two sides of accepted trades priced closer together.

| Weight on football | 0% | 5% | 10% | 15% | 20% | 25% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Training error, 81 of 83 trades across 42 leagues | 10.77% | 10.89% | 11.02% | 11.22% | 11.49% | 11.77% |

| Model | Training error | Later error, 67 of 71 trades across 33 leagues | Later median trade gap |
| --- | ---: | ---: | ---: |
| Current v5.3, 25% football before converting to a score | 11.81% | 15.49% | 12.67% |
| Selected preview, market-only on quoted players | 10.77% | 16.76% | 14.47% |

The preview raised the later error by 1.27 percentage points. A paired bootstrap that resamples leagues gives a 95% interval from −0.52 to +3.02 points. Just three later trades involved a player ranked in the market top 12. Two came from the same special-rules league. The comparison also uses a single forecast date, up to 27 days before the trades. It gives limited evidence about elite-player gaps or how weekly forecast updates would perform.

The older 182-trade replay used dated quotes without weekly football forecasts. Its 15.6% median was for v5.2. In that same window v5.3’s calculator had an 8.3% median and raw quote sums had 8.9%. That window measures market conversion and calculator behavior. [Earlier replay](pick-packages.md)

## Reproduce the comparison

From the repository root, with Python, Node and the v5.3 base commit available in Git, run the replay.

```sh
PYTHONPATH=player-values python3 player-values/research/market_first_replay.py --cache-dir /tmp/dynasty-market-first > /tmp/dynasty-market-first.json
```

The report includes pricing coverage, listed and credited side totals expressed as gaps, results by trade type, and the paired difference for each panel. [Replay code](market_first_replay.py)
