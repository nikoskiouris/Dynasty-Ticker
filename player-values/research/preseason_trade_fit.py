"""Replay August 26, 2026 football and market evidence against later accepted packages."""
import argparse
import csv
import io
import json
from datetime import datetime
from pathlib import Path
from statistics import median

import ranking_holdout as audit
from dynasty_value import value_board
from trade_spacing import legacy_prices
from value_inputs import market_quotes

PROJECTIONS = (audit.RAW_GITHUB + 'mborysiak/Fantasy_Football/04f5ae4b6ad1fd9af06d43c1bd32ae861d933f07/'
               'Data/OtherData/FantasyPros_Projections/2026FantasyPros_Fantasy_Football_Projections_{}.csv')
QUOTES = (audit.RAW_GITHUB + 'perczakp/nfl-hirek/9c3a7d3e753c0c1d241db3125e2154a3c978738c/fantasycalc-values.json')
START = '2026-08-26T07:58:34+00:00'
KICKOFF = '2026-09-10T00:20:00+00:00'
END = '2026-09-22T06:00:00+00:00'
# FantasyPros repeats YDS and TDS columns for rushing, receiving and passing.
# Read each position's stat lines explicitly and reconstruct standard full PPR.
STATS = {
    'QB': ('ATT CMP YDS TDS INTS ATT YDS TDS FL', (0, 0, .04, 4, -2, 0, .1, 6, -2)),
    'RB': ('ATT YDS TDS REC YDS TDS FL', (0, .1, 6, 1, .1, 6, -2)),
    'WR': ('REC YDS TDS ATT YDS TDS FL', (1, .1, 6, 0, .1, 6, -2)),
    'TE': ('REC YDS TDS FL', (1, .1, 6, -2)),
}


def preseason_projections(cache):
    for pos, (columns, weights) in STATS.items():
        rows = csv.reader(io.StringIO(audit.fetch(PROJECTIONS.format(pos), cache)))
        if next(rows) != ['Player', 'Team', *columns.split(), 'FPTS']:
            raise ValueError(f'Unrecognized stat layout for {pos}')
        for row in rows:
            if not row[0].strip():
                continue
            points = sum(float(value.replace(',', '') or '0') * weight
                         for value, weight in zip(row[2:-1], weights, strict=True))
            yield row[0], pos, points, None


def price_models(cache):
    quotes = json.loads(audit.fetch(QUOTES, cache))['values']
    market, picks = market_quotes([{'player': r, 'value': r['value']} for r in quotes], 2026, False)
    crosswalk = list(audit.csv_rows(audit.CROSSWALK, cache))
    prior = {r['player_id']: r for r in audit.csv_rows(audit.STATS.format(2025), cache)
             if r['season_type'] == 'REG' and r['position'] in audit.POSITIONS}
    board = audit.make_board(2026, prior, crosswalk, cache, projections=preseason_projections(cache))
    bios = {r['sleeper_id']: r for r in crosswalk if r['sleeper_id'] != 'NA'}
    by_gsis = {r['gsis_id']: k for k, r in bios.items() if r['gsis_id'] != 'NA'}
    board = {by_gsis.get(key, key): r for key, r in board.items()}
    for quote in quotes:
        key = quote['sleeperId']
        if key not in market:
            continue
        if key not in board:
            # A projection can be unmatched while a market quote supplies an ID.
            unmatched = 'unmatched-' + audit.normalized(quote['name']) + '-' + quote['position']
            bio = bios.get(key, {})
            board[key] = (board.pop(unmatched) if unmatched in board else audit.historical_player(
                2026, quote['position'], None, bio, prior.get(bio.get('gsis_id'))))
        board[key]['market'] = market[key]
    old = legacy_prices(board, picks)
    new = value_board(board, picks)[:2]
    print(f'{len(board)} players in forecast/quote pool, {len(market)} player quotes, {len(picks)} pick quotes')
    prices = {label: {k: v['value'] for part in pair for k, v in part.items()}
              for label, pair in [('v3', old), ('v4', new)]}
    prices['quotes'] = {**market, **{k: r['market'] for k, r in picks.items()}}
    return prices


def millis(date):
    return datetime.fromisoformat(date).timestamp() * 1000


def analyze(deals, prices, end):
    """Unadjusted asset prices on the same trades. Positive bias favors the larger package."""
    covered = []
    selected = {d['transaction']: d for d in deals if millis(START) <= d['proposed']
                <= d['accepted'] < millis(end)}
    for d in selected.values():
        sides = sorted(d['sides'], key=len)
        sides = [[f"pick:{p.split(':')[1]}:r{p.split(':')[2]}:any" if p.startswith('pick:') else p
                  for p in side] for side in sides]
        if all(p in board for board in prices.values() for side in sides for p in side):
            covered.append((sides, d))
    print(f'By {end}: {len(covered)}/{len(selected)} fully priced deals '
          f'from {len({d["league"] for _, d in covered})} leagues')
    packages = [(s, d) for s, d in covered if len(s[0]) != len(s[1])]
    includes_pick = {d['transaction'] for sides, d in packages if any(
        p.startswith('pick:') for side in sides for p in side)}
    for group, matches in [('all', covered), ('unequal packages', packages),
                           ('unequal, players only', [(s, d) for s, d in packages if d['transaction'] not in includes_pick]),
                           ('unequal, includes picks', [(s, d) for s, d in packages if d['transaction'] in includes_pick])]:
        if not matches:
            continue
        print(f'  {group} n={len(matches)}')
        for model, board in prices.items():
            sides = [(sum(board[p] for p in a), sum(board[p] for p in b)) for (a, b), d in matches]
            gaps = [(b-a)/(b+a) for a, b in sides]
            bias = '' if group == 'all' else f', median bias toward larger package {median(gaps):+.1%}'
            print(f'    {model}: median absolute gap {median(abs(x) for x in gaps):.1%}{bias}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('deals', type=Path, help='JSON from the 2026 completed-trade sample')
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/2026-preseason')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    prices = price_models(args.cache_dir)
    deals = json.loads(args.deals.read_text())
    for cutoff in (KICKOFF, END):
        analyze(deals, prices, cutoff)
