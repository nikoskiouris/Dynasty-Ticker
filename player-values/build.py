#!/usr/bin/env python3
"""Build Dynasty Ticker's independent full-PPR dynasty value snapshot.

The generated value is a football forecast. It does not consume another fantasy
ranking, a fitted trade-price file, a crowd-vote price, or a league-specific price.

This file downloads the data, joins Sleeper to nflverse, and writes the snapshot.
The forecast itself lives in forecast.py. backtest.py scores it against history.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from statistics import median
import argparse
import csv
import json
import math
import os
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import forecast  # noqa: E402

REPO = ROOT.parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
OUTPUT = REPO / "docs" / "data" / "player_values.json"
SLIM_PLAYERS_OUTPUT = REPO / "docs" / "data" / "nfl_players_slim.json"
VALIDATION = ROOT / "validation.json"
POSITIONS = ("QB", "RB", "WR", "TE")
SLIM_POSITIONS = {"QB", "RB", "WR", "TE", "FB", "K", "DEF"}
TWO_WAY_POSITIONS = {"CB", "DB", "S", "FS", "SS", "LB", "ILB", "OLB", "DE", "DT", "EDGE", "DL", "NB"}
RETIRED_STATUSES = {"retired", "reserve_retired"}
# Sleeper marks reserve-list players (IR, PUP, NFI, suspended) "Inactive" while they keep a team.
# Those statuses mean gone only when the player has no team.
UNROSTERED_GONE_STATUSES = {"inactive", "reserve/did_not_report", "did_not_report"}
REQUIRED_ASSETS = {
    "player:6794": "Justin Jefferson",
    "player:8151": "Kenneth Walker",
    "player:12530": "Travis Hunter",
}
EXCLUDED_ASSETS = ("player:167", "player:4634")

PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"
DRAFT_URL = "https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv"
HISTORICAL_STATS_URL = "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv"
WEEKLY_STATS_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.csv"
SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
SLEEPER_STATE_URL = "https://api.sleeper.app/v1/state/nfl"


def num(value, default=0.0):
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def clamp(value, low, high):
    return max(low, min(high, value))


def normalized_name(value):
    return "".join(ch for ch in str(value or "").lower() if ch.isalnum())


def name_variants(value):
    """Stable lookup variants without treating a suffix mismatch as a new player."""
    raw = str(value or "").strip()
    if not raw:
        return []
    tokens = raw.replace(".", " ").split()
    variants = {normalized_name(raw)}
    suffixes = {"jr", "sr", "ii", "iii", "iv", "v"}
    while tokens and tokens[-1].lower() in suffixes:
        tokens.pop()
        variants.add(normalized_name(" ".join(tokens)))
    return [item for item in variants if item]


def chart_position(row):
    """Offensive role for a weekly row.

    A defensive chart counts only when that week has carries or targets.
    Tackle-only weeks stay out. The points still come from the offensive box score.
    """
    position = str(row.get("position") or "").upper()
    carries = num(row.get("carries"))
    targets = num(row.get("targets"))
    if position in POSITIONS:
        return position
    if position in TWO_WAY_POSITIONS and carries + targets > 0:
        return "WR" if targets >= carries else "RB"
    return ""


def offensive_position(player):
    primary = str(player.get("position") or "").upper()
    if primary in POSITIONS:
        return primary
    for raw in player.get("fantasy_positions") or []:
        position = str(raw or "").upper()
        if position in POSITIONS:
            return position
    return ""


def player_is_listable(player):
    status = str(player.get("status") or "").strip().lower()
    if status in RETIRED_STATUSES:
        return False
    if str(player.get("team") or "").strip():
        return True
    if player.get("active") is False:
        return False
    return status not in UNROSTERED_GONE_STATUSES


def played_recently(last_season, current_season):
    if last_season is None:
        return True
    return int(last_season) >= int(current_season) - 1


def parse_date(value):
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


# Sleeper and nflverse sometimes disagree on a birthday by a typo: one digit of the
# month or the year. More than this many days apart is a different person.
BIRTH_TOLERANCE_DAYS = 400


def births_conflict(first, second):
    """Two birth dates that cannot be the same person. A missing date never conflicts."""
    one, two = parse_date(first), parse_date(second)
    if one is None or two is None:
        return False
    return abs((one - two).days) > BIRTH_TOLERANCE_DAYS


def player_label(player):
    return player.get("full_name") or f"{player.get('first_name', '')} {player.get('last_name', '')}"


def build_identity_index(meta):
    by_espn = defaultdict(list)
    by_name = defaultdict(list)
    by_name_pos = defaultdict(list)
    names = {}
    births = {}
    for pid, row in meta.items():
        espn = str(row.get("espn_id") or "").strip()
        if espn and espn.lower() != "nan":
            by_espn[espn].append(pid)
        position = str(row.get("position") or "").upper()
        label = row.get("display_name") or row.get("football_name") or row.get("full_name")
        variants = name_variants(label)
        if variants:
            names[pid] = set(variants)
        births[pid] = row.get("birth_date")
        for variant in variants:
            by_name[variant].append(pid)
            if position:
                by_name_pos[(variant, position)].append(pid)
    return {
        "espn": {key: sorted(set(values)) for key, values in by_espn.items()},
        "name": {key: sorted(set(values)) for key, values in by_name.items()},
        "namePos": {key: sorted(set(values)) for key, values in by_name_pos.items()},
        "names": names,
        "birth": births,
    }


def same_person(player, pid, identity):
    """Does Sleeper's record describe the nflverse player behind this id?

    Sleeper carries a few wrong ids. Same name: accept unless the birthdays are
    years apart. Different name (a nickname): accept only when the birthdays match.
    With no nflverse record there is nothing to check.
    """
    known = (identity.get("names") or {}).get(pid)
    if known is None:
        return True
    listed = (identity.get("birth") or {}).get(pid)
    if set(name_variants(player_label(player))) & known:
        return not births_conflict(player.get("birth_date"), listed)
    born, on_file = parse_date(player.get("birth_date")), parse_date(listed)
    if born is None or on_file is None:
        return True
    return abs((born - on_file).days) <= 2


def _born_same_day(player, pids, identity):
    born = parse_date(player.get("birth_date"))
    if born is None:
        return []
    matches = []
    for pid in pids:
        on_file = parse_date((identity.get("birth") or {}).get(pid))
        if on_file is not None and abs((born - on_file).days) <= 2:
            matches.append(pid)
    return matches


def resolve_nfl_id(player, identity, position, active_pids=None):
    births = identity.get("birth") or {}
    gsis = str(player.get("gsis_id") or "").strip()
    if gsis and same_person(player, gsis, identity):
        return gsis, "gsis"
    espn = str(player.get("espn_id") or "").strip()
    if espn:
        hits = identity["espn"].get(espn, [])
        if len(hits) == 1 and same_person(player, hits[0], identity):
            return hits[0], "espn"
    pos_hits = []
    name_hits = []
    for variant in name_variants(player_label(player)):
        pos_hits.extend(identity["namePos"].get((variant, position), []))
        name_hits.extend(identity["name"].get(variant, []))
    born = player.get("birth_date")
    # A namesake born decades apart is someone else. Never price a player off his history.
    pos_hits = [pid for pid in sorted(set(pos_hits)) if not births_conflict(born, births.get(pid))]
    name_hits = [pid for pid in sorted(set(name_hits)) if not births_conflict(born, births.get(pid))]
    if len(pos_hits) == 1:
        return pos_hits[0], "name-position"
    if len(pos_hits) > 1:
        exact = _born_same_day(player, pos_hits, identity)
        if len(exact) == 1:
            return exact[0], "name-birth"
    if position in POSITIONS:
        if len(name_hits) == 1:
            return name_hits[0], "name"
        if len(name_hits) > 1:
            exact = _born_same_day(player, name_hits, identity)
            if len(exact) == 1:
                return exact[0], "name-birth"
        if active_pids:
            recent = [pid for pid in name_hits if pid in active_pids]
            if len(recent) == 1:
                return recent[0], "name-recent"
    return "", ""


def http_bytes(url):
    request = urllib.request.Request(url, headers={"User-Agent": "DynastyTickerPlayerValues/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def cache_payload(path, payload, min_bytes=32):
    """Replace a cache file only after a full upstream body is in hand.

    A short or empty response must not truncate the last good download.
    """
    if not isinstance(payload, (bytes, bytearray)) or len(payload) < min_bytes:
        size = len(payload) if isinstance(payload, (bytes, bytearray)) else 0
        raise RuntimeError(f"{path.name} from upstream was only {size} bytes")
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
    return path


def fetch(cache, name, url, refresh=True):
    path = cache / name
    if refresh or not path.exists():
        cache_payload(path, http_bytes(url))
    return path


def resolve_nfl_clock(state, today=None):
    """Return (season, week) from Sleeper.

    A missing season_type must not wipe the current season. Offseason and
    preseason stay at week 1. Anything else without a usable week fails closed.
    If Sleeper still lists last season as "off" months after it ended, that
    season is over (week 19). It is not about to be played again.
    """
    if not isinstance(state, dict) or not state:
        raise RuntimeError("Sleeper NFL state is missing")
    season_raw = state.get("season")
    if season_raw in (None, ""):
        season_raw = state.get("league_season")
    if season_raw in (None, ""):
        raise RuntimeError("Sleeper NFL state is missing season")
    season = int(num(season_raw, 0))
    if season < 1990:
        raise RuntimeError(f"Sleeper NFL season is not usable: {season_raw!r}")
    season_type = str(state.get("season_type") or "").strip().lower()
    week = int(num(state.get("week"), 0))
    if season_type == "post":
        return season, 19
    if season_type == "regular":
        if week < 1 or week > 22:
            raise RuntimeError(f"Sleeper regular-season week is not usable: {state.get('week')!r}")
        return season, week
    if season_type in {"pre", "off"}:
        kickoff = parse_date(state.get("season_start_date"))
        if today is not None and kickoff is not None and kickoff.year == season and (today - kickoff).days > 150:
            return season, 19
        return season, 1
    if 1 <= week <= 18:
        return season, week
    raise RuntimeError("Sleeper NFL state is missing season_type and week")


def read_csv(path):
    with path.open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def ppr(row):
    """Full-PPR points from offensive productivity only.

    Pass, rush, and catch counting stats are the whole score. Published
    fantasy_points_ppr is ignored because it can add return scores and, on a
    defensive chart, non-offensive events. Tackles, sacks, passes defended,
    return yards, and return scores are not inputs.
    """
    scoring = CONFIG["scoring"]
    interceptions = num(row.get("passing_interceptions", row.get("interceptions")))
    fumbles = sum(num(row.get(key)) for key in (
        "sack_fumbles_lost", "rushing_fumbles_lost", "receiving_fumbles_lost"
    ))
    twos = sum(num(row.get(key)) for key in (
        "passing_2pt_conversions", "rushing_2pt_conversions", "receiving_2pt_conversions"
    ))
    return (
        num(row.get("passing_yards")) * scoring["passingYard"]
        + num(row.get("passing_tds")) * scoring["passingTd"]
        + interceptions * scoring["interception"]
        + num(row.get("rushing_yards")) * scoring["rushingYard"]
        + num(row.get("rushing_tds")) * scoring["rushingTd"]
        + num(row.get("receptions")) * scoring["reception"]
        + num(row.get("receiving_yards")) * scoring["receivingYard"]
        + num(row.get("receiving_tds")) * scoring["receivingTd"]
        + twos * scoring["twoPoint"]
        + fumbles * scoring["fumbleLost"]
    )


def opportunities(row, position):
    if position == "QB":
        return num(row.get("attempts")) + num(row.get("carries"))
    return num(row.get("carries")) + num(row.get("targets"))


def weighted_average(rows, field, half_life):
    if not rows:
        return 0.0
    weights = [2 ** (-(len(rows) - 1 - index) / max(half_life, 0.1)) for index in range(len(rows))]
    total = sum(weights)
    return sum(num(row.get(field)) * weight for row, weight in zip(rows, weights)) / total if total else 0.0


def smoothed_role(rows):
    """Expected opportunities for a dynasty hold, not a redraft week.

    The half-life is about one season. A short slump nudges the role. A full
    season of lost work is what actually changes it.
    """
    role_rows = rows[-int(CONFIG["opportunityWindowGames"]):]
    role_opp = weighted_average(role_rows, "opportunities", float(CONFIG["opportunityHalfLifeGames"]))
    recent_n = int(CONFIG["roleTrendRecentGames"])
    prior_n = int(CONFIG["roleTrendPriorGames"])
    trend_rows = role_rows[-(recent_n + prior_n):]
    recent_block = trend_rows[-recent_n:]
    prior_block = trend_rows[:-recent_n]
    if len(prior_block) < 4 or not recent_block:
        role_trend = 1.0
    else:
        last_role = sum(row["opportunities"] for row in recent_block) / len(recent_block)
        prior_role = sum(row["opportunities"] for row in prior_block) / len(prior_block)
        role_trend = clamp(last_role / prior_role, 0.70, 1.30) if prior_role > 0 else 1.0
    projected = role_opp * (1 + float(CONFIG["roleTrendWeight"]) * (role_trend - 1))
    return projected, role_trend


def age_for(meta, season):
    birth = str(meta.get("birth_date") or "").strip()
    if birth:
        try:
            return (date(season, 9, 1) - date.fromisoformat(birth[:10])).days / 365.2425
        except ValueError:
            pass
    age = num(meta.get("age"), 0)
    return age if age > 0 else None


def manifest(paths):
    rows = []
    seen = set()
    for path in paths:
        path = Path(path)
        if path in seen or not path.exists():
            continue
        seen.add(path)
        payload = path.read_bytes()
        rows.append({"file": path.name, "bytes": len(payload), "sha256": sha256(payload).hexdigest()})
    return rows


def load_inputs(cache, refresh=True, today=None):
    state_path = fetch(cache, "sleeper_state.json", SLEEPER_STATE_URL, refresh=refresh)
    state = json.loads(state_path.read_text(encoding="utf-8"))
    current_season, current_week = resolve_nfl_clock(state, today)

    player_path = fetch(cache, "players.csv", PLAYERS_URL, refresh=refresh)
    draft_path = fetch(cache, "draft_picks.csv", DRAFT_URL, refresh=refresh)
    historical_path = fetch(cache, "player_stats.csv", HISTORICAL_STATS_URL, refresh=refresh)
    sleeper_path = fetch(cache, "sleeper_players.json", SLEEPER_PLAYERS_URL, refresh=refresh)

    meta = {}
    for row in read_csv(player_path):
        pid = str(row.get("gsis_id") or "").strip()
        if not pid:
            continue
        meta[pid] = dict(row)

    for row in read_csv(draft_path):
        pid = str(row.get("gsis_id") or "").strip()
        if not pid:
            continue
        entry = meta.setdefault(pid, {})
        pick = row.get("pick") or row.get("draft_number")
        year = row.get("season") or row.get("draft_year")
        if pick not in (None, ""):
            entry["draft_pick"] = pick
        if year not in (None, ""):
            entry["draft_year"] = year

    weekly = defaultdict(list)
    source_paths = [state_path, player_path, draft_path, historical_path, sleeper_path]

    def add_row(row):
        season = int(num(row.get("season"), 0))
        week = int(num(row.get("week"), 0))
        if season < int(CONFIG["historyStartSeason"]) or season > current_season:
            return
        if str(row.get("season_type") or "REG").upper() != "REG" or week < 1 or week > int(CONFIG["fantasyWeeks"]):
            return
        if season == current_season and week >= current_week:
            return
        position = chart_position(row)
        if position not in POSITIONS:
            return
        pid = str(row.get("player_id") or row.get("gsis_id") or "").strip()
        if not pid:
            return
        team = str(row.get("team") or row.get("recent_team") or "").upper()
        clean = {
            "season": season,
            "week": week,
            "position": position,
            "team": team,
            "ppr": ppr(row),
            "attempts": num(row.get("attempts")),
            "completions": num(row.get("completions")),
            "passing_yards": num(row.get("passing_yards")),
            "passing_tds": num(row.get("passing_tds")),
            "interceptions": num(row.get("passing_interceptions", row.get("interceptions"))),
            "carries": num(row.get("carries")),
            "rushing_yards": num(row.get("rushing_yards")),
            "rushing_tds": num(row.get("rushing_tds")),
            "targets": num(row.get("targets")),
            "receptions": num(row.get("receptions")),
            "receiving_yards": num(row.get("receiving_yards")),
            "receiving_tds": num(row.get("receiving_tds")),
        }
        clean["opportunities"] = opportunities(clean, position)
        if clean["opportunities"] <= 0:
            return
        weekly[pid].append(clean)

    historical_rows = read_csv(historical_path)
    historical_max = max((int(num(row.get("season"), 0)) for row in historical_rows), default=0)
    for row in historical_rows:
        add_row(row)

    for season in range(max(int(CONFIG["historyStartSeason"]), historical_max + 1), current_season + 1):
        weekly_path = fetch(cache, f"stats_player_week_{season}.csv", WEEKLY_STATS_URL.format(season=season), refresh=refresh)
        source_paths.append(weekly_path)
        for row in read_csv(weekly_path):
            add_row(row)

    for rows in weekly.values():
        unique = {(row["season"], row["week"]): row for row in rows}
        rows[:] = sorted(unique.values(), key=lambda row: (row["season"], row["week"]))

    sleeper = json.loads(sleeper_path.read_text(encoding="utf-8"))
    return {
        "state": state,
        "currentSeason": current_season,
        "currentWeek": current_week,
        "meta": meta,
        "identity": build_identity_index(meta),
        "weekly": weekly,
        "sleeper": sleeper,
        "sourcePaths": source_paths,
    }


def summaries(meta, weekly):
    result = {}
    for pid, rows in weekly.items():
        by_season = defaultdict(list)
        for row in rows:
            by_season[row["season"]].append(row)
        for season, games in by_season.items():
            total = sum(row["ppr"] for row in games)
            opp = sum(row["opportunities"] for row in games)
            position = games[-1]["position"]
            # A quarterback's game counts when he actually quarterbacked it. A kneel-down
            # or a gadget snap is not a start, and nobody starts him in fantasy that week.
            counted = games
            if position == "QB":
                counted = [row for row in games if row["attempts"] >= int(CONFIG["qbStartAttempts"])]
            counted_points = sum(row["ppr"] for row in counted)
            result[(pid, season)] = {
                "valueGames": len(counted),
                "valuePpg": counted_points / len(counted) if counted else 0.0,
                "id": pid,
                "season": season,
                "position": position,
                "games": len(games),
                "ppr": total,
                "ppg": total / len(games),
                "opportunities": opp,
                "oppg": opp / len(games),
                "efficiency": total / opp if opp else 0.0,
                "age": age_for(meta.get(pid, {}), season),
            }
    return result


def _starter_pool(values, position_counts, flex_count=0, superflex_count=0):
    """Allocate reference starters across the whole 12-team league.

    Position slots are filled first. FLEX then chooses RB/WR/TE by PPR rate and
    Superflex chooses the best remaining QB/RB/WR/TE. This is a league allocation,
    not a hard-coded QB18/RB48 replacement rank.
    """
    remaining = {position: sorted(values.get(position, []), reverse=True)[:] for position in POSITIONS}
    rostered = {position: [] for position in POSITIONS}
    for position, count in position_counts.items():
        for _ in range(min(count, len(remaining[position]))):
            rostered[position].append(remaining[position].pop(0))

    for _ in range(flex_count):
        candidates = [
            (remaining[position][0], position)
            for position in ("RB", "WR", "TE")
            if remaining[position]
        ]
        if not candidates:
            break
        _, position = max(candidates)
        rostered[position].append(remaining[position].pop(0))

    for _ in range(superflex_count):
        candidates = [
            (remaining[position][0], position)
            for position in POSITIONS
            if remaining[position]
        ]
        if not candidates:
            break
        _, position = max(candidates)
        rostered[position].append(remaining[position].pop(0))
    return remaining, rostered


def _allocate_bench(remaining, rostered, bench_slots, qb_cap=None):
    """Allocate bench spots by scarcity-adjusted PPR.

    A raw-PPR bench draft would over-roster quarterbacks because QB scoring uses a
    different numerical range. Normalize each candidate by the last required starter
    at his position, then take the strongest remaining roster claims. Stop adding
    quarterbacks once the format roster cap is full so a real QB remains available.
    """
    starter_floor = {}
    for position in POSITIONS:
        starter_floor[position] = max(0.1, min(rostered[position]) if rostered[position] else 1.0)

    for _ in range(bench_slots):
        candidates = []
        for position in POSITIONS:
            if not remaining[position]:
                continue
            if position == "QB" and qb_cap is not None and len(rostered["QB"]) >= qb_cap:
                continue
            ppg = remaining[position][0]
            candidates.append((ppg / starter_floor[position], ppg, position))
        if not candidates:
            break
        _, _, position = max(candidates)
        rostered[position].append(remaining[position].pop(0))
    return remaining, rostered


def _replacement_ppg(remaining, rostered, position):
    """Best player left outside the reference roster.

    When the historical pool is smaller than the roster, the last rostered player
    is that alternative. Zero means the pool was empty, which is not a player.
    """
    if remaining[position]:
        return float(remaining[position][0])
    if rostered[position]:
        return float(rostered[position][-1])
    return None


def allocate_reference_league(values, fmt):
    """Fill one reference league and return replacement points per game by position."""
    teams = int(CONFIG["referenceTeams"])
    lineup = CONFIG["referenceLineup"]
    bench_slots = teams * int(CONFIG["referenceBenchSlots"])
    caps = CONFIG["qbRosterCapPerTeam"]
    qb_cap = teams * int(caps["sf"] if fmt == "sf" else caps["oneQb"])
    base_counts = {
        "QB": teams * int(lineup["QB"]),
        "RB": teams * int(lineup["RB"]),
        "WR": teams * int(lineup["WR"]),
        "TE": teams * int(lineup["TE"]),
    }
    remaining, rostered = _starter_pool(
        values,
        base_counts,
        flex_count=teams * int(lineup["FLEX"]),
        superflex_count=teams * int(lineup["SUPER_FLEX"]) if fmt == "sf" else 0,
    )
    remaining, rostered = _allocate_bench(remaining, rostered, bench_slots, qb_cap=qb_cap)
    output = {}
    for position in POSITIONS:
        replacement = _replacement_ppg(remaining, rostered, position)
        if replacement is None or replacement <= 0:
            return None
        output[position] = replacement
    return output


class ReplacementTable:
    """Replacement points per game, season by season, from the documented reference league."""

    def __init__(self, rows):
        self._pools = defaultdict(lambda: {position: [] for position in POSITIONS})
        for row in rows.values():
            if row.get("valueGames", row["games"]) >= 8:
                self._pools[row["season"]][row["position"]].append(row.get("valuePpg", row["ppg"]))
        self._seasons = {}

    def season(self, season):
        """Both formats for one finished season. None when the pool cannot fill a league."""
        if season not in self._seasons:
            pool = self._pools.get(season)
            teams = int(CONFIG["referenceTeams"])
            result = None
            if pool and all(len(pool[position]) >= teams for position in POSITIONS):
                allocated = {fmt: allocate_reference_league(pool, fmt) for fmt in ("oneQb", "sf")}
                if all(allocated.values()):
                    result = allocated
            self._seasons[season] = result
        return self._seasons[season]

    def through(self, through):
        """The line as it stood after `through`: the median of the most recent seasons.

        Scoring has drifted since 1999, so only the last `replacementSeasons`
        count. Skill positions share one line across formats.
        """
        window = int(CONFIG["replacementSeasons"])
        seasons = [
            season for season in sorted(self._pools)
            if season <= through and self.season(season)
        ][-window:]
        if not seasons:
            raise RuntimeError(f"No reference-league replacement samples through {through}")
        result = {"sf": {}, "oneQb": {}}
        for fmt in result:
            for position in POSITIONS:
                result[fmt][position] = round(median(self.season(season)[fmt][position] for season in seasons), 4)
        # Owner-defined launch behavior: skill-position player values share one ruler.
        for position in ("RB", "WR", "TE"):
            shared = round((result["sf"][position] + result["oneQb"][position]) / 2, 4)
            result["sf"][position] = shared
            result["oneQb"][position] = shared
        return result


def learn_replacement(rows, through):
    """Estimate the feasible alternative from the documented reference league."""
    return ReplacementTable(rows).through(through)


def build_world(rows, meta, weekly, season):
    """What the forecast knows entering `season`: the replacement line and the fitted one-year models.

    Only seasons before `season` train the models, so the same call prices today
    and replays any past season for the backtest.
    """
    table = ReplacementTable(rows)
    rows_by_player = forecast.index_rows(rows)
    rookie_year = forecast.rookie_years(meta, weekly)
    window = int(CONFIG["oneYearModel"]["trainingSeasons"])
    first_state = min(year for (_pid, year) in rows) + 2
    origins = list(range(max(first_state, season - window), season))
    lines = {}

    def replacement_for(origin):
        if origin not in lines:
            lines[origin] = table.through(origin - 1)
        return lines[origin]

    models = forecast.fit_models(rows_by_player, meta, rookie_year, replacement_for, origins, CONFIG)
    return {
        "season": season,
        "replacement": replacement_for(season),
        "models": models,
        "rowsByPlayer": rows_by_player,
        "rookieYear": rookie_year,
        "origins": origins,
    }


def weeks_elapsed(week):
    return int(clamp(int(week) - 1, 0, int(CONFIG["fantasyWeeks"])))


def pricing_date(today):
    """Tuesday of the current week. Prices move when games or the week change, not every midnight."""
    return today - timedelta(days=(today.weekday() - 1) % 7)


def value_player(world, pid, position, age, exp, pick, elapsed, as_of, injury=1.0, kickoff=None):
    """Raw (unscaled) value and the season-by-season forecast, per format."""
    season = world["season"]
    by_season = world["rowsByPlayer"].get(pid, {})
    output = {}
    for fmt in forecast.FORMATS:
        if position != "QB" and fmt != "sf":
            output[fmt] = output["sf"]
            continue
        line = world["replacement"][fmt][position]
        model = world["models"][forecast.model_group(position, fmt)]
        last = forecast.season_state(by_season.get(season - 1), line)
        prior = forecast.season_state(by_season.get(season - 2), line)
        before = forecast.season_state(by_season.get(season - 3), line)
        established = forecast.established_pace([last[1], prior[1], before[1]], model["establishedDecay"])
        observed = forecast.season_state(by_season.get(season), line) if elapsed > 0 else (0.0, 0.0, 0.0)
        total, rows, detail = forecast.value_player(
            model, age, exp, pick, last, prior, observed, season, elapsed, as_of, CONFIG, injury, kickoff, established
        )
        output[fmt] = {
            "total": total,
            "forecast": rows,
            "last": last,
            "prior": prior,
            "observed": observed,
            "preseason": detail["preseason"],
        }
    # A quarterback can always be played as if the league were 1QB, so Superflex is never worth less.
    if position == "QB" and output["sf"]["total"] < output["oneQb"]["total"]:
        output["sf"] = output["oneQb"]
    return output


def player_age(player, info, season):
    """Age on September 1, the same definition the models are trained on.

    Sleeper's whole-number `age` is often a year or more stale, so it is the last resort.
    """
    for source in (info, player):
        age = forecast.age_on(source, season)
        if age is not None and 17 < age < 50:
            return age
    listed = num((player or {}).get("age"), 0)
    return listed + 0.5 if listed > 0 else None


def current_profile(pid, player, inputs, world):
    """The facts about one listed player that the forecast and the player page need."""
    weekly = inputs["weekly"]
    meta = inputs["meta"]
    season = inputs["currentSeason"]
    position = offensive_position(player)
    if position not in POSITIONS:
        return None
    rows = weekly.get(pid, [])
    last_season = rows[-1]["season"] if rows else None
    if not played_recently(last_season, season):
        return None
    info = meta.get(pid, {})
    first_year = world["rookieYear"].get(pid)
    if first_year is None:
        experience = int(num(player.get("years_exp"), 99))
    else:
        experience = max(0, season - int(first_year))
    # A player drafted years ago who never took a snap is not a rookie waiting to play.
    if not rows and experience > 1:
        return None
    age = player_age(player, info, season)
    if age is None:
        age = forecast.default_age(experience)
    pick = forecast.draft_pick(info)
    elapsed = weeks_elapsed(inputs["currentWeek"])
    role_rows = rows[-int(CONFIG["opportunityWindowGames"]):]
    recent_ppg = weighted_average(role_rows, "ppr", float(CONFIG["opportunityHalfLifeGames"]))
    role_opp, _trend = smoothed_role(rows) if rows else (0.0, 1.0)
    played = sum(1 for row in rows if row["season"] in (season - 1, season))
    possible = forecast.SEASON_GAMES + elapsed * forecast.SEASON_GAMES / forecast.FANTASY_WEEKS
    injury = str(player.get("injury_status") or "").upper()
    return {
        "position": position,
        "team": str(player.get("team") or (rows[-1]["team"] if rows else "") or "").upper(),
        "age": age,
        "experience": experience,
        "draftPick": None if pick >= forecast.MAX_PICK else int(pick),
        "pick": pick,
        "careerGames": len(rows),
        "lastSeason": last_season,
        "currentGames": sum(1 for row in rows if row["season"] == season),
        "recentPpg": recent_ppg,
        "roleOppPerGame": role_opp,
        "availability": clamp(played / possible, 0.0, 1.0) if rows else None,
        # IR can wipe a season. A weekly Out, Doubtful, or Questionable tag is a short absence.
        "injuryMultiplier": forecast.INJURY_MULTIPLIER.get(injury, 1.0),
    }


def force_descending(values):
    """Keep an earlier pick worth at least as much as the next one. Later noise cannot jump the line."""
    output = []
    for value in values:
        output.append(value if not output else min(value, output[-1]))
    return output


PICK_SLOTS = 60
PICK_ROUNDS = 5


def rookie_slot_values(world, meta, season):
    """What the kth-best rookie of a class is worth on his first kickoff, averaged over recent classes.

    Every drafted QB, RB, WR, and TE gets the same eight-season forecast a player
    gets. Classes are ordered by that value, so a pick is priced as the player it
    becomes. Means, not medians: a late pick is mostly misses and a few hits, and
    the hits are the value.
    """
    classes = int(CONFIG["pickClasses"])
    by_class = defaultdict(list)
    for info in meta.values():
        position = str(info.get("position") or "").upper()
        year = int(num(info.get("draft_year"), 0))
        pick = forecast.draft_pick(info)
        if position in POSITIONS and pick < forecast.MAX_PICK and season - classes < year <= season:
            by_class[year].append((position, pick))
    totals = {fmt: [0.0] * PICK_SLOTS for fmt in forecast.FORMATS}
    used = []
    memo = {}
    for year, rookies in sorted(by_class.items()):
        if len(rookies) < 30:
            continue  # not drafted yet, or missing upstream
        used.append(year)
        board = {fmt: [] for fmt in forecast.FORMATS}
        for position, pick in rookies:
            key = (position, pick)
            if key not in memo:
                one = forecast.rookie_value(world["models"][forecast.model_group(position, "oneQb")], pick, CONFIG)
                sf = forecast.rookie_value(world["models"][forecast.model_group(position, "sf")], pick, CONFIG)
                memo[key] = (max(sf, one), one)
            board["sf"].append(memo[key][0])
            board["oneQb"].append(memo[key][1])
        for fmt in forecast.FORMATS:
            ordered = sorted(board[fmt], reverse=True)[:PICK_SLOTS]
            for slot, value in enumerate(ordered):
                totals[fmt][slot] += value
    if not used:
        raise RuntimeError("No drafted classes to price picks from")
    return {fmt: [value / len(used) for value in totals[fmt]] for fmt in forecast.FORMATS}, used


def first_pick_year(as_of):
    """The NFL draft ends in late April. After that, this year's picks are players."""
    return as_of.year if as_of < date(as_of.year, 4, 26) else as_of.year + 1


