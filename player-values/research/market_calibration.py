"""Recreate the frozen trade-quote to lineup-PPR reference from public startup drafts.

Only this research command uses DuckDB, to read the published 2026 Parquet file.
Alternatively pass --quotes-csv with its fc_value and position columns.
"""
import argparse
import csv
import io
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from statistics import mean, median
from urllib.request import urlopen

from ranking_holdout import CROSSWALK, POSITIONS, STATS, csv_rows, fetch, marginal

# Year-specific public draft lists referenced in Adeiko's Sep 2022 ADP export.
SHEETS = {2019: "1TeEb5l7SBTUABwOLwXSoIB3FK24dr-ol-zfiqBdNqH8",
          2020: "1KGKuAy6PZEJmfNeEngf5fyVop-2oEOeWJ1957UvB2rw"}
FC_ARCHIVE = ("https://raw.githubusercontent.com/stranger9977/dynasty-dashboard/"
              "2f6d6516c98c87f6e301b88bac5720d1ecb12b2f/data/seed/fantasycalc.parquet")
BANDS = ((1, 3), (4, 8), (9, 16), (17, 30), (31, 48), (49, 72), (73, 108),
         (109, 156), (157, 216), (217, 300), (301, 398))
SCORING = dict(pass_td=4, rush_td=6, rec_td=6, pass_yd=.04, rush_yd=.1, rec_yd=.1, rec=1)


def cutoff_drafts(cache):
    def verify(entry):
        year, league_id, draft_id = entry
        def sleeper(path):
            return json.loads(fetch("https://api.sleeper.app/v1/" + path, cache))
        league = sleeper("league/" + league_id)
        scoring = league["scoring_settings"]
        seats = league["roster_positions"]
        if (league["season"] != str(year) or league["total_rosters"] != 12 or league["settings"]["type"] != 2
                or seats.count("QB") != 1 or seats.count("SUPER_FLEX") != 1
                or any(scoring.get("bonus_rec_" + pos) for pos in ("rb", "wr", "te"))
                or any(abs(scoring.get(k, 0) - v) > .00001 for k, v in SCORING.items())):
            return None
        draft = sleeper("draft/" + draft_id)
        if (draft["league_id"] != league_id or draft["status"] != "complete"
                or draft["settings"].get("rounds", 0) < 15 or draft["type"] == "auction"):
            return None
        picks = sorted(sleeper(f"draft/{draft_id}/picks"), key=lambda r: r["pick_no"])
        ids = [r["player_id"] for r in picks if r["metadata"].get("position") in POSITIONS and not r.get("is_keeper")]
        return (year, ids) if len(ids) >= 180 else None

    candidates = []
    for year, sheet in SHEETS.items():
        url = f"https://docs.google.com/spreadsheets/d/{sheet}/gviz/tq?tqx=out:csv&sheet=LeagueList"
        for r in csv.reader(io.StringIO(fetch(url, cache))):
            if (len(r) > 10 and r[5:10] == ["12", "No", "No", "1", "Rookies"]
                    and r[1] in ("6", "7", "8") and r[3].isdigit()):
                candidates.append((year, r[4], r[3]))
    with ThreadPoolExecutor(6) as executor:
        return [draft for draft in executor.map(verify, candidates) if draft]


def quote_sample(csv_path, cache):
    if csv_path:
        with csv_path.open() as file:
            values = [float(r["fc_value"]) for r in csv.DictReader(file) if r["position"] in POSITIONS]
    else:
        import duckdb
        path = cache / "market-2026-05-29.parquet"
        if not path.exists():
            with urlopen(FC_ARCHIVE, timeout=60) as response:
                path.write_bytes(response.read())
        values = [v for (v,) in duckdb.connect().execute(
            "SELECT fc_value FROM read_parquet(?) WHERE position IN ('QB','RB','WR','TE')", [str(path)]
        ).fetchall()]
    return sorted(values, reverse=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path.home() / ".cache/dynasty-ticker/ranking-holdout")
    parser.add_argument("--quotes-csv", type=Path)
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    quotes = quote_sample(args.quotes_csv, cache)
    crosswalk = {r["sleeper_id"]: r["gsis_id"] for r in csv_rows(CROSSWALK, cache) if r["gsis_id"] != "NA"}
    points = {}
    for year in range(min(SHEETS), max(SHEETS) + 3):
        games = 16 if year < 2021 else 17
        stats = {r["player_id"]: {"pos": r["position"], "points": float(r["fantasy_points_ppr"] or 0) * 17 / games}
                 for r in csv_rows(STATS.format(year), cache) if r["season_type"] == "REG" and r["position"] in POSITIONS}
        points[year] = marginal(stats, "points")
    drafts = cutoff_drafts(cache)
    print("Drafts", dict(Counter(y for y, _ in drafts)), "Reference quotes", len(quotes))
    observations, unresolved = 0, 0
    for lo, hi in BANDS:
        by_year = defaultdict(list)
        for year, picks in drafts:
            outcomes = []
            for player in picks[lo - 1:hi]:
                gsis = crosswalk.get(player)
                unresolved += gsis is None
                observations += 1
                first = points[year].get(gsis, 0)
                later = .85 * points[year + 1].get(gsis, 0) + .85 ** 2 * points[year + 2].get(gsis, 0)
                outcomes.append((first, later))
            if outcomes:
                by_year[year].append(tuple(mean(v) for v in zip(*outcomes)))
        amounts = [mean(mean(v[i] for v in drafts_in_year) for drafts_in_year in by_year.values()) for i in (0, 1)]
        print(f"{lo}-{hi}", median(quotes[lo - 1:hi]), *(round(v, 2) for v in amounts))
    print("Selection observations", observations, "unmatched identities", unresolved)


if __name__ == "__main__":
    main()
