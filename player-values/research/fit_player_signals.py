"""Fit candidate trade prices through September, select in October and export the frozen November replay."""
import argparse
from bisect import bisect_right
from collections import defaultdict
from pathlib import Path
import json
from statistics import median
import subprocess

from fit_exchange import league_loss
from market_packages import collect_trades, covered_trades, milliseconds, read_quotes
from package_scale import CURRENT_CALCULATOR
from preseason_trade_fit import START
from dynasty_calibration import exchange_rating_anchors, exchange_surplus, rate_from_anchors
from expert_market import rank_equivalent_scores

HERE = Path(__file__).resolve().parent
OCTOBER = milliseconds('2026-10-01T00:00:00Z')
NOVEMBER = milliseconds('2026-11-01T00:00:00Z')
DAY = 86_400_000
PANELS = ('market-leagues-2026.txt', 'market-leagues-independent-2026.txt',
          'external-exchange-leagues-20261128.txt', 'ktc-sleeper-leagues-20261128.txt')
FOOTBALL_WEIGHTS = (.05, .10, .15, .25, .40)
EXPERT_WEIGHTS = (.125, .25, .375, .50, .75, 1.)
FOOTBALL_FAMILIES = ('plain', 'bounded', 'peer', 'peer_qb', 'peer_skill')
EXPERT_FAMILIES = ('expert_overall', 'expert_position')
FROZEN_FOOTBALL = ('peer_qb', .05)
FROZEN_EXPERT = ('expert_overall', .125)
# Invoking the published JS package calculator in one process keeps all price variants comparable.
PACKAGE_GAPS = """
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {calculatePackageAdjustment} = await import(pathToFileURL(process.argv[1]));
const trades = JSON.parse(fs.readFileSync(0, 'utf8'));
const gaps = trades.map(([globalMaxValue, myValues, theirValues]) => {
  const {myAdjustedValue: a, theirAdjustedValue: b} = calculatePackageAdjustment(
    {globalMaxValue, myValues, theirValues}, {creditShare: .125});
  return Math.abs(a - b) / (a + b);
});
process.stdout.write(JSON.stringify(gaps));
"""


def dated(path, timestamp):
    return {timestamp(t): board for t, board in json.loads(path.read_text()).items()}


def signal_board(quotes, forecast, experts):
    anchors = exchange_rating_anchors(forecast['remainingFraction'])
    rows = {}
    by_position = defaultdict(list)
    for key, quote in quotes.items():
        player = forecast['players'].get(key, {})
        surplus = player.get('footballSurplus')
        quoted_surplus = exchange_surplus(quote, anchors)
        market = rate_from_anchors(quoted_surplus, anchors)
        football = market if surplus is None else rate_from_anchors(surplus, anchors)
        prior = market if surplus is None else rate_from_anchors(.75 * quoted_surplus + .25 * surplus, anchors)
        rows[key] = dict(market=market, prior=prior, football=football, position=player.get('position'),
                         residual=football / market - 1 if market > 0 else 0., centered=0.)
        if surplus is not None and market > 0:
            by_position[player['position']].append(key)
    player_scores = {k: r['market'] for k, r in rows.items() if not k.startswith('pick:')}
    overall = rank_equivalent_scores(player_scores, experts)
    positional = {}
    for keys in by_position.values():
        ordered = sorted(keys, key=lambda k: (rows[k]['market'], k))
        positional.update(rank_equivalent_scores({k: player_scores[k] for k in ordered}, experts))
        for i, key in enumerate(ordered):
            start = max(0, min(i - 5, len(ordered) - 11))
            peers = [rows[k]['residual'] for k in ordered[start:start + 11] if k != key]
            if peers:
                rows[key]['centered'] = rows[key]['residual'] - median(peers)
    for key, row in rows.items():
        row['expert_overall'] = overall.get(key, row['market'])
        row['expert_position'] = positional.get(key, row['market'])
    return rows


def daily_signals(quotes, forecasts, experts):
    origins, editions = sorted(forecasts), sorted(experts)
    daily = {}
    for stamp, quotes_today in sorted(quotes.items()):
        i = bisect_right(origins, stamp) - 1
        if i < 0:
            continue
        j = bisect_right(editions, stamp) - 1
        expert = experts[editions[j]] if j >= 0 and stamp - editions[j] <= 10 * DAY else {}
        daily[stamp] = signal_board(quotes_today, forecasts[origins[i]], expert)
    return daily


def adjustment(row, family, weight):
    market = row['market']
    if family == 'market':
        return 0.
    if family == 'v5.3':
        return row['prior'] - market
    if family in EXPERT_FAMILIES:
        return weight * (row[family] - market)
    if family == 'plain':
        return weight * (row['football'] - market)
    if family == 'peer_qb' and row['position'] != 'QB':
        return 0.
    if family == 'peer_skill' and row['position'] == 'QB':
        return 0.
    delta = row['residual'] if family == 'bounded' else row['centered']
    return weight * market * max(-.75, min(.75, delta))


