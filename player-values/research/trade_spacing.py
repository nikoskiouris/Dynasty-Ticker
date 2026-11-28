"""Compare frozen preseason football prices with subsequent accepted player packages."""
import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from tempfile import TemporaryDirectory
from urllib.error import HTTPError

from ranking_holdout import CROSSWALK, POSITIONS, STATS, cached_file, csv_rows, make_board

ARCHIVE = 'https://zenodo.org/api/records/23813187/files/fantasy-football-case-studies-v1.zip/content'
V3 = 'cb822a483f1cc421152f94a08c573a562e7d77c0'
V4 = '7837cf04672c393355c50dc6bacfc8f056f0a2ee'
# Forecast file commit time, first NFL game scheduled kickoff, Tuesday after week 2 (UTC).
WINDOWS = {
    2023: ('2023-09-01T14:37:09', '2023-09-08T00:20:00', '2023-09-19T06:00:00'),
    2024: ('2024-08-21T02:58:13', '2024-09-06T00:20:00', '2024-09-17T06:00:00'),
}


def candidates(cache):
    with zipfile.ZipFile(cached_file(ARCHIVE, cache)) as source:
        path = 'case-studies/results/primary_units/'
        teams = {r['league'] for r in map(json.loads, source.open(path + 'study1_2024.jsonl')) if r['teams'] == 12}
        superflex = {r['league'] for r in map(json.loads, source.open(path + 'study4_2024.jsonl'))}
    return sorted(teams & superflex, key=lambda key: hashlib.sha256(('2024-spacing-v1' + key).encode()).digest())[:216]


def eligible(league):
    if not league:
        return False
    roster, scoring, settings = league['roster_positions'], league['scoring_settings'], league['settings']
    return (league['total_rosters'] == 12 and settings['type'] == 2 and not settings.get('best_ball')
            and roster.count('QB') == 1 and roster.count('SUPER_FLEX') == 1 and scoring.get('rec') == 1
            and all(not scoring.get(key) for key in ('bonus_rec_te', 'bonus_rec_wr', 'bonus_rec_rb')))


def exchanges(cache):
    def sleeper(path):
        try:
            return json.loads(cached_file('https://api.sleeper.app/v1/league/' + path, cache).read_bytes())
        except HTTPError as error:
            if error.code == 404 and '/' not in path:
                return None
            raise

    def moves(league):
        year = int(league['season'])
        start, kickoff, end = (datetime.fromisoformat(bound).replace(tzinfo=timezone.utc)
                               for bound in WINDOWS[year])
        result = {}
        for leg in (0, 1, 2):
            for trade in sleeper(f"{league['league_id']}/transactions/{leg}"):
                if (trade['status'] != 'complete' or trade['type'] != 'trade' or len(trade['roster_ids']) != 2
                        or trade.get('waiver_budget') or trade.get('draft_picks')):
                    continue
                created = datetime.fromtimestamp(trade['created'] / 1000, timezone.utc)
                date = datetime.fromtimestamp(trade['status_updated'] / 1000, timezone.utc)
                if not start < created <= date < end:
                    continue
                adds = trade.get('adds') or {}
                drops = trade.get('drops') or {}
                if set(drops) != set(adds) or any(owner not in trade['roster_ids'] or
                        drops[key] not in trade['roster_ids'] or drops[key] == owner for key, owner in adds.items()):
                    continue
                sides = [tuple(key for key, received in adds.items() if received == roster)
                         for roster in trade['roster_ids']]
                if all(sides):
                    result[trade['transaction_id']] = (year, date < kickoff, sides, league['league_id'])
        return list(result.values())

    with ThreadPoolExecutor(max_workers=4) as pool:
        recent = [l for l in pool.map(sleeper, candidates(cache)) if eligible(l) and l['season'] == '2024']
        parents = sorted({l['previous_league_id'] for l in recent if l.get('previous_league_id')})
        prior = [l for l in pool.map(sleeper, parents) if eligible(l) and l['season'] == '2023']
        print(f'Eligible league-seasons: 2023={len(prior)}, 2024={len(recent)}')
        return [t for group in pool.map(moves, recent + prior) for t in group]


def legacy_prices(board, picks, revision=V3, *, market_share=None):
    # Load each model with its original dependencies. Current imports stay in this process.
    repo = Path(__file__).resolve().parents[2]
    with TemporaryDirectory() as tmp:
        names = ('dynasty_value.py', 'inseason.py') if revision == V3 else (
            'dynasty_value.py', 'inseason.py', 'dynasty_calibration.py')
        for name in names:
            blob = subprocess.check_output(['git', 'show', f'{revision}:player-values/{name}'], cwd=repo)
            (Path(tmp) / name).write_bytes(blob)
        invoke = """import json, sys, dynasty_value
board, picks, share = json.load(sys.stdin)
if share is not None:
    dynasty_value.MARKET_SHARE = share
print(json.dumps(dynasty_value.value_board(board, picks, season_week=1)[:2]))
"""
        proc = subprocess.run([sys.executable, '-c', invoke], input=json.dumps([board, picks, market_share]), text=True,
                              cwd=tmp, capture_output=True, check=True)
        return json.loads(proc.stdout)


def summarize(records):
    if not records:
        return 'n=0'
    gaps = [abs(a - b) / (a + b) for a, b, _, _ in records]
    unequal = [(a - b) / (a + b) if n > m else (b - a) / (a + b)
               for a, b, n, m in records if n != m]
    twos = [(a - b) / (a + b) if n > m else (b - a) / (a + b)
            for a, b, n, m in records if sorted((n, m)) == [1, 2]]
    text = f'n={len(records)}, median absolute gap={median(gaps):.1%}'
    for name, values in (('unequal', unequal), ('2:1', twos)):
        text += f', {name} n={len(values)}'
        if values:
            text += f' median package bias={median(values):+.1%}'
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/trade-spacing')
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    trades = exchanges(cache)
    ids = list(csv_rows(CROSSWALK, cache))
    link = {r['sleeper_id']: r['gsis_id'] for r in ids if r['gsis_id'] != 'NA' and r['sleeper_id'] != 'NA'}
    for year in WINDOWS:
        prior = {r['player_id']: r for r in csv_rows(STATS.format(year - 1), cache)
                 if r['season_type'] == 'REG' and r['position'] in POSITIONS}
        board = make_board(year, prior, ids, cache)
        models = {'v3': legacy_prices(board, {})[0], 'v4': legacy_prices(board, {}, V4)[0]}
        for label, pre_only in (('pre-kickoff', True), ('through week 2', False)):
            rows = [sides for y, pre, sides, _ in trades if y == year and (pre or not pre_only)]
            totals = {version: [] for version in models}
            coverage = Counter()
            for sides in rows:
                legs = [[link.get(i) for i in side] for side in sides]
                mapped = {v for v, prices in models.items()
                          if all(i in prices and prices[i]['value'] > 0 for side in legs for i in side)}
                coverage.update(mapped)
                if len(mapped) != len(models):
                    continue
                for version, prices in models.items():
                    a, b = (sum(prices[i]['value'] for i in side) for side in legs)
                    totals[version].append((a, b, len(legs[0]), len(legs[1])))
            print(f'{year} {label}: {len(rows)} eligible trades, coverage {dict(coverage)}')
            for version, side_totals in totals.items():
                print(' ', version, summarize(side_totals))


if __name__ == '__main__':
    main()
