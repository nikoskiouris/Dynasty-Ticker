#!/usr/bin/env python3
"""Build Dynasty Ticker's independent full-PPR dynasty value snapshot.

The generated value is a football forecast. It does not consume another fantasy
ranking, a fitted trade-price file, a crowd-vote price, or a league-specific price.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from hashlib import sha256
from pathlib import Path
from statistics import median
import argparse
import csv
import json
import math
import os
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
OUTPUT = REPO / "docs" / "data" / "player_values.json"
VALIDATION = ROOT / "validation.json"
POSITIONS = ("QB", "RB", "WR", "TE")
TWO_WAY_POSITIONS = {"CB", "DB", "S", "FS", "SS", "LB", "ILB", "OLB", "DE", "DT", "EDGE", "DL", "NB"}
RETIRED_STATUSES = {"retired", "inactive", "reserve_retired", "reserve/did_not_report", "did_not_report"}
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
    """Offensive role used for scoring. Two-way players can be charted at CB and still catch passes."""
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
    if player.get("active") is False:
        return False
    status = str(player.get("status") or "").strip().lower()
    return status not in RETIRED_STATUSES


def played_recently(last_season, current_season):
    if last_season is None:
        return True
    return int(last_season) >= int(current_season) - 1


def build_identity_index(meta):
    by_espn = defaultdict(list)
    by_name = defaultdict(list)
    by_name_pos = defaultdict(list)
    for pid, row in meta.items():
        espn = str(row.get("espn_id") or "").strip()
        if espn and espn.lower() != "nan":
            by_espn[espn].append(pid)
        position = str(row.get("position") or "").upper()
        label = row.get("display_name") or row.get("football_name") or row.get("full_name")
        for variant in name_variants(label):
            by_name[variant].append(pid)
            if position:
                by_name_pos[(variant, position)].append(pid)
    return {
        "espn": {key: sorted(set(values)) for key, values in by_espn.items()},
        "name": {key: sorted(set(values)) for key, values in by_name.items()},
        "namePos": {key: sorted(set(values)) for key, values in by_name_pos.items()},
    }


def resolve_nfl_id(player, identity, position):
    gsis = str(player.get("gsis_id") or "").strip()
    if gsis:
        return gsis, "gsis"
    espn = str(player.get("espn_id") or "").strip()
    if espn:
        hits = identity["espn"].get(espn, [])
        if len(hits) == 1:
            return hits[0], "espn"
    label = player.get("full_name") or f"{player.get('first_name', '')} {player.get('last_name', '')}"
    pos_hits = []
    name_hits = []
    for variant in name_variants(label):
        pos_hits.extend(identity["namePos"].get((variant, position), []))
        name_hits.extend(identity["name"].get(variant, []))
    pos_hits = sorted(set(pos_hits))
    if len(pos_hits) == 1:
        return pos_hits[0], "name-position"
    name_hits = sorted(set(name_hits))
    if len(name_hits) == 1 and position in POSITIONS:
        return name_hits[0], "name"
    return "", ""


def http_bytes(url):
    request = urllib.request.Request(url, headers={"User-Agent": "DynastyTickerPlayerValues/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def fetch(cache, name, url, refresh=True):
    path = cache / name
    if refresh or not path.exists():
        payload = http_bytes(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_bytes(payload)
        os.replace(temp, path)
    return path


def read_csv(path):
    with path.open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def ppr(row):
    direct = num(row.get("fantasy_points_ppr"), float("nan"))
    if math.isfinite(direct):
        return direct
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


def age_for(meta, season):
    birth = str(meta.get("birth_date") or "").strip()
    if birth:
        try:
            return (date(season, 9, 1) - date.fromisoformat(birth[:10])).days / 365.2425
        except ValueError:
            pass
    age = num(meta.get("age"), 0)
    return age if age > 0 else None


def draft_bucket(pick):
    pick = int(num(pick, 999))
    if pick <= 10:
        return "top10"
    if pick <= 32:
        return "round1"
    if pick <= 64:
        return "round2"
    if pick <= 120:
        return "earlyDay3"
    if pick <= 200:
        return "day3"
    return "late"


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


def load_inputs(cache, refresh=True):
    state_path = fetch(cache, "sleeper_state.json", SLEEPER_STATE_URL, refresh=refresh)
    state = json.loads(state_path.read_text(encoding="utf-8"))
    current_season = int(num(state.get("season") or state.get("league_season"), datetime.now(timezone.utc).year))
    season_type = str(state.get("season_type") or "").lower()
    current_week = int(num(state.get("week"), 1))
    if season_type == "post":
        current_week = 19
    elif season_type != "regular":
        current_week = 1

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
    team_weeks = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
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
        tw = team_weeks[(season, team)][week]
        for key in ("attempts", "carries", "targets", "ppr"):
            tw[key] += clean[key]

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
        "teamWeeks": team_weeks,
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
            result[(pid, season)] = {
                "id": pid,
                "season": season,
                "position": games[-1]["position"],
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


def learn_replacement(rows, through):
    """Estimate the feasible alternative from the documented reference league."""
    teams = int(CONFIG["referenceTeams"])
    samples = {"sf": defaultdict(list), "oneQb": defaultdict(list)}
    by_year_position = defaultdict(list)

    for row in rows.values():
        if row["season"] > through or row["games"] < 8:
            continue
        by_year_position[(row["season"], row["position"])].append(row["ppg"])

    seasons = sorted({season for season, _ in by_year_position})
    for season in seasons:
        values = {
            position: list(by_year_position.get((season, position), []))
            for position in POSITIONS
        }
        if any(len(values[position]) < teams for position in POSITIONS):
            continue

        for fmt in ("oneQb", "sf"):
            allocated = allocate_reference_league(values, fmt)
            if not allocated:
                continue
            for position in POSITIONS:
                samples[fmt][position].append(allocated[position])

    result = {"sf": {}, "oneQb": {}}
    for fmt in result:
        for position in POSITIONS:
            values = samples[fmt][position]
            if not values:
                raise RuntimeError(f"No reference-league replacement samples for {fmt} {position}")
            result[fmt][position] = round(median(values), 4)

    # Owner-defined launch behavior: skill-position player values share one ruler.
    for position in ("RB", "WR", "TE"):
        shared = round((result["sf"][position] + result["oneQb"][position]) / 2, 4)
        result["sf"][position] = shared
        result["oneQb"][position] = shared
    return result


def position_baselines(rows, through):
    output = {}
    for position in POSITIONS:
        sample = [
            row for row in rows.values()
            if row["position"] == position and row["season"] <= through and row["games"] >= 6
        ]
        output[position] = {
            "ppg": median([row["ppg"] for row in sample]) if sample else 0.0,
            "efficiency": median([row["efficiency"] for row in sample if row["efficiency"] > 0]) if sample else 0.0,
            "availability": median([
                min(1.0, row["games"] / (16 if row["season"] <= 2020 else 17)) for row in sample
            ]) if sample else 0.8,
        }
    return output


def role_tier(row, replacement_ppg):
    ratio = row["ppg"] / max(0.1, replacement_ppg)
    if ratio >= 1.7:
        return "elite"
    if ratio >= 1.2:
        return "starter"
    return "depth"


def learn_transitions(rows, replacement, through_origin):
    retention = defaultdict(list)
    survival = defaultdict(lambda: [0, 0])
    generic = defaultdict(list)
    for (pid, season), row in rows.items():
        if season >= through_origin or row["games"] < 4 or row["age"] is None:
            continue
        key = (row["position"], int(round(row["age"])), role_tier(row, replacement["sf"][row["position"]]))
        survival[key][1] += 1
        nxt = rows.get((pid, season + 1))
        if not nxt or nxt["games"] < 4:
            continue
        survival[key][0] += 1
        if row["games"] >= 8 and nxt["games"] >= 8 and row["ppg"] > 1:
            ratio = clamp(nxt["ppg"] / row["ppg"], 0.35, 1.45)
            retention[key].append(ratio)
            generic[(row["position"], int(round(row["age"])))].append(ratio)
    return retention, survival, generic


def transition(position, age, tier, retention, survival, generic):
    age_bucket = int(round(age))
    exact = retention.get((position, age_bucket, tier), [])
    broad = generic.get((position, age_bucket), [])
    keep = median(exact) if len(exact) >= 12 else (median(broad) if len(broad) >= 12 else 1.0)
    survived, total = survival.get((position, age_bucket, tier), (0, 0))
    probability = (survived + 8.0) / (total + 10.0) if total else 0.80
    return clamp(keep, 0.55, 1.18), clamp(probability, 0.35, 0.98), len(exact), total


def current_profile(pid, player, inputs, baselines):
    weekly = inputs["weekly"]
    meta = inputs["meta"]
    team_weeks = inputs["teamWeeks"]
    season = inputs["currentSeason"]
    current_week = inputs["currentWeek"]
    position = offensive_position(player)
    if position not in POSITIONS:
        return None
    rows = weekly.get(pid, [])
    last_season = rows[-1]["season"] if rows else None
    if not played_recently(last_season, season):
        return None
    if not rows and int(num(player.get("years_exp"), 99)) > 2:
        return None
    recent = rows[-48:]
    role_rows = recent[-16:]
    eff_rows = recent[-32:]
    role_opp = weighted_average(role_rows, "opportunities", float(CONFIG["opportunityHalfLifeGames"]))
    ppr_rate = weighted_average(eff_rows, "ppr", float(CONFIG["efficiencyHalfLifeGames"]))
    opp_rate = weighted_average(eff_rows, "opportunities", float(CONFIG["efficiencyHalfLifeGames"]))
    raw_eff = ppr_rate / opp_rate if opp_rate > 0 else baselines[position]["efficiency"]
    evidence = sum(row["opportunities"] for row in eff_rows)
    shrink = 120 if position == "QB" else 80
    weight = evidence / (evidence + shrink) if evidence else 0.0
    efficiency = raw_eff * weight + baselines[position]["efficiency"] * (1 - weight)

    recent4 = role_rows[-4:]
    prior8 = role_rows[-12:-4]
    last_role = sum(row["opportunities"] for row in recent4) / max(1, len(recent4))
    prior_role = sum(row["opportunities"] for row in prior8) / max(1, len(prior8))
    role_trend = clamp(last_role / prior_role, 0.70, 1.30) if prior_role > 0 else 1.0
    projected_opp = role_opp * (1 + 0.30 * (role_trend - 1))

    team = str(player.get("team") or (rows[-1]["team"] if rows else "") or "").upper()
    team_current = [
        value
        for (year, code), weeks in team_weeks.items()
        if year == season and code == team
        for value in weeks.values()
    ]
    league_current = [
        value
        for (year, _), weeks in team_weeks.items()
        if year == season
        for value in weeks.values()
    ]
    team_volume = weighted_average(team_current, "attempts", float(CONFIG["teamContextHalfLifeGames"])) + weighted_average(team_current, "carries", float(CONFIG["teamContextHalfLifeGames"])) if team_current else 0
    league_volume = median([row["attempts"] + row["carries"] for row in league_current]) if league_current else 0
    team_context = clamp(team_volume / league_volume, 0.90, 1.10) if team_volume and league_volume else 1.0
    projected_opp *= 1 + 0.20 * (team_context - 1)
    projected_ppg = max(0.0, projected_opp * efficiency)

    age = num(player.get("age"), 0) or age_for(meta.get(pid, {}), season) or 26.0
    rookie_year = int(num(meta.get(pid, {}).get("rookie_season") or meta.get(pid, {}).get("draft_year"), season))
    experience = int(num(player.get("years_exp"), max(0, season - rookie_year)))
    draft_pick = num(meta.get(pid, {}).get("draft_pick"), 999)

    if experience <= 2 and len(rows) < 24:
        peer_ppg = []
        wanted = draft_bucket(draft_pick)
        for other_id, other_rows in weekly.items():
            if not other_rows or other_rows[0]["position"] != position:
                continue
            other_meta = meta.get(other_id, {})
            if draft_bucket(other_meta.get("draft_pick")) != wanted:
                continue
            other_rookie = int(num(other_meta.get("draft_year") or other_meta.get("rookie_season"), 0))
            rookie_games = [row for row in other_rows if row["season"] == other_rookie]
            if len(rookie_games) >= 4:
                peer_ppg.append(sum(row["ppr"] for row in rookie_games) / len(rookie_games))
        if peer_ppg:
            prior_weight = {0: 0.45, 1: 0.25, 2: 0.10}.get(experience, 0.0)
            prior_weight *= 1 - 0.6 * min(1.0, len(rows) / 16)
            projected_ppg = projected_ppg * (1 - prior_weight) + median(peer_ppg) * prior_weight

    recent_seasons = (season - 2, season - 1, season)
    played = sum(1 for row in rows if row["season"] in recent_seasons)
    possible = sum(
        (16 if year <= 2020 else 17) if year < season else max(0, min(17, current_week - 1))
        for year in recent_seasons
    )
    observed = played / possible if possible else baselines[position]["availability"]
    availability_weight = possible / (possible + 17) if possible else 0
    availability = clamp(
        observed * availability_weight + baselines[position]["availability"] * (1 - availability_weight),
        0.45,
        0.98,
    )
    injury = str(player.get("injury_status") or "").upper()
    injury_multiplier = {"IR": 0.50, "OUT": 0.55, "DOUBTFUL": 0.72, "QUESTIONABLE": 0.88}.get(injury, 1.0)

    return {
        "position": position,
        "team": team,
        "age": age,
        "experience": experience,
        "draftPick": None if draft_pick >= 999 else int(draft_pick),
        "careerGames": len(rows),
        "lastSeason": last_season,
        "currentGames": sum(1 for row in rows if row["season"] == season),
        "projectedPpg": projected_ppg,
        "roleOppPerGame": projected_opp,
        "efficiency": efficiency,
        "roleTrend": role_trend,
        "teamContext": team_context,
        "availability": availability,
        "injuryMultiplier": injury_multiplier,
    }


def career_value(profile, fmt, replacement, learned, current_week):
    retention, survival, generic = learned
    position = profile["position"]
    ppg = profile["projectedPpg"]
    availability = profile["availability"]
    age = profile["age"]
    alive = 1.0
    threshold = replacement[fmt][position]
    ratio = ppg / max(threshold, 0.1)
    tier = "elite" if ratio >= 1.7 else ("starter" if ratio >= 1.2 else "depth")
    contributions = []
    explanation = []
    for horizon in range(int(CONFIG["horizonYears"])):
        sample = 0
        if horizon == 0:
            remaining = max(0, int(CONFIG["fantasyWeeks"]) - max(0, current_week - 1))
            games = remaining * availability * profile["injuryMultiplier"]
        else:
            keep, survives, sample, _ = transition(position, age + horizon - 1, tier, retention, survival, generic)
            ppg *= keep
            alive *= survives
            games = int(CONFIG["fantasyWeeks"]) * availability * alive
        advantage = max(0.0, ppg - threshold) * games
        discount = float(CONFIG["annualDiscount"]) ** horizon
        discounted = advantage * discount
        contributions.append(discounted)
        explanation.append({
            "year": horizon,
            "ppg": round(ppg, 3),
            "games": round(games, 2),
            "replacementPpg": threshold,
            "survival": round(alive, 4),
            "discount": round(discount, 5),
            "discountedAdvantage": round(discounted, 3),
            "transitionSamples": int(sample),
        })
    return sum(contributions), explanation


def realized_rookie_value(pid, draft_year, fmt, rows, replacement):
    total = 0.0
    for horizon in range(4):
        row = rows.get((pid, draft_year + horizon))
        if not row:
            continue
        total += (
            max(0.0, row["ppg"] - replacement[fmt][row["position"]])
            * row["games"]
            * float(CONFIG["annualDiscount"]) ** horizon
        )
    return total


def rookie_slot_samples(meta, rows, replacement, scale, current_season):
    by_year = defaultdict(list)
    for pid, player in meta.items():
        year = int(num(player.get("draft_year") or player.get("rookie_season"), 0))
        pick = int(num(player.get("draft_pick"), 999))
        position = str(player.get("position") or "").upper()
        if year < int(CONFIG["pickHistoryStartSeason"]) or year > current_season - 2:
            continue
        if position not in POSITIONS or pick >= 999:
            continue
        by_year[year].append((pid, pick, position, age_for(player, year) or 23.0))

    board_config = CONFIG["rookieBoard"]
    age_penalty = float(board_config["agePickPenalty"])
    output = {"sf": defaultdict(list), "oneQb": defaultdict(list)}
    for fmt in output:
        shift = board_config["pickShift"][fmt]
        for year, rookies in sorted(by_year.items()):
            board = sorted(
                rookies,
                key=lambda row: (
                    row[1] - float(shift.get(row[2], 0)) + max(0.0, row[3] - 23) * age_penalty,
                    row[1],
                    row[0],
                ),
            )
            for slot, (pid, _, _, _) in enumerate(board[:60], start=1):
                outcome = realized_rookie_value(pid, year, fmt, rows, replacement)
                output[fmt][slot].append(outcome * scale)
    return output


def force_descending(values):
    """Keep an earlier pick worth at least as much as the next one. Later noise cannot jump the line."""
    output = []
    for value in values:
        output.append(value if not output else min(value, output[-1]))
    return output


def _bucket_median(samples_for_fmt, slots):
    values = [value for slot in slots for value in samples_for_fmt.get(slot, [])]
    if not values:
        return None
    return float(median(values))


def pick_values(samples, current_season):
    output = {"sf": {}, "oneQb": {}, "names": {}}
    raw = {}
    for fmt in ("sf", "oneQb"):
        firsts = [
            _bucket_median(samples[fmt], range(1, 5)),
            _bucket_median(samples[fmt], range(5, 9)),
            _bucket_median(samples[fmt], range(9, 13)),
        ]
        rounds = [
            _bucket_median(samples[fmt], range((round_number - 1) * 12 + 1, round_number * 12 + 1))
            for round_number in range(1, 6)
        ]
        if any(value is None for value in firsts + rounds):
            raise RuntimeError(f"Missing rookie outcome samples for {fmt}")
        early, mid, late = force_descending(firsts)
        round_values = force_descending(rounds)
        any_first = _bucket_median(samples[fmt], range(1, 13))
        any_first = min(early, max(late, any_first))
        raw[fmt] = {"early": early, "mid": mid, "late": late, "any": any_first, "rounds": round_values}

    for year in range(current_season + 1, current_season + 7):
        delay = float(CONFIG["annualDiscount"]) ** max(1, year - current_season)
        for round_number in range(1, 6):
            aid = f"pick:{year}:r{round_number}:any"
            output["names"][aid] = f"{year} Round {round_number}"
            for fmt in ("sf", "oneQb"):
                output[fmt][aid] = max(1, round(raw[fmt]["rounds"][round_number - 1] * delay))
        for bucket in ("early", "mid", "late"):
            aid = f"pick:{year}:r1:{bucket}"
            output["names"][aid] = f"{year} {bucket.title()} 1st"
            for fmt in ("sf", "oneQb"):
                output[fmt][aid] = max(1, round(raw[fmt][bucket] * delay))
        aid = f"pick:{year}:r1:any"
        for fmt in ("sf", "oneQb"):
            output[fmt][aid] = max(1, round(raw[fmt]["any"] * delay))
    return output


def backtest(rows, replacement=None):
    through = int(CONFIG["validationTrainingThrough"])
    if replacement is None:
        replacement = learn_replacement(rows, through=through)
    retention, survival, generic = learn_transitions(
        rows, replacement, through_origin=through
    )
    errors = []
    naive_errors = []
    breakdown = defaultdict(lambda: [0, 0.0, 0.0])
    for season in CONFIG["validationSeasons"]:
        for (pid, year), row in rows.items():
            if year != season or row["games"] < 8 or row["age"] is None:
                continue
            nxt = rows.get((pid, season + 1))
            actual = 0.0 if not nxt else max(
                0.0, nxt["ppg"] - replacement["sf"][row["position"]]
            ) * nxt["games"]
            tier = role_tier(row, replacement["sf"][row["position"]])
            keep, survives, _, _ = transition(
                row["position"], row["age"], tier, retention, survival, generic
            )
            predicted = max(
                0.0, row["ppg"] * keep - replacement["sf"][row["position"]]
            ) * int(CONFIG["fantasyWeeks"]) * survives
            naive = max(
                0.0, row["ppg"] - replacement["sf"][row["position"]]
            ) * int(CONFIG["fantasyWeeks"])
            model_error = abs(predicted - actual)
            naive_error = abs(naive - actual)
            errors.append(model_error)
            naive_errors.append(naive_error)
            key = f"{season}:{row['position']}"
            breakdown[key][0] += 1
            breakdown[key][1] += model_error
            breakdown[key][2] += naive_error
    return {
        "n": len(errors),
        "mae": round(sum(errors) / len(errors), 3) if errors else None,
        "persistenceMae": round(sum(naive_errors) / len(naive_errors), 3) if naive_errors else None,
        "scope": "one-year SF above-replacement; transitions and replacement frozen at validationTrainingThrough",
        "replacementThrough": int(CONFIG["validationTrainingThrough"]),
        "bySeasonPosition": {
            key: {
                "n": value[0],
                "mae": round(value[1] / value[0], 3),
                "persistenceMae": round(value[2] / value[0], 3),
            }
            for key, value in sorted(breakdown.items())
        },
    }


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
        last_season = info.get("lastSeason")
        season = int(bundle.get("season") or 0)
        if season and last_season is not None and int(last_season) < season - 1 and bundle["sf"][asset_id] > 0:
            raise RuntimeError(f"Stale player still priced: {asset_id}")
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


def build(cache, refresh=True):
    inputs = load_inputs(cache, refresh=refresh)
    current_season = inputs["currentSeason"]
    current_week = inputs["currentWeek"]
    rows = summaries(inputs["meta"], inputs["weekly"])
    replacement = learn_replacement(rows, through=current_season - 1)
    baselines = position_baselines(rows, through=current_season - 1)
    learned = learn_transitions(rows, replacement, through_origin=current_season)

    identity = inputs["identity"]
    projected = {}
    player_meta = {}
    names = {}
    chosen = {}

    for sleeper_id, player in inputs["sleeper"].items():
        if not isinstance(player, dict) or not player_is_listable(player):
            continue
        position = offensive_position(player)
        if position not in POSITIONS:
            continue
        pid, mapped_by = resolve_nfl_id(player, identity, position)
        if not pid:
            continue
        rank = {"gsis": 0, "espn": 1, "name-position": 2, "name": 3}[mapped_by]
        team_rank = 0 if str(player.get("team") or "").strip() else 1
        candidate = (rank, team_rank, str(sleeper_id), sleeper_id, player, position, mapped_by)
        current = chosen.get(pid)
        if current is None or candidate < current:
            chosen[pid] = candidate

    for pid, (_rank, _team_rank, _sort_id, sleeper_id, player, position, mapped_by) in sorted(chosen.items()):
        profile = current_profile(pid, player, inputs, baselines)
        if not profile:
            continue
        sf_raw, sf_forecast = career_value(profile, "sf", replacement, learned, current_week)
        one_raw, one_forecast = career_value(profile, "oneQb", replacement, learned, current_week)
        aid = f"player:{sleeper_id}"
        projected[aid] = {"position": position, "sf": sf_raw, "oneQb": one_raw}
        label = str(player.get("full_name") or f"{player.get('first_name','')} {player.get('last_name','')}").strip()
        names[aid] = label or aid
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
                "projectedPpg": round(profile["projectedPpg"], 3),
                "roleOppPerGame": round(profile["roleOppPerGame"], 3),
                "efficiencyPprPerOpportunity": round(profile["efficiency"], 4),
                "roleTrend": round(profile["roleTrend"], 3),
                "teamContext": round(profile["teamContext"], 3),
                "availability": round(profile["availability"], 3),
                "injuryCurrentMultiplier": profile["injuryMultiplier"],
                "careerGames": profile["careerGames"],
                "currentSeasonGames": profile["currentGames"],
            },
            "forecast": {"sf": sf_forecast, "oneQb": one_forecast},
        }

    scale = float(CONFIG["displayScale"])

    validation = backtest(rows)
    bundle = {
        "schemaVersion": int(CONFIG["schemaVersion"]),
        "modelVersion": CONFIG["modelVersion"],
        "asOf": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
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
            "referenceLineup": CONFIG["referenceLineup"],
            "referenceBenchSlots": int(CONFIG["referenceBenchSlots"]),
            "qbRosterCapPerTeam": CONFIG["qbRosterCapPerTeam"],
            "rookieBoard": CONFIG["rookieBoard"],
            "validation": validation,
            "sourceManifest": manifest(inputs["sourcePaths"]),
            "status": "provisional football forecast",
            "notInputs": [
                "KTC values",
                "Sleeper trade-fitted prices",
                "crowd-vote price shifts",
                "league-specific prices",
            ],
            "knownGaps": [
                "No live route participation or first-read target feed",
                "No contract guarantee model",
                "No college production model yet",
                "Current injuries use designation-level availability only",
                "Replacement comes from a modeled 12-team reference roster, capped at 2 QBs per team in 1QB and 3 in Superflex",
            ],
        },
    }

    for aid, row in projected.items():
        sf_value = max(0, round(row["sf"] * scale))
        one_value = max(0, round(row["oneQb"] * scale)) if row["position"] == "QB" else sf_value
        bundle["sf"][aid] = sf_value
        bundle["oneQb"][aid] = one_value

    rookie_samples = rookie_slot_samples(inputs["meta"], rows, replacement, scale, current_season)
    picks = pick_values(rookie_samples, current_season)
    bundle["sf"].update(picks["sf"])
    bundle["oneQb"].update(picks["oneQb"])
    bundle["names"].update(picks["names"])

    report = {
        "modelVersion": CONFIG["modelVersion"],
        "generatedAt": bundle["asOf"],
        "holdout": validation,
        "validatedClaim": "one-year above-replacement retention only",
        "notValidated": [
            "eight-year career calibration",
            "market clearing prices",
            "injury-specific recovery",
            "rookie-pick ordering",
            "weekly lineup decisions",
        ],
    }

    validate(bundle)
    atomic_json(OUTPUT, bundle)
    atomic_json(VALIDATION, report)
    print(json.dumps({
        "output": str(OUTPUT),
        "players": len(player_meta),
        "sfAssets": len(bundle["sf"]),
        "oneQbAssets": len(bundle["oneQb"]),
        "displayScale": scale,
        "holdout": validation,
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/player-values"))
    parser.add_argument("--use-cache", action="store_true", help="Reuse already-downloaded upstream files")
    args = parser.parse_args()
    build(args.cache_dir, refresh=not args.use_cache)


if __name__ == "__main__":
    main()
