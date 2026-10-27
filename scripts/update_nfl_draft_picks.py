#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
NFLVERSE_DRAFT_URL = "https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv"
OUTPUT_PATH = Path("docs/data/nfl_draft_picks.json")
RECENT_SEASONS = 3
MIN_PUBLISHED_PICKS = 400
NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
TEAM_ALIASES = {
    "GBP": "GB",
    "GNB": "GB",
    "GB": "GB",
    "KCC": "KC",
    "KAN": "KC",
    "KC": "KC",
    "LVR": "LV",
    "OAK": "LV",
    "LV": "LV",
    "LAR": "LAR",
    "LA": "LAR",
    "RAM": "LAR",
    "LAC": "LAC",
    "SDG": "LAC",
    "SD": "LAC",
    "NEP": "NE",
    "NWE": "NE",
    "NE": "NE",
    "NOS": "NO",
    "NOR": "NO",
    "NO": "NO",
    "SFO": "SF",
    "SF": "SF",
    "TBB": "TB",
    "TAM": "TB",
    "TB": "TB",
    "WSH": "WAS",
    "WAS": "WAS",
    "JAC": "JAX",
    "JAX": "JAX",
    "ARZ": "ARI",
    "ARI": "ARI",
}
COLLEGE_ALIASES = {
    "ohio st": "ohio state",
    "ohio st.": "ohio state",
    "penn st": "penn state",
    "penn st.": "penn state",
    "florida st": "florida state",
    "florida st.": "florida state",
    "michigan st": "michigan state",
    "nc st": "north carolina state",
    "n c state": "north carolina state",
    "north carolina st": "north carolina state",
    "miami fl": "miami",
    "miami fla": "miami",
    "miami florida": "miami",
    "lsu": "lsu",
    "usc": "usc",
    "southern california": "usc",
    "ole miss": "mississippi",
    "ucla": "ucla",
    "texas a m": "texas am",
    "texas am": "texas am",
}


def http_get(url: str, timeout: int = 60) -> bytes:
    request = Request(url, headers={"User-Agent": "dynasty-ticker-draft-picks"})
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def normalize_name(name: str | None) -> str:
    if not name:
        return ""
    lowered = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    return re.sub(r"\s+", " ", lowered).strip()


def strip_suffix_key(name_key: str) -> str:
    tokens = [token for token in name_key.split() if token]
    while tokens and tokens[-1] in NAME_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def name_keys(name: str | None) -> tuple[str, ...]:
    base = normalize_name(name)
    without_suffix = strip_suffix_key(base)
    keys = []
    for key in (base, without_suffix):
        if key and key not in keys:
            keys.append(key)
    return tuple(keys)


def normalize_team(team: str | None) -> str:
    raw = str(team or "").strip().upper()
    return TEAM_ALIASES.get(raw, raw)


def normalize_college(college: str | None) -> str:
    text = normalize_name(college)
    text = re.sub(r"\bst\b", "state", text)
    return COLLEGE_ALIASES.get(text, text)


def player_name(meta: dict) -> str:
    full = str(meta.get("full_name") or "").strip()
    if full:
        return full
    return f"{str(meta.get('first_name') or '').strip()} {str(meta.get('last_name') or '').strip()}".strip()


def build_sleeper_index(players: dict) -> dict[str, list[dict]]:
    by_key: dict[str, list[dict]] = {}
    for player_id, meta in players.items():
        if not isinstance(meta, dict):
            continue
        record = {
            "player_id": str(meta.get("player_id") or player_id),
            "name": player_name(meta),
            "team": normalize_team(meta.get("team")),
            "college": normalize_college(meta.get("college")),
            "position": str(meta.get("position") or "").upper(),
            "gsis_id": str(meta.get("gsis_id") or "").strip(),
            "rookie_year": str((meta.get("metadata") or {}).get("rookie_year") or ""),
            "years_exp": meta.get("years_exp"),
        }
        keys = set(name_keys(record["name"]))
        search_name = str(meta.get("search_full_name") or "").strip()
        if search_name:
            keys.update(name_keys(search_name.replace(" ", " ")))
            keys.add(normalize_name(search_name))
        for key in keys:
            if not key:
                continue
            by_key.setdefault(key, []).append(record)
    return by_key


