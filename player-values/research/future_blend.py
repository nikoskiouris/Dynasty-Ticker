"""Manually compare sources of week-12 evidence for production in the next two NFL seasons."""
import argparse
from collections import defaultdict
from pathlib import Path
from statistics import mean

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


def evaluate(board, next_season, second_season, samples):
    selection = list(groups(board))
    for method in METHODS:
        forecasts = {p: estimate(method, row) for p, row in board.items()}
        scores = {pos: sorted(f for p, f in forecasts.items() if board[p]["pos"] == pos and f > 0)
                  for pos in LIMIT}
        levels = replacement_levels(scores)
        for player, labels in selection:
            row = board[player]
            pos = row["pos"]
            outlook = expected_surplus(pos, forecasts[player], levels[pos], row["age"], scores[pos])
            draft, share = prospect_prior(row)
            predicted = (1 - share) * outlook + share * draft
            realized = (next_season.get(player, 0) + .85 * second_season.get(player, 0)) / 1.85
            for label in labels:
                samples[label, method].append(abs(predicted - realized))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / ".cache/dynasty-ticker/ranking-holdout")
    cache = parser.parse_args().cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    bios = list(audit.csv_rows(audit.CROSSWALK, cache))
    stats = {year: {r["player_id"]: r for r in audit.csv_rows(audit.STATS.format(year), cache)
                    if r["season_type"] == "REG" and r["position"] in LIMIT}
             for year in range(2019, 2026)}
    realized = {year: audit.marginal({p: {"pos": r["position"], "points": float(r["fantasy_points_ppr"])}
                                      for p, r in season.items()}, "points")
                for year, season in stats.items()}
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
