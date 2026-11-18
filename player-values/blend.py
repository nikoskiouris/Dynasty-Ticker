#!/usr/bin/env python3
"""Learn how much to trust the football forecast against the expert consensus.

At every past date with an archived consensus board (each kickoff, and part-way
through each season), the forecast is rebuilt from earlier games only and both
inputs are put on one scale (consensus.on_forecast_scale). Then one question:
which mix of the two best matches the points above replacement players went on
to score over the next three seasons?

The mix is a share for the forecast by position, fit by least squares with the
positions shrunk toward one shared share. It is checked the same way the
forecast is: the share used for a season is learned only from dates whose
outcomes were finished before that season began.

    python3 player-values/blend.py             # print the report
    python3 player-values/blend.py --write     # also save player-values/blend.json

Standard library only.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backtest  # noqa: E402
import build  # noqa: E402
import consensus  # noqa: E402
import forecast  # noqa: E402

CONFIG = build.CONFIG
OUTPUT = ROOT / "blend.json"
POSITIONS = build.POSITIONS
HORIZON = 3            # seasons of outcomes each date is scored on
POOL = 250             # scored: the forecast's top 250 and the consensus's top 250
MAX_BOARD_GAP = 10     # days between a replay date and the consensus board used for it
RIDGE = 0.05           # pull of each position's share toward the shared one


def _board_near(boards, when):
    best = min(boards, key=lambda day: abs((date.fromisoformat(day) - when).days))
    return best if abs((date.fromisoformat(best) - when).days) <= MAX_BOARD_GAP else None


def _realized(all_rows, pid, position, first, count, line):
    return [
        forecast.season_state(all_rows.get((pid, first + step)), line[position])[0]
        for step in range(count)
    ]


def _discounted(values):
    discount = float(CONFIG["annualDiscount"])
    return sum(value * discount ** step for step, value in enumerate(values))


def kickoff_date(inputs, season):
    """One anchor: kickoff of `season`. Outcomes are that season and the next two."""
    last_complete = int(inputs["currentSeason"]) - 1
    count = min(HORIZON, last_complete - season + 1)
    if count < 1:
        return None
    world, players = backtest.replay(inputs, season)
    line = world["replacement"]["sf"]
    all_rows = build.summaries(inputs["meta"], inputs["weekly"])
    rows = []
    for pid, player in players.items():
        rows.append({
            "pid": pid,
            "position": player["position"],
            "forecastYears": player["years"]["sf"][:count],
            "actualYears": _realized(all_rows, pid, player["position"], season, count, line),
        })
    return {"label": f"kickoff {season}", "season": season, "when": date(season, 9, 8), "firstOutcome": season, "rows": rows}


def midseason_date(inputs, season):
    """One anchor: part-way through `season`. Outcomes are the next three seasons."""
    last_complete = int(inputs["currentSeason"]) - 1
    count = min(HORIZON, last_complete - season)
    if count < 1:
        return None
    meta = inputs["meta"]
    week = int(CONFIG["backtest"]["midSeasonWeek"])
    elapsed = build.weeks_elapsed(week)
    weekly = {}
    for pid, games in inputs["weekly"].items():
        seen = [g for g in games if g["season"] < season or (g["season"] == season and g["week"] < week)]
        if seen:
            weekly[pid] = seen
    rows_now = build.summaries(meta, weekly)
    world = build.build_world(rows_now, meta, weekly, season)
    line = world["replacement"]["sf"]
    kickoff = date(season, 9, 8)
    when = kickoff + timedelta(days=7 * elapsed)
    all_rows = build.summaries(meta, inputs["weekly"])
    players = forecast.universe(season, world["rowsByPlayer"], world["rookieYear"], meta)
    for pid, by_season in world["rowsByPlayer"].items():
        if season in by_season and pid not in players:
            players[pid] = by_season[season]["position"]
    rows = []
    for pid, position in players.items():
        info = meta.get(pid) or {}
        exp = max(0, season - world["rookieYear"].get(pid, season))
        age = forecast.age_on(info, season) or forecast.default_age(exp)
        valued = build.value_player(world, pid, position, age, exp, forecast.draft_pick(info), elapsed, when, 1.0, kickoff)
        rows.append({
            "pid": pid,
            "position": position,
            "forecastYears": [row["expectedAdvantage"] for row in valued["sf"]["forecast"][1:count + 1]],
            "actualYears": _realized(all_rows, pid, position, season + 1, count, line),
        })
    return {"label": f"week {week} {season}", "season": season, "when": when, "firstOutcome": season + 1, "rows": rows}


def cut(anchor, before=None):
    """Score an anchor on its outcomes up to (not including) season `before`."""
    count = len(anchor["rows"][0]["forecastYears"])
    if before is not None:
        count = min(count, before - anchor["firstOutcome"])
    if count < 1:
        return None
    for row in anchor["rows"]:
        row["forecast"] = _discounted(row["forecastYears"][:count])
        row["actual"] = _discounted(row["actualYears"][:count])
    return anchor


def attach_market(anchor, boards):
    """Give every row its consensus rank and its consensus value on the forecast's scale."""
    cut(anchor)
    day = _board_near(boards, anchor["when"])
    if not day:
        return None
    board = boards[day]
    values = {row["pid"]: row["forecast"] for row in anchor["rows"]}
    market = consensus.on_forecast_scale(values, {pid: rank for pid, rank in board.items() if pid in values})
    for row in anchor["rows"]:
        row["rank"] = board.get(row["pid"])
        row["market"] = market[row["pid"]]
    by_forecast = sorted(anchor["rows"], key=lambda row: -row["forecast"])[:POOL]
    by_market = sorted([row for row in anchor["rows"] if row["rank"] is not None], key=lambda row: row["rank"])[:POOL]
    anchor["scored"] = list({row["pid"]: row for row in by_forecast + by_market}.values())
    anchor["board"] = day
    return anchor