def pick_values(slot_values, as_of, kickoff=None):
    """Future-pick prices: the rookie that slot usually buys, discounted until his first kickoff."""
    output = {"sf": {}, "oneQb": {}, "names": {}}
    scale = float(CONFIG["displayScale"])
    discount = float(CONFIG["annualDiscount"])
    teams = int(CONFIG["referenceTeams"])
    third = teams // 3

    def mean(values):
        return sum(values) / len(values)

    raw = {}
    for fmt in ("sf", "oneQb"):
        slots = slot_values[fmt]
        firsts = force_descending([
            mean(slots[0:third]), mean(slots[third:2 * third]), mean(slots[2 * third:teams]),
        ])
        any_first = clamp(mean(slots[0:teams]), firsts[2], firsts[0])
        rounds = force_descending(
            [any_first] + [mean(slots[index * teams:(index + 1) * teams]) for index in range(1, PICK_ROUNDS)]
        )
        raw[fmt] = {"early": firsts[0], "mid": firsts[1], "late": firsts[2], "any": any_first, "rounds": rounds}

    # The kth-best rookie on a Superflex board is worth at least the kth-best on a 1QB board.
    for key in ("early", "mid", "late", "any"):
        raw["sf"][key] = max(raw["sf"][key], raw["oneQb"][key])
    raw["sf"]["rounds"] = [max(sf, one) for sf, one in zip(raw["sf"]["rounds"], raw["oneQb"]["rounds"])]

    start = first_pick_year(as_of)
    for year in range(start, start + 6):
        delay = discount ** forecast.years_until(forecast.season_start(year, kickoff), as_of)
        for round_number in range(1, PICK_ROUNDS + 1):
            aid = f"pick:{year}:r{round_number}:any"
            output["names"][aid] = f"{year} Round {round_number}"
            for fmt in ("sf", "oneQb"):
                output[fmt][aid] = max(1, round(raw[fmt]["rounds"][round_number - 1] * delay * scale))
        for bucket in ("early", "mid", "late"):
            aid = f"pick:{year}:r1:{bucket}"
            output["names"][aid] = f"{year} {bucket.title()} 1st"
            for fmt in ("sf", "oneQb"):
                output[fmt][aid] = max(1, round(raw[fmt][bucket] * delay * scale))
    return output


