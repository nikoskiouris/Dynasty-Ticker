"""Collect completed trades from public Sleeper dynasty leagues."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
import json
import random
import time
from threading import Lock
from urllib.error import HTTPError, URLError

from build import atomic_json, http_bytes

API = "https://api.sleeper.app/v1"
# Public league documented in the repository's previous walkthroughs.
SEEDS = ("1315165104303513600",)
PICK_SLOT_VERSION = 1
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


def transactions(payload, draft_for_pick=None):
    for tx in payload or []:
        roster_ids = set(tx.get("roster_ids") or [])
        if tx.get("type") != "trade" or tx.get("status") != "complete" or len(roster_ids) != 2:
            continue
        timestamp = tx.get("status_updated") or tx["created"]
        sides = {owner: [] for owner in sorted(roster_ids)}
        for player, owner in (tx.get("adds") or {}).items():
            if owner in sides:
                sides[owner].append(f"player:{player}")
        for pick in tx.get("draft_picks") or []:
            owner = pick["owner_id"]
            if owner in sides:
                asset = f"pick:{pick['season']}:r{pick['round']}"
                slots = draft_for_pick(str(pick["season"]), timestamp) if draft_for_pick else {}
                slot = slots.get(str(pick["roster_id"]))
                sides[owner].append(f"{asset}:{slot}" if slot is not None else asset)
        if all(sides.values()):
            yield tx["transaction_id"], {
                "timestamp": timestamp,
                "sides": list(sides.values()),
            }


def drafts_at_trade(drafts, season, timestamp):
    return [
        draft for draft in drafts
        if draft["season"] == season and draft["start"] <= timestamp
        and (draft["end"] is None or timestamp <= draft["end"])
    ]


def positions_for_league(cache, league):
    """Roster-to-slot mappings for started linear rookie drafts."""
    path = cache / "draft-slots" / f"{league}.json"
    if path.exists():
        return json.loads(path.read_text())
    drafts = []
    roster_by_owner = None
    for draft in get(f"league/{league}/drafts") or []:
        settings = draft.get("settings") or {}
        if (
            draft.get("type") != "linear" or settings.get("teams") != 12
            or settings.get("player_type") != 1 or not draft.get("start_time")
            or draft.get("status") not in {"drafting", "paused", "complete"}
            or not draft.get("season")
            or (draft["status"] == "complete" and not draft.get("last_picked"))
        ):
            continue
        slots = {str(roster): int(slot) for slot, roster in (draft.get("slot_to_roster_id") or {}).items()}
        if not slots and draft.get("draft_order"):
            if roster_by_owner is None:
                roster_by_owner = {
                    str(row["owner_id"]): str(row["roster_id"])
                    for row in get(f"league/{league}/rosters") or [] if row.get("owner_id")
                }
            slots = {roster_by_owner[owner]: int(slot) for owner, slot in draft["draft_order"].items()
                     if owner in roster_by_owner}
        slots = {roster: slot for roster, slot in slots.items() if 1 <= slot <= 12}
        if not slots or len(set(slots.values())) != len(slots):
            continue
        drafts.append({
            "season": str(draft["season"]),
            "start": draft["start_time"],
            "end": draft["last_picked"] if draft["status"] == "complete" else None,
            "slots": slots,
        })
    if drafts and all(draft["end"] is not None for draft in drafts):
        atomic_json(path, drafts)
    return drafts


def enrich_pick_slots(cache, corpus, pool):
    """Resolve only draft windows that overlap a same-year pick trade."""
    candidates = defaultdict(list)
    for row in corpus["trades"]:
        stamp = datetime.fromtimestamp(row["timestamp"] / 1000, timezone.utc)
        season = str(stamp.year)
        if any(asset.startswith(f"pick:{season}:") for side in row["sides"] for asset in side):
            candidates[row["league"]].append((row, season))
    leagues = sorted(candidates)
    def slots_for(league):
        drafts = positions_for_league(cache, league)
        return {row["timestamp"] for row, season in candidates[league]
                if len(drafts_at_trade(drafts, season, row["timestamp"])) == 1}, drafts

    staged = list(pool.map(slots_for, leagues))
    def replace_due(item):
        league, (timestamps, drafts) = item
        if not timestamps:
            return

        def draft_for_pick(season, timestamp):
            matches = drafts_at_trade(drafts, season, timestamp)
            return matches[0]["slots"] if len(matches) == 1 else {}

        # Historical caches prior to slot support may lack the transaction leg.
        # Search leg 1 first, then the other available legs for unmatched trades.
        rows_by_stamp = defaultdict(list)
        for row, _ in candidates[league]:
            if row["timestamp"] in timestamps:
                rows_by_stamp[row["timestamp"]].append(row)
        known_legs = {row["leg"] for rows in rows_by_stamp.values() for row in rows if "leg" in row}
        legs = sorted(known_legs)
        if any("leg" not in row for rows in rows_by_stamp.values() for row in rows):
            legs = [1, *[leg for leg in legs if leg != 1]]
            legs += [leg for leg in range(2, 19) if leg not in legs]
        for leg in legs:
            if not rows_by_stamp:
                break
            payload = get(f"league/{league}/transactions/{leg}")
            raw = [tx for tx in payload or [] if (tx.get("status_updated") or tx.get("created")) in rows_by_stamp]
            before = dict(transactions(raw))
            after = dict(transactions(raw, draft_for_pick))
            for tx, row in before.items():
                pending = rows_by_stamp.get(row["timestamp"], [])
                sides = sorted(sorted(side) for side in row["sides"])
                matches = [entry for entry in pending if entry.get("id", tx) == tx
                           and sorted(sorted(side) for side in entry["sides"]) == sides]
                if len(matches) != 1:
                    continue
                matches[0]["sides"] = after[tx]["sides"]
                pending.remove(matches[0])
                if not pending:
                    del rows_by_stamp[row["timestamp"]]

    for _ in pool.map(replace_due, zip(leagues, staged)):
        pass
    corpus["pickSlotsVersion"] = PICK_SLOT_VERSION
    return corpus


def collect(cache, year, week, limit=240, refresh=True):
    path = cache / "trade_corpus.json"
    if not refresh and path.exists():
        corpus = json.loads(path.read_text())
        if corpus.get("pickSlotsVersion") == PICK_SLOT_VERSION:
            return corpus
        with ThreadPoolExecutor(max_workers=12) as pool:
            enrich_pick_slots(cache, corpus, pool)
        atomic_json(path, corpus)
        return corpus
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
        for (key, leg), rows in zip(jobs, pool.map(load, jobs)):
            trades.update((tx, dict(row, league=key, leg=leg, id=tx)) for tx, row in rows.items())
        result = {"collectedOn": date.today().isoformat(), "trades": list(trades.values())}
        enrich_pick_slots(cache, result, pool)
    if len(trades) < 1000 or len({row["league"] for row in trades.values()}) < 30:
        raise RuntimeError(f"Sleeper sample too small to publish: {len(trades)} completed trades")
    atomic_json(path, result)
    return result


if __name__ == "__main__":
    from pathlib import Path
    from build import resolve_nfl_clock
    season, week = resolve_nfl_clock(get("state/nfl"), date.today())
    result = collect(Path(".cache/player-values"), season, week)
    print(f"Collected {len(result['trades'])} completed trades")
