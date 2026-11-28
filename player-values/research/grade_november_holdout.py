"""Replay predeclared daily price boards on the frozen November public trade sample."""
import argparse
from bisect import bisect_left
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from math import isfinite
from pathlib import Path
from random import Random
from statistics import mean, median, quantiles

from package_scale import CURRENT_CALCULATOR, calculator_totals

FROZEN = Path(__file__).with_name('november-holdout-trades.json')
MAX_AGE = 7 * 86_400_000
RAW_FC = 'raw_market_quote_sums'


def dated_boards(file):
    return {int(stamp): board for stamp, board in json.loads(Path(file).read_text()).items()}


def metrics(pairs):
    leagues = defaultdict(list)
    for league, error in pairs:
        leagues[league].append(error)
    errors = [error for _, error in pairs]
    return dict(n=len(errors), leagues=len(leagues), median=median(errors),
                p75=quantiles(errors, n=4, method='inclusive')[2] if len(errors) > 1 else errors[0],
                league_mean=mean(mean(group) for group in leagues.values()))


def league_interval(candidate, comparator):
    leagues = defaultdict(list)
    for (league, new), (other, old) in zip(candidate, comparator, strict=True):
        if league != other:
            raise ValueError('Unpaired leagues')
        leagues[league].append(new - old)
    effects = [mean(group) for group in leagues.values()]
    random = Random(20261128)
    sample = sorted(mean(random.choices(effects, k=len(effects))) for _ in range(4000))
    return [mean(effects), sample[99], sample[3899]]


def match_dates(deals, market, boards):
    days = sorted(set.intersection(set(market), *(set(b) for b in boards.values())))
    if not days:
        raise ValueError('The board files have no common valuation timestamps')
    grouped, exclusions = defaultdict(list), Counter()
    for deal in sorted(deals.values(), key=lambda d: (d['proposed'], d['transaction'])):
        previous = bisect_left(days, deal['proposed']) - 1
        if previous < 0 or deal['proposed'] - days[previous] > MAX_AGE:
            exclusions['no_pre_proposal_board_within_week'] += 1
            continue
        day = days[previous]
        keys = [key for side in deal['sides'] for key in side]
        if any(market[day].get(key, 0) <= 0 for key in keys):
            exclusions['missing_raw_market_quote'] += 1
            continue
        if any(not isfinite(board[day].get(key, 0)) or board[day].get(key, 0) <= 0
               for board in boards.values() for key in keys):
            exclusions['incomplete_model_coverage'] += 1
            continue
        grouped[day].append(deal)
    return days, grouped, exclusions


def trade_groups(deal, top):
    assets = [key for side in deal['sides'] for key in side]
    players = {key for key in assets if not key.startswith('pick:')}
    groups = ['all', 'with_players' if players else 'all_picks']
    if all(key in players for key in assets):
        groups.append('players_only')
    elif players:
        groups.append('both_players_picks')
    if top & players:
        groups.append('with_top12_player')
    if len(deal['sides'][0]) != len(deal['sides'][1]):
        groups.append('unequal_counts')
    return groups


def evaluate(deals, market, boards, candidate):
    days, grouped, exclusions = match_dates(deals, market, boards)
    if not grouped:
        raise ValueError('No offers met price coverage requirements')
    observations = []
    for day, matches in sorted(grouped.items()):
        quotes = market[day]
        top = set(sorted((k for k in quotes if not k.startswith('pick:')), key=quotes.get, reverse=True)[:12])
        totals = {name: calculator_totals(board[day], matches, CURRENT_CALCULATOR, {'creditShare': .125})
                  for name, board in boards.items()}
        # Raw quoted units are compared as listed. Applying the site's package curve
        # to raw quotes would mix its 0–100 price scale with FantasyCalc units.
        quoted = [[sum(quotes[k] for k in side) for side in d['sides']] for d in matches]
        totals[RAW_FC] = [(pair, pair) for pair in quoted]
        for i, deal in enumerate(matches):
            errors = {name: {kind: abs(a - b) / (a + b)
                             for kind, (a, b) in zip(('listed', 'credited'), pairs[i], strict=True)}
                      for name, pairs in totals.items()}
            observations.append(dict(league=deal['league'], transaction=deal['transaction'], proposed=deal['proposed'],
                                     dated=day, groups=trade_groups(deal, top), losses=errors))
    report = {
        'eligible': len(deals), 'priced': len(observations), 'exclusions': dict(exclusions),
        'common_board_dates': len(days), 'used_dates': {
            datetime.fromtimestamp(t / 1000, timezone.utc).isoformat(): len(g) for t, g in sorted(grouped.items())},
        'groups': {},
    }
    for group in sorted({name for r in observations for name in r['groups']}):
        subset = [r for r in observations if group in r['groups']]
        losses = {name: {kind: [(r['league'], r['losses'][name][kind]) for r in subset]
                         for kind in ('credited', 'listed')} for name in [*boards, RAW_FC]}
        report['groups'][group] = {
            'metrics': {name: {kind: metrics(pairs) for kind, pairs in types.items()} for name, types in losses.items()},
            'candidate_minus_comparator': {
                name: league_interval(losses[candidate]['credited'], types['credited'])
                for name, types in losses.items() if name != candidate},
        }
    return report, observations


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boards', action='append', required=True,
                        help='label=file, a JSON map from millisecond timestamps to raw asset IDs and 0–100 prices')
    parser.add_argument('--market', required=True, type=Path, help='Timestamped raw FantasyCalc quote boards')
    parser.add_argument('--candidate', required=True, help='Label of the preselected candidate')
    parser.add_argument('--deals', type=Path, default=FROZEN)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--rows-output', type=Path)
    args = parser.parse_args()
    entries = dict(arg.split('=', 1) for arg in args.boards)
    if len(entries) != len(args.boards) or args.candidate not in entries or RAW_FC in entries:
        parser.error('Supply distinct labels, including the candidate; raw_market_quote_sums is reserved')
    maps = {name: dated_boards(path) for name, path in entries.items()}
    rows = json.loads(args.deals.read_text())
    result, examples = evaluate({d['transaction']: d for d in rows}, dated_boards(args.market), maps, args.candidate)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    if args.rows_output:
        args.rows_output.write_text(json.dumps(examples, separators=(',', ':')) + '\n')
    print(f"{result['priced']} of {result['eligible']} offers priced")
    for label, stats in result['groups']['all']['metrics'].items():
        print(f"{label}: league-balanced mean {stats['credited']['league_mean']:.2%}, "
              f"median {stats['credited']['median']:.2%}")
