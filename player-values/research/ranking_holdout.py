"""Reproduce the two-season, preseason ranking audit with the production model (Python 3.10+)."""
import argparse
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
import zipfile
from xml.etree import ElementTree
from collections import Counter, defaultdict
from datetime import date
from itertools import groupby
from pathlib import Path
from statistics import correlation
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dynasty_value import value_board

POSITIONS = ('QB', 'RB', 'WR', 'TE')
RAW_GITHUB = 'https://raw.githubusercontent.com/'
CROSSWALK = RAW_GITHUB + 'dynastyprocess/data/d78f87cf9f6923f1654205ba93079835c01b7023/files/db_playerids.csv'
STATS = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{}.csv'
ESPN_ARCHIVES = {
    2021: ('53ab555546889571c8e7395e1f484c8310605f9e', 10),
    2024: ('c8082cd1424fb6cd5eaf0cb11c65b85942981e79', 18),
}
FANTASYPROS_ARCHIVES = {
    2020: ('fantasydatapros/data/e36e1de3303de41ab92993cf1d764afdeb117407/fantasypros/fp_projections.csv',
           'Player', 'Pos', ('PassingYds', 'PassingTD', 'Int', 'RushingYds', 'RushingTD',
                            'Receptions', 'ReceivingYds', 'ReceivingTD', 'FL')),
    2023: ('Saurabh1975/ffb-streamlit/1bb6d3f9f579c350de2afff862921b755d2c442b/Data/fpros_projections.csv',
           'player', 'position', ('pass_yds', 'pass_td', 'pass_int', 'rush_yds', 'rush_td',
                                  'rec_att', 'rec_yds', 'rec_td', 'fumble_lost')),
}
PPR = (.04, 4, -2, .1, 6, 1, .1, 6, -2)
ESPN_STAT_IDS = ('3', '4', '20', '24', '25', '53', '42', '43', '72')
ALIASES = {
    'gabedavis': 'gabrieldavis', 'mitchtrubisky': 'mitchelltrubisky', 'scottmiller': 'scottymiller',
    'jeffwilson': 'jefferywilson', 'zonovanknight': 'bamknight', 'robbyanderson': 'robbiechosen',
    'phillipwalker': 'pjwalker', 'deonteharris': 'deonteharty',
}


def cached_file(url, cache):
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    path = cache / (key + '-' + url.rsplit('/', 1)[1])
    if not path.exists():
        with urlopen(url, timeout=60) as response:
            data = response.read()
        with NamedTemporaryFile(dir=cache, delete=False) as tmp:
            tmp.write(data)
        Path(tmp.name).replace(path)
    return path


def fetch(url, cache):
    return cached_file(url, cache).read_text(encoding='utf-8-sig')


def csv_rows(url, cache):
    return csv.DictReader(io.StringIO(fetch(url, cache)))


def normalized(name):
    name = unicodedata.normalize('NFKD', name).lower()
    stripped = re.sub(r'\b(jr|sr|ii|iii|iv|v)\b', '', name)
    return re.sub(r'[^a-z0-9]', '', stripped)


def optional_int(value):
    return None if value in (None, '', 'NA') else int(value)


def ppr(stats, fields):
    return sum(float(str(stats.get(field) or 0).replace(',', '')) * weight
               for field, weight in zip(fields, PPR))


def espn_2018_forecast(cache):
    # The August 12 workbook has four positional sheets with identical columns.
    # Both fumbles and two-point conversions are absent in this archive.
    url = (RAW_GITHUB + 'jpurpura/fantasy-football-2018/'
           '8dee3651860987af2dfbabace450c80fba70a204/projections/espn_projections_aug_src.xlsx')
    fields = ('PASS YDS', 'PASS TD', 'INT', 'RUSH YDS', 'RUSH TD', 'REC', 'REC YDS', 'REC TD')
    with zipfile.ZipFile(cached_file(url, cache)) as workbook:
        strings = [''.join(node.itertext()) for node in ElementTree.fromstring(workbook.read('xl/sharedStrings.xml'))]
        for sheet, position in enumerate(POSITIONS, start=1):
            root = ElementTree.fromstring(workbook.read(f'xl/worksheets/sheet{sheet}.xml'))
            rows = root.findall('.//{*}row')
            headers = [strings[int(cell.findtext('{*}v'))] for cell in rows[0].findall('{*}c')]
            for row in rows[1:]:
                cells = {}
                for cell in row.findall('{*}c'):
                    column = ord(cell.attrib['r'][0]) - ord('A')
                    raw = cell.findtext('{*}v')
                    if raw is not None:
                        cells[headers[column]] = strings[int(raw)] if cell.get('t') == 's' else raw
                name = cells['PLAYER'].split(',', 1)[0].strip()
                yield name, position, ppr(cells, fields), None


