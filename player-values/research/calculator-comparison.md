# What two independent estimates say about Bijan Robinson and Joe Burrow

The November 28 Dynasty Ticker board priced Bijan 18.7% above Burrow. FantasyCalc’s trade quotes gave Bijan an 8.3% premium. DynastyProcess’s expert-based values favored Burrow. These readings came from different methods and league assumptions.

| Source available on November 28, 2026 | Bijan | Burrow | Bijan / Burrow |
| --- | ---: | ---: | ---: |
| Dynasty Ticker v5.3, 12-team superflex full PPR | 92.42 | 77.84 | 1.187 |
| FantasyCalc, 12 teams, two QBs, full PPR, dynasty | 8,936 | 8,250 | 1.083 |
| DynastyProcess, 2QB dynasty | 8,166 | 8,721 | 0.936 |

Each ratio compares two prices from the same source. FantasyCalc estimates market prices from traded packages. DynastyProcess takes FantasyPros expert consensus ranks, adjusts for the two-QB format and converts ranks to estimated prices along a decay curve. In particular, the order of these two players differs even before translating the source values to a common scale. [Dated v5.3 board and raw FantasyCalc quotes](https://github.com/nikoskiouris/Dynasty-Ticker/blob/a195a23112b0ee9450e5032e46ef3523c937b8a4/docs/data/player_values.json) · [November 27 expert values](https://github.com/dynastyprocess/data/blob/a8326e4597fcdd8802c6d80a926832fab27f4fdd/files/values.csv) · [DynastyProcess methodology](https://dynastyprocess.com/values/)

## Does adding expert rankings help price accepted trades?

For each archived market board, we took the latest expert publication available at the time, with a ten-day age limit. Among players covered by both, we sorted market prices from highest to lowest. The highest-ranked expert player received the market price at rank one, the second received the price at rank two, and tied players shared the average price of their slots. This gave us two estimates in comparable units. Picks and unranked players kept their market price. The comparison used 17 dated expert publications with player names and ID crosswalks from the same commit. [Archived input revisions and retrieval](expert_origins.py) · [Player matching and rank conversion](expert_market.py)

A 12.5% adjustment toward the expert estimate earned a place in the November replay. This would move the November 28 price from 84.31 to 82.46 for Bijan and from 77.84 to 78.88 for Burrow. On 292 completed November exchanges across 113 separate leagues, it raised the average error from 13.40% to 13.69%. Each league receives equal weight. The error is the absolute difference in the two calculator-adjusted sides divided by their sum. The expert comparison therefore supports caution about the original 14.58-point cliff, while the later transactions favor using the market quote directly. [Model selection and exported comparison boards](fit_player_signals.py) · [Paired grading](grade_november_holdout.py)

## Reproduce

Run these commands from the repository root with Python and Node available. The expert source is the public DynastyProcess data repository, which publishes weekly inputs for developers under GPL-3.0. [Repository and attribution](https://github.com/dynastyprocess/data) · [Source license](https://github.com/dynastyprocess/data/blob/a8326e4597fcdd8802c6d80a926832fab27f4fdd/LICENSE)

```sh
export PYTHONPATH=player-values
audit=/tmp/dynasty-source-comparison
mkdir -p "$audit/cache"
python3 player-values/research/expert_origins.py --cache-dir "$audit/cache" --output "$audit/experts.json"
python3 player-values/research/weekly_origins.py --cache-dir "$audit/cache" --output "$audit/football.json"
python3 player-values/research/fit_player_signals.py --cache-dir "$audit/cache" --origins "$audit/football.json" --experts "$audit/experts.json" --output-dir "$audit/boards"
python3 player-values/research/grade_november_holdout.py --candidate both --market "$audit/boards/quotes.json" --boards both="$audit/boards/both.json" --boards market="$audit/boards/market.json" --boards expert="$audit/boards/expert.json" --boards v53="$audit/boards/v53.json" --output "$audit/comparison.json"
```

## What the corrected price buys

On the November 28 board, the five-to-six gap falls from 14.58 to 6.47 points. Three players score above 92. At the two ends of the gap, Bijan Robinson's market price is 84.31 and his independent football estimate is 99.15. Joe Burrow's market price is 77.84 and his football estimate is 77.76. On v5.3 the surplus-to-price curve moved Bijan about 55% of the way from his market price toward his football estimate, despite a nominal 25% football weight. Quoted players now take their full market price. Players without quotes take their football estimate.

For Bijan versus Burrow plus a generic 2027 fourth, the v5.5 calculator credits the two sides at 85.32 and 85.90. The dated v5.3 calculator credits those same sides at 93.43 and 85.90. These are estimates of a plausible return. The historical add-on study reports the errors when managers actually agreed to two-for-one trades. [v5.3 prices](../../docs/data/price-history/202611280526.json) · [v5.5 prices](../../docs/data/price-history/202611280653.json) · [Independent confirmation](november-holdout.md)
