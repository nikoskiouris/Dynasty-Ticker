"""Fit and audit the fixed 0–100 dynasty utility scale using real dated preseason boards."""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median

import inseason_forecast as seasonal
import ranking_holdout as audit
from dynasty_value import raw_board
from inseason import remaining_share
from production_evidence import read_rows

DISCOUNT = .85
UPPER_EDGES = (10, 30, 60, 100, 160, 240, 360, 520, float("inf"))


def historic_reference(cache):
    """A real elite career-window outcome, known before any forecast audit."""
    groups = defaultdict(dict)
    for r in read_rows('stats', cache):
        year = int(r['season'])
        if r['season_type'] == 'REG' and 2000 <= year <= 2018 and r['position'] in audit.POSITIONS:
            groups[year][r['player_id']] = {'pos': r['position'], 'points': float(r['fantasy_points_ppr'])}
    surplus = {y: audit.marginal(pool, 'points') for y, pool in groups.items()}
    elite = []
    for year in range(2000, 2017):
        # These were 16-game seasons. Set the unit in 17-game-equivalent points.
        outcomes = [17/16 * sum(DISCOUNT**h * surplus[year+h].get(p, 0.) for h in range(3))
                    for p in groups[year]]
        elite.append(mean(sorted(outcomes, reverse=True)[:3]))
    return round(median(elite), 2)


def actual_surplus(stats):
    return audit.marginal({p: {'pos': r['position'], 'points': float(r['fantasy_points_ppr'])}
                           for p, r in stats.items()}, 'points')


def remaining_surplus(year, cutoff, cache):
    points, positions = Counter(), {}
    for r in audit.csv_rows(seasonal.WEEKLY.format(year), cache):
        if r['season_type'] == 'REG' and r['position'] in audit.POSITIONS and int(r['week']) > cutoff:
            p = r['player_id']
            points[p] += float(r['fantasy_points_ppr'])
            positions[p] = r['position']
    return audit.marginal({p: {'points': v, 'pos': positions[p]} for p, v in points.items()}, 'points')


def checkpoints(year, stats, crosswalk, schedule, cache):
    board = audit.make_board(year, stats[year - 1], crosswalk, cache)
    yield 0, board, actual_surplus(stats[year])
    for _, cutoff, _, records in seasonal.observations(year, schedule, crosswalk, cache, cutoffs=(12,)):
        yield cutoff, {row['player_id']: row for row, _ in records}, remaining_surplus(year, cutoff, cache)


def sample(seasons, cache):
    crosswalk = list(audit.csv_rows(audit.CROSSWALK, cache))
    schedule = list(audit.csv_rows(seasonal.SCHEDULE, cache))
    years = sorted({y + h for y in seasons for h in (-1, 0, 1, 2)})
    stats = {y: {r['player_id']: r for r in audit.csv_rows(audit.STATS.format(y), cache)
                 if r['season_type'] == 'REG' and r['position'] in audit.POSITIONS} for y in years}
    full = {y: actual_surplus(pool) for y, pool in stats.items()}
    out = []
    for year in seasons:
        for cutoff, board, remaining in checkpoints(year, stats, crosswalk, schedule, cache):
            raw, _ = raw_board(board, season_week=cutoff + 1)
            # Replay the v3 football scale. Both sides lack historical market quotes.
            max_now = max(r['lineup'] for r in raw.values())
            max_future = max(r['future'] + r['draft'] for r in raw.values())
            immediate = .35 * remaining_share(board, cutoff + 1)
            weights = {p: immediate * r['lineup'] / max_now
                       + (.75 - immediate) * (r['future'] + r['draft']) / max_future
                       for p, r in raw.items()}
            peak = max(weights.values())
            group = []
            for p, r in raw.items():
                x = r['lineup'] + r['future'] + r['draft']
                # Unresolved identities have unknown outcomes; include them in
                # the forecast board and its replacement levels, exclude from fit.
                if x <= 0 or p.startswith('unmatched-'):
                    continue
                y = remaining.get(p, 0.) + DISCOUNT * full[year+1].get(p, 0.) + DISCOUNT**2 * full[year+2].get(p, 0.)
                group.append((p, board[p]['pos'], x, y, 100 * weights[p] / peak))
            out.append((year, cutoff, sorted(group, key=lambda r: (-r[2], r[0]))))
    return out


def fit(checkpoints):
    groups = defaultdict(list)
    for _, _, rows in checkpoints:
        for _, _, x, y, _ in rows:
            groups[next(e for e in UPPER_EDGES if x <= e)].append((x, y))
    blocks = []
    # Each bin gets one startup round (12 prior observations) at a forecast's
    # own PPR estimate. This stabilizes the rare top tail and preserves units.
    for edge in UPPER_EDGES:
        rows = groups[edge]
        if not rows:
            continue
        n, x = len(rows), mean(v for v, _ in rows)
        blocks.append([n*x, n, sum(y for _, y in rows) + 12*x, n+12])
        while len(blocks) >= 2:
            left, right = blocks[-2:]
            if left[2]/left[3] <= right[2]/right[3]:
                break
            blocks[-2:] = [[a + b for a, b in zip(left, right)]]
    return [(0., 0.)] + [(round(sx/n, 2), round(sy/w, 2)) for sx, n, sy, w in blocks]


