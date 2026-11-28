"""Discover a disjoint validation panel from managers in the public KTC league list."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from threading import Lock
from time import monotonic, sleep
from urllib.error import HTTPError, URLError

from market_packages import DIRECTORY, SLEEPER, league_eligible
from ranking_holdout import fetch


def hash_order(key):
    return hashlib.sha256(key.encode()).digest()


def discover(cache, limit):
    seeds = (DIRECTORY / 'ktc-sleeper-leagues-20261128.txt').read_text().splitlines()
    prior = set(seeds)
    for name in ('market-leagues-2026.txt', 'market-leagues-independent-2026.txt'):
        prior.update((DIRECTORY / name).read_text().splitlines())
    lock = Lock()
    last = 0

    def request(url):
        nonlocal last
        cached = cache / (hashlib.sha256(url.encode()).hexdigest()[:16] + '-' + url.rsplit('/', 1)[1])
        if cached.is_file():
            return json.loads(cached.read_bytes())
        for attempt in range(4):
            with lock:
                sleep(max(0, last + .10 - monotonic()))
                last = monotonic()
            try:
                return json.loads(fetch(url, cache))
            except (HTTPError, URLError, TimeoutError) as err:
                retryable = not isinstance(err, HTTPError) or err.code in (429, 500, 502, 503, 504)
                if attempt == 3 or not retryable:
                    raise
                sleep(2 ** attempt)

    with ThreadPoolExecutor(6) as workers:
        def load_seed(key):
            league = request(SLEEPER + key)
            if not league:
                return None, set()
            users = request(SLEEPER + key + '/users')
            return league, {u['user_id'] for u in users or [] if u.get('user_id')}

        managers, excluded_users = set(), set()
        for league, users in workers.map(load_seed, seeds):
            if users:
                managers.update(sorted(users, key=hash_order)[:7])
                if league_eligible(league):
                    excluded_users.update(users)
        print(f'{len(managers)} unique discovery users; {len(excluded_users)} users of eligible seed leagues excluded', flush=True)
        candidates = set()
        for leagues in workers.map(request, ('https://api.sleeper.app/v1/user/' + u + '/leagues/nfl/2026'
                                             for u in sorted(managers - excluded_users))):
            candidates.update(row['league_id'] for row in leagues or [] if league_eligible(row))
        candidates -= prior
        ordered = sorted(candidates, key=hash_order)
        print(f'{len(ordered)} eligible new league IDs before checking full membership', flush=True)
        selected = []
        for start in range(0, len(ordered), 12):
            batch = ordered[start:start + 12]
            for key, users in zip(batch, workers.map(request, (SLEEPER + k + '/users' for k in batch)), strict=True):
                if users and not any(u.get('user_id') in excluded_users for u in users):
                    selected.append(key)
                    if len(selected) == limit:
                        return selected
        return selected


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=120)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    panel = discover(args.cache_dir, args.limit)
    args.output.write_text('\n'.join(panel) + '\n')
    print(f'{len(panel)} selected')
