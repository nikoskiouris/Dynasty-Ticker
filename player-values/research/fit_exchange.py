"""Fit the market weight and package credit on completed trades, then score unseen leagues and dates."""
import argparse
from collections import defaultdict
from hashlib import sha256
import json
import math
from pathlib import Path
from statistics import mean, median, quantiles

from package_scale import CURRENT_CALCULATOR, calculator_totals, trade_key
from market_packages import collect_trades, covered_trades, milliseconds, read_quotes
from pick_packages import prices, sensitivity
from preseason_trade_fit import END, START, millis, reconstructed_inputs
import dynasty_value
from dynasty_calibration import exchange_rating_anchors, exchange_surplus, rate_from_anchors

DIR = Path(__file__).resolve().parent
CREDIT_SHARES = (0., .125, .25, .375, .50)
MARKET_WEIGHTS = (.25, .50, .75)
NOVEMBER = milliseconds('2026-11-01T00:00:00Z')
STUDY_END = milliseconds('2026-11-28T00:00:00Z')


def outside_old_panels(deals):
    known = set((DIR / 'market-leagues-2026.txt').read_text().split())
    known.update((DIR / 'market-leagues-independent-2026.txt').read_text().split())
    return [d for d in deals if d['league'] not in known]


def split_leagues(deals):
    ids = sorted({d['league'] for d in deals}, key=lambda lid: sha256(('ktc-credit-v1' + lid).encode()).digest())
    held = set(ids[:math.ceil(len(ids) / 4)])
    return ([d for d in deals if d['league'] not in held], [d for d in deals if d['league'] in held])


def mapped(deal):
    return {**deal, 'sides': [[trade_key(k) for k in side] for side in deal['sides']]}


def evaluate(board, matches, credit):
    totals = calculator_totals(board, matches, CURRENT_CALCULATOR, {'creditShare': credit})
    rows = []
    for deal, (_, (a, b)) in zip(matches, totals, strict=True):
        gap = abs(b - a) / (a + b)
        rows.append((deal['league'], gap))
    return rows


def league_loss(rows):
    leagues = defaultdict(list)
    for lid, gap in rows:
        leagues[lid].append(gap)
    return mean(mean(group) for group in leagues.values())


def compare(rows, title):
    print(title)
    for setting, losses in rows.items():
        if not losses:
            print(f'  {setting:.1%}: no fully priced deals')
            continue
        gaps = [gap for _, gap in losses]
        q75 = quantiles(gaps, n=4, method='inclusive')[2] if len(gaps) > 1 else gaps[0]
        print(f'  {setting:.1%}: {len(gaps)} trades, {len(set(lid for lid, _ in losses))} leagues, '
              f'league-balanced mean {league_loss(losses):.2%}, median {median(gaps):.2%}, p75 {q75:.2%}')


def fit_weight(discovery, training, cache):
    inputs, _, picks = reconstructed_inputs(cache)
    boards = {}
    for weight in MARKET_WEIGHTS:
        with sensitivity(weight):
            boards[weight] = prices(dynasty_value.value_board(inputs, picks)[:2])
    rows = {w: [] for w in boards}
    for name, deals in [('discovery', discovery), ('KTC', training)]:
        eligible = [mapped(d) for d in deals if millis(START) < d['proposed'] <= d['accepted'] < millis(END)]
        matches = [d for d in eligible if all(b.get(k, 0) > 0 for b in boards.values() for s in d['sides'] for k in s)]
        print(f'{name} August full-model rows: {len(matches)}/{len(eligible)}')
        for weight, board in boards.items():
            rows[weight].extend(evaluate(board, matches, .25))
    compare(rows, 'Train football and market weight with 25% credit')
    return min(rows, key=lambda w: league_loss(rows[w]))


def market_losses(deals, boards, credits):
    by_date = defaultdict(list)
    for known, d in covered_trades(deals, boards):
        by_date[known].append(mapped(d))
    losses = {c: [] for c in credits}
    opening = milliseconds('2026-09-08T06:00:00Z')
    for known, matched in by_date.items():
        fraction = 1 - (known - opening) // (7 * 86400000) / 18
        anchors = exchange_rating_anchors(fraction)
        board = {trade_key(k): round(rate_from_anchors(exchange_surplus(q, anchors), anchors), 2)
                 for k, q in boards[known].items()}
        for credit in credits:
            losses[credit].extend(evaluate(board, matched, credit))
    return losses


def run(ktc, discovery, cache):
    unique = {d['transaction']: d for d in ktc}
    fresh = outside_old_panels(unique.values())
    training, holdout = split_leagues(fresh)
    print(f'{len(unique)} unique KTC-league exchanges, {len(fresh)} outside historical panels. '
          f'{len({d["league"] for d in training})} training / {len({d["league"] for d in holdout})} held leagues.')
    weight = fit_weight(discovery, training, cache)
    boards = read_quotes(cache)
    earlier = [d for d in training if millis(END) <= d['proposed'] <= d['accepted'] < NOVEMBER
               and len(d['sides'][0]) != len(d['sides'][1])]
    later = [d for d in holdout if NOVEMBER <= d['proposed'] <= d['accepted'] < STUDY_END
             and len(d['sides'][0]) != len(d['sides'][1])]
    train = market_losses(earlier, boards, CREDIT_SHARES)
    compare(train, f'Train consolidation share, {len(earlier)} eligible unequal packages')
    # Retain the published 25% share if the objective ties exactly.
    selected = min(CREDIT_SHARES, key=lambda c: (league_loss(train[c]), abs(c - .25)))
    print(f'Selected weight {weight:.1%}, credit {selected:.1%}')
    candidates = list(dict.fromkeys([.0, .25, selected]))
    compare(market_losses(later, boards, candidates), f'Later disjoint leagues, {len(later)} eligible unequal packages')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('ktc', nargs='?', type=Path, help='Reuse an export from the fixed KTC league list')
    p.add_argument('discovery', nargs='?', type=Path, help='Reuse the historical discovery panel export')
    p.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/market-packages')
    args = p.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    ktc = (json.loads(args.ktc.read_text()) if args.ktc else
           collect_trades(args.cache_dir, 12, DIR / 'ktc-sleeper-leagues-20261128.txt'))
    discovery = json.loads(args.discovery.read_text()) if args.discovery else collect_trades(args.cache_dir, 2)
    run(ktc, discovery, args.cache_dir)
