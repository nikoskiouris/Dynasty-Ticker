"""The dynasty market: Superflex rankings from several public dynasty sources, on one scale.

Dynasty Ticker's price is a learned blend of two inputs that answer the same
question in different ways:

- the football forecast (forecast.py): what a player's production says he will
  score above replacement over the next eight seasons, and
- the market: where Superflex dynasty rankings put him today. FantasyPros'
  expert consensus (100+ rankers, via DynastyProcess), KeepTradeCut's crowd
  Superflex values, and FantasyCalc's 12-team Superflex PPR trade values. It
  sees what box scores cannot (injury type and recovery, depth charts,
  coaching, talent signals), and it has its own blind spots.

Every source is a Superflex board. One-QB boards are never read. Source names
stay in this repository; the site never shows them.

blend.py learns, from past seasons only, how much to trust each one by
position, and checks that on seasons it did not learn from. This file reads the
consensus and puts it on the forecast's scale. Standard library only.
"""
from __future__ import annotations

from pathlib import Path
import csv
import gzip
import html
import io
import json
import os
import re
import tempfile

ECR_TYPE = "dsf"   # FantasyPros dynasty Superflex
BASE = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/"
LATEST_URL = BASE + "db_fpecr_latest.csv"
IDS_URL = BASE + "db_playerids.csv"
# Every Superflex dynasty board since October 2020: scrape date, FantasyPros id, rank.
# Seeded from DynastyProcess's archive; the daily refresh adds each new board.
ARCHIVE = Path(__file__).resolve().parent / "consensus_boards.csv.gz"
SOURCE = "FantasyPros dynasty Superflex expert consensus, via DynastyProcess (github.com/dynastyprocess/data)"
KTC_URL = "https://keeptradecut.com/dynasty-rankings?page=0&filters=QB|WR|RB|TE|RDP&format=2"
FANTASYCALC_URL = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&numTeams=12&ppr=1"
# The other boards, archived daily from the first day they were read: source, date, Sleeper id, rank.
# There is no history for them before that, so their weight cannot be learned yet (see blend.py).
MARKET_ARCHIVE = Path(__file__).resolve().parent / "market_boards.csv.gz"
POSITIONS = ("QB", "RB", "WR", "TE")


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


def load_ktc_ids(path):
    """KeepTradeCut id -> Sleeper id."""
    output = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            ktc_id, sleeper_id = _clean(row.get("ktc_id")), _clean(row.get("sleeper_id"))
            if ktc_id and sleeper_id:
                output[ktc_id] = sleeper_id
    return output


def _name_key(name, position):
    text = "".join(ch for ch in str(name or "").lower() if ch.isalnum() or ch == " ")
    words = [w for w in text.split() if w not in ("jr", "sr", "ii", "iii", "iv", "v")]
    return (" ".join(words), str(position or "").upper())


def ktc_board(path, ktc_ids, names):
    """{Sleeper id: Superflex value} from KeepTradeCut's rankings page.

    `names` maps (name key, position) -> Sleeper id for players KTC's id table misses.
    A name that matches two players is not used.
    """
    text = open(path, encoding="utf-8").read()
    match = re.search(r'<script[^>]*id="ktc-players"[^>]*>(.*?)</script>', text, re.S)
    if not match:
        raise RuntimeError("KeepTradeCut page has no player table")
    board = {}
    for player in json.loads(html.unescape(match.group(1))):
        if player.get("position") not in POSITIONS:
            continue
        value = float((player.get("superflexValues") or {}).get("value") or 0)
        sleeper_id = ktc_ids.get(str(player.get("playerID"))) or names.get(_name_key(player.get("playerName"), player.get("position")))
        if sleeper_id and value > 0:
            board[sleeper_id] = max(value, board.get(sleeper_id, 0.0))
    return board


def fantasycalc_board(path):
    """{Sleeper id: value} from FantasyCalc's 12-team Superflex PPR dynasty values."""
    board = {}
    for row in json.load(open(path, encoding="utf-8")):
        player = row.get("player") or {}
        if player.get("position") not in POSITIONS:
            continue
        sleeper_id = _clean(player.get("sleeperId"))
        value = float(row.get("value") or 0)
        if sleeper_id and value > 0:
            board[sleeper_id] = max(value, board.get(sleeper_id, 0.0))
    return board


def ranks_from_values(values):
    """Higher value -> rank 1."""
    return {key: index + 1.0 for index, key in enumerate(sorted(values, key=lambda k: (-values[k], k)))}


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


def market_on_forecast_scale(forecast_values, boards):
    """The market: each source put on the forecast's scale, then averaged over the sources that list him.

    `boards` is a list of {key: rank}. Sources are averaged with equal weight:
    only one of them has the history needed to learn a weight, so none is
    favoured. A player no source lists keeps the forecast's order below everyone.
    """
    mapped = [on_forecast_scale(forecast_values, board) for board in boards if board]
    output = {}
    for key in forecast_values:
        listed = [values[key] for values, board in zip(mapped, [b for b in boards if b]) if key in board]
        output[key] = sum(listed) / len(listed) if listed else sum(values[key] for values in mapped) / len(mapped)
    return output


def market_rank(key, boards):
    """Average rank across the sources that list him, or None."""
    ranks = [board[key] for board in boards if board and key in board]
    return sum(ranks) / len(ranks) if ranks else None


def read_market_archive(path=MARKET_ARCHIVE):
    boards = {}
    if not path.exists():
        return boards
    with gzip.open(path, "rt", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            boards.setdefault((row["source"], row["date"]), {})[row["sleeper_id"]] = float(row["rank"])
    return boards


def archive_market_board(source, day, ranks, path=MARKET_ARCHIVE):
    """Add one day's board for a source. A (source, date) already there is never rewritten."""
    boards = read_market_archive(path)
    if (source, day) in boards:
        return False
    boards[(source, day)] = ranks
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    os.close(descriptor)
    try:
        with open(temp_name, "wb") as out, \
                gzip.GzipFile(filename="", mode="wb", fileobj=out, compresslevel=9, mtime=0) as raw, \
                io.TextIOWrapper(raw, encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["source", "date", "sleeper_id", "rank"])
            for key in sorted(boards):
                for sleeper_id, rank in sorted(boards[key].items()):
                    writer.writerow([key[0], key[1], sleeper_id, f"{rank:g}"])
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return True


def blend(forecast_value, market_value, weight):
    """`weight` is the learned share given to the football forecast."""
    return weight * forecast_value + (1.0 - weight) * market_value
