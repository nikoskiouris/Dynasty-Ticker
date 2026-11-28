# Forecasting unearned regular-season points

The lineup component prices points a manager can still start. Once a game begins, its points leave the opportunity set. Completed games inform expected scoring and role in later games. A bye supplies neither a scoring opportunity nor a zero-point performance.

## Model

1. For each player, use his current team's unstarted regular-season games. For each game with a numeric Sleeper PPR forecast, use 75% of that forecast and 25% of the independently estimated scoring rate below. A numeric zero is an observation. For a QB without a numeric forecast, a teammate projected to handle the passing role supplies evidence of a backup game. Use 25% of the empirical rate in those games for possible role changes. If an eligible game has no direct role evidence, use the empirical forecast.
2. Start the empirical estimate with eight team games at the preseason projected PPR per game. Add observed PPR and team games so far. Count the latest four completed team games and associated PPR one additional time. For a player who switched clubs, count at least his actual appearances as elapsed opportunities. The prior fades with accumulating observations. A known absence reduces points per scheduled game, and four productive games can shift the outlook before a stale season projection changes.
3. Use 56% of empirical pace when the current injury listing is IR or PUP. This is a cohort estimate of expected remaining production. It preserves uncertainty about a return date. The explicit forward forecast retains its own 75% on covered games. An Out listing removes the current game once when the team still has that game to play. A known free agent without a scheduled forecast receives no remaining forecast. A literal zero reflects a completed schedule.
4. Re-optimize all 108 lineup slots on the remaining PPR forecasts. Removing a player from this lineup gives his remaining-season surplus in PPR. With each game played, fewer points remain available. The [pricing model](../README.md) combines this estimate with future production and market evidence.

The 75% forward blend is a judgment about the informational advantage of a dated forward projection over preseason and past scoring. Archived weekly forecasts updated after their game are unusable as earlier forecasts. The audit below measures the empirical fallback. It cannot establish the best blend weight. [Sleeper API](https://docs.sleeper.com/) · [Example dated Sleeper projection records](https://api.sleeper.com/projections/nfl/2024/13?season_type=regular&position%5B%5D=QB)

## Historical comparison

The question was whether updating a preseason forecast after Weeks 4, 8, 12 and 15 predicts subsequent regular-season full-PPR points better than carrying the initial pace forward. The forecast pool at each cutoff includes all players from the dated preseason board plus any eligible QB, RB, WR or TE appearing in a roster or scoring record available through that week. A player active only in later weeks cannot enter the earlier pool via his outcome. Eligible players with no later production receive zero. Match preseason identities with the same procedure as the [preseason audit](ranking-holdout.md).

Use the historical NFL schedule, rosters and weeks of PPR production through each cutoff for elapsed and remaining opportunities, recent role and reserve status. Use NFL outcomes after each cutoff only for scoring. Each weekly roster snapshot is treated as the roster at the end of that week. Later revisions to historical data remain possible. The baseline multiplies preseason projected points per scheduled game by games left. Both methods use the same population and team schedules. For errors, divide each player’s absolute error in remaining total PPR by the common average number of games remaining for the evaluated pool at that cutoff. Top-150 error uses preseason projected points for selection. Top-48 capture measures how much of the best 48 available players’ realized future PPR the forecast’s 48 selections delivered. [NFL weekly production](https://github.com/nflverse/nflverse-data/releases/tag/stats_player) · [Weekly rosters](https://github.com/nflverse/nflverse-data/releases/tag/weekly_rosters) · [NFL schedule](https://github.com/nflverse/nfldata/blob/master/data/games.csv)

Develop on 2020 and 2021 only (7,481 player-cutoff records). Compare preseason weights of 2, 4, 8 and 16 equivalent games and 0, 1 or 2 additional observations per recent team game. The eight-game prior with one additional recent observation gave near-minimum top-150 error. The fitted least-squares scale on 833 reserve player-cutoffs was 0.556, rounded to 0.56. The reserve group includes players who never returned and players who resumed productive roles.

Freeze those choices and compare the 2023 and 2024 seasons (7,841 player-cutoff observations). The four cutoffs within a season overlap, so they are not independent seasons. Historical forward-week Sleeper projections captured at each cutoff, including expected QB starter changes, were unavailable. Substituting finalized forecasts from later dates would leak information.

| Held-out observations | Initial pace error | Updated pace error | Initial top-150 error | Updated top-150 error | Initial top-48 capture | Updated top-48 capture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 (3,873) | 1.814 | 1.458 | 4.936 | 4.104 | 71.8% | 79.5% |
| 2024 (3,968) | 1.744 | 1.398 | 5.242 | 4.273 | 75.0% | 81.8% |
| Both | 1.778 | 1.428 | 5.089 | 4.188 | 73.4% | 80.6% |

After Week 4, held-out top-150 error declined from 4.052 to 3.770. After Week 12 it fell from 5.355 to 4.192, and after Week 15 from 6.382 to 4.959. These outcomes concern regular-season PPR. Accepted-trade prices and long-horizon dynasty outcomes require different observations.

From the repository root, reproduce development and held-out results with the Python standard library.

```sh
python3 player-values/research/inseason_forecast.py
python3 player-values/research/inseason_forecast.py --holdout
```

## November 28, 2026 spot checks

Matthew Golden’s 170-point raw season projection lagged his 180.8 settled points. Six future weekly forecasts totaled 102.83. The updated lineup forecast was 98.7 points remaining. J.J. McCarthy’s 13.62-point raw season projection lagged his new role. Seven published game projections totaled 103.73, yielding an 87.6-point remaining forecast. Mac Jones had one directly projected game and six games with evidence for a different starting QB. His remaining estimate was 9.0 points.

Puka Nacua was on IR with no future weekly forecast. His reserve-adjusted 55.6 remaining points fell below the 60.2-point WR replacement level. Removing only the IR flag would have produced 99.3. Lamar Jackson also had no published future PPR, with another QB projected to handle the passing work in his team’s remaining games. His estimate was 8.5.

Under the November 28 v2 pricing formula, 104 of 272 regular-season games remained, giving the lineup component a 13.38% weight. Replaying the board with two teams left to play their final game produced a 0.13% lineup weight and valid zero-point replacement levels. A completed schedule produced zero lineup weight and no current-season price contribution, with the forward outlook and market anchor still available.
