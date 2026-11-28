"""Reconstruct the fixed phase-specific price anchors and report board utilization."""
import argparse
import json
from math import exp
from pathlib import Path
from statistics import median

import inseason_forecast as seasonal
import preseason_trade_fit as preseason
import ranking_holdout as audit
from dynasty_calibration import MARKET_KNOTS, calibrated_football
from dynasty_value import interpolate, raw_board
from inseason import remaining_share
from trade_spacing import legacy_prices
from market_calibration import BANDS


PHASES = (0., 1/3, 1.)
RANKS = (48, 21, 7, 3)
V4_REFERENCE = 361.37
MARKET_RANK = [(lo + hi)/2 for lo, hi in BANDS]


def market_reference(rank, fraction):
    # These public rank-band expectations are in PPR. Their projection does
    # not need prices or identities for an individual historical player.
    utility = [season * fraction + future for _, season, future in reversed(MARKET_KNOTS[1:])]
    return interpolate(rank, MARKET_RANK, utility)


def forecast_profiles(year, crosswalk, schedule, cache):
    prior = {r['player_id']: r for r in audit.csv_rows(audit.STATS.format(year-1), cache)
             if r['season_type'] == 'REG' and r['position'] in audit.POSITIONS}
    initial = audit.make_board(year, prior, crosswalk, cache)
    _, cutoff, _, records = next(seasonal.observations(year, schedule, crosswalk, cache, cutoffs=(12,)))
    later = {row['player_id']: row for row, _ in records}
    profiles = {}
    for fraction, week, board in ((1., 1, initial), (1/3, cutoff+1, later), (0., cutoff+1, later)):
        raw, _ = raw_board(board, season_week=week)
        # End-of-season reference removes the remaining lineup contribution
        # from the same week-13 pool. No hindsight year-end winners enter it.
        football = sorted((calibrated_football(r['future'] + r['draft'] + (r['lineup'] if fraction else 0))
                           for r in raw.values()), reverse=True)
        profiles[fraction] = [.75 * value + .25 * market_reference(rank, fraction)
                              for rank, value in enumerate(football, start=1)]
    return profiles


def fit_anchors(profiles):
    anchors = {}
    for t in PHASES:
        values = []
        for rank in RANKS:
            values.append(round(median(p[t][rank-1] for p in profiles), 2))
        anchors[t] = values
    return anchors


def band_score(value, fraction, anchors, *, protected=False, exponential=False):
    by_rank = [interpolate(fraction, PHASES, [anchors[t][i] for t in PHASES]) for i in range(4)]
    depth, upper, elite, star = by_rank
    x, y = [0.], [0.]
    if protected:
        x.append(depth)
        y.append(1.35 * 100 * depth / V4_REFERENCE)
    x.extend((upper, elite, star))
    y.extend((87., 90., 95.))
    if value <= star:
        return interpolate(value, x, y)
    width = star - elite
    if exponential:
        return 100 - 5 * exp(-(value - star) / width)
    # Match the upper segment's slope at 95 and reach the observed historical
    # three-year PPR ceiling at 100. A single maximum today does not set it.
    ceiling = 501.36
    if value >= ceiling:
        return 100.
    excess = value - star
    return 95 + 5 * excess / (width + (1 - width / (ceiling - star)) * excess)


def inspect_board(label, fraction, values, anchors):
    ranked = sorted(values, reverse=True)
    prices = [round(band_score(v, fraction, anchors), 2) for v in ranked]
    tail = [round(band_score(v, fraction, anchors, exponential=True), 2) for v in ranked[:3]]
    print(label, 'fraction', round(fraction, 4),
          '90+ / [87,90) / 85+ / 100', sum(v >= 90 for v in prices),
          sum(87 <= v < 90 for v in prices), sum(v >= 85 for v in prices), sum(v == 100 for v in prices))
    print('  ranks 1/2/3/6/12/18/30/48/96/240:',
          *(f'{prices[r-1]:.2f}' for r in (1, 2, 3, 6, 12, 18, 30, 48, 96, 240)))
    print('  exponential tail ranks 1/2/3:', *(f'{x:.2f}' for x in tail))
    print('  protected ranks 48/96/240:',
          *(f'{band_score(ranked[r-1], fraction, anchors, protected=True):.2f}' for r in (48, 96, 240)))


def inspect_actual(label, board, picks, week, anchors):
    results, _ = legacy_prices(board, picks, '60aa24a', season_week=week)
    inspect_board(label, remaining_share(board, week), [r['calibratedSurplus'] for r in results.values()], anchors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=Path.home() / '.cache/dynasty-ticker/ranking-holdout')
    parser.add_argument('--live-input', type=Path, help='Normalized source bundle from --save-inputs')
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    crosswalk = list(audit.csv_rows(audit.CROSSWALK, cache))
    schedule = list(audit.csv_rows(seasonal.SCHEDULE, cache))
    profiles = {year: forecast_profiles(year, crosswalk, schedule, cache) for year in (2018, 2020, 2023)}
    anchors = fit_anchors([profiles[2018], profiles[2020]])
    print('Remaining fraction -> fixed PPR of reference ranks 48,21,7,3:', anchors)
    for year, profile in profiles.items():
        for fraction in reversed(PHASES):
            inspect_board(str(year) + ' rank-paired reference', fraction, profile[fraction], anchors)
    board, _, picks = preseason.reconstructed_inputs(cache)
    inspect_actual('August 26 2026 observed', board, picks, 1, anchors)
    if args.live_input:
        data = json.loads(args.live_input.read_text())
        inspect_actual(data['asOf'], data['players'], data['picks'], data['seasonWeek'], anchors)


if __name__ == '__main__':
    main()
