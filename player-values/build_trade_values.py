#!/usr/bin/env python3
"""Build the published trade-value snapshot and copy Sleeper's PPR projections."""
import argparse
import csv
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import math
from pathlib import Path

from build import (
    CONFIG, EXCLUDED_ASSETS, OUTPUT, POSITIONS, _assert_pick_order,
    atomic_json, choose_sleeper_players, current_profile, forecast,
    http_bytes, load_inputs, offensive_position, played_recently, player_age,
    player_is_listable, player_label, write_slim_players,
)
from sleeper_trades import collect
from trade_model import MODEL_VERSION, train, usable_trades

PROJECTION_API = "https://api.sleeper.com/projections/nfl"


def projection_points(season, week=None):
    scope = f"{season}/{week}" if week is not None else str(season)
    query = "&".join(f"position%5B%5D={position}" for position in POSITIONS)
    rows = json.loads(http_bytes(f"{PROJECTION_API}/{scope}?season_type=regular&{query}"))
    if not isinstance(rows, list):
        raise RuntimeError(f"Sleeper returned an invalid projection feed for {scope}")
    latest = {}
    for row in rows:
        value = (row.get("stats") or {}).get("pts_ppr")
        if (
            not row.get("player_id") or row.get("category") != "proj"
            or str(row.get("season")) != str(season) or row.get("week") != week
            or not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value)
        ):
            continue
        player = str(row["player_id"])
        stamp = row.get("last_modified") or 0
        if player not in latest or stamp > latest[player][0]:
            latest[player] = (stamp, value)
    return {player: value for player, (_, value) in latest.items()}


def validate(bundle):
    values, players, names = (bundle[key] for key in ("sf", "players", "names"))
    if len(players) < 200 or not all(key in names for key in values):
        raise RuntimeError("Incomplete asset snapshot")
    if any(not isinstance(value, int) or value < 0 for value in values.values()):
        raise RuntimeError("Invalid published trade value")
    if sum(values.get(asset, 0) > 0 for asset in players) < 100:
        raise RuntimeError("Too few players with trade-supported prices")
    if any(values.get(asset, 0) > 0 and not row["tradeEvidence"]["priceSupported"]
           for asset, row in players.items()):
        raise RuntimeError("Player price missing trade evidence")
    if any(values.get(asset, 0) > 0 for asset in EXCLUDED_ASSETS):
        raise RuntimeError("Retired asset still priced")
    _assert_pick_order(values)


