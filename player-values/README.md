# Dynasty player values

This board estimates the trade value of players and rookie picks on a 0–100 scale in a 12-team dynasty league with full PPR and a superflex. The assumed lineup per team is one QB, two RBs, three WRs, one TE, one RB/WR/TE flex and one QB/RB/WR/TE superflex. All four positions receive one point per reception.

## What the board must do

- Publish one price for an asset across rankings, player details, league rosters and the calculator.
- Let a receiver win a superflex spot when he outscores the next quarterback. A player's lineup advantage is the drop in the best legal league-wide lineup when he is removed.
- Distinguish prospects with different future outlooks even when their current projections match. Use independently observed market prices for picks.
- Show where a price came from, identify missing inputs and retain the last valid board if a required source fails.
- Keep dated trade links readable across the model transition. Compare price changes across snapshots calculated with the same valuation formula.

## Research

The [design study](research/format-design.md) explains the choice of a lineup-based approach, compares roster assumptions and works through Josh Allen's 2023 replacement using the actual player pool. In five of six seasons the highest-scoring legal lineup started 24 quarterbacks. In the sixth, two receivers earned superflex slots. This is a season-total measure of lineup scarcity. A manager setting a lineup each week can substitute around injuries and bye weeks.

The [production study](research/production-evidence.md) estimates how much prior finish, age and NFL draft round tell us about later full-PPR scoring. For 1,440 held-out player-seasons, mean absolute error per scheduled team game was 4.111 for repeating last year's production, 3.778 after grouping by position and finish, and 3.705 after adding age. A separate check using an archived preseason projection beat repeating the prior year for all four positions. Both tests informed which evidence to include.

## How a price is built

| Component | Opening weight | What it measures |
| --- | ---: | --- |
| Future production | 40% | Sustainable production relative to the lineup boundary, with retention by position and age. NFL draft evidence contributes part of this component for rookies and second-year players. |
| Current lineup advantage | 35% | The drop in projected **remaining** regular-season PPR across all 108 starter slots when this player is removed. |
| Market | 25% | An independent FantasyCalc dynasty quote for 12 teams, two QBs and full PPR. The provider's two-QB setting is a proxy for the league's superflex market. |

As clubs play their schedules, current lineup advantage receives less weight and future production receives more. The lineup weight is 35% times the league-wide fraction of games still available. At the end of the regular season, future production receives 75% and market evidence receives 25%. This time allocation is a modeling assumption for a neutral dynasty manager.

During the season, the model uses the team's upcoming regular-season schedule and Sleeper's projections for those games. It incorporates recent scoring, the player's availability and the preseason expectation where coverage is incomplete. Games that have kicked off are excluded from the remaining opportunity. The player page shows both the estimate for games still ahead and Sleeper's separate full-season projection. See the [in-season forecast study](research/inseason-forecast.md) for the estimator and its evaluation.

The percentages apply after scaling the component scores to the same range. They are design weights. Their relative contribution for a particular player depends on his inputs. The highest-valued player sets the scale at 100. Player and pick values retain two decimal places of precision. The component amounts add up to each player’s published price. Trade packages and rosters sum individual values and can exceed 100. Missing market evidence contributes zero. A player without positive contributions receives no price. The user-facing price is a relative trade estimate, in units distinct from PPR points or dollars.

The [future-production study](research/future-blend.md) found little overall benefit from dropping prior-season evidence in a 504-player-season comparison. The future estimate blends the full-season projection (six games of weight), last season's total (up to eight games of weight) and current production annualized over estimated elapsed team games. It splits the resulting outlook equally between the individual player's age-adjusted surplus and the historical surplus of players at a similar positional rank. This gives reserves some value for the chance they earn a starting role. The second future season receives 85% of the first's weight. When NFL draft round is available, it supplies up to 65% of the rookie's future component and up to 25% in year two. Its influence fades with NFL appearances.

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

The builder uses the Python standard library. Supply `--save-inputs /tmp/dynasty-inputs.json` on the build command to retain that run's normalized observations. The board carries its own model version, retrieval time, reference lineup, weights and replacement thresholds. Each player record carries his factor contributions and available evidence. The public source endpoints expose a retrieval time without individual quote timestamps. When a weekly forecast is unavailable, the model uses the historical scoring estimate for that game. An unavailable required feed or insufficient board coverage stops publication. Dated share links retain access to older snapshots. Price trends include the final v2 board after converting its prices to 0–100 units. Earlier pricing formulas keep their own history. New archives record their scale explicitly.

## Validation and limitations

The [historical ranking audit](research/ranking-holdout.md) compares the football components with preseason baselines. Dated market quotes for the required settings were unavailable. The 25% market weight, pick prices and fit to accepted trades remain unvalidated by that audit. The in-season forecast and late-career QB studies use subsequent NFL production as their outcome. KeepTradeCut's half-PPR ranks serve as an external comparison.


On November 28, 104 of the 272 NFL regular-season games had yet to start. The board therefore assigned 13.38% to remaining lineup value, 61.62% to future production and 25% to the market. Matthew Golden's full-season source projection was 170 PPR points and he had already scored 180.8. For his six remaining games, the model estimated 98.7 more points. He moved from 66th to 42nd among players. Jonah Coleman moved from 101st to 91st. His final weekly score sheets showed 113.0 points in seven appearances, including a Friday game still missing from the aggregate season feed. The remaining-season estimate was 83.1.

The revised QB curve reduced held-out mean absolute error from 2.536 to 2.376 two-year surplus PPR points per scheduled game for 22 starter-seasons at age 35 or older. Only eight individual quarterbacks contributed those seasons. Dak Prescott, age 33, now ranks 12th, ahead of Caleb Williams at 20th. Williams has the higher remaining-season forecast, while Prescott's recent and prior production support the higher two-year estimate. [QB aging study](research/production-evidence.md)
