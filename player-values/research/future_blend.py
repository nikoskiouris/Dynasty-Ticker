"""Manually compare sources of week-12 evidence for production in the next two NFL seasons."""
import argparse
from collections import defaultdict
from pathlib import Path
from statistics import mean

import inseason_forecast as inseason
import ranking_holdout as audit
from dynasty_value import expected_surplus, future_production, prospect_prior, replacement_levels

ORIGINS = (2020, 2021, 2023)
LIMIT = {"QB": 32, "RB": 48, "WR": 64, "TE": 24}
WEEKLY = audit.STATS.replace("stats_player_reg_", "stats_player_week_")
METHODS = ("Published blend", "Four prior games", "Zero prior games", "Preseason alone", "Current pace alone")


def current_inputs(year, board, cache):
    by_player = defaultdict(list)
    for row in audit.csv_rows(WEEKLY.format(year), cache):
        if row["season_type"] == "REG" and int(row["week"]) <= 11:
            by_player[row["player_id"]].append(float(row["fantasy_points_ppr"] or 0))
    for player, row in board.items():
        games = by_player[player]
        row.update(games=len(games), actual_ppr=sum(games))


def groups(board):
    for pos, limit in LIMIT.items():
        players = sorted((p for p in board if board[p]["pos"] == pos),
                         key=lambda p: -board[p]["season_ppr"])
        for player in players[:limit]:
            row = board[player]
            labels = ["All"]
            if pos == "QB":
                labels.append("QB")
                if row["age"] is not None and row["age"] <= 26:
                    labels.append("QB age <=26")
                if row["age"] is not None and 31 <= row["age"] < 35:
                    labels.append("QB age 31-34")
            if row["actual_ppr"] * 18 / 11 >= 1.35 * row["season_ppr"]:
                labels.append("High current pace")
            yield player, labels


def estimate(method, row):
    if method == "Preseason alone":
        return row["season_ppr"]
    if method == "Current pace alone":
        return 17 * row["actual_ppr"] / max(11 * 17 / 18, row["games"])
    cap = {"Published blend": 8, "Four prior games": 4, "Zero prior games": 0}[method]
    return future_production(dict(row, last_games=min(row["last_games"] or 0, cap)), 12)


def forecast_errors(board, forecasts, selected, next_season, second_season):
    scores = {pos: sorted(f for p, f in forecasts.items() if board[p]["pos"] == pos and f and f > 0)
              for pos in LIMIT}
    levels = replacement_levels(scores)
    for player in selected:
        row = board[player]
        pos = row["pos"]
        outlook = expected_surplus(pos, forecasts[player], levels[pos], row.get("age"), scores[pos])
        draft, share = prospect_prior(row)
        predicted = (1 - share) * outlook + share * draft
        realized = (next_season.get(player, 0) + .85 * second_season.get(player, 0)) / 1.85
        yield player, predicted - realized


def evaluate(board, next_season, second_season, samples):
    selection = dict(groups(board))
    for method in METHODS:
        forecasts = {p: estimate(method, row) for p, row in board.items()}
        for player, error in forecast_errors(board, forecasts, selection, next_season, second_season):
            labels = selection[player]
            for label in labels:
                samples[label, method].append(abs(error))