def slim_nfl_player(player, player_id=""):
    """Keep only the fields the desk reads from Sleeper."""
    if not isinstance(player, dict):
        return None
    positions = []
    for raw in player.get("fantasy_positions") or []:
        position = str(raw or "").strip().upper()
        if position and position not in positions:
            positions.append(position)
    primary = str(player.get("position") or "").strip().upper()
    if primary and primary not in positions:
        positions.insert(0, primary)
    if not any(position in SLIM_POSITIONS for position in positions):
        return None
    status = str(player.get("status") or "").strip()
    team = str(player.get("team") or "").strip()
    retired = status.lower() in {"retired", "inactive", "reserve_retired", "did_not_report"}
    if not team and (player.get("active") is False or retired):
        return None
    first = str(player.get("first_name") or "").strip()
    last = str(player.get("last_name") or "").strip()
    full = str(player.get("full_name") or "").strip() or f"{first} {last}".strip()
    if not full:
        return None
    record = {"player_id": str(player.get("player_id") or player_id or "")}
    if not record["player_id"]:
        return None
    record["full_name"] = full
    if primary:
        record["position"] = primary
    elif positions:
        record["position"] = positions[0]
    team = str(player.get("team") or "").strip()
    if team:
        record["team"] = team
    age = num(player.get("age"), default=None)
    if age is not None and age > 0:
        record["age"] = int(age) if float(age).is_integer() else round(float(age), 1)
    injury = str(player.get("injury_status") or "").strip()
    if injury:
        record["injury_status"] = injury
    status = str(player.get("status") or "").strip()
    if status:
        record["status"] = status
    years = num(player.get("years_exp"), default=None)
    if years is not None and years >= 0:
        record["years_exp"] = int(years)
    if player.get("active") is False:
        record["active"] = False
    if positions:
        record["fantasy_positions"] = positions[:4]
    rookie = num((player.get("metadata") or {}).get("rookie_year"), default=None)
    if rookie is not None and rookie > 0:
        record["metadata"] = {"rookie_year": int(rookie)}
    return record