def price_board(rows, parameters):
    prices = {}
    for key, row in rows.items():
        raw = row['market'] + sum(adjustment(row, family, w) for family, w in parameters)
        prices[key] = round(100 * max(0., min(100., raw))) / 100
    return prices


def measure(daily, pairs, parameters):
    by_date = {t: price_board(daily[t], parameters) for t in {t for t, _ in pairs}}
    max_price = {t: max(v for k, v in board.items() if not k.startswith('pick:')) for t, board in by_date.items()}
    trades = [[max_price[t], *[[by_date[t][k] for k in side] for side in deal['sides']]] for t, deal in pairs]
    output = subprocess.run(['node', '--input-type=module', '-e', PACKAGE_GAPS, str(CURRENT_CALCULATOR)],
                            input=json.dumps(trades), text=True, capture_output=True, check=True)
    groups = defaultdict(list)
    for (_, deal), gap in zip(pairs, json.loads(output.stdout), strict=True):
        sample = 'fit' if deal['accepted'] < OCTOBER else 'october'
        groups[sample].append((deal['league'], gap))
    return {name: {'league_mean': league_loss(rows), 'median': median(gap for _, gap in rows),
                   'trades': len(rows), 'leagues': len({lid for lid, _ in rows})} for name, rows in groups.items()}


def study(cache, board_path, expert_path, output):
    forecasts = dated(board_path, milliseconds)
    experts = dated(expert_path, int)
    quotes = {t: b for t, b in read_quotes(cache).items() if t >= milliseconds(START)}
    daily = daily_signals(quotes, forecasts, experts)
    deals = {}
    for filename in PANELS:
        for deal in collect_trades(cache, 9, HERE / filename):
            if milliseconds(START) <= deal['proposed'] <= deal['accepted'] < NOVEMBER:
                if deal['accepted'] < OCTOBER or deal['proposed'] >= OCTOBER:
                    deals[deal['transaction']] = deal
    pairs = list(covered_trades(deals.values(), {t: quotes[t] for t in daily}))
    market = measure(daily, pairs, [('market', 0)])
    grid = {'market': market}
    winners = {}
    families = [(family, FOOTBALL_WEIGHTS) for family in FOOTBALL_FAMILIES]
    families.extend((family, EXPERT_WEIGHTS) for family in EXPERT_FAMILIES)
    for family, weights in families:
        labels = ['market']
        for weight in weights:
            name = f'{family}:{weight}'
            grid[name] = measure(daily, pairs, [(family, weight)])
            labels.append(name)
        winners[family] = min(labels, key=lambda label: grid[label]['fit']['league_mean'])

    def select(families):
        names = ['market', *(winners[family] for family in families)]
        return min(names, key=lambda label: grid[label]['october']['league_mean'])

    methods = {
        'market': [('market', 0.)], 'v53': [('v5.3', 0.)], 'football': [FROZEN_FOOTBALL],
        'expert': [FROZEN_EXPERT], 'both': [FROZEN_FOOTBALL, FROZEN_EXPERT],
    }
    summaries = {name: measure(daily, pairs, params) for name, params in methods.items()}
    chosen = min(methods, key=lambda name: summaries[name]['october']['league_mean'])
    report = {'eligible': len(deals), 'priced': len(pairs), 'strength_fit': grid, 'family_winners': winners,
              'football_refit': select(FOOTBALL_FAMILIES), 'expert_refit': select(EXPERT_FAMILIES),
              'october_metrics': summaries, 'october_lowest': chosen, 'locked_primary': 'both'}
    output.mkdir(parents=True, exist_ok=True)
    (output / 'development.json').write_text(json.dumps(report, indent=2) + '\n')
    # Preserve the specification frozen before the final identity and prior-stat vintage audit.
    for name, params in methods.items():
        boards = {t: price_board(rows, params) for t, rows in daily.items() if t >= NOVEMBER - 7 * DAY}
        (output / f'{name}.json').write_text(json.dumps(boards, separators=(',', ':')))
    (output / 'quotes.json').write_text(json.dumps(quotes, separators=(',', ':')))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origins', required=True, type=Path, help='Weekly football estimates from weekly_origins.py')
    parser.add_argument('--experts', required=True, type=Path, help='Dated expert scores keyed by publication time in ms')
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    results = study(args.cache_dir, args.origins, args.experts, args.output_dir)
    print(json.dumps({k: v for k, v in results.items() if k != 'strength_fit'}, indent=2))