def build(cache, refresh):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    today = now.date()
    inputs = load_inputs(cache, refresh=refresh, today=today)
    season, week = inputs["currentSeason"], inputs["currentWeek"]
    in_season = inputs["state"].get("season_type") == "regular"
    season_points = projection_points(season)
    weekly_points = projection_points(season, week) if in_season else {}
    league_year = int(inputs["state"].get("league_season") or season)
    corpus = collect(cache, league_year, week, refresh=refresh)
    sleeper_players = inputs["sleeper"]
    def history_at(cutoff):
        # A reversal can only affect a historical fit once the return trade
        # has taken place. Cutoffs for the holdouts are UTC day boundaries.
        return usable_trades(corpus, sleeper_players, cutoff - timedelta(days=1))
    eligible = usable_trades(corpus, sleeper_players, today)
    model, report = train(eligible, today, history_at)
    report["transactionsCollected"] = len(corpus["trades"])
    report["transactionsWithoutCompleteTransfers"] = sum(not row.get("transfers") for row in corpus["trades"])
    report["eligibleTrades"] = len(eligible)
    manifest = sorted((when.isoformat(), sorted(sorted(side) for side in sides), league)
                      for when, sides, league in eligible)
    report["eligibleTradesSha256"] = sha256(json.dumps(manifest, separators=(",", ":")).encode()).hexdigest()
    report["reversedTransactionsExcluded"] = sum("reversalConfirmedAt" in row for row in corpus["trades"])
    report["sample"] = "public completed two-manager trades in 12-team Superflex PPR dynasty leagues"

    world = {"rookieYear": forecast.rookie_years(inputs["meta"], inputs["weekly"])}
    active = {pid for pid, rows in inputs["weekly"].items()
              if rows and played_recently(rows[-1]["season"], season)}
    players, values, names = {}, {}, {}
    mapped = {}
    for pid, (_, _, _, sleeper_id, player, position, mapping) in choose_sleeper_players(inputs, active).items():
        profile = current_profile(pid, player, inputs, world)
        if profile is not None:
            mapped[sleeper_id] = {
                "position": position,
                "team": profile["team"],
                "age": round(profile["age"], 2),
                "experience": profile["experience"],
                "draftPick": profile["draftPick"],
                "sourceMapping": mapping,
                "lastSeason": profile["lastSeason"],
                "components": {key: profile[key] for key in
                               ("recentPpg", "roleOppPerGame", "availability", "careerGames")}
                               | {"currentSeasonGames": profile["currentGames"]},
            }
    for sleeper_id, player in sleeper_players.items():
        asset = f"player:{sleeper_id}"
        position = offensive_position(player)
        if asset in EXCLUDED_ASSETS or position not in POSITIONS:
            continue
        price = model.price(asset, today) if player_is_listable(player) and model.publishable(asset) else None
        profile = mapped.get(sleeper_id)
        if profile is None and price is None and sleeper_id not in season_points and sleeper_id not in weekly_points:
            continue
        name = player_label(player).strip()
        if not name:
            continue
        if profile is None:
            age = player_age(player, {}, season)
            profile = {
                "position": position,
                "team": player.get("team") or "",
                "age": round(age, 2) if age is not None else None,
                "experience": player.get("years_exp"),
                "sourceMapping": "sleeper-id",
            }
        values[asset] = max(1, round(price)) if price is not None else 0
        names[asset] = name
        players[asset] = {
            **profile,
            "tradeEvidence": model.evidence(asset),
            "projection": {
                "season": season,
                "seasonPpr": season_points.get(sleeper_id),
                "week": week if in_season else None,
                "weekPpr": weekly_points.get(sleeper_id),
            },
        }
    # Keep this year's picks available through the preseason for late rookie drafts.
    first_year = today.year + (today.month >= 9)
    for year in range(first_year, first_year + 6):
        previous = None
        for rnd in range(1, 6):
            asset = f"pick:{year}:r{rnd}:any"
            modeled = model.price(f"pick:{year}:r{rnd}", today)
            if modeled is None:
                continue
            price = max(1, round(modeled))
            values[asset] = min(price, previous) if previous is not None else price
            previous = values[asset]
            names[asset] = f"{year} Round {rnd}"
    bundle = {
        "schemaVersion": CONFIG["schemaVersion"],
        "modelVersion": MODEL_VERSION,
        "asOf": now.isoformat(),
        "generatedAt": now.isoformat(),
        "season": season,
        "throughWeek": max(0, week - 1),
        "sf": values,
        "names": names,
        "players": players,
        "meta": {
            "scoring": "full PPR",
            "referenceTeams": CONFIG["referenceTeams"],
            "price": report,
        },
    }
    validate(bundle)
    atomic_json(OUTPUT, bundle)
    write_slim_players(inputs["sleeper"], teams_by_id={
        asset.removeprefix("player:"): row["team"] for asset, row in players.items()
    })
    print(json.dumps(report, indent=2))
    return bundle


def write_top_100(path, bundle):
    board = sorted((asset for asset, value in bundle["sf"].items() if value > 0), key=lambda asset: (-bundle["sf"][asset], bundle["names"][asset], asset))
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(("rank", "asset", "value", "position", "completed_trades", "recent_trades", "asset_id"))
        for rank, asset in enumerate(board[:100], 1):
            player = bundle["players"].get(asset, {})
            evidence = player.get("tradeEvidence", {})
            writer.writerow((rank, bundle["names"][asset], bundle["sf"][asset], player.get("position", "PICK"),
                             evidence.get("completedTrades"), evidence.get("recentTrades"), asset))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/player-values"))
    parser.add_argument("--use-cache", action="store_true", help="Reuse downloaded statistical and trade inputs")
    parser.add_argument("--top-100", type=Path, help="Also write the 100 highest-valued assets to CSV")
    args = parser.parse_args()
    bundle = build(args.cache_dir, refresh=not args.use_cache)
    if args.top_100:
        write_top_100(args.top_100, bundle)


if __name__ == "__main__":
    main()
