"""A small made-up league for forecast tests. No download, same every run.

Players have a talent set by draft slot, an age curve, off-years, and injuries
they come back from. Nothing here is a real player.
"""

from __future__ import annotations

import importlib.util
import random
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALUES = ROOT / "player-values"
if str(VALUES) not in sys.path:
    sys.path.insert(0, str(VALUES))


def load(name):
    """Load player-values/<name>.py once, under its own name, so every test shares one copy."""
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, VALUES / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


build = load("build")
forecast = load("forecast")

ROOKIES_PER_CLASS = {"QB": 12, "RB": 26, "WR": 34, "TE": 14}
BASE_PPG = {"QB": 9.0, "RB": 2.5, "WR": 2.5, "TE": 2.0}
TOP_PPG = {"QB": 14.0, "RB": 16.0, "WR": 16.0, "TE": 12.0}
PEAK_AGE = {"QB": 29, "RB": 25, "WR": 27, "TE": 27}
DECLINE = {"QB": 0.025, "RB": 0.075, "WR": 0.05, "TE": 0.05}
LAST_AGE = {"QB": 40, "RB": 32, "WR": 34, "TE": 35}


def age_factor(position, age):
    peak = PEAK_AGE[position]
    if age < peak:
        return max(0.55, 1.0 - 0.07 * (peak - age))
    return max(0.0, 1.0 - DECLINE[position] * (age - peak))


def make_inputs(first_class=1996, last_season=2025, current_season=2026, seed=11):
    """Weekly games and player metadata in the shape build.load_inputs returns."""
    rng = random.Random(seed)
    meta = {}
    weekly = {}
    for draft_year in range(first_class, last_season + 1):
        for position, count in ROOKIES_PER_CLASS.items():
            for index in range(count):
                pid = f"{position}-{draft_year}-{index:02d}"
                pick = min(forecast.MAX_PICK - 1, 1 + int(index * 255 / count) + rng.randint(0, 4))
                born = draft_year - rng.choice((21, 22, 22, 23))
                meta[pid] = {
                    "position": position,
                    "birth_date": f"{born}-{rng.randint(1, 12):02d}-15",
                    "draft_year": str(draft_year),
                    "draft_pick": str(pick),
                    "display_name": f"{position} {draft_year} {index}",
                }
                talent = BASE_PPG[position] + TOP_PPG[position] * forecast.capital(pick) ** 1.5
                talent *= rng.uniform(0.55, 1.45)
                games = []
                for season in range(max(draft_year, 1999), last_season + 1):
                    age = season - born
                    if age > LAST_AGE[position]:
                        break
                    rate = talent * age_factor(position, age) * rng.uniform(0.75, 1.25)
                    if rate < BASE_PPG[position] * 0.8 and season > draft_year + 2:
                        break  # out of the league
                    hurt = rng.random()
                    played = 16 if hurt > 0.3 else (0 if hurt < 0.05 else rng.randint(3, 14))
                    for week in sorted(rng.sample(range(1, 18), played)):
                        points = max(0.0, rate * rng.uniform(0.4, 1.6))
                        games.append(game(position, season, week, points))
                if games:
                    weekly[pid] = games
    return {
        "meta": meta,
        "weekly": weekly,
        "currentSeason": current_season,
        "currentWeek": 1,
        "state": {"season": str(current_season), "season_type": "pre"},
        "sleeper": {},
        "identity": build.build_identity_index(meta),
        "sourcePaths": [],
    }


def game(position, season, week, points):
    row = {
        "season": season,
        "week": week,
        "position": position,
        "team": "SYN",
        "ppr": points,
        "attempts": 30.0 if position == "QB" else 0.0,
        "completions": 0.0,
        "passing_yards": 0.0,
        "passing_tds": 0.0,
        "interceptions": 0.0,
        "carries": 12.0 if position == "RB" else 2.0 if position == "QB" else 0.0,
        "rushing_yards": 0.0,
        "rushing_tds": 0.0,
        "targets": 7.0 if position in ("WR", "TE") else 2.0 if position == "RB" else 0.0,
        "receptions": 0.0,
        "receiving_yards": 0.0,
        "receiving_tds": 0.0,
    }
    row["opportunities"] = build.opportunities(row, position)
    return row


_CACHE = {}


def league():
    """(inputs, season rows, world entering the current season). Built once per test run."""
    if "league" not in _CACHE:
        inputs = make_inputs()
        rows = build.summaries(inputs["meta"], inputs["weekly"])
        world = build.build_world(rows, inputs["meta"], inputs["weekly"], inputs["currentSeason"])
        _CACHE["league"] = (inputs, rows, world)
    return _CACHE["league"]


KICKOFF = date(2026, 9, 8)
