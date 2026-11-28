#!/usr/bin/env python3
"""Check the JSON files the desk reads.

Schema errors fail the run. A player-value file older than 21 days is a
warning unless --fail-on-age is set. The live
deploy and the player-value refresh use the hard failure.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
MAX_VALUE_AGE_DAYS = 21
# The model the builder is configured to write. A snapshot from any other model is not the one the desk expects.
MODEL_VERSION = "dynasty-sf-ppr-v4"
POSITIONS = {"QB", "RB", "WR", "TE"}


def price_hundredths(value) -> int | None:
    if type(value) not in (int, float) or not 0 <= value <= 100:
        return None
    scaled = Decimal(str(value)) * 100
    return int(scaled) if scaled == scaled.to_integral_value() else None


def nonnegative_number(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def valid_score_anchors(anchors) -> bool:
    if not isinstance(anchors, list) or len(anchors) < 3:
        return False
    if not all(isinstance(row, dict) and nonnegative_number(row.get("score"))
               and nonnegative_number(row.get("surplus")) for row in anchors):
        return False
    return (anchors[0]["score"] == anchors[0]["surplus"] == 0 and anchors[-1]["score"] == 100
            and all(a["score"] < b["score"] and a["surplus"] < b["surplus"]
                    for a, b in zip(anchors, anchors[1:])))


def parse_stamp(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if len(text) == 10:
        text = text + "T00:00:00+00:00"
    try:
        stamp = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp


def age_days(stamp: datetime, now: datetime) -> float:
    return (now - stamp).total_seconds() / 86400


def check_player_values(
    data: dict,
    now: datetime,
    max_age_days: float,
    fail_on_age: bool = False,
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return ["player_values.json is not an object"], warnings
    required = (
        "schemaVersion", "modelVersion", "asOf", "season", "throughWeek",
        "sf", "names", "players", "meta",
    )
    for key in required:
        if key not in data:
            errors.append(f"player_values.json missing {key}")
    if data.get("schemaVersion") != 1:
        errors.append(f"player_values schemaVersion is {data.get('schemaVersion')!r}")
    if data.get("modelVersion") != MODEL_VERSION:
        errors.append(f"player_values modelVersion is {data.get('modelVersion')!r}")
    if data.get("valueScale") != 100:
        errors.append("player_values must use the 0–100 scale")
    sf = data.get("sf")
    names = data.get("names")
    players = data.get("players")
    if not isinstance(sf, dict):
        errors.append("player_values sf must be an object")
        return errors, warnings
    if not isinstance(names, dict) or not isinstance(players, dict):
        errors.append("player_values names and players must be objects")
        names = names if isinstance(names, dict) else {}
        players = players if isinstance(players, dict) else {}
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    if (meta.get("referenceTeams"), meta.get("scoring"), meta.get("superflex")) != (12, "full PPR", True):
        errors.append("player_values league format must be 12-team superflex full PPR")
    price_method = meta.get("price")
    if not isinstance(price_method, dict) or not valid_score_anchors(price_method.get("scoreAnchors")):
        errors.append("missing or invalid surplus-to-score calibration")
    if len(players) < 200 or not any(key.startswith("pick:") for key in sf):
        errors.append("incomplete dynasty player or pick board")
    for asset_id, value in sf.items():
        cents = price_hundredths(value)
        if cents is None or cents == 0:
            errors.append(f"bad sf value {asset_id}")
            break
        if asset_id not in names:
            errors.append(f"missing name for {asset_id}")
            break
        if asset_id.startswith("player:"):
            info = players.get(asset_id)
            if not isinstance(info, dict):
                errors.append(f"missing player meta for {asset_id}")
                break
            factors = info.get("factors")
            if (not isinstance(factors, dict) or set(factors) != {"lineup", "future", "draft", "market"}
                    or any(price_hundredths(part) is None for part in factors.values())
                    or sum(price_hundredths(part) for part in factors.values()) != cents):
                errors.append(f"missing or invalid attribution for {asset_id}")
                break
            market_share = info.get("marketShare")
            projected = info.get("projectedSurplus")
            if (not nonnegative_number(market_share) or market_share > 1
                    or not nonnegative_number(info.get("calibratedSurplus"))
                    or not (nonnegative_number(projected) or (projected is None and market_share == 1))):
                errors.append(f"invalid surplus or market evidence for {asset_id}")
                break
            projection = info.get("projection")
            if not isinstance(projection, dict) or "remainingPpr" not in projection:
                errors.append(f"missing rest-of-season forecast field for {asset_id}")
                break
            remaining = projection["remainingPpr"]
            if remaining is not None and (type(remaining) not in (int, float) or not math.isfinite(remaining)
                                          or remaining < 0 or (projection.get("remainingGames") == 0 and remaining > 0)):
                errors.append(f"invalid rest-of-season PPR for {asset_id}")
                break
            position = info.get("position")
            if position not in POSITIONS:
                errors.append(f"bad position for {asset_id}")
                break
    if set(players) != {key for key in sf if key.startswith("player:")}:
        errors.append("player metadata and priced player IDs do not match")
    stamp = parse_stamp(str(data.get("asOf") or ""))
    if stamp is None:
        errors.append(f"player_values asOf is not a time: {data.get('asOf')!r}")
    else:
        days = age_days(stamp, now)
        if days > max_age_days:
            message = (
                f"player_values.json is {days:.1f} days old (max {max_age_days:g}); "
                "throughWeek "
                f"{data.get('throughWeek')}"
            )
            if fail_on_age:
                errors.append(message)
            else:
                warnings.append(message)
        elif days < -1:
            errors.append("player_values asOf is in the future")
    return errors, warnings


def check_draft_picks(data: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return ["nfl_draft_picks.json is not an object"], warnings
    picks = data.get("picks")
    if not isinstance(picks, dict) or len(picks) < 400:
        errors.append(f"nfl_draft_picks.json has {len(picks) if isinstance(picks, dict) else 0} picks")
        return errors, warnings
    for player_id, row in picks.items():
        if not isinstance(row, dict):
            errors.append(f"draft pick {player_id} is not an object")
            break
        if not all(key in row for key in ("year", "round", "pick", "name")):
            errors.append(f"draft pick {player_id} is missing year, round, pick, or name")
            break
    if not data.get("updated"):
        warnings.append("nfl_draft_picks.json has no updated stamp, so age cannot be checked")
    return errors, warnings


def check_files(
    root: Path = DATA,
    now: datetime | None = None,
    max_age_days: float = MAX_VALUE_AGE_DAYS,
    fail_on_age: bool = False,
):
    now = now or datetime.now(timezone.utc)
    errors: list[str] = []
    warnings: list[str] = []
    specs = (
        ("player_values.json", check_player_values),
        ("nfl_draft_picks.json", None),
    )
    loaded = {}
    for name, _checker in specs:
        path = root / name
        try:
            loaded[name] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{name} is not readable JSON: {exc}")
    if "player_values.json" in loaded:
        found, warned = check_player_values(
            loaded["player_values.json"], now, max_age_days, fail_on_age=fail_on_age
        )
        errors.extend(found)
        warnings.extend(warned)
    if "nfl_draft_picks.json" in loaded:
        found, warned = check_draft_picks(loaded["nfl_draft_picks.json"])
        errors.extend(found)
        warnings.extend(warned)
    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fail-on-age",
        action="store_true",
        help="Exit 1 when player values are older than the max age. The default is a warning.",
    )
    args = parser.parse_args(argv)
    errors, warnings = check_files(fail_on_age=args.fail_on_age)
    for warning in warnings:
        print(f"warning: {warning}")
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print("market files ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
