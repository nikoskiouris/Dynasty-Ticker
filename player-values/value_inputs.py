"""Read and normalize live inputs for the 12-team superflex PPR dynasty board."""
from __future__ import annotations

import csv
import io
import json
import math
import re
import time
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
SLEEPER = "https://api.sleeper.app/v1"
SCHEDULE = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv"
MARKET = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&numTeams=12&ppr=1"
POSITIONS = {"QB", "RB", "WR", "TE"}
SLIM_FIELDS = ["full_name", "position", "team", "age", "injury_status", "status", "years_exp"]


def fetch(url, *, csv_format=False):
    """Fetch a live response. The HTTP date describes the response, not the underlying forecast."""
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "DynastyTicker/1.0"})
            with urlopen(request, timeout=45) as response:
                stamp = response.headers.get("Date")
                if stamp:
                    delta = datetime.now(timezone.utc) - parsedate_to_datetime(stamp)
                    if not -timedelta(hours=1) <= delta <= timedelta(days=2):
                        raise ValueError(f"Stale or future HTTP response for {url}: {stamp}")
                if csv_format:
                    return list(csv.DictReader(io.StringIO(response.read().decode("utf-8"))))
                return json.load(response)
        except (HTTPError, URLError, TimeoutError) as error:
            if isinstance(error, HTTPError) and error.code < 500 and error.code != 429:
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def number(value):
    return value if type(value) in (float, int) and math.isfinite(value) else None


def full_name(row):
    return row.get("full_name") or " ".join(filter(None, [row.get("first_name"), row.get("last_name")]))


def player_age(row, as_of):
    try:
        birthday = date.fromisoformat(row["birth_date"])
        age = (as_of - birthday).days / 365.2425
        return round(age, 2) if 16 <= age <= 60 else None
    except (KeyError, TypeError, ValueError):
        return number(row.get("age"))


def market_quotes(feed, season, season_started):
    players, picks = {}, {}
    for quote in feed:
        info = quote["player"]
        amount = number(quote.get("value"))
        if amount is None or amount <= 0:
            continue
        if info.get("position") in POSITIONS:
            if info.get("sleeperId"):
                players[str(info["sleeperId"])] = amount
            continue
        if info.get("position") != "PICK":
            continue
        match = re.fullmatch(r"(\d{4}) (\d+)(?:st|nd|rd|th)(?: \((Early|Mid|Late)\))?", info["name"])
        if match:
            year, draft_round, group = match.groups()
            bucket = (group or "Any").lower()
            key = f"pick:{year}:r{draft_round}:{bucket}"
            picks[key] = {"name": info["name"], "year": int(year), "market": amount}
    first_year = min((p["year"] for p in picks.values()), default=0)
    expected_classes = {season + 1} if season_started else {season, season + 1}
    if len(players) < 200 or first_year not in expected_classes:
        raise ValueError("Incomplete market feed or pick classes inconsistent with Sleeper season")
    return players, picks


def points_and_games(row):
    games = number(row.get("gp"))
    points = number(row.get("pts_ppr"))
    # Sleeper omits a zero-point total on many rows with recorded appearances.
    return (0 if points is None and games and games > 0 else points), games


def team_schedule(rows, season, active_week, stamp):
    """Split regular-season games into final, started, and still usable at retrieval."""
    teams = {}
    eastern = ZoneInfo("America/New_York")
    for row in rows:
        if row["season"] != str(season) or row["game_type"] != "REG":
            continue
        week = int(row["week"])
        if row["home_score"] != "" and row["away_score"] != "":
            state = "final"
        elif row["gametime"]:
            kickoff = datetime.fromisoformat(row["gameday"] + "T" + row["gametime"]).replace(tzinfo=eastern)
            state = "upcoming" if kickoff > stamp else "started"
        else:
            # TBD kickoffs are safe for later weeks. Don't assume an
            # undated game in the active slate is still available.
            state = "upcoming" if week > active_week else "started"
        for team in (row["home_team"], row["away_team"]):
            team = "LAR" if team == "LA" else team
            games = teams.setdefault(team, {"final": [], "started": [], "upcoming": []})
            games[state].append(week)
    for games in teams.values():
        for weeks in games.values():
            weeks.sort()
    if len(teams) != 32 or any(sum(map(len, games.values())) != 17 for games in teams.values()):
        raise ValueError(f"Incomplete nflverse regular-season schedule for {season}")
    return teams


def optional_week(url):
    try:
        feed = fetch(url)
        if "/stats/nfl/" in url and isinstance(feed, list):
            return {str(row["player_id"]): (row["team"], *points_and_games(row["stats"])) for row in feed}
        return feed
    except (ValueError, OSError) as error:
        print(f"Weekly input unavailable: {url} ({error})", file=sys.stderr)
        return None


