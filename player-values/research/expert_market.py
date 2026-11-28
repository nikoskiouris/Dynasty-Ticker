"""DynastyProcess 2QB dynasty ranks, aligned to the full-PPR trade market."""
import re
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from itertools import groupby
from statistics import mean

POSITIONS = {"QB", "RB", "WR", "TE"}
MAX_AGE = timedelta(days=10)


def name_key(name):
    plain = unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]", "", plain)
    return re.sub(r"(?:jr|sr|iii|ii|iv)$", "", base)


def parse_expert_values(value_rows, id_rows, model_rows, as_of):
    """Match dated ranks by stable player ID, using unique name/position as a fallback."""
    by_fp, by_name = defaultdict(set), defaultdict(set)
    for row in id_rows:
        sid, fp = row["sleeper_id"], row["fantasypros_id"]
        if sid.isdigit():
            if fp.isdigit():
                by_fp[fp].add(sid)
            by_name[name_key(row["name"]), row["position"]].add(sid)
    for sid, player in model_rows.items():
        by_name[name_key(player["name"]), player["pos"]].add(sid)

    values = defaultdict(set)
    for row in value_rows:
        pos, raw = row["pos"], row["value_2qb"]
        if pos not in POSITIONS or not raw.isdigit() or int(raw) <= 0:
            continue
        published = date.fromisoformat(row["scrape_date"])
        if not timedelta(0) <= as_of.date() - published <= MAX_AGE:
            continue
        matches = by_fp[row["fp_id"]] or by_name[name_key(row["player"]), pos]
        if len(matches) == 1:
            values[next(iter(matches))].add(int(raw))
    return {sid: next(iter(scores)) for sid, scores in values.items() if len(scores) == 1}


def rank_equivalent_scores(market_scores, expert_rank_values):
    """Return the average market price of the slots occupied by tied expert ranks."""
    players = sorted((sid for sid in market_scores if expert_rank_values.get(sid, 0) > 0),
                     key=market_scores.get, reverse=True)
    ranked = sorted(players, key=expert_rank_values.get, reverse=True)
    result = {}
    start = 0
    for _, group in groupby(ranked, key=expert_rank_values.get):
        ids = list(group)
        end = start + len(ids)
        price = mean(market_scores[sid] for sid in players[start:end])
        result.update(dict.fromkeys(ids, price))
        start = end
    return result