def forecast_rows(year, cache):
    if year == 2018:
        yield from espn_2018_forecast(cache)
        return
    if year in FANTASYPROS_ARCHIVES:
        archive, name_key, pos_key, fields = FANTASYPROS_ARCHIVES[year]
        for row in csv_rows(RAW_GITHUB + archive, cache):
            if row[pos_key] in POSITIONS:
                yield row[name_key], row[pos_key], ppr(row, fields), None
        return
    commit, pages = ESPN_ARCHIVES[year]
    prefix = f'{RAW_GITHUB}xitij/espn-projection-scraper/{commit}/src/projections/{year}/'
    for page in range(1, pages + 1):
        records = json.loads(fetch(prefix + f'projections-page-{page}.json', cache))['players']
        for record in records:
            player = record['player']
            pos = player['defaultPositionId']
            if pos not in range(1, 5):
                continue
            forecasts = [line['stats'] for line in player.get('stats', []) if 'stats' in line
                         and line['seasonId'] == year and line['statSourceId'] == 1
                         and line['scoringPeriodId'] == 0 and line['statSplitTypeId'] == 0]
            if len(forecasts) == 1:
                stats = forecasts[0]
                conversions = sum(stats.get(key, 0) for key in ('19', '26', '44'))
                yield player['fullName'], POSITIONS[pos - 1], ppr(stats, ESPN_STAT_IDS) + 2 * conversions, str(player['id'])


def historical_player(year, pos, points, bio, last):
    birth, draft_year = bio.get('birthdate'), optional_int(bio.get('draft_year'))
    age = (date(year, 9, 1) - date.fromisoformat(birth)).days / 365.2425 if birth and birth != 'NA' else None
    return {
        'pos': pos, 'season_ppr': points, 'age': age,
        'years_exp': year - draft_year if draft_year and draft_year <= year else None,
        'draft_round': optional_int(bio.get('draft_round')), 'draft_pick': optional_int(bio.get('draft_ovr')),
        'last_ppr': float(last['fantasy_points_ppr']) if last else None,
        'last_games': int(last['games']) if last else None,
    }


def make_board(year, prior, crosswalk, cache, *, projections=None):
    by_espn = {r['espn_id']: r for r in crosswalk if r['espn_id'] != 'NA'}
    by_gsis = {r['gsis_id']: r for r in crosswalk if r['gsis_id'] != 'NA'}
    by_name, prior_names = defaultdict(list), defaultdict(list)
    for row in crosswalk:
        if row['gsis_id'] != 'NA':
            by_name[normalized(row['name'])].append(row)
    for player_id, row in prior.items():
        prior_names[normalized(row['player_display_name'])].append(player_id)

    def match_name(name, pos):
        key = normalized(name)
        candidates = [r for r in by_name[key] if r['position'] == pos]
        if len(candidates) == 1:
            return candidates[0]
        candidates = [r for r in candidates if 2002 <= (optional_int(r['draft_year']) or year) <= year]
        if len(candidates) == 1:
            return candidates[0]
        if len(prior_names[key]) == 1:
            return by_gsis.get(prior_names[key][0], {})
        candidates = by_name[ALIASES.get(key, key)]
        return candidates[0] if len(candidates) == 1 else {}

    board = {}
    for name, pos, points, espn_id in (forecast_rows(year, cache) if projections is None else projections):
        if points <= 0:
            continue
        bio = by_espn.get(espn_id, {}) if espn_id is not None else match_name(name, pos)
        key = bio.get('gsis_id', 'NA')
        if key == 'NA':
            key = 'unmatched-' + normalized(name) + '-' + pos
        if key in board and board[key]['season_ppr'] >= points:
            continue
        board[key] = historical_player(year, pos, points, bio, prior.get(key))
    return board


