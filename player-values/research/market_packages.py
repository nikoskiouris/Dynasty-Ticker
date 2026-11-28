"""Measure package spacing against dated quotes; optionally export public league transactions."""
import argparse
from bisect import bisect_left
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
from statistics import median
from time import sleep

from ranking_holdout import fetch
from dynasty_calibration import market_surplus, native_score
from package_scale import CURRENT_CALCULATOR, V4, V51, archived_calculator, calculator_totals, interval

DIRECTORY = Path(__file__).resolve().parent
SLEEPER = "https://api.sleeper.app/v1/league/"
REPO = "perczakp/nfl-hirek"
LAST = "7fc7ef55133fb57de3cfabf0954b9999b56b68d1"
IDP = {"DL", "LB", "DB", "IDP_FLEX"}
POSITIONS = {"QB", "RB", "WR", "TE"}


def milliseconds(date):
    return int(datetime.fromisoformat(date.replace("Z", "+00:00")).timestamp() * 1000)


def league_eligible(league):
    scoring, slots, settings = league["scoring_settings"], league["roster_positions"], league["settings"]
    return (league["season"] == "2026" and league["total_rosters"] == 12 and settings["type"] == 2
            and not settings.get("best_ball") and slots.count("QB") == slots.count("SUPER_FLEX") == 1
            and not IDP.intersection(slots) and scoring.get("rec") == 1 and scoring.get("pass_td") == 4
            and not any(scoring.get(key) for key in ("bonus_rec_te", "bonus_rec_rb", "bonus_rec_wr")))


def exchange(trade):
    rosters = trade.get("roster_ids") or []
    if (trade["type"] != "trade" or trade["status"] != "complete" or len(set(rosters)) != 2
            or trade.get("waiver_budget")):
        return None
    adds, drops = trade.get("adds") or {}, trade.get("drops") or {}
    if set(adds) != set(drops) or any({adds[p], drops[p]} != set(rosters) for p in adds):
        return None
    picks = trade.get("draft_picks") or []
    if any({p["owner_id"], p["previous_owner_id"]} != set(rosters) for p in picks):
        return None
    sides = [[p for p in adds if adds[p] == rid] +
             [f"pick:{p['season']}:{p['round']}" for p in picks if p["owner_id"] == rid] for rid in rosters]
    return sorted(sides, key=len) if all(sides) else None


def collect_trades(cache, max_week=12, panel=DIRECTORY / "market-leagues-2026.txt"):
    def download(league_id):
        league = json.loads(fetch(SLEEPER + league_id, cache))
        if not league or not league_eligible(league):
            return False, {}
        found = {}
        for week in range(max_week + 1):
            url = f"{SLEEPER}{league_id}/transactions/{week}"
            cache_name = hashlib.sha256(url.encode()).hexdigest()[:16] + "-" + str(week)
            if not (cache / cache_name).exists():
                sleep(.30)  # Pace network access across the four workers.
            for t in json.loads(fetch(url, cache)):
                if not (milliseconds("2026-08-18T08:00:00Z") <= t["created"] <= t["status_updated"]
                        < milliseconds("2026-11-28T00:00:00Z")):
                    continue
                sides = exchange(t)
                if sides:
                    tid = t["transaction_id"]
                    found[tid] = dict(transaction=tid, league=league_id, week=week, proposed=t["created"],
                                      accepted=t["status_updated"], sides=sides)
        return True, found

    ids = panel.read_text().splitlines()
    result, allowed = {}, 0
    with ThreadPoolExecutor(4) as pool:
        for eligible, trades in pool.map(download, ids):
            allowed += eligible
            result.update(trades)
    print(f"Leagues: {allowed} included from {len(ids)} candidates.")
    return sorted(result.values(), key=lambda t: (t["proposed"], t["transaction"]))


