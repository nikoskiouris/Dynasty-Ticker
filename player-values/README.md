# Player values

This directory is the single source of truth for Dynasty Ticker player values.

## Product contract

Dynasty Ticker publishes exactly one value map: **12-team Superflex full-PPR dynasty**. All players and picks use the same reference league. Connected league settings never change the price.

League settings do **not** reprice players. There is no TE premium, RB premium, half-PPR toggle, star multiplier, crowd-vote bump, or local-league price. League context answers a different question: whether a move helps a particular roster.

The browser, trade engine, and league views consume the same generated snapshot at `docs/data/player_values.json`.

## What the number means

For each player the forecast answers one question a season at a time: how many full-PPR points above a replacement player should we expect from him?

```
value =
  sum over the next eight seasons of games (
    discount ^ years_until_that_season_kicks_off *
    expected_points_above_replacement(season)
  )
```

The fixed display conversion is **20 points per discounted point of lineup advantage**. It is one ruler across dates; values are never renormalized to make the top player equal 10,000.

The annual discount is **0.85** and the horizon is **eight seasons of games**. Those are product choices, not discovered constants; `config.json` owns them. The backtest does not test them.

Every price is the sum of its forecast seasons. The snapshot lists them under `players[...].forecast`, with data-integrity validation during generation.

## The files

- `forecast.py` is the forecast. Standard library only.
- `build.py` downloads the data, joins Sleeper to nflverse, and writes the snapshot.
- `backtest.py` rebuilds the forecast at past kickoffs and scores it against what happened.
- `config.json` owns every setting.
- `validation.json` is the last backtest report.

## How the forecast works

### One year ahead

A player's season is three numbers, all measured against the replacement line:

- **banked**: points above replacement he actually scored, `max(0, ppg - replacement) * games`
- **pace**: the same rate over a full 16 games, so an injured star still reads as a star
- **games**: the share of the season he played

Next season's three numbers are forecast from his last two seasons, his age, and, through his third year, his NFL draft slot. The relationship is a ridge regression, fit separately for QB, RB, WR, and TE, on the **15 most recent seasons** only. Football has changed since 1999: young players keep about a third less of their value five years out than they did in the 2000s. A forecast trained on old careers runs high.

There is no free constant. A player earns expected value through recent production or recent games, so someone who has left the league fades to zero instead of collecting an average forever. A missed season is zeros, not the end: the season before still counts, and the forecast expects most players back.

A star who played three games did not become a three-game sample. For the share of last season a player missed, his pace is read from the level he had established over the three seasons before, fading 15% for each year since he showed it. A full season is taken as it was. In the backtest, players coming off a mostly-missed season produced 32% more than forecast without this and 11% more with it.

Three safeguards sit on the fitted line. None of them adds value by hand.

- A better season never forecasts less. Where the fit would say otherwise, that slope is held at zero.
- The line can bend at three high pace levels, because the best seasons regress the hardest.
- A last step moves each forecast level to what players at that level actually averaged. It narrows a tendency to run high on the very best players. It does not remove it: the report shows the top dozen still about 10% high.

### Chained forward

The forecast for next season becomes the input for the season after, for eight seasons. Each step ages the player one year. Because each step is an expected value that is linear in his own numbers, chaining keeps it an expected value. There is no "survival" switch that turns a player off for good.

### Rookies and young players

Before a rookie has played, his forecast is his draft slot: what past players at his position and slot went on to do. Draft slot keeps counting through year three and fades as real seasons arrive. In those years the slot counts separately for the share of last season a player missed, because a high pick who sat out is not the same as one who played poorly. In the data, first-round receivers who missed most of their rookie year went on to less, not more.

An earlier pick is never forecast below a later one. A pick earlier than any the position has produced is priced like the earliest one it has.

### During the season

Before kickoff the current season is the forecast. After week 17 it is what happened. In between, the weeks left are a blend: this season's pace counts `weeks / (weeks + 4)` against the kickoff forecast. The backtest replays week 10 of every season to check that the blend beats ignoring this season and beats trusting it alone.

Weeks already played are spent, so a price eases down through the season. A ninth season fills in behind, so the forecast always covers eight seasons of games.

A weekly Out, Doubtful, or Questionable tag trims the weeks left. IR cuts them in half. Those multipliers are set by hand and are not tested.

