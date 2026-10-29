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
- games with offensive involvement over about the last two seasons
- team carry/target/attempt environment
- target share and carry share
- role trajectory across the recent season, not the last month

This is a dynasty price. Opportunity uses a 17-game half-life across the last 34 games. A four-game slump nudges the role. It does not replace the prior season. A role that stays smaller for a full season does change the forecast.

### Efficiency
- completion rate
- passing yards per attempt
- passing TD and interception rates
- rushing yards and TDs per carry
- catch rate
- receiving yards and TDs per target
- full-PPR points per opportunity

Efficiency uses a 32-game half-life across the last 48 games. Small samples shrink toward historical position baselines.

### Availability and health
- recent multi-season availability
- current Sleeper injury designation

Availability changes expected games. It is not another final-value multiplier.

### Team environment and competition
- team attempts, carries, targets, and fantasy production
- the player's share of those opportunities
- recent share trend

A good offense does not receive a flat value bonus; it changes expected opportunity.

### Positional finishes
A season-long finish is total offensive PPR at the position, minimum 8 games. Rank 1 is the WR1. Several top-5 seasons pull a cold forecast back toward that player's typical top-5 scoring, and that pull fades slower when the run is long. One top-12 season is a small nudge. The pull only goes up. It is full through age 28.

### Draft investment
Early-career production by draft bucket sets an anchor. A top-10 pick keeps part of the 75th percentile of that bucket. A late pick does not. The pull only goes up, only after 4 games, and it fades with seasons of evidence. It is smaller than the production gap between two young players, so a better producer stays ahead of a higher pick who has not produced. It is full at age 22 and gone by 29.

A player with few NFL games is also priced from his draft slot. The slot value is the median four-season outcome of past players at the same position and NFL draft range, the same window and ruler that prices rookie picks. It carries weight `8 / (8 + career games)` and fades to nothing by the fourth season. A draft range with fewer than 6 past players borrows the neighboring ranges. So a rookie who has not played yet is priced like his pick, and one big game from a seventh-rounder does not count as a full role.

### Age
The first forecast year uses the measured next-season rate for the player's tier and age. That rate already holds one season of pull toward average, and the role haircut for an unproven player applies that year only. Later years apply a pure age curve per position: next-season scoring change with the pull toward average fitted out. Past the peak age, the curve never softens and never rises, because old players in the sample are the ones still good enough to play. A rate borrowed from a younger age also pays the aging between the two ages.

The chance of playing next season is the tier rate shrunk toward all players at that position and age. Past the last well-measured age it fades 15% per year, and it is zero past the oldest season on record at the position. A player under 26 who missed time is pulled back toward a normal game rate. Two top-12 seasons lock a role. One hot year does not. A weekly Out tag trims the rest of this season. IR is the designation that cuts the year. The snapshot emits the learned curve (`meta.aging`), the fitted pull toward average (`meta.regressionToAverage`), and the career-end ages (`meta.careerEndAge`).

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

Historical rookie classes are ordered from information available at draft time: NFL draft pick, then a format shift for quarterbacks, then age. Each year older than 23 moves a prospect back 4 picks. 1QB moves quarterbacks back 32 picks. Superflex moves them back only 8, so the same quarterback is earlier than in 1QB and still does not jump a whole round of skill players. `config.json` owns those shifts. A Superflex pick is never priced under the same 1QB pick, because every Superflex player value is at least his 1QB value.

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

The refresh workflow runs every day at 11:17 UTC. GitHub only starts that schedule from the default branch. After the build, `scripts/prices_unchanged.py` compares `docs/data/player_values.json` and `player-values/validation.json` to HEAD with `asOf` and `generatedAt` removed. When that is the only difference, the workflow restores those files and does not archive. Otherwise it runs `scripts/archive_price_snapshot.py`. The commit step then runs `git diff --cached --quiet` on those data files and skips the commit when the tree is clean.

A data commit is `data: refresh independent player values [skip netlify]`. It pushes to `develop` only. Live publishes still come from promoting `develop` to `prod`. `netlify.toml` sets `ignore = "bash ./scripts/netlify-ignore.sh"`, and that script exits 0 for every git-connected build, so the daily commit does not deploy even if that ignore command is what Netlify runs.

Shared trade links and the trend helpers read one archive, `docs/data/price-history/`. Each snapshot file is immutable:

```json
{
  "asOf": "2026-10-14T19:17:17+00:00",
  "sf": { "player:4984": 14620, "player:6794": 7803 },
  "oneQb": { "player:4984": 8175, "player:6794": 7803 }
}
```

The filename is the UTC stamp `YYYYMMDDHHmm` from `asOf`. `sf` and `oneQb` are the full price maps, the same keys as `player_values.json`. `index.json` (`schemaVersion` 1) lists `{ stamp, asOf }`. The page fetches that index and only the snapshots inside the trend window, plus the one snapshot just before it. A file more than 90 days older than the newest is dropped. The newest file is always kept. An existing stamp is never rewritten, so the same `asOf` writes nothing. To run the schedule on Tuesdays only, set the workflow cron back to `17 11 * * 2`.

## Output

```json
{
  "schemaVersion": 1,
  "modelVersion": "football-forecast-v1",
  "asOf": "...",
  "generatedAt": "...",
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