def build_slim_players(sleeper_players):
    players = {}
    for player_id, player in (sleeper_players or {}).items():
        record = slim_nfl_player(player, player_id)
        if record:
            players[str(player_id)] = record
    return players


SLIM_FILE_FIELDS = ("full_name", "position", "team", "age", "injury_status", "status", "years_exp")


def compact_slim_players(records):
    rows = {}
    for player_id in sorted(records or {}, key=str):
        record = records[player_id]
        status = record.get("status") or ""
        if status == "Active":
            status = ""
        rows[str(player_id)] = [
            record.get("full_name") or "",
            record.get("position") or "",
            record.get("team") or "",
            record.get("age") or 0,
            record.get("injury_status") or "",
            status,
            record.get("years_exp") if record.get("years_exp") is not None else None,
        ]
    return rows


def published_player_teams(path=OUTPUT):
    """Team on the published snapshot, used only when Sleeper has none."""
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    teams = {}
    for asset_id, info in (payload.get("players") or {}).items():
        if not str(asset_id).startswith("player:"):
            continue
        team = str((info or {}).get("team") or "").strip()
        if team:
            teams[str(asset_id).split(":", 1)[1]] = team
    return teams


def write_slim_players(sleeper_players, output=SLIM_PLAYERS_OUTPUT, teams_by_id=None):
    """Byte-stable. No clock, and player ids are sorted."""
    records = build_slim_players(sleeper_players)
    for player_id, record in records.items():
        if str(record.get("team") or "").strip():
            continue
        team = str((teams_by_id or {}).get(str(player_id)) or "").strip()
        if team:
            record["team"] = team
    payload = {
        "source": "sleeper",
        "fields": list(SLIM_FILE_FIELDS),
        "players": compact_slim_players(records),
    }
    atomic_json(output, payload)
    return payload