def pick_best_candidate(row: dict, candidates: list[dict]) -> dict | None:
    if not candidates:
        return None
    unique = []
    seen = set()
    for candidate in candidates:
        if candidate["player_id"] in seen:
            continue
        seen.add(candidate["player_id"])
        unique.append(candidate)
    season = str(row.get("season") or "")
    year_matches = [
        item for item in unique
        if season and str(item.get("rookie_year") or "") == season
    ]
    # A dated sleeper row from another class is a namesake, not this pick.
    # Undated rows can still match when the name is unique.
    if any(str(item.get("rookie_year") or "") for item in unique) and not year_matches:
        return None
    pool = year_matches or unique
    if len(pool) == 1:
        return pool[0]

    college = normalize_college(row.get("college"))
    if college:
        college_matches = [item for item in pool if item["college"] == college]
        if len(college_matches) == 1:
            return college_matches[0]
        if college_matches:
            pool = college_matches

    team = normalize_team(row.get("team"))
    if team:
        team_matches = [item for item in pool if item["team"] == team]
        if len(team_matches) == 1:
            return team_matches[0]
        if team_matches:
            pool = team_matches

    position = str(row.get("position") or "").upper()
    if position:
        position_matches = [item for item in pool if item["position"] == position]
        if len(position_matches) == 1:
            return position_matches[0]
        if position_matches:
            pool = position_matches

    return pool[0] if len(pool) == 1 else None


def match_draft_row(row: dict, by_gsis: dict[str, dict], by_name: dict[str, list[dict]]) -> dict | None:
    gsis_id = str(row.get("gsis_id") or "").strip()
    if gsis_id and gsis_id in by_gsis:
        return by_gsis[gsis_id]
    for key in name_keys(row.get("pfr_player_name")):
        matched = pick_best_candidate(row, by_name.get(key) or [])
        if matched:
            return matched
    return None


def parse_draft_rows(csv_text: str, seasons: set[str]) -> list[dict]:
    rows = []
    for row in csv.DictReader(io.StringIO(csv_text)):
        if str(row.get("season") or "") not in seasons:
            continue
        try:
            round_no = int(row["round"])
            pick_no = int(row["pick"])
        except (KeyError, TypeError, ValueError):
            continue
        rows.append({
            "season": str(row.get("season") or ""),
            "round": round_no,
            "pick": pick_no,
            "team": row.get("team") or "",
            "college": row.get("college") or "",
            "position": row.get("position") or "",
            "pfr_player_name": row.get("pfr_player_name") or "",
            "gsis_id": row.get("gsis_id") or "",
        })
    return rows


def build_draft_pick_map(players: dict, draft_rows: list[dict]) -> dict[str, dict]:
    by_gsis = {}
    for player_id, meta in players.items():
        if not isinstance(meta, dict):
            continue
        gsis_id = str(meta.get("gsis_id") or "").strip()
        if gsis_id:
            by_gsis[gsis_id] = {
                "player_id": str(meta.get("player_id") or player_id),
                "name": player_name(meta),
            }
    by_name = build_sleeper_index(players)
    picks: dict[str, dict] = {}
    for row in draft_rows:
        matched = match_draft_row(row, by_gsis, by_name)
        if not matched:
            continue
        picks[str(matched["player_id"])] = {
            "year": int(row["season"]),
            "round": int(row["round"]),
            "pick": int(row["pick"]),
            "name": matched.get("name") or row["pfr_player_name"],
        }
    return picks


def recent_seasons(current_year: int, count: int = RECENT_SEASONS) -> set[str]:
    return {str(year) for year in range(current_year - count + 1, current_year + 1)}


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = text.encode("utf-8")
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded)
        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def publish_draft_picks(path: Path, payload: dict, min_picks: int = MIN_PUBLISHED_PICKS) -> None:
    count = len((payload or {}).get("picks") or {})
    if count < min_picks:
        raise RuntimeError(f"Refusing to replace draft picks with only {count} rows")
    atomic_write_text(path, json.dumps(payload, separators=(",", ":"), sort_keys=True))


def main() -> int:
    players = json.loads(http_get(SLEEPER_PLAYERS_URL, timeout=120))
    csv_text = http_get(NFLVERSE_DRAFT_URL, timeout=60).decode("utf-8")
    years = sorted({int(row["season"]) for row in csv.DictReader(io.StringIO(csv_text)) if str(row.get("season") or "").isdigit()})
    current_year = years[-1] if years else 2026
    seasons = recent_seasons(current_year)
    draft_rows = parse_draft_rows(csv_text, seasons)
    picks = build_draft_pick_map(players, draft_rows)
    payload = {
        "updated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "year": current_year,
        "seasons": sorted(int(season) for season in seasons),
        "picks": picks,
    }
    publish_draft_picks(OUTPUT_PATH, payload)
    print(f"Wrote {len(picks)} draft picks to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
