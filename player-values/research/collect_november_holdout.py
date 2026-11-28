"""Reconstruct the disjoint November exchange sample from public Sleeper league data."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
from threading import Lock
from time import monotonic, sleep
from urllib.error import HTTPError, URLError

from market_packages import DIRECTORY, SLEEPER, exchange, league_eligible, milliseconds
from ranking_holdout import fetch

PRIOR_MANIFESTS = (
    'market-leagues-2026.txt', 'market-leagues-independent-2026.txt',
    'ktc-sleeper-leagues-20261128.txt', 'external-exchange-leagues-20261128.txt',
)
START = milliseconds('2026-11-01T00:00:00Z')
STOP = milliseconds('2026-11-28T00:00:00Z')


def priority(identifier):
    return sha256(('market-forward-2026-v1/' + identifier).encode()).digest()


def managers(rosters):
    owners = set()
    for roster in rosters:
        owners.update(roster.get('co_owners') or [])
        if roster.get('owner_id'):
            owners.add(roster['owner_id'])
    return owners


def collect(cache, output, confirmation=False):
    lock = Lock()
    last = 0.

    def request(url):
        nonlocal last
        cached = cache / (sha256(url.encode()).hexdigest()[:16] + '-' + url.rsplit('/', 1)[1])
        for attempt in range(4):
            if not cached.is_file():
                with lock:
                    sleep(max(last + .10 - monotonic(), 0))
                    last = monotonic()
            try:
                return json.loads(fetch(url, cache))
            except (HTTPError, URLError, TimeoutError) as exc:
                if attempt == 3 or isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                    raise
                sleep(2 ** attempt)

    prior = {key for name in PRIOR_MANIFESTS for key in (DIRECTORY / name).read_text().split()}
    with ThreadPoolExecutor(10) as workers:
        formats = workers.map(request, [SLEEPER + key for key in sorted(prior)])
        eligible_prior = [league['league_id'] for league in formats if league and league_eligible(league)]
        old_owners = set()
        for rosters in workers.map(request, [SLEEPER + key + '/rosters' for key in eligible_prior]):
            old_owners.update(managers(rosters or []))
        seed_order = sorted(old_owners, key=priority)
        seeds = seed_order[720:1440] if confirmation else seed_order[:720]
        prefix = 'november-confirmation' if confirmation else 'november-holdout'
        if confirmation:
            initial_panel = (DIRECTORY / 'november-holdout-leagues.txt').read_text().split()
            prior.update(initial_panel)
            for rosters in workers.map(request, [SLEEPER + key + '/rosters' for key in initial_panel]):
                old_owners.update(managers(rosters or []))
        new = set()
        for leagues in workers.map(request, ['https://api.sleeper.app/v1/user/' + u + '/leagues/nfl/2026' for u in seeds]):
            new.update(league['league_id'] for league in leagues or [] if league_eligible(league))
        new -= prior
        panel = sorted(new, key=priority)[:250]
        (output / f'{prefix}-leagues.txt').write_text('\n'.join(panel) + '\n')
        print(f'Fixed {len(panel)} new league IDs before collecting transactions.')
        allowed = {}
        for key, rosters in zip(panel, workers.map(request, [SLEEPER + key + '/rosters' for key in panel]), strict=True):
            allowed[key] = {r['roster_id'] for r in rosters if r.get('owner_id') and managers([r]).isdisjoint(old_owners)}

        keys = [(key, week) for key in panel for week in range(7, 13)]
        pages = workers.map(request, [f'{SLEEPER}{key}/transactions/{week}' for key, week in keys])
        deals = {}
        before_ids = set()
        for (league, week), records in zip(keys, pages, strict=True):
            for trade in records or []:
                if not START <= trade['created'] <= trade['status_updated'] < STOP:
                    continue
                sides = exchange(trade)
                if not sides:
                    continue
                tid = trade['transaction_id']
                before_ids.add(tid)
                if not set(trade['roster_ids']) <= allowed[league]:
                    continue
                deals[tid] = dict(transaction=tid, league=league, week=week, proposed=trade['created'],
                                  accepted=trade['status_updated'], sides=sides)
    rows = sorted(deals.values(), key=lambda row: (row['proposed'], row['transaction']))
    (output / f'{prefix}-trades.json').write_text(json.dumps(rows, separators=(',', ':')))
    print(f'{len(eligible_prior)} eligible prior leagues, {len(old_owners)} excluded prior managers, '
          f'{len(before_ids)} eligible transactions, {len(rows)} retained.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--confirmation', action='store_true', help='Use the second seed group and exclude the initial holdout')
    args = parser.parse_args()
    for path in (args.cache_dir, args.output_dir):
        path.mkdir(parents=True, exist_ok=True)
    collect(args.cache_dir, args.output_dir, args.confirmation)