def build_slim_only(cache, refresh=True):
    sleeper_path = fetch(cache, "sleeper_players.json", SLEEPER_PLAYERS_URL, refresh=refresh)
    sleeper = json.loads(sleeper_path.read_text(encoding="utf-8"))
    payload = write_slim_players(sleeper, teams_by_id=published_player_teams())
    print(json.dumps({
        "output": str(SLIM_PLAYERS_OUTPUT),
        "players": len(payload["players"]),
    }, indent=2))


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
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


def validate(bundle):
    if bundle.get("modelVersion") != CONFIG["modelVersion"]:
        raise RuntimeError("Wrong model version")
    for fmt in ("sf", "oneQb"):
        values = bundle.get(fmt)
        if not isinstance(values, dict) or not any(key.startswith("player:") for key in values):
            raise RuntimeError(f"Missing {fmt} players")
        for asset_id, value in values.items():
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise RuntimeError(f"Invalid {fmt} value {asset_id}: {value}")
    sf_players = {key for key in bundle["sf"] if key.startswith("player:")}
    one_players = {key for key in bundle["oneQb"] if key.startswith("player:")}
    if sf_players != one_players:
        raise RuntimeError("Format player coverage differs")
    for asset_id in sf_players:
        info = bundle["players"].get(asset_id, {})
        position = info.get("position")
        if position in ("RB", "WR", "TE") and bundle["sf"][asset_id] != bundle["oneQb"][asset_id]:
            raise RuntimeError(f"Non-QB changed by format: {asset_id}")
        if position == "QB" and bundle["sf"][asset_id] < bundle["oneQb"][asset_id]:
            raise RuntimeError(f"Quarterback worth less in Superflex: {asset_id}")
        last_season = info.get("lastSeason")
        season = int(bundle.get("season") or 0)
        if season and last_season is not None and int(last_season) < season - 1 and bundle["sf"][asset_id] > 0:
            raise RuntimeError(f"Stale player still priced: {asset_id}")
        if last_season is None and int(info.get("experience") or 0) > 1 and bundle["sf"][asset_id] > 0:
            raise RuntimeError(f"Never-played veteran priced as a rookie: {asset_id}")
    replacement = bundle.get("meta", {}).get("replacementPpg") or {}
    for fmt in ("sf", "oneQb"):
        for position in POSITIONS:
            value = (replacement.get(fmt) or {}).get(position)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
                raise RuntimeError(f"Replacement for {fmt} {position} is not a real player: {value}")
    for fmt in ("sf", "oneQb"):
        _assert_pick_order(bundle[fmt])
    for asset_id, label in REQUIRED_ASSETS.items():
        if bundle["sf"].get(asset_id, 0) <= 0 or bundle["oneQb"].get(asset_id, 0) <= 0:
            raise RuntimeError(f"Missing priced player {label} ({asset_id})")
    for asset_id in EXCLUDED_ASSETS:
        if bundle["sf"].get(asset_id, 0) > 0 or bundle["oneQb"].get(asset_id, 0) > 0:
            raise RuntimeError(f"Excluded player still priced: {asset_id}")


