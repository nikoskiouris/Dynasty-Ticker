"""Evaluate the locked trade model on the additional, fixed public Sleeper panel."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from random import Random
from statistics import mean

from fit_exchange import compare, market_losses
from market_packages import SLEEPER, collect_trades, read_quotes
from pick_packages import late_market, preseason
from preseason_trade_fit import END, millis, reconstructed_inputs
from ranking_holdout import fetch

PANEL = Path(__file__).with_name('external-exchange-leagues-20261128.txt')


def credit_check(deals, cache):
    unequal = [d for d in deals if d['proposed'] >= millis(END) and len(d['sides'][0]) != len(d['sides'][1])]
    estimates = market_losses(unequal, read_quotes(cache), (0., .125, .25))
    compare(estimates, f'{len(unequal)} later unequal offers before quote coverage')
    groups = defaultdict(list)
    for league, gap in estimates[.125]:
        groups[league].append(gap)
    widths = defaultdict(list)
    for league, gaps in groups.items():
        slots = json.loads(fetch(SLEEPER + league, cache))['roster_positions']
        starters = sum(s not in {'BN', 'BENCH', 'IR', 'TAXI', 'RESERVE', 'PUP', 'NA'} for s in slots)
        band = 'up to 9 starters' if starters <= 9 else ('10 starters' if starters == 10 else '11+ starters')
        widths[band].extend((league, gap) for gap in gaps)
    for band, rows in sorted(widths.items()):
        compare({.125: rows}, band)
    # Unit of resampling is an entire league, preserving the comparison on each package.
    by_league = defaultdict(list)
    for (league, new), (other, old) in zip(estimates[.125], estimates[.25], strict=True):
        if league != other:
            raise ValueError('Inconsistent league order across credit settings')
        by_league[league].append(new - old)
    if by_league:
        means = [mean(group) for group in by_league.values()]
        rng = Random(20261128)
        samples = sorted(mean(rng.choices(means, k=len(means))) for _ in range(2000))
        print(f'Locked minus former credit, paired league mean {mean(means):+.3%}, '
              f'league-bootstrap 95% interval [{samples[49]:+.3%}, {samples[1949]:+.3%}]')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--deals', type=Path, help='Reuse an export from this exact panel')
    parser.add_argument('--exclude-league', action='append', default=[], help='Sensitivity check with this league omitted')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    deals = json.loads(args.deals.read_text()) if args.deals else collect_trades(args.cache_dir, panel=PANEL)
    if not {d['league'] for d in deals} <= set(PANEL.read_text().splitlines()):
        parser.error('The export contains leagues outside the validation panel')
    if args.exclude_league:
        deals = [d for d in deals if d['league'] not in args.exclude_league]
    print(f'{len(deals)} completed exchanges, {len({d["league"] for d in deals})} contributing leagues')
    print('August frozen football and market replay')
    preseason(deals, *reconstructed_inputs(args.cache_dir), weights=())
    print('September–November pre-proposal market replay')
    late_market(deals, args.cache_dir)
    credit_check(deals, args.cache_dir)
