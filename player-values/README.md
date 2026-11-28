# Dynasty player values

This board estimates the trade value of players and rookie picks in a 12-team dynasty league with full PPR and a superflex. The assumed lineup per team is one QB, two RBs, three WRs, one TE, one RB/WR/TE flex and one QB/RB/WR/TE superflex. All four positions receive one point per reception.

## What the board must do

- Publish one price for an asset across rankings, player details, league rosters and the calculator.
- Let a receiver win a superflex spot when he outscores the next quarterback. A player's lineup advantage is the drop in the best legal league-wide lineup when he is removed.
- Distinguish prospects with different future outlooks even when their current projections match. Use independently observed market prices for picks.
- Show where a price came from, identify missing inputs and retain the last valid board if a required source fails.
- Keep dated trade links readable across the model transition. Compare price changes within the same model version.

## Research

The [design study](research/format-design.md) explains the choice of a lineup-based approach, compares roster assumptions and works through Josh Allen's 2023 replacement using the actual player pool. In five of six seasons the highest-scoring legal lineup started 24 quarterbacks. In the sixth, two receivers earned superflex slots. This is a season-total measure of lineup scarcity. A manager setting a lineup each week can substitute around injuries and bye weeks.

The [production study](research/production-evidence.md) estimates how much prior finish, age and NFL draft round tell us about later full-PPR scoring. For 1,440 held-out player-seasons, mean absolute error per scheduled team game was 4.111 for repeating last year's production, 3.778 after grouping by position and finish, and 3.705 after adding age. A separate check using an archived preseason projection beat repeating the prior year for all four positions. Both tests informed which evidence to include.

## How a price is built

| Component | Weight | What it measures |
| --- | ---: | --- |
| Future production | 40% | Sustainable production relative to the lineup boundary, with retention by position and age. NFL draft evidence contributes part of this component for rookies and second-year players. |
| Current lineup advantage | 35% | The change in the highest projected full-PPR total across all 108 starter slots if this player is removed. |
| Market | 25% | An independent FantasyCalc dynasty quote for 12 teams, two QBs and full PPR. The provider's two-QB setting is a proxy for the league's superflex market. |

The percentages apply after scaling the component scores to the same range. They are design weights. Their relative contribution for a particular player depends on his inputs. The model scales the largest combined player price to 10,000 and rounds each contribution so the displayed numbers sum to the price. Missing market evidence contributes zero. A player without positive contributions receives no price. The user-facing price is a relative trade estimate, in units distinct from PPR points or dollars.

The future estimate blends the full-season projection (six games of weight), last season's total (up to eight games of weight) and current production annualized over estimated elapsed team games. It splits the resulting outlook equally between the individual player's age-adjusted surplus and the historical surplus of players at a similar positional rank. This gives reserves some value for the chance they earn a starting role. The second future season receives 85% of the first's weight. When NFL draft round is available, it supplies up to 65% of the rookie's future component and up to 25% in year two. Its influence fades with NFL appearances.

Picks have no NFL production to project. For a quoted pick, the model finds players with comparable external quotes, groups them in sets of 12, and interpolates their median board prices. It enforces a nondecreasing price as the quote rises. This puts a 2027 first and a veteran with similar market support on a comparable scale. Each pick year and round needs its own source evidence. [FantasyCalc API documentation](https://www.fantasydatapros.com/fantasyfootball/blog/fantasycalc/1)

## Refresh and inspect

From the repository root, run:

```sh
python3 scripts/update_nfl_draft_picks.py
python3 player-values/build_trade_values.py
python3 scripts/check_market_files.py --fail-on-age
python3 scripts/build_sitemap.py
python3 scripts/archive_price_snapshot.py
```

The builder uses the Python standard library. Supply `--save-inputs /tmp/dynasty-inputs.json` on the build command to retain that run's normalized observations. The board carries its own model version, retrieval time, reference lineup, weights and replacement thresholds. Each player record carries his factor contributions and available evidence. The public source endpoints expose a retrieval time without individual quote timestamps. Source failure or insufficient board coverage stops publication. Historical snapshots remain readable for dated share links and are excluded from price trends across the model transition.

## Validation and limitations

The [historical ranking audit](research/ranking-holdout.md) re-ran the football model on archived preseason forecasts from four seasons. It identified 108 of 192 top-48 entries by realized two-season lineup surplus. Single-season projected surplus identified 104, prior-season points 101 and raw projected points 116. The model selected 45 quarterbacks across those groups, compared with 65 in the realized groups. Three of the four origins were inspected during development, and some outcome seasons overlap. Dated market quotes for the required settings were unavailable. The audit measures the football components and leaves the market weight, pick prices and fit to accepted trades unvalidated.

On the November 28, 2026 board, Josh Allen was worth 8,331 points. His contributions were 2,846 from lineup advantage, 3,132 from future production and 2,353 from the market. Rebuilding the same input board with only his projected season PPR raised by 17 increased his price to 8,733. Increasing only his age by four years reduced it to 7,736. A full-board check found that his removal lowered the best legal lineup by 133.66 projected PPR points. These checks exercise the model's behavior under a change in one input.