def _assert_pick_order(values):
    years = sorted({
        int(key.split(":")[1])
        for key in values
        if key.startswith("pick:") and key.split(":")[1].isdigit()
    })
    for year in years:
        early = values.get(f"pick:{year}:r1:early")
        mid = values.get(f"pick:{year}:r1:mid")
        late = values.get(f"pick:{year}:r1:late")
        if None not in (early, mid, late) and not (early >= mid >= late):
            raise RuntimeError(f"{year} firsts are out of order: {early} {mid} {late}")
        any_first = values.get(f"pick:{year}:r1:any")
        if None not in (early, any_first, late) and not (early >= any_first >= late):
            raise RuntimeError(f"{year} round-1 any sits outside early/late")
        rounds = [values.get(f"pick:{year}:r{rnd}:any") for rnd in range(1, 6)]
        if None not in rounds and rounds != sorted(rounds, reverse=True):
            raise RuntimeError(f"{year} rounds are out of order: {rounds}")
    for earlier, later in zip(years, years[1:]):
        early = values.get(f"pick:{earlier}:r1:early")
        nxt = values.get(f"pick:{later}:r1:early")
        if None not in (early, nxt) and early < nxt:
            raise RuntimeError(f"Later early first outranks an earlier class: {earlier} {early} < {later} {nxt}")


