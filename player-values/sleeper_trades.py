"""Collect completed trades from public Sleeper dynasty leagues."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import json
import random
import time
from threading import Lock
from urllib.error import HTTPError, URLError

from build import atomic_json, http_bytes

API = "https://api.sleeper.app/v1"
# Public league documented in the repository's previous walkthroughs.
SEEDS = ("1315165104303513600",)
REQUEST_SPACING = 0.075  # Keep the process below Sleeper's published 1,000 requests/minute guidance.
_request_lock = Lock()
_next_request = 0.0


def get(path):
    global _next_request
    for attempt in range(4):
        with _request_lock:
            time.sleep(max(0, _next_request - time.monotonic()))
            _next_request = time.monotonic() + REQUEST_SPACING
        try:
            return json.loads(http_bytes(f"{API}/{path}"))
        except HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code < 500 and exc.code != 429:
                raise
            if attempt == 3:
                raise
        except (URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2 ** attempt)


def eligible(league):
    if not league:
        return False
    lineup = league.get("roster_positions") or []
    scoring = league.get("scoring_settings") or {}
    settings = league.get("settings") or {}
    return (
        settings.get("type") == 2 and league.get("total_rosters") == 12
        and "SUPER_FLEX" in lineup and lineup.count("QB") == 1
        and not settings.get("best_ball") and scoring.get("rec") == 1
        and not any(scoring.get(f"bonus_rec_{pos}") for pos in ("qb", "rb", "wr", "te", "fb"))
    )


def discover(pool, year, limit):
    leagues = {}
    frontier = SEEDS
    visited = set()
    seen_leagues = set(SEEDS)
    for _ in range(8):
        batches = pool.map(get, (f"league/{league}/users" for league in frontier))
        users = sorted({u["user_id"] for batch in batches for u in batch or []} - visited)
        random.Random(2026).shuffle(users)
        users = users[:100]
        visited.update(users)
        next_frontier = {}
        for batch in pool.map(get, (f"user/{user}/leagues/nfl/{year}" for user in users)):
            for league in batch or []:
                key = league["league_id"]
                if eligible(league) and len(leagues) < limit:
                    leagues[key] = league
                if key not in seen_leagues and league.get("settings", {}).get("type") == 2:
                    next_frontier[key] = league
        ids = sorted(next_frontier)
        random.Random(2026).shuffle(ids)
        frontier = ids[:75]
        seen_leagues.update(frontier)
        if len(leagues) >= limit or not frontier:
            break
    return leagues


def transactions(payload):
    for tx in payload or []:
        roster_ids = set(tx.get("roster_ids") or [])
        if tx.get("type") != "trade" or tx.get("status") != "complete" or len(roster_ids) != 2:
            continue
        sides = {owner: [] for owner in sorted(roster_ids)}
        for player, owner in (tx.get("adds") or {}).items():
            if owner in sides:
                sides[owner].append(f"player:{player}")
        for pick in tx.get("draft_picks") or []:
            owner = pick["owner_id"]
            if owner in sides:
                sides[owner].append(f"pick:{pick['season']}:r{pick['round']}")
        if all(sides.values()):
            yield tx["transaction_id"], {
                "timestamp": tx.get("status_updated") or tx["created"],
                "sides": list(sides.values()),
            }


def collect(cache, year, week, limit=240, refresh=True):
    path = cache / "trade_corpus.json"
    if not refresh and path.exists():
        return json.loads(path.read_text())
    with ThreadPoolExecutor(max_workers=12) as pool:
        leagues = discover(pool, year, limit)
        frontier = list(leagues.values())
        for _ in range(2):
            previous = sorted({row["previous_league_id"] for row in frontier
                               if row.get("previous_league_id")} - leagues.keys())
            frontier = [row for row in pool.map(get, (f"league/{key}" for key in previous)) if eligible(row)]
            leagues.update((row["league_id"], row) for row in frontier)
        print(f"Collecting Sleeper transactions across {len(leagues)} league seasons", flush=True)
        jobs = [(key, leg) for key, league in sorted(leagues.items())
                for leg in range(1, 19 if int(league["season"]) < year else min(18, max(1, week)) + 1)]

        def load(job):
            key, leg = job
            saved = cache / "transactions" / f"{key}-{leg}.json"
            current_season = int(leagues[key]["season"]) >= year
            # Revisit recent legs where a pending trade may have since cleared.
            cacheable = leg <= min(16, week - 2) if current_season else leg < 18
            if saved.exists() and cacheable:
                return json.loads(saved.read_text())
            rows = dict(transactions(get(f"league/{key}/transactions/{leg}")))
            if cacheable:
                atomic_json(saved, rows)
            return rows

        trades = {}
        for (key, _), rows in zip(jobs, pool.map(load, jobs)):
            trades.update((tx, dict(row, league=key)) for tx, row in rows.items())
    if len(trades) < 1000 or len({row["league"] for row in trades.values()}) < 30:
        raise RuntimeError(f"Sleeper sample too small to publish: {len(trades)} completed trades")
    result = {"collectedOn": date.today().isoformat(), "trades": list(trades.values())}
    atomic_json(path, result)
    return result


if __name__ == "__main__":
    from pathlib import Path
    from build import resolve_nfl_clock
    season, week = resolve_nfl_clock(get("state/nfl"), date.today())
    result = collect(Path(".cache/player-values"), season, week)
    print(f"Collected {len(result['trades'])} completed trades")
