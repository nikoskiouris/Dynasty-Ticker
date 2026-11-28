"""Compare the price scale and calculator on the same later, accepted Sleeper trades."""

import argparse
from collections import defaultdict
from contextlib import contextmanager
import json
from pathlib import Path
from random import Random
from statistics import median
import subprocess
from tempfile import TemporaryDirectory

from preseason_trade_fit import END, KICKOFF, START, millis, reconstructed_inputs
import ranking_holdout as audit
from trade_spacing import V4, WINDOWS, exchanges, legacy_prices
from dynasty_value import value_board


ROOT = Path(__file__).resolve().parents[2]
CALCULATOR = """
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {calculatePackageAdjustment} = await import(pathToFileURL(process.argv[1]));
const {maximum, trades} = JSON.parse(fs.readFileSync(0, 'utf8'));
const totals = trades.map(([myValues, theirValues]) => {
  const r = calculatePackageAdjustment({myValues, theirValues, globalMaxValue: maximum});
  return [[r.myBaseValue, r.theirBaseValue], [r.myAdjustedValue, r.theirAdjustedValue]];
});
process.stdout.write(JSON.stringify(totals));
"""


def trade_key(key):
    if not key.startswith('pick:'):
        return key
    _, season, rnd = key.split(':')
    return f'pick:{season}:r{rnd}:any'


def calculator_totals(prices, matches, module):
    maximum = max(v for k, v in prices.items() if not k.startswith('pick:'))
    trades = [[[prices[k] for k in side] for side in deal['sides']] for deal in matches]
    result = subprocess.run(['node', '--input-type=module', '-e', CALCULATOR, str(module)],
                            input=json.dumps({'maximum': maximum, 'trades': trades}), text=True,
                            capture_output=True, check=True)
    return json.loads(result.stdout)


def scored_deals(deals, prices, quotes):
    selected = {d['transaction']: d for d in deals
                if millis(START) < d['proposed'] <= d['accepted'] < millis(END)}
    matched = []
    for d in selected.values():
        sides = sorted([[trade_key(k) for k in side] for side in d['sides']], key=len)
        if all(model.get(k, 0) > 0 for model in [*prices.values(), quotes] for side in sides for k in side):
            matched.append({**d, 'sides': sides})
    compare_prices(matched, prices)
    return list(selected.values()), matched


@contextmanager
def archived_calculator():
    # Reproduce v4 with the curve/release that actually shipped with that board.
    with TemporaryDirectory() as folder:
        archived = Path(folder)
        (archived / 'package.json').write_text('{"type":"module"}')
        for name in ('package-value.js', 'price-units.js'):
            blob = subprocess.check_output(['git', 'show', f'{V4}:docs/modules/{name}'], cwd=ROOT)
            (archived / name).write_bytes(blob)
        yield archived / 'package-value.js'


def compare_prices(matched, prices):
    with archived_calculator() as archived:
        for label, board in prices.items():
            module = archived if label == 'v4' else ROOT / 'docs/modules/package-value.js'
            for deal, (listed, credited) in zip(matched, calculator_totals(board, matched, module), strict=True):
                deal[label] = [(b - a) / (a + b) for a, b in (listed, credited)]


def model_prices(inputs, picks):
    versions = {'v4': legacy_prices(inputs, picks, V4), 'v5': value_board(inputs, picks)[:2]}
    return {k: {asset: r['value'] for part in result for asset, r in part.items()}
            for k, result in versions.items()}


def interval(records):
    # Resample whole leagues. Each resample preserves the paired scores on every deal.
    by_league = defaultdict(list)
    for r in records:
        by_league[r['league']].append(r)
    groups = list(by_league.values())
    rng = Random(20261128)
    changes = []
    for _ in range(1000):
        sample = [r for group in rng.choices(groups, k=len(groups)) for r in group]
        old, new = (median(abs(r[k][1]) for r in sample) for k in ('v4', 'v5'))
        changes.append(new - old)
    changes.sort()
    return changes[24], changes[974]


def report(records, prices):
    top = set(sorted((k for k in prices if not k.startswith('pick:')), key=prices.get, reverse=True)[:12])
    for name, group in (
        ('all', records),
        ('unequal', [r for r in records if len(r['sides'][0]) < len(r['sides'][1])]),
        ('2:1', [r for r in records if tuple(map(len, r['sides'])) == (1, 2)]),
        ('unequal incl. top-12 player', [r for r in records if len(r['sides'][0]) < len(r['sides'][1])
                                       and any(k in top for side in r['sides'] for k in side)]),
    ):
        if not group:
            continue
        print(f'  {name}: {len(group)} deals / {len({r["league"] for r in group})} leagues')
        for label in ('v4', 'v5'):
            fields = []
            for i, basis in enumerate(('listed', 'credited')):
                gaps = [r[label][i] for r in group]
                bias = f', bias {median(gaps):+.1%}' if name != 'all' else ''
                fields.append(f'{basis} {median(abs(x) for x in gaps):.1%}{bias}')
            print(f'    {label}: ' + ' | '.join(fields))
        flips = sum(r['v4'][1] * r['v5'][1] < 0 for r in group)
        print(f'    {flips} deals changed which side had the higher credited total')
        if name == 'unequal' and len({r['league'] for r in group}) >= 10:
            lo, hi = interval(group)
            print(f'    95% league-bootstrap interval for v5 minus v4 median credited gap: {lo:+.1%} to {hi:+.1%}')


def historical_players(cache):
    records = exchanges(cache)
    crosswalk = list(audit.csv_rows(audit.CROSSWALK, cache))
    link = {r['sleeper_id']: r['gsis_id'] for r in crosswalk if 'NA' not in (r['sleeper_id'], r['gsis_id'])}
    for year in WINDOWS:
        prior = {r['player_id']: r for r in audit.csv_rows(audit.STATS.format(year - 1), cache)
                 if r['season_type'] == 'REG' and r['position'] in audit.POSITIONS}
        prices = model_prices(audit.make_board(year, prior, crosswalk, cache), {})
        eligible = [(sides, league) for y, _, sides, league in records if y == year]
        matches = []
        for sides, league in eligible:
            ids = sorted([[link.get(i) for i in side] for side in sides], key=len)
            if all(board.get(k, 0) > 0 for board in prices.values() for side in ids for k in side):
                matches.append({'league': league, 'sides': ids})
        compare_prices(matches, prices)
        print(f'{year} football only, through Week 2: {len(matches)}/{len(eligible)} fully priced')
        report(matches, prices['v4'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('deals', type=Path, help='JSON saved by market_packages.py --save-deals')
    parser.add_argument('--cache-dir', type=Path, default=Path.home()/'.cache/dynasty-ticker/2026-preseason')
    parser.add_argument('--historical-players', action='store_true',
                        help='Also replay the independent 2023 and 2024 player-only sample')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    inputs, market, picks = reconstructed_inputs(args.cache_dir)
    prices = model_prices(inputs, picks)
    quotes = {**market, **{k: r['market'] for k, r in picks.items()}}
    selected, covered = scored_deals(json.loads(args.deals.read_text()), prices, quotes)
    for window, select in (('pre-kickoff', lambda r: r['accepted'] < millis(KICKOFF)),
                           ('after kickoff through Week 2', lambda r: r['accepted'] >= millis(KICKOFF)),
                           ('through Week 2', lambda r: True)):
        matches = list(filter(select, covered))
        print(f'{window}: {len(matches)}/{sum(select(r) for r in selected)} fully priced')
        report(matches, prices['v4'])
    if args.historical_players:
        historical_players(args.cache_dir)


if __name__ == '__main__':
    main()
