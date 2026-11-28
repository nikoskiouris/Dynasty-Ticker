"""Replay player/pick packages with the same pre-proposal football and market inputs."""
import argparse
from collections import defaultdict
from contextlib import contextmanager
import json
from pathlib import Path
from statistics import median

from market_packages import covered_trades, milliseconds, read_quotes
from package_scale import CURRENT_CALCULATOR, archived_calculator, calculator_totals, trade_key
from preseason_trade_fit import END, START, millis, reconstructed_inputs
from trade_spacing import legacy_prices
import dynasty_value
from dynasty_calibration import exchange_rating_anchors, exchange_surplus, market_surplus, rate_from_anchors, rating_anchors

BASE = '588bfb095cd6fed808788aeddfc744c6590e59eb'


@contextmanager
def sensitivity(weight=None, anchors=exchange_rating_anchors):
    saved = dynasty_value.MARKET_SHARE
    anchor_function = dynasty_value.exchange_rating_anchors
    try:
        dynasty_value.exchange_rating_anchors = anchors
        if weight is not None:
            dynasty_value.MARKET_SHARE = weight
        yield
    finally:
        dynasty_value.MARKET_SHARE = saved
        dynasty_value.exchange_rating_anchors = anchor_function


def prices(parts):
    return {key: row['value'] for part in parts for key, row in part.items()}


def pick_side(sides):
    """Index of the picks when one player is sold for nothing but picks."""
    for index, side in enumerate(sides):
        opposite = sides[1 - index]
        if (all(k.startswith('pick:') for k in side) and len(opposite) == 1
                and not opposite[0].startswith('pick:')):
            return index
    return None


def preseason(deals, inputs, market, picks, weights):
    baseline = prices(legacy_prices(inputs, picks, BASE))
    v53 = prices(legacy_prices(inputs, picks, 'fe49c70'))
    boards = {'v5.2': baseline, 'candidate': v53,
              'quotes': {**market, **{k: v['market'] for k, v in picks.items()}}}
    with sensitivity(.75, anchors=rating_anchors):
        boards['compressed'] = prices(dynasty_value.value_board(inputs, picks)[:2])
    for weight in weights:
        with sensitivity(weight):
            boards[f'{weight:.0%}'] = prices(dynasty_value.value_board(inputs, picks)[:2])
    matches = []
    eligible = {d['transaction']: d for d in deals if millis(START) < d['proposed'] <= d['accepted'] < millis(END)}
    for deal in eligible.values():
        sides = [[trade_key(k) for k in side] for side in deal['sides']]
        if all(board.get(k, 0) > 0 for board in boards.values() for side in sides for k in side):
            matches.append({**deal, 'sides': sides, 'pick_side': pick_side(sides)})

    with archived_calculator(BASE) as old:
        score(matches, boards, old)
    report(matches, len(eligible), list(boards))


def score(matches, boards, old):
    players = sorted((k for k in boards['quotes'] if not k.startswith('pick:')),
                     key=boards['quotes'].get, reverse=True)
    ranks = {key: i for i, key in enumerate(players, 1)}
    for deal in matches:
        sides = deal['sides']
        deal['elite_rank'] = min((ranks[k] for side in sides for k in side if k in ranks), default=None)
        deal['elite_single_rank'] = None
        for i, side in enumerate(sides):
            others = sides[1 - i]
            if (len(side) == 1 and side[0] in ranks and any(k.startswith('pick:') for k in others)
                    and any(k in ranks for k in others)):
                deal['elite_single_rank'] = ranks[side[0]]
    for label, board in boards.items():
        if label == 'quotes':
            totals = [[[sum(board[k] for k in side) for side in d['sides']]] for d in matches]
        else:
            totals = calculator_totals(board, matches, old if label == 'v5.2' else CURRENT_CALCULATOR)
        for d, pairs in zip(matches, totals, strict=True):
            d[label] = [(b - a) / (b + a) for a, b in pairs]


