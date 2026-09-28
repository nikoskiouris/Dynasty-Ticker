# Player values

This directory is the single source of truth for Dynasty Ticker player values.

## Product contract

Dynasty Ticker publishes exactly two **full-PPR** value maps:

- **1QB PPR**
- **Superflex PPR**

The football forecast for a player is the same in both formats. Only quarterback replacement scarcity changes between them. RB, WR, and TE values are therefore identical across 1QB and Superflex. Future picks can differ because Superflex changes the value of quarterbacks in the expected rookie pool.

League settings do **not** reprice players. There is no TE premium, RB premium, half-PPR toggle, star multiplier, crowd-vote bump, or local-league price. League context answers a different question: whether a move helps a particular roster.

The browser, trade engine, league views, and CLI consume the same generated snapshot at `docs/data/player_values.json`.

## What the number means

For each player, the builder forecasts eight seasons of usable full-PPR production above a replacement player at the same position:

```
raw_value(format) =
  sum(
    discount^year *
    expected_games(year) *
    max(0, expected_ppr_per_game(year) - replacement_ppr_per_game(format, position))
  )
```

The fixed display conversion is **20 points per discounted point of lineup advantage**. It is the same ruler across formats and dates; values are never renormalized to make the top player equal 10,000.

The annual discount starts at **0.85** and the horizon at **eight seasons**. Those are explicit product assumptions, not discovered constants; `config.json` owns them.

## Inputs actually implemented

The builder avoids counting the same signal as several independent bonuses. Inputs change a forecast component instead of adding a separate percentage to final value.

### Age and experience
- exact age when available
- NFL experience
- position-specific year-to-year PPR retention
- probability of remaining in a fantasy-relevant NFL role

Historical players who lose jobs or leave the league remain in the training population. Survivor-only aging curves are not allowed.

### Opportunity
- pass attempts
- carries
- targets
- recent games with offensive involvement
- team carry/target/attempt environment
- target share and carry share
- recent role trajectory

Recent opportunity uses a four-game half-life.

### Efficiency
- completion rate
- passing yards per attempt
- passing TD and interception rates
- rushing yards and TDs per carry
- catch rate
- receiving yards and TDs per target
- full-PPR points per opportunity

Efficiency uses a 32-game half-life and small samples shrink toward historical position baselines.

### Availability and health
- recent multi-season availability
- current Sleeper injury designation

Availability changes expected games. It is not another final-value multiplier.

### Team environment and competition
- team attempts, carries, targets, and fantasy production
- the player's share of those opportunities
- recent share trend

A good offense does not receive a flat value bonus; it changes expected opportunity.

### Draft investment / young-player prior
NFL draft slot stabilizes thin young-player samples. Its influence decays quickly with NFL evidence. Established NFL role and production dominate after a meaningful sample.

### Position and format
Replacement is estimated from a **12-team reference league**, not a hard-coded QB18/RB48 lookup. The builder allocates:

- 1 QB
- 2 RB
- 3 WR
- 1 TE
- 2 FLEX
- 12 bench slots

Superflex adds one Superflex starter per team. The model fills the reference lineups from historical PPR production, then allocates the bench on scarcity-adjusted roster claims. Quarterback benches stop at **2 per team in 1QB** and **3 per team in Superflex**, so the league cannot roster every quarterback and call the alternative zero. The best remaining player at each position is the feasible alternative. If that pool is empty, the last rostered player is the alternative.

RB/WR/TE replacement is shared across formats at launch. Superflex therefore changes only QB player values. Future picks may differ because rookie-QB demand changes the expected rookie board.

## Inputs deliberately not faked

The first implementation does **not** pretend to have live route participation, first-read targets, offensive-line grades, guaranteed-money detail, a college production model, or calibrated injury-recovery curves when those feeds are not dependable in the build.

Those are documented future inputs, not silent zeroes.

## Rookies and future picks

A future pick is not an arbitrary percentage of a veteran.

Historical rookie classes are ordered from information available at draft time: NFL draft pick, then a format shift for quarterbacks, then age. Each year older than 23 moves a prospect back 4 picks. 1QB moves quarterbacks back 32 picks. Superflex moves them back only 8, so the same quarterback is earlier than in 1QB and still does not jump a whole round of skill players. `config.json` owns those shifts.

The builder measures the discounted above-replacement production those ordered rookies actually produced, then aggregates slots 1-4 / 5-8 / 9-12 into early / mid / late firsts and twelve-pick blocks into later rounds. If a later bucket's history comes out higher, the published price is capped at the earlier bucket. Early is worth at least as much as mid, and mid at least as much as late.

This remains intentionally conservative until college-production inputs are added.

## Validation

`player-values/validation.json` is generated with the snapshot.

The current holdout test is narrower than the final product claim. It asks: after a completed season, how well do learned age/availability transitions predict the next season's above-replacement production versus simply carrying forward the prior PPR rate? Transition tables and replacement levels are both frozen at the training cutoff before those seasons.

The report includes both MAEs. It does **not** claim to validate:
- eight-year career calibration
- exact trade-market clearing prices
- injury-specific recovery
- weekly lineup decisions
- rookie-pick ordering quality

A model does not earn a stronger claim until a test measures it.

## Data

The builder downloads public nflverse weekly player statistics plus player/draft metadata, then uses Sleeper for current player IDs, teams, ages/status, and NFL week. Identity joins on `gsis_id`, then ESPN id, then a unique name and position. Players with `active: false`, a retired or inactive status, or no game since the previous season are left out. Prices use the offensive box score only. Defensive stats, return scores, and opponent defense are not inputs. A two-way player charted on defense still counts on weeks with targets or carries, and those weeks score only the passes, rushes, and catches.

No KTC value, completed-trade fitted price, crowd-vote shift, or other fantasy-market ranking is an input. Upstream files and hashes are recorded in snapshot metadata.

## Refresh

```bash
python3 player-values/build.py
```

The builder validates a temporary snapshot before atomically replacing `docs/data/player_values.json`. A failed refresh leaves the prior file intact.

## Output

```json
{
  "schemaVersion": 1,
  "modelVersion": "football-forecast-v1",
  "asOf": "...",
  "sf": {"player:...": 0, "pick:...": 0},
  "oneQb": {"player:...": 0, "pick:...": 0},
  "names": {"player:...": "..."},
  "players": {
    "player:...": {
      "position": "WR",
      "team": "CIN",
      "confidence": "established",
      "components": {}
    }
  },
  "meta": {}
}
```

The `players` object explains a value. Runtime pricing comes only from `sf` or `oneQb`.
