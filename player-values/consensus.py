"""The expert market: FantasyPros dynasty Superflex consensus, as published by DynastyProcess.

Dynasty Ticker's price is a learned blend of two inputs that answer the same
question in different ways:

- the football forecast (forecast.py): what a player's production says he will
  score above replacement over the next eight seasons, and
- the expert consensus: where 100+ dynasty rankers put him today. It sees what
  box scores cannot (injury type and recovery, depth charts, coaching, talent
  signals), and it has its own blind spots.

blend.py learns, from past seasons only, how much to trust each one by
position, and checks that on seasons it did not learn from. This file reads the
consensus and puts it on the forecast's scale. Standard library only.
"""
from __future__ import annotations

from pathlib import Path
import csv
import gzip
import io
import os
import tempfile

ECR_TYPE = "dsf"   # FantasyPros dynasty Superflex
BASE = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/"
LATEST_URL = BASE + "db_fpecr_latest.csv"
IDS_URL = BASE + "db_playerids.csv"
# Every Superflex dynasty board since October 2020: scrape date, FantasyPros id, rank.
# Seeded from DynastyProcess's archive; the daily refresh adds each new board.
ARCHIVE = Path(__file__).resolve().parent / "consensus_boards.csv.gz"
SOURCE = "FantasyPros dynasty Superflex expert consensus, via DynastyProcess (github.com/dynastyprocess/data)"


def _clean(value):
    value = str(value or "").strip()
    return "" if value in ("", "NA") else value


def load_ids(path):
    """FantasyPros id -> (Sleeper id, nflverse gsis id)."""
    output = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            fp_id = _clean(row.get("fantasypros_id"))
            if fp_id:
                output[fp_id] = (_clean(row.get("sleeper_id")), _clean(row.get("gsis_id")))
    return output


def _rows(handle):
    for row in csv.DictReader(handle):
        if row.get("ecr_type") != ECR_TYPE:
            continue
        try:
            ecr = float(row.get("ecr"))
        except (TypeError, ValueError):
            continue
        yield row, ecr


def latest_board(path):
    """(scrape date, {FantasyPros id: rank}) for the newest Superflex dynasty board."""
    ranks = {}
    dates = set()
    with open(path, newline="", encoding="utf-8") as handle:
        for row, ecr in _rows(handle):
            fp_id = _clean(row.get("id"))
            if fp_id:
                dates.add(_clean(row.get("scrape_date")))
                ranks[fp_id] = min(ecr, ranks.get(fp_id, ecr))
    if not ranks:
        raise RuntimeError("The expert consensus file has no Superflex dynasty board")
    return max(dates), ranks


def by_sleeper_id(ranks, ids):
    output = {}
    for fp_id, rank in ranks.items():
        sleeper_id = ids.get(fp_id, ("", ""))[0]
        if sleeper_id:
            output[sleeper_id] = min(rank, output.get(sleeper_id, rank))
    return output


def read_archive(path=ARCHIVE):
    boards = {}
    with gzip.open(path, "rt", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            boards.setdefault(row["scrape_date"], {})[row["fantasypros_id"]] = float(row["ecr"])
    return boards


def history(ids, path=ARCHIVE):
    """{scrape date: {gsis id: rank}} for every archived board."""
    output = {}
    for day, ranks in read_archive(path).items():
        board = output.setdefault(day, {})
        for fp_id, rank in ranks.items():
            gsis_id = ids.get(fp_id, ("", ""))[1]
            if gsis_id:
                board[gsis_id] = min(rank, board.get(gsis_id, rank))
    return output


def archive_board(day, ranks, path=ARCHIVE):
    """Add one board to the archive. A date already there is never rewritten. True when it was added."""
    boards = read_archive(path) if path.exists() else {}
    if day in boards:
        return False
    boards[day] = ranks
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    os.close(descriptor)
    try:
        # mtime=0 keeps the file byte-for-byte the same for the same boards.
        with open(temp_name, "wb") as out, \
                gzip.GzipFile(filename="", mode="wb", fileobj=out, compresslevel=9, mtime=0) as raw, \
                io.TextIOWrapper(raw, encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["scrape_date", "fantasypros_id", "ecr"])
            for board_day in sorted(boards):
                for fp_id, rank in sorted(boards[board_day].items()):
                    writer.writerow([board_day, fp_id, f"{rank:g}"])
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return True


def on_forecast_scale(forecast_values, ranks):
    """The consensus as a value on the forecast's own ruler.

    The forecast's values for everyone priced that day are sorted, and the
    consensus order hands them out: the expert's No. 1 gets the largest one,
    No. 2 the next. Players the experts do not list keep the forecast's order
    below everyone they do list. So the consensus changes who gets which value,
    never the spread of values, and both inputs share one scale.
    """
    pool = sorted(forecast_values.values(), reverse=True)
    order = sorted(
        forecast_values,
        key=lambda key: (key not in ranks, ranks.get(key, 0.0), -forecast_values[key], key),
    )
    return {key: value for key, value in zip(order, pool)}


def blend(forecast_value, market_value, weight):
    """`weight` is the learned share given to the football forecast."""
    return weight * forecast_value + (1.0 - weight) * market_value