### Time

Each future season is discounted by how far away its kickoff is on the pricing date. That date is the Tuesday of the current week, so prices move when games or the week change, not every midnight. Nothing jumps when the season turns over: the day after week 17 and the first day of the next league year price the same future the same way. `backtest.py` and the snapshot check it by construction: a rookie at kickoff and his pick use the same function.

## Replacement

Replacement is estimated from a **12-team reference league**, not a hard-coded QB18/RB48 lookup. The builder allocates:

- 1 QB
- 2 RB
- 3 WR
- 1 TE
- 2 FLEX
- 12 bench slots

Superflex adds one Superflex starter per team. The model fills the reference lineups from historical PPR production, then allocates the bench on scarcity-adjusted roster claims. Quarterback benches stop at **3 per team in Superflex**. The best remaining player at each position is the alternative. If that pool is empty, the last rostered player is.

The line is the median of the **last 14 seasons**, because scoring has drifted since 1999.

A quarterback's game counts only when he threw at least 10 passes. A kneel-down or a gadget snap is not a start, and nobody starts him in fantasy that week. Counting those appearances made the Superflex line whichever backup happened to rank 37th: 9.5 points a game one year and 0.7 the next. Counting starts, fewer quarterbacks have 8 of them than a Superflex league rosters, so the line is the last real starter: between 8.5 and 11.6 points in each of the last twelve seasons.

RB/WR/TE replacement is shared across formats. Superflex therefore changes only QB player values.

The replacement level is still a product choice. This one is the waiver wire: the best player nobody rosters. A line set at the last starter instead would make stars worth more and depth worth less. The backtest cannot settle that, because it scores against whichever line is chosen.

## Future picks

A pick is priced as the rookie it becomes.

Every drafted QB, RB, WR, and TE from the last 10 classes gets the same eight-season forecast a player gets, as of his first kickoff. Each class is ordered by that value. Slots 1-4, 5-8, and 9-12 average into early, mid, and late firsts, and twelve-slot blocks into later rounds. Then the price is discounted for the wait until that rookie can first play.

This is one ruler. On the day he can first play, an unplayed rookie is worth what his pick was. `backtest.py` and the snapshot check it by construction: a rookie at kickoff and his pick use the same function.

Means, not medians. A late pick is mostly misses and a few hits, and the hits are the value. Pricing a third-round pick at its median outcome prices it near zero.

This year's picks are listed until the NFL draft ends in late April, then they are players.

A rookie's age does not change his forecast yet, and the board is ordered by the forecast, not by how real rookie drafts go. Neither is tested against real drafts.

## Who is priced

The builder downloads public nflverse weekly player statistics from 1999 on, plus player and draft metadata, then uses Sleeper for current player IDs, teams, injury status, and the NFL week.

- Sleeper joins nflverse on `gsis_id`, then ESPN id, then name. Every join is checked against the birthday both sources carry. A namesake born years apart is someone else and is not priced off that record. A Sleeper id that points at a different player is ignored.
- Age is the birthday on September 1, the same definition the forecast is trained on. Sleeper's whole-number `age` is often a year or more stale and is the last resort.
- First NFL year is the earliest of draft year, listed rookie season, and first game. One upstream column lists the whole 2012 class as 2013.
- A player with no game since the season before last is left out. So is a player drafted two or more years ago who never played. `active: false` and retired or inactive statuses with no team are left out.
- Prices use the offensive box score only. Defensive stats, return scores, and opponent defense are not inputs. A two-way player charted on defense still counts on weeks with targets or carries.

No KTC value, completed-trade fitted price, crowd-vote shift, or other fantasy-market ranking is an input. Upstream files and hashes are recorded in snapshot metadata.

## Known lean

Established players coming off a shortened season are still forecast about 30% low at QB, RB, and TE (about right at WR). History is harsh on them on average: for every Aaron Rodgers 2014 there is a player who never came back. The forecast prices the average, and it prices it a little too low. A hurt star will read cheaper here than in a market that expects the comeback.

## Not modeled

Live route participation, first-read targets, offensive-line grades, contracts, depth charts, college production, and injury-specific recovery. They are documented gaps, not silent zeroes.

## Validation

```bash
python3 player-values/backtest.py            # print the report
python3 player-values/backtest.py --write    # also save validation.json
```