def read_quotes(cache):
    boards = {}
    for page in (1, 2):
        url = (f"https://api.github.com/repos/{REPO}/commits?path=fantasycalc-values.json&sha={LAST}"
               f"&per_page=100&page={page}")
        for c in json.loads(fetch(url, cache)):
            # Look up the actual historical blob. The empty first commit is a placeholder.
            raw = f"https://raw.githubusercontent.com/{REPO}/{c['sha']}/fantasycalc-values.json"
            data = json.loads(fetch(raw, cache))
            if not data["values"]:
                continue
            settings = data["settings"]
            if (settings["dynasty"], settings["teams"], settings["qbs"], settings["ppr"]) != (True, 12, 2, 1):
                raise ValueError(f"Unexpected format in {raw}")
            known = max(milliseconds(data["fetchedAt"]), milliseconds(c["commit"]["committer"]["date"]))
            quotes = {}
            for row in data["values"]:
                if row["position"] in POSITIONS and row["sleeperId"]:
                    quotes[str(row["sleeperId"])] = row["value"]
                pick = re.fullmatch(r"(20\d{2}) (\d+)(?:st|nd|rd|th)", row["name"])
                if pick:
                    quotes["pick:" + ":".join(pick.groups())] = row["value"]
            boards[known] = quotes
    return boards


def covered_trades(trades, boards):
    times = sorted(boards)
    for trade in trades:
        before = bisect_left(times, trade["proposed"]) - 1
        if before < 0 or trade["proposed"] - times[before] > 7 * 86400000:
            continue
        known = times[before]
        if all(boards[known].get(p, 0) > 0 for side in trade["sides"] for p in side):
            yield known, trade


def market_evaluation(trades, boards):
    results = []
    kickoff = milliseconds("2026-09-10T00:20:00Z")
    # Actual transaction period supplies the v4 study's remaining-week factor after kickoff.
    for known, trade in covered_trades(trades, boards):
        board = boards[known]
        left, right = trade["sides"]
        fraction = 1 if trade["proposed"] < kickoff else max(0., (19 - max(1, trade["week"])) / 18)
        # This study reproduces v4's published linear chart on its original units.
        values = {key: round(min(100.0, 100 * market_surplus(board[key], fraction) / 361.37), 2)
                  for key in left + right}
        for method, prices in (("Raw quotes", board), ("Market conversion", values)):
            a, b = sum(prices[p] for p in left), sum(prices[p] for p in right)
            if a + b > 0:
                results.append((method, len(left), len(right), (b - a) / (a + b),
                                any(p.startswith("pick:") for p in left + right)))
    for method in ("Raw quotes", "Market conversion"):
        for name, rows in (
            ("All", [r for r in results if r[0] == method]),
            ("Unequal", [r for r in results if r[0] == method and r[1] != r[2]]),
            ("Unequal, players only", [r for r in results if r[0] == method and r[1] != r[2] and not r[4]]),
            ("2 for 1", [r for r in results if r[0] == method and (r[1], r[2]) == (1, 2)]),
        ):
            if rows:
                bias = "" if name == "All" else f", package bias {median(r[3] for r in rows):+.1%}"
                print(f"{method}, {name}: n={len(rows)}, median absolute gap "
                      f"{median(abs(r[3]) for r in rows):.1%}{bias}")