def marginal(pool, field):
    """Construct outcome labels independently from the production model."""
    ranked = sorted(pool, key=lambda i: (-pool[i][field], i))
    seats = [(('QB',), 12), (('RB',), 24), (('WR',), 36), (('TE',), 12),
             (('RB', 'WR', 'TE'), 12), (POSITIONS, 12)]

    def lineup(exclude=None):
        selected = set()
        total = 0.
        for eligible, count in seats:
            group = [i for i in ranked if i != exclude and i not in selected and pool[i]['pos'] in eligible][:count]
            total += sum(pool[i][field] for i in group)
            selected.update(group)
        return selected, total

    starters, total = lineup()
    return {i: round(max(0, total - lineup(i)[1]), 5) for i in starters}


def midranks(scores, ids):
    ranks = {}
    sorted_ids = sorted(ids, key=lambda i: scores.get(i, 0))
    for _, group in groupby(sorted_ids, key=lambda i: scores.get(i, 0)):
        tied = list(group)
        ranks.update(dict.fromkeys(tied, len(ranks) + (len(tied) + 1) / 2))
    return [ranks[i] for i in ids]


def top(scores, count):
    return sorted(scores, key=lambda i: (-scores[i], i))[:count]


def evaluate(year, stats, board):
    prices, _, _ = value_board(board, {}, season_week=1)
    realized, positions = Counter(), {}
    for season, discount in ((year, 1), (year + 1, .85)):
        outcome = {i: {'pos': r['position'], 'points': float(r['fantasy_points_ppr'])}
                   for i, r in stats[season].items()}
        positions.update({i: r['pos'] for i, r in outcome.items()})
        for player, points in marginal(outcome, 'points').items():
            realized[player] += discount * points
    positions.update({i: r['pos'] for i, r in board.items()})
    projected = {i: r['season_ppr'] for i, r in board.items()}
    methods = {
        'Realized': realized, 'New model': {i: r['value'] for i, r in prices.items()},
        'Raw projection': projected, 'Projected marginal': marginal(board, 'season_ppr'),
        'Prior PPR': {i: r['last_ppr'] or 0 for i, r in board.items()},
    }
    best = set(top(realized, 48))
    maximum = sum(realized[i] for i in best)
    positive = {i for i in realized if realized[i] > 0}
    front = top(projected, 150)
    target_ranks = midranks(realized, front)
    matched = sum(not key.startswith('unmatched-') for key in board)
    print(f'\n{year}: {len(board)} projected, {matched} linked, {len(prices)} priced, '
          f'{len(best & board.keys())}/48 top and {len(positive & board.keys())}/{len(positive)} positive covered')
    print('method               hits   surplus    rho   QB  RB  WR  TE')
    for method, scores in methods.items():
        chosen = top(scores, 48)
        counts = Counter(positions[i] for i in chosen)
        captured = sum(realized[i] for i in chosen) / maximum
        rho = correlation(target_ranks, midranks(scores, front))
        hits = len(best.intersection(chosen))
        print(f'{method:20} {hits:4}  {captured:7.2%}  {rho:.3f}  ' + '  '.join(f'{counts[p]:2}' for p in POSITIONS))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/ranking-holdout')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    crosswalk = list(csv_rows(CROSSWALK, args.cache_dir))
    stats = {year: {r['player_id']: r for r in csv_rows(STATS.format(year), args.cache_dir)
                    if r['season_type'] == 'REG' and r['position'] in POSITIONS}
             for year in range(2019, 2026)}
    for year in (2021, 2023, 2024, 2020):
        board = make_board(year, stats[year - 1], crosswalk, args.cache_dir)
        evaluate(year, stats, board)


if __name__ == '__main__':
    main()
