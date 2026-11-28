"""Describe how much prior NFL production, age and draft round tell us about future PPR.

Run manually with Python 3.10+. Downloads the nflverse inputs to a user cache.
Study outcomes measure NFL production.
"""
import argparse
import csv
import hashlib
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from math import exp
from pathlib import Path
from statistics import mean
from urllib.request import urlopen


SOURCES = {
    'stats': 'player_stats/player_stats_season.csv',
    'players': 'players/players.csv',
    'draft': 'draft_picks/draft_picks.csv',
    'projections': ('https://raw.githubusercontent.com/fantasydatapros/data/'
                    'e36e1de3303de41ab92993cf1d764afdeb117407/fantasypros/fp_projections.csv'),
}
# Study cutoffs approximate league demand; they do not allocate flexible slots.
CUTOFF = {'QB': 24, 'RB': 36, 'WR': 48, 'TE': 12}


def read_rows(source, cache):
    asset = SOURCES[source]
    path = cache / asset.split('/')[-1]
    if not path.exists():
        url = asset if asset.startswith('https://') else 'https://github.com/nflverse/nflverse-data/releases/download/' + asset
        with urlopen(url, timeout=60) as response:
            payload = response.read()
        path.write_bytes(payload)
    print(f'{path.name}: {hashlib.sha256(path.read_bytes()).hexdigest()}')
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def schedule_length(year):
    return 16 if year < 2021 else 17


@dataclass(frozen=True)
class Observation:
    position: str
    age: int
    year: int
    tier: int
    current: float
    future: float
    starter: bool
    retained: bool
    player: str


def collect(stats, bios):
    scores, groups, cutoff_score = {}, defaultdict(list), {}
    birth = {row['gsis_id']: date.fromisoformat(row['birth_date']) for row in bios
             if row['gsis_id'] and row['birth_date']}
    for row in stats:
        year, pos = int(row['season']), row['position']
        if row['season_type'] != 'REG' or pos not in CUTOFF or year > 2024:
            continue
        player = row['player_id']
        score = float(row['fantasy_points_ppr'] or 0) / schedule_length(year)
        scores[player, year] = score
        groups[pos, year].append((score, player))
    for (pos, year), group in groups.items():
        group.sort(reverse=True)
        cutoff_score[pos, year] = group[CUTOFF[pos] - 1][0]
    observations = []
    for (pos, year), group in groups.items():
        if year < 2000 or (pos, year + 1) not in groups:
            continue
        for rank, (score, player) in enumerate(group[:2 * CUTOFF[pos]], start=1):
            if player not in birth:
                continue
            birthday = birth[player]
            age = year - birthday.year - ((9, 1) < (birthday.month, birthday.day))
            future = scores.get((player, year + 1), 0.)
            tier = (rank - 1) // (CUTOFF[pos] // 2)
            observations.append(Observation(pos, int(age), year, tier, score, future,
                                            rank <= CUTOFF[pos], future >= cutoff_score[pos, year + 1], player))
    return scores, cutoff_score, observations


def compare_forecasts(observations, scores, cutoff_score):
    # Year is the *known* prior season. All training targets end by 2018.
    train = defaultdict(list)
    for row in observations:
        if row.year + 1 <= 2018:
            train[row.position, row.tier].append(row)
    errors = defaultdict(list)
    for row in observations:
        if row.year + 1 < 2019:
            continue
        cohort = train[row.position, row.tier]
        prior = mean(r.future for r in cohort)
        neighbors = [r.future for r in cohort if abs(r.age - row.age) <= 2]
        estimate = (12 * prior + sum(neighbors)) / (12 + len(neighbors))
        for pos in ('All', row.position):
            for name, value in [('repeat', row.current), ('tier', prior), ('tier + age', estimate)]:
                errors[pos, name].append(abs(row.future - value))
    print('\nHeld-out next-year MAE (PPR points per scheduled team game)')
    for pos in ('All', *CUTOFF):
        n = len(errors[pos, 'repeat'])
        print(pos, n, *(f'{mean(errors[pos, name]):.3f}' for name in ('repeat', 'tier', 'tier + age')))
    print('\nTraining-cohort starter retention and future/current surplus (n, percent, Y+1, Y+2)')
    for pos in CUTOFF:
        for low, high in [(20, 24), (25, 27), (28, 30), (31, 33), (34, 50)]:
            cohort = [r for r in observations if r.position == pos and r.starter
                      and r.year + 2 <= 2018 and low <= r.age <= high]
            if cohort:
                current = sum(max(0., r.current - cutoff_score[pos, r.year]) for r in cohort)
                ratios = []
                for horizon in (1, 2):
                    future = sum(max(0., scores.get((r.player, r.year + horizon), 0.)
                                     - cutoff_score[pos, r.year + horizon]) for r in cohort)
                    ratios.append(f'{future/current:.2f}' if current else 'n/a')
                print(pos, f'{low}-{high}', len(cohort), f'{mean(r.retained for r in cohort):.1%}', *ratios)