def reserve_audit(years, realized, bios, cache):
    """Compare treatments of missed games for players on the week-12 reserve list."""
    schedule = list(audit.csv_rows(inseason.SCHEDULE, cache))
    errors = defaultdict(list)
    for year in years:
        roster = [r for r in audit.csv_rows(inseason.ROSTER.format(year), cache)
                  if r["week"] == "12" and r["game_type"] == "REG" and r["position"] in LIMIT]
        reserve = {r["gsis_id"] for r in roster if r["status"] == "RES"
                   and r["status_description_abbr"] in ("", "R01") and r["gsis_id"]}
        reserve.difference_update(r["gsis_id"] for r in roster if r["status"] in ("ACT", "INA"))
        _, _, _, records = next(inseason.observations(year, schedule, bios, cache, cutoffs=(12,)))
        # Keep the published v5.1 reserve comparison on its original exposure.
        board = {row["player_id"]: dict(row, team_games=None) for row, _ in records}
        for method in ("Published", "Half missed exposure", "Prior evidence only"):
            predicted = {}
            for key, row in board.items():
                played = row.get("games") or 0
                if key in reserve and played:
                    if method == "Half missed exposure":
                        elapsed = max(played, 12 * 17 / 18)
                        row = dict(row, team_games=(elapsed + played) / 2)
                    elif method == "Prior evidence only":
                        row = dict(row, actual_ppr=None, games=None)
                predicted[key] = future_production(row, 13)
            for key, error in forecast_errors(board, predicted, sorted(reserve & board.keys()),
                                              realized[year+1], realized[year+2]):
                row, pos = board[key], board[key]["pos"]
                labels = ["All"]
                if 0 < (row.get("games") or 0) < 12 * 17 / 18:
                    labels.append("Appeared and missed games")
                if pos == "QB":
                    labels.append("QB")
                for label in labels:
                    errors[label, method].append(error)
    print("Cohort | Method | Observations | Bias | MAE | RMSE")
    for (label, method), values in errors.items():
        print(label, method, len(values), f"{mean(values):.2f}", f"{mean(map(abs, values)):.2f}",
              f"{mean(v**2 for v in values)**.5:.2f}", sep=" | ")


def schedule_audit(realized, bios, cache):
    """Compare both elapsed-game counts with the same 2024–25 realized outcomes."""
    schedule = list(audit.csv_rows(inseason.SCHEDULE, cache))
    print("2023 week | Players | Week-average MAE | Club-schedule MAE")
    for _, cutoff, _, records in inseason.observations(2023, schedule, bios, cache):
        board = {row["player_id"]: row for row, _ in records}
        top = []
        for pos, limit in LIMIT.items():
            projected = [p for p, r in board.items() if r["pos"] == pos and r.get("season_ppr") is not None]
            top.extend(sorted(projected, key=lambda p: -board[p]["season_ppr"])[:limit])
        errors = []
        for use_schedule in (False, True):
            forecasts = {p: future_production(r if use_schedule else dict(r, team_games=None), cutoff + 1)
                         for p, r in board.items()}
            signed = forecast_errors(board, forecasts, top, realized[2024], realized[2025])
            errors.append(mean(abs(error) for _, error in signed))
        print(cutoff, len(top), *(f"{v:.3f}" for v in errors), sep=" | ")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / ".cache/dynasty-ticker/ranking-holdout")
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--reserve", choices=("development", "holdout"), help="Audit Week 13 injured-reserve exposure")
    selection.add_argument("--schedule", action="store_true", help="Compare calendar and club-game exposure")
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    bios = list(audit.csv_rows(audit.CROSSWALK, cache))
    stats = {year: {r["player_id"]: r for r in audit.csv_rows(audit.STATS.format(year), cache)
                    if r["season_type"] == "REG" and r["position"] in LIMIT}
             for year in range(2019, 2026)}
    realized = {year: audit.marginal({p: {"pos": r["position"], "points": float(r["fantasy_points_ppr"])}
                                      for p, r in season.items()}, "points")
                for year, season in stats.items()}
    if args.reserve:
        reserve_audit((2018, 2020) if args.reserve == "development" else (2023,), realized, bios, cache)
        return
    if args.schedule:
        schedule_audit(realized, bios, cache)
        return
    samples = defaultdict(list)
    for year in ORIGINS:
        board = audit.make_board(year, stats[year - 1], bios, cache)
        current_inputs(year, board, cache)
        evaluate(board, realized[year + 1], realized[year + 2], samples)
    print("Group | Player-seasons | " + " | ".join(METHODS))
    for group in ("All", "QB", "QB age <=26", "QB age 31-34", "High current pace"):
        values = [f"{mean(samples[group, method]):.1f}" for method in METHODS]
        print(f"{group} | {len(samples[group, METHODS[0]])} | " + " | ".join(values))


if __name__ == "__main__":
    main()