def late_market(deals, cache):
    boards = read_quotes(cache)
    cutoff = milliseconds('2026-11-28T00:00:00Z')
    eligible = [d for d in deals if millis(END) <= d['proposed'] <= d['accepted'] < cutoff]
    by_day = defaultdict(list)
    for known, d in covered_trades(eligible, boards):
        sides = [[trade_key(k) for k in side] for side in d['sides']]
        by_day[known].append({**d, 'sides': sides, 'pick_side': pick_side(sides)})
    matches = []
    start = milliseconds("2026-09-08T06:00:00Z")
    with archived_calculator(BASE) as old:
        for known, day in by_day.items():
            fraction = 1 - (known - start) // (7 * 86400000) / 18
            anchors = rating_anchors(fraction)
            quotes = {trade_key(k): v for k, v in boards[known].items()}
            before = {k: round(rate_from_anchors(market_surplus(v, fraction), anchors), 2)
                      for k, v in quotes.items()}
            prices_by_model = {'v5.2': before, 'quotes': quotes}
            for label, curve in [('compressed', anchors), ('candidate', exchange_rating_anchors(fraction))]:
                prices_by_model[label] = {k: round(rate_from_anchors(exchange_surplus(v, curve), curve), 2)
                                          for k, v in quotes.items()}
            score(day, prices_by_model, old)
            matches.extend(day)
    report(matches, len(eligible), ['v5.2', 'candidate', 'quotes', 'compressed'])


def report(matches, eligible_count, methods):
    print(f'{len(matches)} of {eligible_count} later accepted offers fully priced')
    all_picks = [d for d in matches if d['pick_side'] is not None]
    elite = []
    for cutoff in (3, 6, 12):
        unequal = [d for d in matches if d['elite_rank'] is not None and d['elite_rank'] <= cutoff
                   and len(d['sides'][0]) != len(d['sides'][1])]
        mixed = [d for d in matches if d['elite_single_rank'] is not None and d['elite_single_rank'] <= cutoff]
        elite.extend([(f'Unequal with top-{cutoff} player', unequal), (f'Top-{cutoff} player for players + picks', mixed)])
    for group, rows in (
        ('All', matches),
        ('Any pick', [d for d in matches if any(k.startswith('pick:') for s in d['sides'] for k in s)]),
        ('Players only', [d for d in matches if all(not k.startswith('pick:') for s in d['sides'] for k in s)]),
        ('One player for only picks', all_picks),
        ('One player for multiple picks', [d for d in all_picks if len(d['sides'][d['pick_side']]) > 1]),
        ('One player for two seconds', [d for d in all_picks if len(d['sides'][d['pick_side']]) == 2
                                        and all(':r2:' in k for k in d['sides'][d['pick_side']])]),
        *elite,
    ):
        print(f'{group}: {len(rows)} trades in {len({d["league"] for d in rows})} leagues')
        if not rows:
            continue
        for label in methods:
            listed = median(abs(d[label][0]) for d in rows)
            adjusted = median(abs(d[label][-1]) for d in rows)
            print(f'  {label}: {listed:.1%} listed, {adjusted:.1%} final', end='')
            if all(d['pick_side'] is not None for d in rows):
                bias = median(d[label][-1] * (1 if d['pick_side'] == 1 else -1) for d in rows)
                print(f', signed toward picks {bias:+.1%}', end='')
            print()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('deals', type=Path, help='A panel exported by market_packages.py --save-deals')
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/2026-preseason')
    parser.add_argument('--late-market', action='store_true', help='Evaluate dated market quotes for Weeks 3–12')
    parser.add_argument('--weights', nargs='+', type=float, choices=(.25, .50, .75),
                        help='Explore alternative weights on development trades')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    deals = json.loads(args.deals.read_text())
    if args.late_market:
        late_market(deals, args.cache_dir)
    else:
        preseason(deals, *reconstructed_inputs(args.cache_dir), args.weights or ())