def _design(row):
    """Shared (forecast, consensus) pair, then the same pair once more for the player's position."""
    out = [row["forecast"], row["market"]]
    for position in POSITIONS:
        on = 1.0 if row["position"] == position else 0.0
        out += [on * row["forecast"], on * row["market"]]
    return out


def fit(rows):
    """Least squares, actual ~ design. The position terms are shrunk toward zero (the shared mix)."""
    design = [_design(row) for row in rows]
    target = [row["actual"] for row in rows]
    width = len(design[0])
    gram = [[sum(r[i] * r[j] for r in design) for j in range(width)] for i in range(width)]
    rhs = [sum(r[i] * t for r, t in zip(design, target)) for i in range(width)]
    scale = sum(gram[i][i] for i in range(width)) / width
    for i in range(2, width):
        gram[i][i] += RIDGE * scale
    return forecast._solve(gram, rhs)


def shares(coefficients):
    """The forecast's share of the mix for each position, from the fitted weights on the two inputs."""
    output = {}
    for index, position in enumerate(POSITIONS):
        on_forecast = max(0.0, coefficients[0] + coefficients[2 + 2 * index])
        on_market = max(0.0, coefficients[1] + coefficients[3 + 2 * index])
        total = on_forecast + on_market
        output[position] = round(on_forecast / total, 3) if total > 0 else 0.5
    return output


def _ranks(values):
    order = sorted(range(len(values)), key=lambda i: -values[i])
    out = [0] * len(values)
    for rank, index in enumerate(order):
        out[index] = rank + 1
    return out


def spearman(xs, ys):
    rx, ry = _ranks(xs), _ranks(ys)
    middle = (len(xs) + 1) / 2
    return sum((a - middle) * (b - middle) for a, b in zip(rx, ry)) / sum((a - middle) ** 2 for a in rx)


def _scored_rows(anchor, before=None):
    """The scored pool for an anchor, with the consensus re-ranked on the (possibly cut) forecast."""
    if not cut(anchor, before):
        return []
    values = {row["pid"]: row["forecast"] for row in anchor["rows"]}
    ranks = {row["pid"]: row["rank"] for row in anchor["rows"] if row["rank"] is not None}
    market = consensus.on_forecast_scale(values, ranks)
    for row in anchor["rows"]:
        row["market"] = market[row["pid"]]
    return [dict(row) for row in anchor["scored"]]


def holdout(anchors):
    """Score each season with a mix learned only from outcomes finished before it began."""
    results = []
    for anchor in sorted(anchors, key=lambda a: (a["season"], a["when"])):
        season = anchor["season"]
        train = [row for other in anchors if other["firstOutcome"] < season for row in _scored_rows(other, season)]
        rows = _scored_rows(anchor)
        if len(train) < 200 or not rows:
            continue
        mix = shares(fit(train))
        actual = [row["actual"] for row in rows]
        inputs = {
            "forecast": [row["forecast"] for row in rows],
            "consensus": [row["market"] for row in rows],
            "blend": [consensus.blend(row["forecast"], row["market"], mix[row["position"]]) for row in rows],
        }
        total = sum(actual) or 1.0
        results.append({
            "date": anchor["label"],
            "board": anchor["board"],
            "players": len(rows),
            "trainedOn": len(train),
            "forecastShare": mix,
            "rankCorrelation": {name: round(spearman(values, actual), 3) for name, values in inputs.items()},
            "errorShare": {
                name: round(sum(abs(p - a) for p, a in zip(values, actual)) / total, 3) for name, values in inputs.items()
            },
        })
    return results


