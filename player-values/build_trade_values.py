#!/usr/bin/env python3
"""Build the 12-team superflex PPR board from independent, contemporaneous feeds."""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dynasty_value import VALUE_SCALE, value_board
from value_inputs import DATA, ROOT, collect

sys.path.insert(0, str(ROOT / "scripts"))
from check_market_files import MODEL_VERSION, check_player_values
from update_nfl_draft_picks import atomic_write_text


def assemble(inputs):
    players = inputs["players"]
    picks = inputs["picks"]
    results, pick_results, diagnostics = value_board(players, picks, season_week=inputs["seasonWeek"])
    names, sf, details, quotes = {}, {}, {}, {}
    for player_id, result in results.items():
        row = players[player_id]
        key = f"player:{player_id}"
        sf[key], names[key] = result["value"], row["name"]
        if "market" in result["coverage"]:
            quotes[key] = row["market"]
        details[key] = {
            "position": row["pos"], "team": row["team"], "age": row["age"],
            "experience": row["years_exp"], "draftPick": row["draft_pick"],
            "projection": {"season": inputs["season"], "week": inputs["week"],
                           "seasonPpr": row["season_ppr"], "weekPpr": row["week_ppr"],
                           "remainingPpr": result["remainingPpr"], "actualPpr": row["actual_ppr"],
                           "gamesPlayed": row["games"], "teamGames": row.get("team_games"),
                           "remainingGames": row.get("remaining_games"),
                           "forwardPpr": row.get("forward_ppr"), "forwardGames": row.get("forward_games"),
                           "backupGames": row.get("backup_games"),
                           "recentPpr": row.get("recent_ppr"), "recentTeamGames": row.get("recent_team_games")},
            "priceBasis": result["priceBasis"], "marketScore": result["marketScore"],
            "footballScore": result["footballScore"], "factors": result["factors"],
            "coverage": result["coverage"],
            "projectedSurplus": result["projectedSurplus"], "calibratedSurplus": result["calibratedSurplus"],
            "marketShare": result["marketShare"], "footballSurplus": result["footballSurplus"],
        }
    for key, result in pick_results.items():
        sf[key], names[key] = result["value"], picks[key]["name"]
        quotes[key] = picks[key]["market"]
    return {
        "schemaVersion": 1, "modelVersion": MODEL_VERSION, "valueScale": VALUE_SCALE,
        "asOf": inputs["asOf"], "generatedAt": inputs["asOf"],
        "season": inputs["season"], "throughWeek": inputs.get("throughWeek", inputs["seasonWeek"] - 1),
        "names": names, "sf": sf, "players": details, "marketQuotes": quotes,
        "meta": {"referenceTeams": 12, "scoring": "full PPR", "superflex": True, "price": diagnostics,
                 "sources": inputs["sources"], "actualSource": inputs["actualSource"], "draftClasses": inputs["draftClasses"],
                 "asOfMeaning": "UTC source retrieval time. Sleeper v1 projections and FantasyCalc quotes used here omit per-player update times."},
    }


def save(path, data):
    atomic_write_text(path, json.dumps(data, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--save-inputs", type=Path, help="Also save normalized source observations for offline analysis")
    args = parser.parse_args()
    inputs, slim = collect()
    if args.save_inputs:
        save(args.save_inputs, inputs)
    board = assemble(inputs)
    errors, _ = check_player_values(board, datetime.now(timezone.utc), 1, fail_on_age=True)
    if errors:
        raise ValueError(", ".join(errors))
    save(DATA / "nfl_players_slim.json", slim)
    save(DATA / "player_values.json", board)
    print(f"Published {len(board['players'])} player and {len(board['sf']) - len(board['players'])} pick values "
          f"from feeds retrieved {inputs['asOf']}")


if __name__ == "__main__":
    main()
