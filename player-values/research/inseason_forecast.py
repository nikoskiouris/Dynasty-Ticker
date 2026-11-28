"""Reproduce the time-split, rest-of-regular-season PPR audit (Python 3.10+)."""
import argparse
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

from ranking_holdout import CROSSWALK, POSITIONS, STATS, csv_rows, make_board
from inseason import remaining_forecast

SCHEDULE = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
WEEKLY = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{}.csv"
ROSTER = "https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{}.csv"
CUTOFFS = (4, 8, 12, 15)


def observations(year, schedule, crosswalk, cache, *, cutoffs=CUTOFFS):
    prior = {r["player_id"]: r for r in csv_rows(STATS.format(year - 1), cache)
             if r["season_type"] == "REG" and r["position"] in POSITIONS}
    initial = make_board(year, prior, crosswalk, cache)
    regular = 16 if year < 2021 else 17
    rosters = defaultdict(dict)
    for row in csv_rows(ROSTER.format(year), cache):
        if row["position"] in POSITIONS and row["game_type"] == "REG" and row["gsis_id"]:
            rosters[int(row["week"])][row["gsis_id"]] = row
    weekly = [r for r in csv_rows(WEEKLY.format(year), cache)
              if r["season_type"] == "REG" and r["position"] in POSITIONS]
    weeks = defaultdict(list)
    for game in schedule:
        if int(game["season"]) == year and game["game_type"] == "REG":
            for team in ("home_team", "away_team"):
                weeks[game[team]].append(int(game["week"]))

    for cutoff in cutoffs:
        pool = {i: dict(r) for i, r in initial.items()}
        latest_roster = {}
        for w in range(1, cutoff + 1):
            latest_roster.update(rosters[w])
        for i, r in latest_roster.items():
            pool.setdefault(i, {"pos": r["position"]})
        played, points, recent, future = Counter(), Counter(), Counter(), Counter()
        recent_weeks = {t: sorted(w for w in ws if w <= cutoff)[-4:] for t, ws in weeks.items()}
        last_team = {}
        for r in weekly:
            w, i, pts = int(r["week"]), r["player_id"], float(r["fantasy_points_ppr"] or 0)
            if w > cutoff:
                future[i] += pts
                continue
            pool.setdefault(i, {"pos": r["position"]})
            points[i] += pts
            played[i] += 1
            if w >= last_team.get(i, (0, None))[0]:
                last_team[i] = w, r["team"]
            if w in recent_weeks.get(r["team"], ()):
                recent[i, r["team"]] += pts
        records = []
        for i, row in pool.items():
            roster = latest_roster.get(i, {})
            team = roster.get("team") or last_team.get(i, (0, None))[1]
            if team in weeks:
                elapsed = sum(w <= cutoff for w in weeks[team])
                left = sum(w > cutoff for w in weeks[team])
                recent_n = len(recent_weeks[team])
            else:
                elapsed = cutoff * regular / (regular + 1)
                left, recent_n = regular - elapsed, 0
            row.update({"team_games": elapsed, "remaining_games": left, "actual_ppr": points[i],
                        "games": played[i], "recent_ppr": recent[i, team] if recent_n else None,
                        "recent_team_games": recent_n, "injury_status": "IR" if roster.get("status") == "RES" else None})
            records.append((dict(row, player_id=i), future[i]))
        yield (year, cutoff, regular, records)


def errors(samples, options, group="all"):
    loss, high_loss, captured = [], [], []
    for year, cutoff, season_length, records in samples:
        predicted = []
        for row, target in records:
            if options is None:
                estimate = (row.get("season_ppr") or 0) * row["remaining_games"] / season_length
            else:
                estimate = remaining_forecast(row, cutoff + 1, season_length, **options) or 0
            predicted.append((row, target, estimate))
        candidates = [r for r in predicted if group == "all" or r[0]["injury_status"] == "IR"]
        # Equal weight per player-cutoff, including nonparticipants. Divide by a
        # common league-average number of remaining games at this cutoff.
        left = sum(r[0]["remaining_games"] for r in predicted) / len(predicted)
        loss.extend(abs(actual - estimate) / left for _, actual, estimate in candidates)
        first = sorted(candidates, key=lambda r: -(r[0].get("season_ppr") or 0))[:150]
        high_loss.extend(abs(actual - estimate) / left for _, actual, estimate in first)
        ideal = sum(r[1] for r in sorted(candidates, key=lambda r: -r[1])[:48])
        if ideal:
            captured.append(sum(r[1] for r in sorted(candidates, key=lambda r: -r[2])[:48]) / ideal)
    return mean(loss), mean(high_loss), mean(captured), len(loss)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / ".cache/dynasty-ticker/ranking-holdout")
    parser.add_argument("--holdout", action="store_true", help="Evaluate the fixed candidate on later seasons")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    crosswalk, schedule = [list(csv_rows(url, args.cache_dir)) for url in (CROSSWALK, SCHEDULE)]
    years = (2023, 2024) if args.holdout else (2020, 2021)
    samples = [sample for yr in years for sample in observations(yr, schedule, crosswalk, args.cache_dir)]
    print("seasons", years, "cutoffs", CUTOFFS, "metrics: all MAE, top150 MAE, top48 capture, count")
    print("Initial projection", errors(samples, None))
    if not args.holdout:
        for prior in (2, 4, 8, 16):
            for recent in (0, 1, 2):
                print("development", prior, recent, errors(samples, {"prior_games": prior, "recent_weight": recent}))
        # Fit expected reserve production to PPR using least squares through
        # the origin. More than half the samples have zero future production,
        # so minimizing absolute error alone would discard real return upside.
        reserve_forecasts = [(remaining_forecast(r, cutoff + 1, n, reserve_multiplier=1), target)
                             for _, cutoff, n, records in samples for r, target in records
                             if r["injury_status"] == "IR"]
        slope = sum(pred * actual for pred, actual in reserve_forecasts) / sum(pred ** 2 for pred, _ in reserve_forecasts)
        print("reserve expected-PPR multiplier", len(reserve_forecasts), slope)
        for reserve in (0.0, .15, .35, .56, 1.0):
            print("reserve group", reserve, errors(samples, {"reserve_multiplier": reserve}, "IR"))
    print("Frozen fallback", errors(samples, {}))
    for year in years:
        selected = [row for row in samples if row[0] == year]
        print(year, "initial / updated", errors(selected, None), errors(selected, {}))
    for cutoff in CUTOFFS:
        selected = [row for row in samples if row[1] == cutoff]
        print("week", cutoff, "initial / updated", errors(selected, None), errors(selected, {}))


if __name__ == "__main__":
    main()
