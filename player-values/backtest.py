#!/usr/bin/env python3
"""Score the player-value forecast against what players went on to do.

For each past season the forecast is rebuilt using only games played before that
season's kickoff, then compared with the full-PPR points above replacement those
players produced over the next one, three, five, and eight seasons. The same
replay is run for two naive forecasts, so "better than guessing" has a number.

    python3 player-values/backtest.py              # print the report
    python3 player-values/backtest.py --write      # also save player-values/validation.json

Run it, and commit validation.json, whenever forecast.py or config.json changes.
A test fails if the saved report is for a different model version. The daily
refresh runs it with --if-stale, so a new season of results is scored once.

What this does not test: trade-market prices, weekly lineup decisions, or the
rookie-pick board against real rookie drafts.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import build  # noqa: E402
import forecast  # noqa: E402

CONFIG = build.CONFIG
POSITIONS = build.POSITIONS
GROUPS = ("rookies", "years 1-3", "veterans 25 and under", "veterans 26-28", "veterans 29-31", "veterans 32+")
TIERS = (("top 12", 0, 12), ("13-36", 12, 36), ("37-72", 36, 72), ("73-150", 72, 150))


def spearman(xs, ys):
    """Rank correlation with ties averaged. None when either side has no spread."""
    if len(xs) < 5:
        return None

    def ranks(values):
        order = sorted(range(len(values)), key=lambda index: values[index])
        result = [0.0] * len(values)
        start = 0
        while start < len(order):
            end = start
            while end + 1 < len(order) and values[order[end + 1]] == values[order[start]]:
                end += 1
            for position in range(start, end + 1):
                result[order[position]] = (start + end) / 2 + 1
            start = end + 1
        return result

    rx, ry = ranks(xs), ranks(ys)
    mean_x = sum(rx) / len(rx)
    mean_y = sum(ry) / len(ry)
    cov = sum((a - mean_x) * (b - mean_y) for a, b in zip(rx, ry))
    var_x = sum((a - mean_x) ** 2 for a in rx)
    var_y = sum((b - mean_y) ** 2 for b in ry)
    if var_x <= 0 or var_y <= 0:
        return None
    return cov / (var_x * var_y) ** 0.5


def as_of_rows(inputs, season):
    """Weekly games and season summaries as they stood at kickoff of `season`."""
    weekly = {}
    for pid, games in inputs["weekly"].items():
        earlier = [game for game in games if game["season"] < season]
        if earlier:
            weekly[pid] = earlier
    return weekly, build.summaries(inputs["meta"], weekly)


def replay(inputs, season):
    """Price every player who could have been priced at kickoff of `season`, knowing nothing later."""
    meta = inputs["meta"]
    weekly, rows = as_of_rows(inputs, season)
    world = build.build_world(rows, meta, weekly, season)
    kickoff = date(season, 9, 8)
    players = {}
    for pid, position in forecast.universe(season, world["rowsByPlayer"], world["rookieYear"], meta).items():
        info = meta.get(pid) or {}
        exp = max(0, season - world["rookieYear"].get(pid, season))
        age = forecast.age_on(info, season)
        if age is None:
            age = forecast.default_age(exp)
        pick = forecast.draft_pick(info)
        valued = build.value_player(world, pid, position, age, exp, pick, 0, kickoff, 1.0, kickoff)
        players[pid] = {
            "position": position,
            "age": age,
            "exp": exp,
            "pick": pick,
            "years": {fmt: [row["expectedAdvantage"] for row in valued[fmt]["forecast"]] for fmt in forecast.FORMATS},
            "last": {fmt: valued[fmt]["last"] for fmt in forecast.FORMATS},
            "prior": {fmt: valued[fmt]["prior"] for fmt in forecast.FORMATS},
        }
    return world, players


def realized_years(pid, position, season, horizon, all_rows, line):
    """Points above the kickoff-day replacement line the player then banked, season by season."""
    return [
        forecast.season_state(all_rows.get((pid, season + step)), line[position])[0]
        for step in range(horizon)
    ]


def group_of(player):
    if player["exp"] == 0:
        return "rookies"
    if player["exp"] <= 3:
        return "years 1-3"
    if player["age"] < 25.5:
        return "veterans 25 and under"
    if player["age"] < 28.5:
        return "veterans 26-28"
    if player["age"] < 31.5:
        return "veterans 29-31"
    return "veterans 32+"


def relevant(players, fmt):
    """The players a manager would actually trade for, chosen only from what was known at kickoff."""
    ranked = sorted(players, key=lambda pid: -players[pid]["last"][fmt][0])[:200]
    chosen = set(ranked)
    for pid, player in players.items():
        if player["exp"] == 0 and player["pick"] <= 100:
            chosen.add(pid)
        if player["exp"] <= 3 and player["pick"] <= 64:
            chosen.add(pid)
    return sorted(chosen)


def discounted(values, discount):
    return sum(value * discount ** step for step, value in enumerate(values))


def score_origin(inputs, all_rows, season, horizon, fmt="sf"):
    discount = float(CONFIG["annualDiscount"])
    world, players = replay(inputs, season)
    line = world["replacement"][fmt]
    pids = relevant(players, fmt)
    forecasts = {
        "model": {pid: players[pid]["years"][fmt][:horizon] for pid in players},
        # He repeats last season's full-season pace every year.
        "lastSeason": {pid: [players[pid]["last"][fmt][1]] * horizon for pid in players},
        # He repeats a 2:1 blend of his last two seasons' banked points every year.
        "lastTwoSeasons": {
            pid: [(2 * players[pid]["last"][fmt][0] + players[pid]["prior"][fmt][0]) / 3] * horizon for pid in players
        },
    }
    actual_years = {
        pid: realized_years(pid, players[pid]["position"], season, horizon, all_rows, line) for pid in players
    }
    actual = {pid: discounted(actual_years[pid], discount) for pid in players}
    result = {"season": season, "players": len(pids)}
    best_possible = sum(sorted(actual.values(), reverse=True)[:60]) or 1.0
    for name, by_player in forecasts.items():
        predicted = {pid: discounted(by_player[pid], discount) for pid in players}
        entry = {
            "rank": spearman([predicted[pid] for pid in pids], [actual[pid] for pid in pids]),
            "top60": sum(actual[pid] for pid in sorted(players, key=lambda pid: -predicted[pid])[:60]) / best_possible,
            "error": sum(abs(predicted[pid] - actual[pid]) for pid in pids) / max(1.0, sum(actual[pid] for pid in pids)),
            "byPosition": {},
        }
        for position in POSITIONS:
            subset = [pid for pid in pids if players[pid]["position"] == position]
            entry["byPosition"][position] = spearman([predicted[pid] for pid in subset], [actual[pid] for pid in subset])
        result[name] = entry
    # Calibration of the model only: realized points and forecast points, summed.
    model = forecasts["model"]
    sums = {
        "byYear": [[0.0, 0.0] for _ in range(horizon)],
        "byGroup": defaultdict(lambda: [0.0, 0.0]),
        "byPosition": defaultdict(lambda: [0.0, 0.0]),
        "byTier": defaultdict(lambda: [0.0, 0.0]),
        "overall": [0.0, 0.0],
    }
    for pid in pids:
        for step in range(horizon):
            weight = discount ** step
            sums["byYear"][step][0] += actual_years[pid][step]
            sums["byYear"][step][1] += model[pid][step]
            for key, label in (("byGroup", group_of(players[pid])), ("byPosition", players[pid]["position"])):
                sums[key][label][0] += actual_years[pid][step] * weight
                sums[key][label][1] += model[pid][step] * weight
            sums["overall"][0] += actual_years[pid][step] * weight
            sums["overall"][1] += model[pid][step] * weight
    order = sorted(players, key=lambda pid: -discounted(model[pid], discount))
    for label, low, high in TIERS:
        for pid in order[low:high]:
            sums["byTier"][label][0] += actual[pid]
            sums["byTier"][label][1] += discounted(model[pid], discount)
    result["sums"] = sums
    return result


def score_midseason(inputs, all_rows, season, week, fmt="sf"):
    """Replay a season part-way through: how well are the weeks left, and next season, forecast?

    Three forecasts are compared: the published blend, the kickoff forecast with
    this season's games ignored, and this season's pace with the kickoff forecast ignored.
    """
    meta = inputs["meta"]
    elapsed = build.weeks_elapsed(week)
    weeks_left = forecast.FANTASY_WEEKS - elapsed
    weekly = {}
    rest_games = {}
    for pid, games in inputs["weekly"].items():
        seen = [game for game in games if game["season"] < season or (game["season"] == season and game["week"] < week)]
        if seen:
            weekly[pid] = seen
        later = [game for game in games if game["season"] == season and game["week"] >= week]
        if later:
            rest_games[pid] = later
    rows = build.summaries(meta, weekly)
    rest_rows = build.summaries(meta, rest_games)
    world = build.build_world(rows, meta, weekly, season)
    line = world["replacement"][fmt]
    kickoff = date(season, 9, 8)
    as_of = kickoff + timedelta(days=7 * elapsed)
    players = forecast.universe(season, world["rowsByPlayer"], world["rookieYear"], meta)
    for pid, by_season in world["rowsByPlayer"].items():
        if season in by_season and pid not in players:
            players[pid] = by_season[season]["position"]
    scored = {}
    for pid, position in players.items():
        info = meta.get(pid) or {}
        exp = max(0, season - world["rookieYear"].get(pid, season))
        age = forecast.age_on(info, season)
        if age is None:
            age = forecast.default_age(exp)
        pick = forecast.draft_pick(info)
        now = build.value_player(world, pid, position, age, exp, pick, elapsed, as_of, 1.0, kickoff)[fmt]
        before = build.value_player(world, pid, position, age, exp, pick, 0, kickoff, 1.0, kickoff)[fmt]
        seen_advantage, seen_pace, _seen_games = now["observed"]
        scored[pid] = {
            "position": position,
            "exp": exp,
            "pick": pick,
            "last": {fmt: now["last"]},
            "rest": {
                "model": now["forecast"][0]["expectedAdvantage"],
                "kickoffOnly": before["forecast"][0]["expectedAdvantage"] * weeks_left / forecast.FANTASY_WEEKS,
                "paceOnly": seen_advantage / elapsed * weeks_left if elapsed else 0.0,
            },
            "next": {
                "model": now["forecast"][1]["expectedAdvantage"],
                "kickoffOnly": before["forecast"][1]["expectedAdvantage"],
                "paceOnly": seen_pace,
            },
            "actualRest": forecast.season_state(rest_rows.get((pid, season)), line[position])[0],
            "actualNext": forecast.season_state(all_rows.get((pid, season + 1)), line[position])[0],
        }
    pids = relevant(scored, fmt)
    result = {"season": season}
    for target, actual_key in (("rest", "actualRest"), ("next", "actualNext")):
        actual = [scored[pid][actual_key] for pid in pids]
        result[target] = {}
        for name in ("model", "kickoffOnly", "paceOnly"):
            predicted = [scored[pid][target][name] for pid in pids]
            result[target][name] = {
                "rank": spearman(predicted, actual),
                "actual": sum(actual),
                "forecast": sum(predicted),
            }
    return result


def run_midseason(inputs, week=None, first_origin=None, fmt="sf", log=None):
    settings = CONFIG["backtest"]
    week = int(week or settings["midSeasonWeek"])
    first_origin = int(first_origin or settings["firstOrigin"])
    all_rows = build.summaries(inputs["meta"], inputs["weekly"])
    last_complete = int(inputs["currentSeason"]) - 1
    origins = list(range(first_origin, last_complete))
    results = []
    for season in origins:
        results.append(score_midseason(inputs, all_rows, season, week, fmt))
        if log:
            log(f"  after week {week - 1} of {season}: rest-of-season rank {results[-1]['rest']['model']['rank']:.3f}")
    summary = {"afterWeek": week - 1, "origins": [origins[0], origins[-1]]}
    for target, label in (("rest", "restOfSeason"), ("next", "nextSeason")):
        summary[label] = {"rankCorrelation": {}, "realizedOverForecast": {}}
        for name in ("model", "kickoffOnly", "paceOnly"):
            summary[label]["rankCorrelation"][name] = _mean([result[target][name]["rank"] for result in results])
            summary[label]["realizedOverForecast"][name] = _ratio([
                sum(result[target][name]["actual"] for result in results),
                sum(result[target][name]["forecast"] for result in results),
            ])
    return summary


def _mean(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 3) if values else None


def _ratio(pair):
    return round(pair[0] / pair[1], 2) if pair[1] > 0 else None


def summarize(results, horizon):
    """Average the rank scores over origins. Pool the points before taking calibration ratios."""
    summary = {
        "horizonSeasons": horizon,
        "origins": [results[0]["season"], results[-1]["season"]],
        "playersPerOrigin": round(sum(result["players"] for result in results) / len(results)),
        "rankCorrelation": {},
        "top60Capture": {},
        "errorShare": {},
    }
    for name in ("model", "lastSeason", "lastTwoSeasons"):
        summary["rankCorrelation"][name] = _mean([result[name]["rank"] for result in results])
        summary["top60Capture"][name] = _mean([result[name]["top60"] for result in results])
        summary["errorShare"][name] = _mean([result[name]["error"] for result in results])
    summary["rankCorrelationByPosition"] = {
        position: {
            name: _mean([result[name]["byPosition"][position] for result in results])
            for name in ("model", "lastSeason")
        }
        for position in POSITIONS
    }
    pooled_years = [[0.0, 0.0] for _ in range(horizon)]
    pooled = {key: defaultdict(lambda: [0.0, 0.0]) for key in ("byGroup", "byPosition", "byTier")}
    overall = [0.0, 0.0]
    for result in results:
        sums = result["sums"]
        for step in range(horizon):
            pooled_years[step][0] += sums["byYear"][step][0]
            pooled_years[step][1] += sums["byYear"][step][1]
        for key in pooled:
            for label, pair in sums[key].items():
                pooled[key][label][0] += pair[0]
                pooled[key][label][1] += pair[1]
        overall[0] += sums["overall"][0]
        overall[1] += sums["overall"][1]
    summary["realizedOverForecast"] = {
        "overall": _ratio(overall),
        "byYear": [_ratio(pair) for pair in pooled_years],
        "byGroup": {label: _ratio(pooled["byGroup"][label]) for label in GROUPS if label in pooled["byGroup"]},
        "byPosition": {position: _ratio(pooled["byPosition"][position]) for position in POSITIONS},
        "byTier": {label: _ratio(pooled["byTier"][label]) for label, _low, _high in TIERS},
    }
    return summary


def run(inputs, first_origin=None, horizons=None, fmt="sf", log=None):
    settings = CONFIG["backtest"]
    first_origin = int(first_origin or settings["firstOrigin"])
    horizons = [int(value) for value in (horizons or settings["horizons"])]
    all_rows = build.summaries(inputs["meta"], inputs["weekly"])
    last_complete = int(inputs["currentSeason"]) - 1
    report = {}
    for horizon in horizons:
        origins = list(range(first_origin, last_complete - horizon + 2))
        if not origins:
            continue
        results = []
        for season in origins:
            results.append(score_origin(inputs, all_rows, season, horizon, fmt))
            if log:
                log(f"  {horizon}-season window, kickoff {season}: rank {results[-1]['model']['rank']:.3f}")
        report[str(horizon)] = summarize(results, horizon)
    return report, last_complete


CLAIM = (
    "Rebuilt at each past kickoff from earlier games only, the forecast orders players by the points above "
    "replacement they went on to score better than repeating last season, and its totals land near what happened."
)
NOT_VALIDATED = [
    "trade-market prices",
    "the 0.85 annual discount and the replacement definition, which are product choices",
    "the rookie-pick board against real rookie drafts",
    "in-season updates at weeks other than the one replayed",
    "injury-specific recovery",
    "weekly lineup decisions",
]


def build_report(inputs, log=None):
    summary, last_complete = run(inputs, log=log)
    in_season = run_midseason(inputs, log=log)
    return {
        "modelVersion": CONFIG["modelVersion"],
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dataThroughSeason": last_complete,
        "format": "Superflex full PPR",
        "method": (
            "Rolling origin. Each kickoff is priced from earlier games only and scored on discounted points above "
            "the kickoff-day replacement line over the next N seasons. Players are the top 200 by last season's "
            "points above replacement plus recent early draft picks, chosen before the outcome is known."
        ),
        "claim": CLAIM,
        "summary": summary,
        "inSeason": in_season,
        "notValidated": NOT_VALIDATED,
    }


def report_is_current(season, path=None):
    """True when the saved report scored this model version with every finished season."""
    path = path or build.VALIDATION
    if not path.exists():
        return False
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return (
        report.get("modelVersion") == CONFIG["modelVersion"]
        and int(report.get("dataThroughSeason") or 0) >= int(season) - 1
    )


def print_report(report):
    for horizon, block in report["summary"].items():
        ranks = block["rankCorrelation"]
        capture = block["top60Capture"]
        cal = block["realizedOverForecast"]
        print(f"\nNext {horizon} season(s), kickoffs {block['origins'][0]}-{block['origins'][1]}, about {block['playersPerOrigin']} players each")
        print(f"  rank correlation with what happened   forecast {ranks['model']:.3f}   last season repeated {ranks['lastSeason']:.3f}   last two seasons {ranks['lastTwoSeasons']:.3f}")
        print(f"  value captured by the top 60 picks     forecast {capture['model']:.3f}   last season repeated {capture['lastSeason']:.3f}   last two seasons {capture['lastTwoSeasons']:.3f}")
        print(f"  realized / forecast points             overall {cal['overall']}   by year {cal['byYear']}")
        print(f"    by group    {cal['byGroup']}")
        print(f"    by position {cal['byPosition']}")
        print(f"    by forecast rank {cal['byTier']}")


    mid = report.get("inSeason")
    if mid:
        print(f"\nReplayed after week {mid['afterWeek']}, seasons {mid['origins'][0]}-{mid['origins'][1]}")
        for label, title in (("restOfSeason", "weeks left this season"), ("nextSeason", "next season")):
            ranks = mid[label]["rankCorrelation"]
            cal = mid[label]["realizedOverForecast"]
            print(f"  {title:22s} rank: forecast {ranks['model']:.3f}   kickoff forecast only {ranks['kickoffOnly']:.3f}   this season's pace only {ranks['paceOnly']:.3f}")
            print(f"  {'':22s} realized / forecast: {cal['model']}   {cal['kickoffOnly']}   {cal['paceOnly']}")
    print("\nNot tested: " + "; ".join(report.get("notValidated") or []) + ".")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/player-values"))
    parser.add_argument("--use-cache", action="store_true", help="Reuse already-downloaded upstream files")
    parser.add_argument("--write", action="store_true", help="Save player-values/validation.json")
    parser.add_argument(
        "--if-stale",
        action="store_true",
        help="Do nothing when the saved report already scores this model through the last finished season",
    )
    args = parser.parse_args()
    today = datetime.now(timezone.utc).date()
    if args.if_stale:
        state_path = build.fetch(args.cache_dir, "sleeper_state.json", build.SLEEPER_STATE_URL, refresh=not args.use_cache)
        season, _week = build.resolve_nfl_clock(json.loads(state_path.read_text(encoding="utf-8")), today)
        if report_is_current(season):
            print("The saved backtest already covers this model and the last finished season.")
            return
    inputs = build.load_inputs(args.cache_dir, refresh=not args.use_cache, today=today)
    report = build_report(inputs, log=lambda line: print(line, file=sys.stderr))
    print_report(report)
    if args.write:
        build.atomic_json(build.VALIDATION, report)
        print(f"\nwrote {build.VALIDATION}")


if __name__ == "__main__":
    main()
