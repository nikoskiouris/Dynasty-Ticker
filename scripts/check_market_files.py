#!/usr/bin/env python3
"""Check the JSON files the desk reads.

Schema errors and a player-value file older than 21 days fail the run.
Schedule and draft-pick files have no scrape stamp today, so those ages
are warnings. The rookie mock stamp is the article date.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
MAX_VALUE_AGE_DAYS = 21
MOCK_WARN_DAYS = 45
POSITIONS = {"QB", "RB", "WR", "TE"}
SKILL = POSITIONS


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


def check_player_values(data: dict, now: datetime, max_age_days: float) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    required = (
        "schemaVersion", "modelVersion", "asOf", "season", "throughWeek",
        "sf", "oneQb", "names", "players", "meta",
    )
    for key in required:
        if key not in data:
            errors.append(f"player_values.json missing {key}")
    if data.get("schemaVersion") != 1:
        errors.append(f"player_values schemaVersion is {data.get('schemaVersion')!r}")
    if data.get("modelVersion") != "football-forecast-v1":
        errors.append(f"player_values modelVersion is {data.get('modelVersion')!r}")
    sf = data.get("sf")
    one = data.get("oneQb")
    names = data.get("names")
    players = data.get("players")
    if not isinstance(sf, dict) or not isinstance(one, dict):
        errors.append("player_values sf and oneQb must be objects")
        return errors, warnings
    if set(sf) != set(one):
        errors.append("player_values sf and oneQb keys differ")
    if not isinstance(names, dict) or not isinstance(players, dict):
        errors.append("player_values names and players must be objects")
        names = names if isinstance(names, dict) else {}
        players = players if isinstance(players, dict) else {}
    for asset_id, value in sf.items():
        other = one.get(asset_id)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            errors.append(f"bad sf value {asset_id}")
            break
        if isinstance(other, bool) or not isinstance(other, int) or other < 0:
            errors.append(f"bad oneQb value {asset_id}")
            break
        if asset_id not in names:
            errors.append(f"missing name for {asset_id}")
            break
        if asset_id.startswith("player:"):
            info = players.get(asset_id)
            if not isinstance(info, dict):
                errors.append(f"missing player meta for {asset_id}")
                break
            position = info.get("position")
            if position not in POSITIONS:
                errors.append(f"bad position for {asset_id}")
                break
            if position in {"RB", "WR", "TE"} and value != other:
                errors.append(f"non-QB price differs by format: {asset_id}")
                break
    if not any(str(key).startswith("player:") for key in sf):
        errors.append("player_values has no players")
    stamp = parse_stamp(str(data.get("asOf") or ""))
    if stamp is None:
        errors.append(f"player_values asOf is not a time: {data.get('asOf')!r}")
    else:
        days = age_days(stamp, now)
        if days > max_age_days:
            errors.append(
                f"player_values.json is {days:.1f} days old (max {max_age_days:g}); "
                "throughWeek "
                f"{data.get('throughWeek')}"
            )
        elif days < -1:
            errors.append("player_values asOf is in the future")
    return errors, warnings


def check_schedule(data: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    games = data.get("games")
    seasons = data.get("seasons")
    if not isinstance(games, list) or not games:
        return ["nfl_schedule.json has no games"], warnings
    if not isinstance(seasons, list) or not seasons:
        errors.append("nfl_schedule.json has no seasons")
        seasons = []
    seen = {str(season): set() for season in seasons}
    for game in games:
        if not isinstance(game, dict):
            errors.append("nfl_schedule.json has a non-object game")
            break
        season = str(game.get("season") or "")
        week = game.get("week")
        home = str(game.get("home") or "")
        away = str(game.get("away") or "")
        if season not in seen:
            errors.append(f"nfl_schedule game season {season} is not listed")
            break
        if isinstance(week, bool) or not isinstance(week, int) or not 1 <= week <= 18:
            errors.append(f"nfl_schedule week is not 1-18: {week!r}")
            break
        if not home.isalpha() or not away.isalpha() or not 2 <= len(home) <= 3 or not 2 <= len(away) <= 3:
            errors.append(f"nfl_schedule teams look wrong: {home} {away}")
            break
        seen[season].add(week)
    for season, weeks in seen.items():
        missing = [week for week in range(1, 19) if week not in weeks]
        if missing:
            errors.append(f"nfl_schedule {season} missing weeks {missing}")
    if not data.get("updated"):
        warnings.append("nfl_schedule.json has no updated stamp, so age cannot be checked")
    return errors, warnings


def check_mock(data: dict, now: datetime) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    mocks = data.get("mocks")
    if not isinstance(mocks, list) or not mocks:
        return ["nfl_mock_drafts.json has no mocks"], warnings
    picks = mocks[0].get("picks") if isinstance(mocks[0], dict) else None
    if not isinstance(picks, list) or len(picks) < 20:
        errors.append("nfl_mock_drafts.json has fewer than 20 picks")
        picks = picks if isinstance(picks, list) else []
    for pick in picks:
        if not isinstance(pick, dict) or pick.get("pos") not in SKILL:
            errors.append("nfl_mock_drafts.json has a non-skill pick")
            break
        if not isinstance(pick.get("round"), int) or pick["round"] > 2:
            errors.append("nfl_mock_drafts.json has a pick past round 2")
            break
    stamp = parse_stamp(str(data.get("updated") or ""))
    if stamp is None:
        errors.append("nfl_mock_drafts.json updated is not a date")
    else:
        days = age_days(stamp, now)
        if days > MOCK_WARN_DAYS:
            warnings.append(f"rookie mock article date is {days:.0f} days old")
    return errors, warnings


def check_draft_picks(data: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
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


def check_files(root: Path = DATA, now: datetime | None = None, max_age_days: float = MAX_VALUE_AGE_DAYS):
    now = now or datetime.now(timezone.utc)
    errors: list[str] = []
    warnings: list[str] = []
    specs = (
        ("player_values.json", check_player_values),
        ("nfl_schedule.json", None),
        ("nfl_mock_drafts.json", None),
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
        found, warned = check_player_values(loaded["player_values.json"], now, max_age_days)
        errors.extend(found)
        warnings.extend(warned)
    if "nfl_schedule.json" in loaded:
        found, warned = check_schedule(loaded["nfl_schedule.json"])
        errors.extend(found)
        warnings.extend(warned)
    if "nfl_mock_drafts.json" in loaded:
        found, warned = check_mock(loaded["nfl_mock_drafts.json"], now)
        errors.extend(found)
        warnings.extend(warned)
    if "nfl_draft_picks.json" in loaded:
        found, warned = check_draft_picks(loaded["nfl_draft_picks.json"])
        errors.extend(found)
        warnings.extend(warned)
    return errors, warnings


def main() -> int:
    errors, warnings = check_files()
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