def build_report(inputs, boards, log=None):
    last_complete = int(inputs["currentSeason"]) - 1
    first_board = date.fromisoformat(min(boards))
    anchors = []
    for season in range(first_board.year, last_complete + 1):
        for maker in (kickoff_date, midseason_date):
            anchor = maker(inputs, season)
            if anchor and attach_market(anchor, boards):
                anchors.append(anchor)
                if log:
                    log(f"  {anchor['label']}: consensus board {anchor['board']}, {len(anchor['scored'])} players scored")
    if not anchors:
        raise RuntimeError("No past date has both a replayed forecast and a consensus board")
    checks = holdout(anchors)
    rows = [row for anchor in anchors for row in _scored_rows(anchor)]
    mix = shares(fit(rows))
    mean = lambda key, name: round(sum(c[key][name] for c in checks) / len(checks), 3) if checks else None
    return {
        "modelVersion": CONFIG["modelVersion"],
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dataThroughSeason": last_complete,
        "consensusSource": consensus.SOURCE,
        "method": (
            "At each past kickoff and mid-season date with an archived consensus board, the forecast is rebuilt "
            "from earlier games only and the consensus is put on the forecast's scale. The forecast's share of the "
            "mix, by position, is the least-squares fit to the points above replacement players scored over the "
            f"next {HORIZON} seasons. Positions are pulled toward one shared share."
        ),
        "forecastShare": mix,
        "dates": [{"date": a["label"], "board": a["board"], "players": len(a["scored"])} for a in anchors],
        "holdout": {
            "claim": "Each season is scored with a mix learned only from outcomes finished before it began.",
            "seasons": checks,
            "mean": {
                "rankCorrelation": {name: mean("rankCorrelation", name) for name in ("forecast", "consensus", "blend")},
                "errorShare": {name: mean("errorShare", name) for name in ("forecast", "consensus", "blend")},
            },
        },
        "notValidated": [
            "seasons beyond three ahead: the mix is learned on three-season outcomes and applied to the eight-season price",
            "dates other than kickoff and mid-season",
            "future picks, which are priced by the forecast alone",
        ],
    }


def report_is_current(season, path=None):
    path = path or OUTPUT
    if not path.exists():
        return False
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return report.get("modelVersion") == CONFIG["modelVersion"] and int(report.get("dataThroughSeason") or 0) >= int(season) - 1


def load(path=None):
    """The saved mix. The build refuses to price without one for this model version."""
    path = path or OUTPUT
    report = json.loads(path.read_text(encoding="utf-8"))
    if report.get("modelVersion") != CONFIG["modelVersion"]:
        raise RuntimeError(f"{path.name} is for {report.get('modelVersion')}, not {CONFIG['modelVersion']}. Run blend.py --write.")
    return report


def print_report(report):
    print(f"Forecast share of the price by position: {report['forecastShare']}")
    for check in report["holdout"]["seasons"]:
        r = check["rankCorrelation"]
        print(f"  {check['date']:16s} board {check['board']}  rank: forecast {r['forecast']:.3f}  consensus {r['consensus']:.3f}  blend {r['blend']:.3f}")
    m = report["holdout"]["mean"]
    print(f"Mean rank correlation {m['rankCorrelation']}  error share {m['errorShare']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/player-values"))
    parser.add_argument("--use-cache", action="store_true", help="Reuse already-downloaded upstream files")
    parser.add_argument("--write", action="store_true", help="Save player-values/blend.json")
    parser.add_argument("--if-stale", action="store_true", help="Do nothing when blend.json covers this model and the last finished season")
    args = parser.parse_args()
    today = datetime.now(timezone.utc).date()
    refresh = not args.use_cache
    if args.if_stale:
        state_path = build.fetch(args.cache_dir, "sleeper_state.json", build.SLEEPER_STATE_URL, refresh=refresh)
        season, _week = build.resolve_nfl_clock(json.loads(state_path.read_text(encoding="utf-8")), today)
        if report_is_current(season):
            print("The saved blend already covers this model and the last finished season.")
            return
    inputs = build.load_inputs(args.cache_dir, refresh=refresh, today=today)
    ids = consensus.load_ids(build.fetch(args.cache_dir, "dp_playerids.csv", consensus.IDS_URL, refresh=refresh))
    boards = consensus.history(ids)
    report = build_report(inputs, boards, log=lambda line: print(line, file=sys.stderr))
    print_report(report)
    if args.write:
        build.atomic_json(OUTPUT, report)
        print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