def weekly_evidence(season, schedule, registry, active_week, active_projection, urls):
    """Fetch each relevant week once. A missing feed leaves its signals unknown."""
    final_weeks = {w for games in schedule.values() for w in games["final"]}
    forward_weeks = {w for games in schedule.values() for w in games["upcoming"]}
    requests = {}
    for w in sorted(final_weeks):
        requests[f"statsWeek{w}"] = f"https://api.sleeper.app/stats/nfl/{season}/{w}?season_type=regular"
    for w in sorted(forward_weeks):
        if w != active_week:
            requests[f"forecastWeek{w}"] = f"{SLEEPER}/projections/nfl/regular/{season}/{w}"
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses = dict(zip(requests, pool.map(optional_week, requests.values())))
    urls.update({key: url for key, url in requests.items() if responses[key] is not None})
    stats, forecasts, starters = {}, {}, {}
    for w in final_weeks:
        rows = responses.get(f"statsWeek{w}")
        if isinstance(rows, dict):
            stats[w] = rows
    for w in forward_weeks:
        feed = active_projection if w == active_week else responses.get(f"forecastWeek{w}")
        if not isinstance(feed, dict):
            continue
        forecasts[w] = feed
        starters[w] = {registry[pid]["team"] for pid, row in feed.items()
                       if registry.get(pid, {}).get("position") == "QB"
                       and (number(row.get("pass_att")) or 0) >= 12}
    return stats, forecasts, starters


def settled_stats(schedule, weekly_stats):
    """Current-season total from official final score sheets, including players who changed teams."""
    final_teams = {(w, team) for team, games in schedule.items() for w in games["final"]}
    for w, team in final_teams:
        if weekly_stats.get(w, {}).get(team, (None, None, None))[2] != 1:
            # The raw season aggregate may lag. Retain that identified source
            # if any completed club is missing its final box score.
            return None
    totals = {}
    for w, rows in weekly_stats.items():
        for pid, (team, pts, gp) in rows.items():
            if (w, team) in final_teams and gp and gp > 0:
                player = totals.setdefault(pid, {"pts_ppr": 0, "gp": 0})
                player["pts_ppr"] = round(player["pts_ppr"] + (pts or 0), 2)
                player["gp"] += gp
    return totals


def game_evidence(player_id, team, pos, schedule, weekly, week):
    games = schedule.get(team)
    if games is None:
        return {}
    stats, forecasts, starters = weekly
    recent = games["final"][-4:]
    recent_ppr = recent_games = None
    # Each team DEF row signals that Sleeper has statistics for that game.
    # A wholly missing score sheet cannot stand in for a player scoring zero.
    if recent and all(w in stats and stats[w].get(team, (None, None, None))[2] == 1 for w in recent):
        rows = [stats[w][player_id] for w in recent if player_id in stats[w]]
        if all(game_team == team for game_team, _, _ in rows):
            recent_ppr = round(sum(pts or 0 for _, pts, _ in rows), 2)
            recent_games = sum(gp or 0 for _, _, gp in rows)
    points, backups = [], []
    for w in games["upcoming"]:
        if w not in forecasts:
            continue
        ppr = number(forecasts[w].get(player_id, {}).get("pts_ppr"))
        if ppr is not None:
            points.append(ppr)
        elif pos == "QB" and team in starters[w]:
            backups.append(w)
    return {
        "team_games": len(games["final"]), "remaining_games": len(games["upcoming"]),
        "current_week_open": week in games["upcoming"],
        "recent_ppr": recent_ppr, "recent_games": recent_games,
        "recent_team_games": len(recent) if recent_ppr is not None else None,
        "forward_ppr": round(sum(points), 2) if points else None, "forward_games": len(points),
        "backup_games": len(backups), "current_week_backup": week in backups,
    }