MAPPING_RANK = {"gsis": 0, "espn": 1, "name-birth": 2, "name-position": 3, "name-recent": 4, "name": 5}


def choose_sleeper_players(inputs, active_pids):
    """One Sleeper record per nflverse player. A verified id beats a name, and a rostered record beats a free agent."""
    identity = inputs["identity"]
    chosen = {}
    for sleeper_id, player in inputs["sleeper"].items():
        if not isinstance(player, dict) or not player_is_listable(player):
            continue
        position = offensive_position(player)
        if position not in POSITIONS:
            continue
        pid, mapped_by = resolve_nfl_id(player, identity, position, active_pids)
        if not pid:
            continue
        team_rank = 0 if str(player.get("team") or "").strip() else 1
        candidate = (MAPPING_RANK[mapped_by], team_rank, str(sleeper_id), sleeper_id, player, position, mapped_by)
        current = chosen.get(pid)
        if current is None or candidate < current:
            chosen[pid] = candidate
    return chosen


def validation_summary():
    """The last backtest report, if it scored this model version. backtest.py writes the file."""
    if not VALIDATION.exists():
        return {"status": "not run"}
    report = json.loads(VALIDATION.read_text(encoding="utf-8"))
    if report.get("modelVersion") != CONFIG["modelVersion"]:
        return {"status": "not run for this model version", "reportModelVersion": report.get("modelVersion")}
    return {
        "status": "backtested",
        "generatedAt": report.get("generatedAt"),
        "dataThroughSeason": report.get("dataThroughSeason"),
        "claim": report.get("claim"),
        "summary": report.get("summary"),
        "notValidated": report.get("notValidated"),
    }


def model_summary(world):
    output = {}
    for (position, fmt), model in sorted(world["models"].items()):
        output[f"{position}:{fmt}"] = {
            "seasons": model["origins"],
            "samples": model["samples"],
            "paceHinges": [round(value, 2) for value in model["hinges"]],
        }
    return output