def estimate(x, knots):
    for (lx, ly), (rx, ry) in zip(knots, knots[1:]):
        if x <= rx:
            return ly + (x-lx)*(ry-ly)/(rx-lx)
    # Keep the top tail distinguishable; hold its learned utility/input ratio.
    return x * knots[-1][1] / knots[-1][0]


def fit_reference(checkpoints, knots):
    # What a top asset could have been expected to deliver, using only the
    # completed development sample. Individual future boards never reset it.
    return round(median(max(estimate(row[2], knots) for row in rows)
                        for _, cutoff, rows in checkpoints if cutoff == 0), 2)


def baseline_factor(checkpoints):
    # Least-squares through origin: give a rescaled v3 board its strongest
    # one-coefficient fit for squared error on exactly the same PPR outcomes.
    rows = [r for _, _, group in checkpoints for r in group]
    return sum(y*v3 for _, _, _, y, v3 in rows) / sum(r[4]**2 for r in rows)


def evaluate(checkpoints, knots, reference, v3_factor):
    groups, packages = defaultdict(list), []
    for year, cutoff, rows in checkpoints:
        scored = []
        for rank, (_, pos, x, y, v3) in enumerate(rows, 1):
            predicted = min(100., 100 * estimate(x, knots) / reference)
            realized = 100 * y / reference
            row = (realized, v3, min(100., 100*v3*v3_factor/reference), min(100., 100*x/reference), predicted)
            scored.append(row)
            label = '1–12' if rank <= 12 else '13–108' if rank <= 108 else '109–240' if rank <= 240 else '241+'
            groups[label].append(row)
            if rank <= 240:
                groups[pos].append(row)
                groups['1–240'].append(row)
        print(year, 'after week', cutoff, 'native top/12th/48th/capped:',
              *(f'{scored[i][-1]:.2f}' for i in (0, 11, 47)), sum(r[-1] >= 100 for r in scored))
        # Predetermine packages from forecast ranks, never from realized outcomes.
        # One top-36 asset vs two distinct assets ranked 37–108.
        for i in range(36):
            packages.append(tuple(a-b-c for a, b, c in zip(scored[i], scored[36+i], scored[72+i])))
    tiers = [groups[label] for label in ('1–12', '13–108', '109–240')]
    total_count = sum(len(tier) for tier in tiers)
    bias = [sum(abs(sum(row[m] - row[0] for row in tier)) for tier in tiers) / total_count
            for m in (1, 2, 3, 4)]
    print('Top-240 weighted absolute tier-mean error (v3, scaled v3, raw, native):',
          *(f'{v:.2f}' for v in bias))
    groups['1 vs 2 package gap'] = packages
    print('Mean, MAE, RMSE on the same native points: v3; scaled v3; raw PPR; calibrated PPR')
    for label, rows in groups.items():
        target, *methods = zip(*rows)
        metrics = []
        for values in methods:
            mse = mean((a-b)**2 for a, b in zip(target, values))
            mae = mean(abs(a-b) for a, b in zip(target, values))
            metrics.append(f'{mean(values):.2f}/{mae:.2f}/{mse**.5:.2f}')
        print(label, len(rows), f'{mean(target):.2f}', *metrics)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/ranking-holdout')
    parser.add_argument('--holdout', action='store_true', help='Also score 2023 forecasts using outcomes through 2025.')
    parser.add_argument('--live-input', type=Path, help='Report range on a normalized --save-inputs board.')
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    hindsight_reference = historic_reference(cache)
    training = sample((2018, 2020), cache)
    knots = fit(training)
    reference = fit_reference(training, knots)
    v3_factor = baseline_factor(training)
    print('Ex-ante reference:', reference, 'Hindsight reference:', hindsight_reference, 'v3 multiplier:', v3_factor, 'Knots:', knots)
    print('Development 2018 and 2020')
    evaluate(training, knots, reference, v3_factor)
    if args.holdout:
        print('Forecast holdout 2023')
        evaluate(sample((2023,), cache), knots, reference, v3_factor)
    if args.live_input:
        from dynasty_value import value_board

        inputs = json.loads(args.live_input.read_text())
        rows = inputs['players']
        raw, _ = raw_board(rows, season_week=inputs['seasonWeek'])
        pure = [min(100., 100*estimate(r['lineup'] + r['future'] + r['draft'], knots)/reference)
                for r in raw.values()]
        prices, _, _ = value_board(rows, inputs['picks'], season_week=inputs['seasonWeek'])
        for label, values in [('football', pure), ('full', [r['value'] for r in prices.values()])]:
            values.sort(reverse=True)
            print(inputs['asOf'], label, 'top/12th/48th/capped:',
                  *(f'{values[i]:.2f}' for i in (0, 11, 47)), sum(v >= 100 for v in values))


if __name__ == '__main__':
    main()