def late_qb_retention(observations, scores, cutoffs):
    """Estimate future starter chances conditional on already having a top-24 finish."""
    rows = []
    for row in observations:
        if row.position != 'QB' or not row.starter or row.age < 28 or row.year > 2022:
            continue
        current = max(0., row.current - cutoffs['QB', row.year])
        future = [max(0., scores.get((row.player, year), 0.) - cutoffs['QB', year])
                  for year in (row.year + 1, row.year + 2)]
        rows.append((row, current, future))
    training = [entry for entry in rows if entry[0].year <= 2016]
    older = [entry for entry in training if entry[0].age >= 34]
    held_out = [entry for entry in rows if entry[0].year >= 2018 and entry[0].age >= 35]

    def probability(coefs, age, tier):
        intercept, slope, role = coefs
        return 1 / (1 + exp(-(intercept + slope * (age - 34) + role * tier)))

    def fit(horizon):
        # Penalized logistic model for earning positive surplus. Coordinate Newton
        # iterations maximize the binomial log likelihood with L2 penalties on
        # the age coefficient (SD 0.2 per year) and top-12/13–24 coefficient (SD 1).
        coefs = [0., 0., 0.]
        for _ in range(200):
            largest = 0.
            for j, penalty in enumerate((0., 25., 1.)):
                gradient = -penalty * coefs[j]
                curvature = penalty
                for row, _, future in training:
                    x = (1., row.age - 34, row.tier)[j]
                    prob = probability(coefs, row.age, row.tier)
                    gradient += x * ((future[horizon] > 0.) - prob)
                    curvature += x * x * prob * (1 - prob)
                step = gradient / curvature
                coefs[j] += step
                largest = max(largest, abs(step))
            if largest < 1e-9:
                break
        return coefs

    ages = (35, 38, 41, 44, 47, 50)
    anchors = {age: [] for age in ages}
    for horizon, base in enumerate((.61, .53)):
        coefs = fit(horizon)
        # Fix the role mix, weighted by the older cohort's starting surplus,
        # so different ages are compared at the same prior quality. A ratio to
        # age 35 preserves the attrition already included in the cohort estimate.
        def weighted_chance(age):
            return sum(current * probability(coefs, age, row.tier) for row, current, _ in older)
        for age in ages:
            anchors[age].append(round(base * weighted_chance(age) / weighted_chance(35), 3))
    print('\nLate QB age anchors trained on 2000–16 top-24 starters:', anchors)
    print('Training age 28+ and 40+ seasons:', len(training), sum(r.age >= 40 for r, _, _ in training))
    for low, high in ((34, 36), (37, 39), (40, 50)):
        group = [entry for entry in older if low <= entry[0].age <= high]
        total = sum(current for _, current, _ in group)
        ratios = [sum(future[h] for _, _, future in group) / total for h in (0, 1)]
        print(f'Training age {low}–{high}: {len(group)} seasons; retention', *(f'{r:.2f}' for r in ratios))
    for label, sample in [('35+', held_out), ('40+', [e for e in held_out if e[0].age >= 40]),
                          ('35+ excluding Brady', [e for e in held_out if e[0].player != '00-0019596'])]:
        errors = defaultdict(list)
        for row, current, future in sample:
            i = min((row.age - 35) // 3, len(ages) - 2)
            share = min(1., (row.age - ages[i]) / 3)
            curve = [a + share * (b - a) for a, b in zip(anchors[ages[i]], anchors[ages[i + 1]])]
            actual = (future[0] + .85 * future[1]) / 1.85
            for name, coefs in [('flat', anchors[35]), ('age', curve)]:
                prediction = current * (coefs[0] + .85 * coefs[1]) / 1.85
                errors[name].append(prediction - actual)
        print(label, f'{len(sample)} seasons, {len({r.player for r, _, _ in sample})} QBs')
        for name in ('flat', 'age'):
            err = errors[name]
            print(f'  {name}: MAE {mean(map(abs, err)):.3f}, RMSE {mean(e*e for e in err)**.5:.3f}')


def rank_surplus(stats):
    # Use the same 12-team eligible-slot optimizer as the production build.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from dynasty_value import replacement_levels

    boards, scores = defaultdict(lambda: defaultdict(list)), {}
    for row in stats:
        year, pos = int(row['season']), row['position']
        if row['season_type'] != 'REG' or not 2000 <= year <= 2018 or pos not in CUTOFF:
            continue
        points = float(row['fantasy_points_ppr'] or 0.) * 17 / schedule_length(year)
        player = row['player_id']
        scores[player, year] = points
        boards[year][pos].append((points, player))

    limits = {}
    for year, positions in boards.items():
        populations = {pos: [points for points, _ in rows] for pos, rows in positions.items()}
        limits[year] = replacement_levels(populations)
    upper_ranks = (3, 6, 12, 18, 24, 30, 36, 48, 64, 96)
    buckets = defaultdict(list)
    for year in range(2000, 2017):
        for pos, rows in boards[year].items():
            ordered = sorted(rows, reverse=True)
            for rank, (_, player) in enumerate(ordered[:96], start=1):
                first, second = (max(0., scores.get((player, t), 0.) - limits[t][pos])
                                 for t in (year + 1, year + 2))
                bucket = next(end for end in upper_ranks if end >= rank)
                buckets[pos, bucket].append((first + .85 * second) / 1.85)
    print('\nExpected 17-game future surplus by prior positional rank (n, mean)')
    for pos in CUTOFF:
        print(pos, *(f'{len(buckets[pos, end])}: {mean(buckets[pos, end]):.1f}'
                     for end in upper_ranks))


def name_key(name):
    name = re.sub(r'\b(?:jr|sr|ii|iii|iv)\.?$', '', name.lower()).strip()
    return re.sub(r'[^a-z]', '', name)


def archived_forecasts(projections, stats, observations):
    # Match to the prior roster only. Future participation must not determine eligibility.
    names = {row['player_id']: name_key(row['player_display_name']) for row in stats
             if row['season_type'] == 'REG' and row['season'] == '2019'}
    candidates = defaultdict(list)
    weights = {'Receptions': 1, 'PassingYds': .04, 'PassingTD': 4, 'Int': -2, 'FL': -2,
               'RushingYds': .1, 'ReceivingYds': .1, 'RushingTD': 6, 'ReceivingTD': 6}
    for row in projections:
        points = sum(float(row[key].replace(',', '')) * weight for key, weight in weights.items())
        candidates[row['Pos'], name_key(row['Player'])].append(points / 16)
    errors = defaultdict(list)
    misses = 0
    for row in observations:
        if row.year != 2019:
            continue
        matching = candidates[row.position, names[row.player]]
        if len(matching) != 1:
            misses += 1
            continue
        for pos in ('All', row.position):
            errors[pos, 'repeat'].append(abs(row.current - row.future))
            errors[pos, 'preseason'].append(abs(matching[0] - row.future))
    print('\n2020 archived forecasts (n, repeat MAE, preseason MAE); unmatched:', misses)
    for pos in ('All', *CUTOFF):
        repeat = errors[pos, 'repeat']
        print(pos, len(repeat), f'{mean(repeat):.3f}', f"{mean(errors[pos, 'preseason']):.3f}")


def rookie_surplus(draft, bios, scores, cutoff_score):
    identifiers = {r['pfr_id']: r['gsis_id'] for r in bios if r['pfr_id'] and r['gsis_id']}
    cohorts = defaultdict(list)
    later_classes = []
    unidentified = 0
    for row in draft:
        year, pos = int(row['season']), row['position']
        if year not in range(2000, 2017) and year not in range(2019, 2023):
            continue
        if pos not in CUTOFF:
            continue
        player = row['gsis_id'] or identifiers.get(row['pfr_player_id'])
        if not player and row['games']:
            # An unmatched draftee with NFL appearances has unknown production.
            unidentified += 1
            continue
        round_group = min(int(row['round']), 4)
        outcomes = [max(0, scores.get((player, y), 0.) - cutoff_score[pos, y])
                    for y in range(year, year + 3)]
        if year <= 2016:
            cohorts[pos, round_group].append(outcomes)
        else:
            later_classes.append((pos, round_group, mean(outcomes[1:])))
    print('\nNFL draftees: mean PPR above cutoff per scheduled game, by career year')
    print('Unresolved identities excluded:', unidentified)
    for pos in CUTOFF:
        for group in range(1, 5):
            rows = cohorts[pos, group]
            print(pos, '4+' if group == 4 else group, len(rows),
                  *(f'{mean(column):.2f}' for column in zip(*rows)))

    # Validate exactly the quantity estimated by the means above: surplus in years 2–3.
    by_round = {key: mean(mean(row[1:]) for row in rows) for key, rows in cohorts.items()}
    by_pos = {pos: mean(mean(row[1:]) for (p, _), rows in cohorts.items() if p == pos
                        for row in rows) for pos in CUTOFF}
    errors = defaultdict(list)
    for pos, group, actual in later_classes:
        for segment in (pos, 'All'):
            errors[segment, 'position'].append((actual - by_pos[pos]) ** 2)
            errors[segment, 'round'].append((actual - by_round[pos, group]) ** 2)
    print('\n2019–22 classes: years 2–3 mean surplus RMSE (n, position only, position and round)')
    for pos in ('All', *CUTOFF):
        print(pos, len(errors[pos, 'round']),
              *(f'{mean(errors[pos, model]) ** .5:.3f}' for model in ('position', 'round')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path.home() / '.cache' / 'dynasty-production-evidence')
    cache = parser.parse_args().cache
    cache.mkdir(parents=True, exist_ok=True)
    stats, bios, draft, projections = [read_rows(source, cache) for source in SOURCES]
    scores, cutoff_score, observations = collect(stats, bios)
    compare_forecasts(observations, scores, cutoff_score)
    late_qb_retention(observations, scores, cutoff_score)
    rank_surplus(stats)
    archived_forecasts(projections, stats, observations)
    rookie_surplus(draft, bios, scores, cutoff_score)


if __name__ == '__main__':
    main()