def collect():
    stamp = datetime.now(timezone.utc).replace(microsecond=0)
    state = fetch(f"{SLEEPER}/state/nfl")
    season, stage = int(state["season"]), state["season_type"]
    expected_seasons = {stamp.year, stamp.year - 1} if stamp.month <= 3 else {stamp.year}
    if stage not in {"pre", "regular", "post", "off"} or season not in expected_seasons:
        raise ValueError(f"Unexpected Sleeper season: {season}, {stage}")
    week = int(state["week"]) if stage == "regular" else None
    if week is not None and not 1 <= week <= 18:
        raise ValueError(f"Unexpected regular-season week: {week}")
    # In January and February Sleeper can remain in the completed season after Week 18.
    season_ended = stage == "post" or (stage == "off" and season < stamp.year)
    season_week = week or (19 if season_ended else 1)
    urls = {
        "registry": f"{SLEEPER}/players/nfl",
        "projections": f"{SLEEPER}/projections/nfl/regular/{season}",
        "lastSeason": f"{SLEEPER}/stats/nfl/regular/{season - 1}",
        "market": MARKET,
    }
    if week or season_ended:
        urls["thisSeason"] = f"{SLEEPER}/stats/nfl/regular/{season}"
    if week:
        urls["thisWeek"] = f"{SLEEPER}/projections/nfl/regular/{season}/{week}"
    with ThreadPoolExecutor(max_workers=len(urls)) as pool:
        jobs = {key: pool.submit(optional_week if key in {"thisWeek", "thisSeason"} else fetch, url)
                for key, url in urls.items()}
        feeds = {key: job.result() for key, job in jobs.items()}
    if not isinstance(feeds.get("thisWeek"), dict):
        feeds["thisWeek"] = {}
        urls.pop("thisWeek", None)
    registry = feeds["registry"]
    # Preseason before schedule release still has 17 games per team. Opening
    # week and later require a schedule so a completed game cannot be resold.
    schedule, weekly = {}, ({}, {}, {})
    actual_source = "Sleeper season aggregate"
    if week or season_ended:
        schedule = team_schedule(fetch(SCHEDULE, csv_format=True), season, season_week, stamp)
        urls["schedule"] = SCHEDULE
        weekly = weekly_evidence(season, schedule, registry, week, feeds.get("thisWeek"), urls)
        settled = settled_stats(schedule, weekly[0])
        if settled is not None:
            feeds["thisSeason"] = settled
            actual_source = "Sleeper weekly stats from completed games"
        elif not isinstance(feeds.get("thisSeason"), dict):
            raise ValueError("Incomplete final score sheets and no Sleeper season aggregate")
    market, picks = market_quotes(feeds["market"], season, stage in {"regular", "post"})
    draft = json.loads((DATA / "nfl_draft_picks.json").read_text())
    draft_year = season if stage in {"regular", "post"} or stamp.month >= 5 else season - 1
    if draft_year not in draft["seasons"]:
        raise ValueError(f"Missing NFL draft class {draft_year}; refresh nfl_draft_picks.json first")
    model_rows, slim = {}, {}
    for player_id, info in registry.items():
        name = full_name(info)
        eligible = info.get("fantasy_positions") or []
        primary = info.get("position")
        if not name or not (info.get("active") or info.get("team") or player_id in market):
            continue
        if primary in (POSITIONS | {"K", "FB", "DEF"}) or set(eligible) & (POSITIONS | {"K"}):
            slim[player_id] = [name, primary or "", info.get("team") or "", info.get("age"),
                               info.get("injury_status") or "", info.get("status") or "", info.get("years_exp")]
        pos = primary if primary in POSITIONS else next((p for p in eligible if p in POSITIONS), None)
        if pos is None:
            continue
        current, games = points_and_games(feeds.get("thisSeason", {}).get(player_id, {}))
        last, last_games = points_and_games(feeds["lastSeason"].get(player_id, {}))
        projection = number(feeds["projections"].get(player_id, {}).get("pts_ppr"))
        # The registry can still call a retired or cut player "active". A draft
        # pick from a past season alone is insufficient evidence of current relevance.
        if not info.get("team") and player_id not in market and not (projection or games):
            continue
        pick = draft["picks"].get(player_id, {})
        model_rows[player_id] = {
            "pos": pos, "age": player_age(info, stamp.date()), "years_exp": number(info.get("years_exp")),
            "team": info.get("team"), "name": name, "draft_pick": pick.get("pick"), "draft_round": pick.get("round"),
            "draft_seasons_ago": season - pick["year"] if pick else None,
            "season_ppr": projection,
            "week_ppr": number(feeds.get("thisWeek", {}).get(player_id, {}).get("pts_ppr")),
            "last_ppr": last, "last_games": last_games, "actual_ppr": current, "games": games,
            "market": market.get(player_id), "injury_status": info.get("injury_status"),
            **game_evidence(player_id, info.get("team"), pos, schedule, weekly, week),
        }
    # Bound league-wide input loss before allowing an otherwise plausible partial board.
    required_fields = ["market", "season_ppr", "last_ppr"]
    if season_week > 2:
        required_fields.append("actual_ppr")
    for field in required_fields:
        coverage = sum((row[field] or 0) > 0 for row in model_rows.values())
        if coverage < 160:
            raise ValueError(f"Only {coverage} players with positive {field} in the incoming feed")
    urls["draftCapital"] = "https://github.com/nflverse/nflverse-data/releases/tag/draft_picks"
    return {
        "asOf": stamp.isoformat(), "season": season, "week": week, "seasonWeek": season_week, "actualSource": actual_source,
        "sources": urls, "draftClasses": draft.get("seasons", []), "players": model_rows, "picks": picks,
    }, {"source": "sleeper", "fields": SLIM_FIELDS, "players": slim}
