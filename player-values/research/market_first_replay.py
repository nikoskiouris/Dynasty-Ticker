"""Fit the displayed-score blend before kickoff and evaluate later trades in disjoint leagues."""
import argparse
from collections import defaultdict
from contextlib import redirect_stdout
import json
from pathlib import Path
from random import Random
from statistics import mean, median
import sys

from fit_exchange import league_loss, mapped, outside_old_panels, split_leagues
from market_packages import collect_trades
from package_scale import CURRENT_CALCULATOR, calculator_totals
from pick_packages import prices
from preseason_trade_fit import END, KICKOFF, START, millis, reconstructed_inputs
from trade_spacing import legacy_prices
from dynasty_value import value_board


RESEARCH = Path(__file__).resolve().parent
V53 = 'a195a23112b0ee9450e5032e46ef3523c937b8a4'
FOOTBALL_WEIGHTS = (0, 5, 10, 15, 20, 25)
CREDIT_SHARE = .125


def in_window(deals, start, end):
    first, last = millis(start), millis(end)
    return [d for d in deals if first <= d['proposed'] <= d['accepted'] < last]


def sample_panels(cache):
    discovery = collect_trades(cache, 2)
    # Reconstruct the nine previously designated KTC training leagues from the
    # complete study window. Only their pre-kickoff deals contribute to the fit.
    ktc = collect_trades(cache, 12, RESEARCH / 'ktc-sleeper-leagues-20261128.txt')
    ktc_train, _ = split_leagues(outside_old_panels(ktc))
    earlier_panel = discovery + ktc_train
    held_panel = []
    for name in ('market-leagues-independent-2026.txt', 'external-exchange-leagues-20261128.txt'):
        held_panel.extend(collect_trades(cache, 2, RESEARCH / name))
    if {d['league'] for d in earlier_panel} & {d['league'] for d in held_panel}:
        raise ValueError('Training and held panels must use separate leagues')
    return {
        'train': in_window(earlier_panel, START, KICKOFF),
        'holdout': in_window(held_panel, KICKOFF, END),
        'all_dates_held_leagues': in_window(held_panel, START, END),
        'later_training_leagues': in_window(earlier_panel, KICKOFF, END),
    }


def metrics(rows):
    return {'trades': len(rows), 'leagues': len(set(lid for lid, _ in rows)),
            'league_mean_gap': league_loss(rows), 'median_gap': median(gap for _, gap in rows)}


def evaluate_panel(deals, boards, market_assets, elite):
    distinct = {d['transaction']: mapped(d) for d in deals}
    matched = []
    for deal in distinct.values():
        assets = [key for side in deal['sides'] for key in side]
        if all(key in market_assets and all(b.get(key, 0) > 0 for b in boards.values()) for key in assets):
            matched.append(deal)
    groups = defaultdict(list)
    for index, deal in enumerate(matched):
        left, right = deal['sides']
        keys = set(left + right)
        groups['all'].append(index)
        if len(left) != len(right):
            groups['unequal_piece_counts'].append(index)
        if keys & elite:
            groups['includes_market_top_12'].append(index)
        if all(not key.startswith('pick:') for key in keys):
            groups['players_only'].append(index)
        if all(key.startswith('pick:') for key in keys):
            groups['picks_only'].append(index)
    stats, credited = {}, {}
    for name, board in boards.items():
        totals = calculator_totals(board, matched, CURRENT_CALCULATOR, {'creditShare': CREDIT_SHARE})
        losses = {'listed': [], 'credited': []}
        for deal, pair in zip(matched, totals, strict=True):
            for label, (a, b) in zip(losses, pair, strict=True):
                losses[label].append((deal['league'], abs(a - b) / (a + b)))
        credited[name] = losses['credited']
        stats[name] = {
            group: {label: metrics([rows[i] for i in ids]) for label, rows in losses.items()}
            for group, ids in groups.items()
        }
    return {'eligible': len(distinct), 'priced': len(matched), 'models': stats}, credited


def paired_interval(candidate, baseline):
    """Pair trades and resample whole leagues for the difference in the primary metric."""
    by_league = defaultdict(list)
    for (league, new), (other, old) in zip(candidate, baseline, strict=True):
        if league != other:
            raise ValueError('Mismatched leagues across model replays')
        by_league[league].append(new - old)
    changes = [mean(group) for group in by_league.values()]
    rng = Random(20261128)
    samples = sorted(mean(rng.choices(changes, k=len(changes))) for _ in range(4000))
    return {'change': mean(changes), 'interval95': [samples[99], samples[3899]]}


def replay(cache):
    players, market, picks = reconstructed_inputs(cache)
    boards = {'v5.3': prices(legacy_prices(players, picks, V53))}
    for weight in FOOTBALL_WEIGHTS:
        boards[f'football_{weight}'] = prices(value_board(players, picks, football_weight=weight / 100)[:2])
    market_assets = set(market) | set(picks)
    elite = set(sorted(market, key=market.get, reverse=True)[:12])
    samples = sample_panels(cache)
    train, losses = evaluate_panel(samples.pop('train'), boards, market_assets, elite)
    winner = min(FOOTBALL_WEIGHTS, key=lambda weight: league_loss(losses[f'football_{weight}']))
    selected = f'football_{winner}'
    results = {'training_football_weight_percent': winner, 'train': train}
    for name, deals in samples.items():
        panel, losses = evaluate_panel(deals, boards, market_assets, elite)
        panel['selected_minus_v5.3'] = paired_interval(losses[selected], losses['v5.3'])
        panel['selected_minus_market'] = paired_interval(losses[selected], losses['football_0'])
        results[name] = panel
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True, help='Directory for reusable public inputs')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    with redirect_stdout(sys.stderr):
        report = replay(args.cache_dir)
    print(json.dumps(report, indent=2))