def build(cache, refresh=True, today=None):
    today = today or datetime.now(timezone.utc).date()
    inputs = load_inputs(cache, refresh=refresh, today=today)
    current_season = inputs["currentSeason"]
    current_week = inputs["currentWeek"]
    rows = summaries(inputs["meta"], inputs["weekly"])
    world = build_world(rows, inputs["meta"], inputs["weekly"], current_season)
    replacement = world["replacement"]
    elapsed = weeks_elapsed(current_week)
    as_of = pricing_date(today)
    kickoff = parse_date(inputs["state"].get("season_start_date"))
    active_pids = {
        pid
        for pid, weekly_rows in inputs["weekly"].items()
        if weekly_rows and played_recently(weekly_rows[-1]["season"], current_season)
    }

    projected = {}
    player_meta = {}
    names = {}
    scale = float(CONFIG["displayScale"])
    in_season_weight = forecast.blend_weight(elapsed, CONFIG["oneYearModel"]["inSeasonShrinkWeeks"])

    chosen = choose_sleeper_players(inputs, active_pids)
    for pid, (_rank, _team_rank, _sort_id, sleeper_id, player, position, mapped_by) in sorted(chosen.items()):
        profile = current_profile(pid, player, inputs, world)
        if not profile:
            continue
        valued = value_player(
            world, pid, position, profile["age"], profile["experience"], profile["pick"],
            elapsed, as_of, profile["injuryMultiplier"], kickoff,
        )
        aid = f"player:{sleeper_id}"
        projected[aid] = {"position": position, "sf": valued["sf"]["total"], "oneQb": valued["oneQb"]["total"]}
        label = str(player_label(player)).strip()
        names[aid] = label or aid
        seasons = valued["sf"]
        forecast_rows = {"sf": valued["sf"]["forecast"]}
        if position == "QB":
            forecast_rows["oneQb"] = valued["oneQb"]["forecast"]
        player_meta[aid] = {
            "position": position,
            "team": profile["team"],
            "age": round(profile["age"], 2),
            "experience": profile["experience"],
            "draftPick": profile["draftPick"],
            "confidence": "established" if profile["careerGames"] >= 32 else ("developing" if profile["careerGames"] >= 12 else "thin"),
            "sourceMapping": mapped_by,
            "lastSeason": profile["lastSeason"],
            "components": {
                "recentPpg": round(profile["recentPpg"], 3),
                "roleOppPerGame": round(profile["roleOppPerGame"], 3),
                "availability": None if profile["availability"] is None else round(profile["availability"], 3),
                "injuryCurrentMultiplier": profile["injuryMultiplier"],
                "careerGames": profile["careerGames"],
                "currentSeasonGames": profile["currentGames"],
                # Points above replacement: [banked, full-season pace, share of games played].
                "lastSeason": [round(value, 2) for value in seasons["last"]],
                "priorSeason": [round(value, 2) for value in seasons["prior"]],
                "thisSeason": [round(value, 2) for value in seasons["observed"]],
                "preseasonForecast": [round(value, 2) for value in seasons["preseason"]],
            },
            "forecast": forecast_rows,
        }

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    bundle = {
        "schemaVersion": int(CONFIG["schemaVersion"]),
        "modelVersion": CONFIG["modelVersion"],
        "asOf": generated_at,
        "generatedAt": generated_at,
        "season": current_season,
        "throughWeek": max(0, current_week - 1),
        "sf": {},
        "oneQb": {},
        "names": names,
        "players": player_meta,
        "meta": {
            "scoring": "full PPR",
            "referenceTeams": int(CONFIG["referenceTeams"]),
            "annualDiscount": float(CONFIG["annualDiscount"]),
            "horizonYears": int(CONFIG["horizonYears"]),
            "displayScale": scale,
            "replacementPpg": replacement,
            "replacementSeasons": int(CONFIG["replacementSeasons"]),
            "referenceLineup": CONFIG["referenceLineup"],
            "referenceBenchSlots": int(CONFIG["referenceBenchSlots"]),
            "qbRosterCapPerTeam": CONFIG["qbRosterCapPerTeam"],
            "pricingDate": as_of.isoformat(),
            "weeksElapsed": elapsed,
            "inSeasonWeight": round(in_season_weight, 4),
            "oneYearModel": {
                "settings": CONFIG["oneYearModel"],
                "groups": model_summary(world),
            },
            "validation": validation_summary(),
            "sourceManifest": manifest(inputs["sourcePaths"]),
            "status": "provisional football forecast",
            "notInputs": [
                "KTC values",
                "Sleeper trade-fitted prices",
                "crowd-vote price shifts",
                "league-specific prices",
                "defensive stats",
                "return scores",
                "opponent defense",
            ],
            "knownGaps": [
                "No live route participation or first-read target feed",
                "No contract guarantee model",
                "No college production model yet",
                "Current injuries use designation-level availability only",
                "A rookie's age does not change his forecast yet",
                "Replacement comes from a modeled 12-team reference roster, capped at 2 QBs per team in 1QB and 3 in Superflex",
            ],
        },
    }

    for aid, row in projected.items():
        sf_value = max(0, round(row["sf"] * scale))
        one_value = max(0, round(row["oneQb"] * scale)) if row["position"] == "QB" else sf_value
        bundle["sf"][aid] = max(sf_value, one_value)
        bundle["oneQb"][aid] = one_value

    slot_values, classes = rookie_slot_values(world, inputs["meta"], current_season)
    picks = pick_values(slot_values, as_of, kickoff)
    bundle["meta"]["pickClasses"] = classes
    bundle["sf"].update(picks["sf"])
    bundle["oneQb"].update(picks["oneQb"])
    bundle["names"].update(picks["names"])

    validate(bundle)
    atomic_json(OUTPUT, bundle)
    write_slim_players(inputs["sleeper"], teams_by_id=published_player_teams())
    print(json.dumps({
        "output": str(OUTPUT),
        "players": len(player_meta),
        "priced": sum(1 for aid in player_meta if bundle["sf"][aid] > 0),
        "sfAssets": len(bundle["sf"]),
        "oneQbAssets": len(bundle["oneQb"]),
        "displayScale": scale,
        "pricingDate": as_of.isoformat(),
        "validation": bundle["meta"]["validation"].get("status"),
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/player-values"))
    parser.add_argument("--use-cache", action="store_true", help="Reuse already-downloaded upstream files")
    parser.add_argument("--slim-only", action="store_true", help="Write docs/data/nfl_players_slim.json and skip the value model")
    args = parser.parse_args()
    if args.slim_only:
        build_slim_only(args.cache_dir, refresh=not args.use_cache)
        return
    build(args.cache_dir, refresh=not args.use_cache)


if __name__ == "__main__":
    main()