The backtest rebuilds the whole forecast at each past kickoff from earlier games only, then compares it with the points above replacement those players produced over the next one, three, five, and eight seasons. It runs the same replay for two naive forecasts: he repeats last season, and he repeats a blend of his last two. The players scored are the top 200 by last season plus recent early draft picks, chosen before the outcome is known.

It reports two things.

- **Order.** Rank correlation between the forecast and what happened, and how much of the best 60 players' production the forecast's top 60 captured.
- **Level.** Realized points over forecast points, by forecast year, by age group, by position, and by forecast rank. 1.00 is exact. Below 1 means the forecast ran high.

The numbers live in `validation.json` and in the snapshot under `meta.validation`. They are not copied here, so they cannot go stale.

Rules the report is meant to meet. There is no automated test suite (owner policy), so check them by reading `validation.json` after running `backtest.py --write`:

- The saved report must be for the model version in `config.json`. Change the forecast and run the backtest again before shipping.
- The forecast should beat both naive forecasts at every horizon.
- Totals should land within 10% of what happened, and every forecast year within 20%.
- A replay must not see the future: it trains only on seasons before the kickoff and prices from earlier games only.

What it does **not** test:

- trade-market prices
- the 0.85 discount and the replacement definition
- the pick board against real rookie drafts
- in-season updates at weeks other than the one replayed
- injury-specific recovery
- weekly lineup decisions

A model does not earn a stronger claim until a test measures it.

## Refresh

```bash
python3 player-values/build.py
```

The builder validates a temporary snapshot before atomically replacing `docs/data/player_values.json`. A failed refresh leaves the prior file intact.

The refresh workflow runs every day at 11:17 UTC. GitHub only starts that schedule from the default branch. Before the build it runs `backtest.py --write --if-stale`, which does nothing unless a season has finished since the report was saved. After the build, `scripts/prices_unchanged.py` compares `docs/data/player_values.json` and `player-values/validation.json` to HEAD with `asOf` and `generatedAt` removed. When that is the only difference, the workflow restores those files and does not archive. Otherwise it runs `scripts/archive_price_snapshot.py`. The commit step then runs `git diff --cached --quiet` on those data files and skips the commit when the tree is clean.

A data commit is `data: refresh independent player values [skip netlify]`. It pushes to `develop` only. Live publishes still come from promoting `develop` to `prod`. `netlify.toml` sets `ignore = "bash ./scripts/netlify-ignore.sh"`, and that script exits 0 for every git-connected build, so the daily commit does not deploy even if that ignore command is what Netlify runs.

Shared trade links and the trend helpers read one archive, `docs/data/price-history/`. Each snapshot file is immutable:

```json
{
  "asOf": "2026-10-14T19:17:17+00:00",
  "sf": { "player:4984": 14620, "player:6794": 7803 }
}
```

The filename is the UTC stamp `YYYYMMDDHHmm` from `asOf`. `sf` is the full price map; legacy snapshots may contain an ignored alternate map,, the same keys as `player_values.json`. `index.json` (`schemaVersion` 1) lists `{ stamp, asOf, modelVersion }`. A row with no `modelVersion` was priced by `football-forecast-v1`. The site only draws a trend across snapshots from the model it is running, so a model change never shows up as every player moving at once. Shared trade links still read any stamp. The page fetches that index and only the snapshots inside the trend window, plus the one snapshot just before it. A file more than 90 days older than the newest is dropped. The newest file is always kept. An existing stamp is never rewritten, so the same `asOf` writes nothing. To run the schedule on Tuesdays only, set the workflow cron back to `17 11 * * 2`.

## Output

```json
{
  "schemaVersion": 1,
  "modelVersion": "football-forecast-v2",
  "asOf": "...",
  "generatedAt": "...",
  "sf": {"player:...": 0, "pick:...": 0},
  "names": {"player:...": "..."},
  "players": {
    "player:...": {
      "position": "WR",
      "team": "CIN",
      "confidence": "established",
      "components": {},
      "forecast": {"sf": [{"season": 2026, "expectedAdvantage": 0, "weight": 1, "discount": 1, "discountedAdvantage": 0}]}
    }
  },
  "meta": {}
}
```

The `players` object explains a value. Runtime pricing comes only from `sf`. `forecast.sf` lists the seasons that add up to the price.