def later_packages(trades, boards, *, show_examples=False):
    # Start after the August football-board study ends. Evaluate each source
    # at the phase when that quote was available, using Tuesday 06:00 UTC boundaries.
    after_week_two = milliseconds("2026-09-22T06:00:00Z")
    opening_tuesday = milliseconds("2026-09-08T06:00:00Z")
    elapsed_week = 7 * 86400000
    by_day = defaultdict(list)
    eligible = [t for t in trades if t["proposed"] >= after_week_two]
    for known, trade in covered_trades(eligible, boards):
        by_day[known].append(trade)
    print(f"Later window: {sum(map(len, by_day.values()))}/{len(eligible)} trades have matching quotes.")
    groups = defaultdict(list)
    examples = {}
    with archived_calculator(V4) as previous, archived_calculator(V51) as v51_calculator:
        for known, deals in by_day.items():
            quotes = boards[known]
            fraction = 1 - (known - opening_tuesday) // elapsed_week / 18
            utilities = {k: market_surplus(q, fraction) for k, q in quotes.items()}
            v4 = {k: round(min(100., 100 * u / 361.37), 2) for k, u in utilities.items()}
            v5 = {k: round(native_score(u, fraction), 2) for k, u in utilities.items()}
            players = sorted((k for k in quotes if not k.startswith("pick:")), key=quotes.get, reverse=True)
            ranks = {k: r for r, k in enumerate(players, 1)}
            old = calculator_totals(v4, deals, previous)
            historical = calculator_totals(v5, deals, v51_calculator)
            current = calculator_totals(v5, deals, CURRENT_CALCULATOR)
            for trade, old_totals, prior_totals, new_totals in zip(deals, old, historical, current, strict=True):
                left, right = trade["sides"]  # collect_trades sorts by number of pieces.
                quoted = [sum(quotes[k] for k in side) for side in (left, right)]
                totals = {"v4": old_totals, "v5.1": prior_totals, "current": new_totals, "raw quotes": [quoted]}
                row = {method: [(b - a) / (b + a) for a, b in pairs] for method, pairs in totals.items()}
                row["league"] = trade["league"]
                groups["All"].append(row)
                if len(left) == len(right):
                    continue
                groups["Unequal"].append(row)
                players_only = all(k in ranks for k in left + right)
                if players_only:
                    groups["Unequal, players only"].append(row)
                if show_examples and (len(left), len(right)) == (1, 2):
                    label = "players only" if players_only else "includes picks"
                    if label not in examples:
                        examples[label] = (trade, known, {k: v5[k] for k in left + right}, new_totals)
                if len(left) == 1 and len(right) >= 3:
                    groups["1 for 3 or more"].append(row)
                best = min((ranks[k] for k in left + right if k in ranks), default=999)
                for threshold in (6, 12):
                    if best <= threshold:
                        groups[f"Unequal, top-{threshold} quoted player"].append(row)
    for name, rows in groups.items():
        leagues = len({r["league"] for r in rows})
        print(f"{name}: {len(rows)} trades from {leagues} leagues")
        methods = (("v4", 1, "v4 credited"), ("v5.1", 1, "v5.1 credited"),
                   ("current", 1, "current credited"), ("current", 0, "current listed"), ("raw quotes", 0, "raw quotes"))
        for method, column, version in methods:
            gaps = [r[method][column] for r in rows]
            bias = "" if name == "All" else f", package bias {median(gaps):+.1%}"
            print(f"  {version} median absolute gap {median(abs(x) for x in gaps):.1%}{bias}")
        if name == "Unequal" and leagues >= 10:
            low, high = interval(rows, baseline=("current", 0), candidate=("current", 1))
            print(f"  Credited minus listed median gap, 95% league-bootstrap interval: {low:+.1%} to {high:+.1%}")
    for label, (trade, known, prices, totals) in examples.items():
        print(f"First covered two-for-one ({label}): {SLEEPER}{trade['league']}/transactions/{trade['week']}")
        print(f"  transaction {trade['transaction']}, proposal {trade['proposed']}, quote timestamp {known}")
        print(f"  sides {trade['sides']}, individual prices {prices}, listed and credited totals {totals}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / ".cache/dynasty-ticker/market-packages")
    parser.add_argument("--save-deals", type=Path, help="Also save eligible exchanges, including those missing quotes")
    parser.add_argument("--independent-panel", action="store_true",
                        help="Use the separate 34-league panel (weeks 0–2 for export, 0–12 with --later-packages)")
    parser.add_argument("--later-packages", action="store_true",
                        help="Compare raw quotes, listed prices and calculator totals in Weeks 3–12")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    if args.independent_panel:
        if not (args.save_deals or args.later_packages):
            parser.error("--independent-panel requires --save-deals or --later-packages")
        weeks = 12 if args.later_packages else 2
        trades = collect_trades(args.cache_dir, weeks, DIRECTORY / "market-leagues-independent-2026.txt")
    else:
        trades = collect_trades(args.cache_dir)
    print(f"Eligible two-sided transactions: {len(trades)}")
    if args.save_deals:
        args.save_deals.write_text(json.dumps(trades, separators=(",", ":")) + "\n")
    if args.independent_panel and not args.later_packages:
        return
    boards = read_quotes(args.cache_dir)
    if args.later_packages:
        later_packages(trades, boards, show_examples=args.independent_panel)
    else:
        market_evaluation(trades, boards)


if __name__ == "__main__":
    main()
