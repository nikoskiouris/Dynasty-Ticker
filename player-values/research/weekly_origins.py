"""Reconstruct the preseason and eleven weekly 2026 football forecasts from pre-cutoff public Git archives.

Run from the repository root:
PYTHONPATH=player-values python player-values/research/weekly_origins.py --output /tmp/football.json --cache-dir /tmp/football-cache

Each output key is the earliest time at which a replay may use its forecast. Market quotes
are joined separately by proposal time. The archive contains the current week's Sleeper
projection, and for Week 12 also the next week's. The football model fills unobserved
weeks from its scoring-rate estimate. The season prior comes from August FantasyPros.
"""
import argparse
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path

from dynasty_calibration import calibrated_football
from dynasty_value import raw_board
from preseason_trade_fit import preseason_projections
from ranking_holdout import RAW_GITHUB, POSITIONS, csv_rows, fetch, historical_player, normalized

STATS_REPO = 'antonwilms/sleeper-dashboard-data'
PROJECTION_REPO = 'jangelpicon/settlers-of-the-gridiron'
# Birth dates, draft picks and identifying crosswalk from August 21. Later player
# name corrections and newly added IDs must not change a historical projection.
CROSSWALK = RAW_GITHUB + 'dynastyprocess/data/bc68538c8ccb6d1cc164a78389973f3d4ae7eccb/files/db_playerids.csv'
# At each Wednesday 20:00 UTC, pin the last commit of each public repository.
# Each row names the stats/registry and projections commits, in that order.
SOURCES = (
    (2, "49cd3490b131495f92c28da3af2a32573bc8c0f6", "2026-09-16T19:41:33Z",
        "6dde24b22428181a18eda0b403a7d0ef0c203a2f", "2026-09-16T19:22:59Z"),
    (3, "7491e4cc24a138206068a33451b3f5a2305ac3de", "2026-09-23T19:48:01Z",
        "90519d4dc63b3e53a082803701252888b17fab5b", "2026-09-23T02:42:58Z"),
    (4, "46d3e42a87f60b39556cae5a7c073532f9576232", "2026-09-30T18:28:37Z",
        "f9a9628db8095585307d8abe3c0e6ce5781b4b03", "2026-09-30T15:39:15Z"),
    (5, "cde2d06fdc6fef2fc4aff6ca32c90432f0639fd4", "2026-10-07T19:24:06Z",
        "66725fb927914c685a163e7d826ef6bc2b98e395", "2026-10-07T15:32:41Z"),
    (6, "e97799fd3212c2cb1769a1db18bb8463ce61a06c", "2026-10-14T18:04:09Z",
        "f19b6fca72b9a40cf1fffe2320cb383a03440082", "2026-10-14T07:01:01Z"),
    (7, "c5e3d9882176bd1bcd875aba36c4b42e8fce1b2f", "2026-10-21T18:07:53Z",
        "108ac3db924f3167abcaefae9c09ceea2dc16f33", "2026-10-21T18:45:09Z"),
    (8, "154cdb5d14d50337af4b02608a34b130187bc41e", "2026-10-28T18:56:02Z",
        "d763f985c6dcf1dfc59eee3f9df631ddb07e0ead", "2026-10-28T07:00:58Z"),
    (9, "ee2fdbf450bfff1cb764b376b7125d05a81a009c", "2026-11-03T21:56:47Z",
        "7d937d406ca28d1db320203f6bb33e6e716bfc84", "2026-11-04T15:24:28Z"),
    (10, "dfbb353e313dc583007ba28fef65ad6fb2814eae", "2026-11-11T14:35:26Z",
        "c00aafdb290e8a8bb939e1dc83366e4ccf68a9e5", "2026-11-11T14:50:35Z"),
    (11, "b6888f99b9a860ccf13dc7ad14e13c5304ed84b8", "2026-11-18T15:50:28Z",
        "1a0d13cad6490e389caec31e0a1b6dbb049a48f1", "2026-11-18T08:02:59Z"),
    (12, "8c25682c1f2b4b679ed72247c2bc810546864492", "2026-11-25T17:27:03Z",
        "cdf1e5df14ae7e53cda116bd76755892653f85f3", "2026-11-25T08:03:41Z"),
)


def source_json(repo, sha, path, cache):
    return json.loads(fetch(f'{RAW_GITHUB}{repo}/{sha}/{path}', cache))


def team_abbreviation(team):
    return {'LA': 'LAR', 'JAC': 'JAX', 'WSH': 'WAS'}.get(team, team)


def points_and_games(record):
    stats = record.get('stats', {})
    appearances = stats.get('gp') or record.get('gamesPlayed') or 0
    return (stats.get('pts_ppr', 0) if appearances else None), appearances


def preseason_inputs(cache):
    bios = {}
    name_ids = defaultdict(list)
    for bio in csv_rows(CROSSWALK, cache):
        pid, pos = bio['sleeper_id'], bio['position']
        if pid.isdigit() and pos in POSITIONS:
            bios[pid] = historical_player(2026, pos, None, bio, None)
            name_ids[(normalized(bio['name']), pos)].append(pid)
    return bios, {(normalized(name), pos): pts for name, pos, pts, _ in preseason_projections(cache)}, name_ids


def schedule_by_team(schedule, week):
    weeks = defaultdict(set)
    for game in schedule['games']:
        if game['gameType'] == 'REG':
            for team in (game['homeTeam'], game['awayTeam']):
                weeks[team_abbreviation(team)].add(game['week'])
    if len(weeks) != 32 or any(len(games) != 17 for games in weeks.values()):
        raise ValueError(f'Incomplete NFL schedule for week {week}')
    return weeks


def registry_matches(registry, preseason):
    _, season_forecasts, name_ids = preseason
    # Strict name+position match; ignore ambiguous players in either source.
    names = defaultdict(list)
    for pid, info in registry.items():
        names[(normalized(info['name']), info['position'])].append(pid)
    season_by_id = {}
    for key, points in season_forecasts.items():
        ids = names.get(key) or name_ids.get(key, [])
        if len(ids) == 1:
            season_by_id[ids[0]] = points

    return names, season_by_id


def player_inputs(week, when, files, preseason, totals_by_week, use_espn_remaining):
    bios, _, _ = preseason
    registry, totals = files['registry']['players'], files['totals']
    projections = files['projection']
    weeks = schedule_by_team(files['schedule'], week)
    names, season_by_id = registry_matches(registry, preseason)
    projections_by_id = {}
    projection_rows = defaultdict(list)
    for pr in projections['players'].values():
        projection_rows[(normalized(pr['name']), pr['pos'])].append(pr)
    for key, matches in projection_rows.items():
        ids = names.get(key, [])
        if len(ids) == len(matches) == 1:
            projections_by_id[ids[0]] = matches[0]
    rows = {}
    elapsed = (when.date() - date(2026, 9, 1)).days / 365.2425
    for pid in sorted(set(registry) | set(season_by_id)):
        info, base = registry.get(pid, {}), bios.get(pid, {})
        pos = info.get('position') or base.get('pos')
        if pos not in POSITIONS:
            continue
        current, pr = totals.get(pid, {}), projections_by_id.get(pid, {})
        # Use the matching on-week observation before the older registry.
        team = team_abbreviation(pr.get('team') or info.get('team') or current.get('team'))
        club_weeks = weeks.get(team, set())
        if not club_weeks:
            team = None
        completed = sorted(w for w in club_weeks if w < week)
        open_game = week in club_weeks
        forward = []
        if open_game and pr.get('sleeper') is not None:
            forward.append(pr['sleeper'])
        if (week + 1 in club_weeks and projections.get('nextWeek') == week + 1
                and pr.get('sleeperNext') is not None):
            forward.append(pr['sleeperNext'])
        forward_games = len(forward)
        forward_total = sum(forward) if forward else None
        if use_espn_remaining and club_weeks and pr.get('espnSeason') is not None:
            # The dated ESPN league-defaults/3 feed uses four-point passing TDs
            # and full PPR. Its period-zero live projection covers remaining games.
            forward_games = len(club_weeks) - len(completed)
            forward_total = max(0.0, pr['espnSeason'])
        points, games = points_and_games(current)
        previous, prior_games = points_and_games(files['prior'].get(pid, {}))
        # Older archives kept only half-PPR weekly lines. Difference full-PPR
        # season totals across four club games when both boundaries are known.
        recent = completed[-4:]
        old = totals_by_week.get(recent[0], {}).get(pid, {}) if recent else {}
        has_recent = (recent and (recent[0] == 1 or recent[0] in totals_by_week)
                      and games and team == team_abbreviation(current.get('team'))
                      and (not old or team == team_abbreviation(old.get('team'))))
        previous_points, previous_games = points_and_games(old)
        injury_map = {'ACT': None, 'IR': 'IR', 'O': 'Out', 'D': 'Doubtful', 'Q': 'Questionable'}
        injury = injury_map.get(pr.get('injS', pr.get('injE')), info.get('injuryStatus'))
        rows[pid] = dict(base, pos=pos, age=base['age'] + elapsed if base.get('age') else None,
                         team=team, actual_ppr=points, games=games, season_ppr=season_by_id.get(pid),
                         week_ppr=pr.get('sleeper') if open_game else None, current_week_open=open_game,
                         forward_games=forward_games, forward_ppr=forward_total,
                         injury_status=injury, remaining_games=17 - len(completed) if team else None,
                         team_games=len(completed) if team else None,
                         recent_ppr=round(points - (previous_points or 0), 2) if has_recent else None,
                         recent_games=games - previous_games if has_recent else None,
                         recent_team_games=len(recent) if has_recent else None,
                         last_games=prior_games, last_ppr=previous)
    return rows


def football_evidence(rows, week):
    raw, context = raw_board(rows, season_week=week)
    out = {}
    for pid, record in raw.items():
        coverage = record['coverage']
        row = rows[pid]
        if not coverage or (set(coverage) == {'recentTeamGames'} and not row.get('recent_games')):
            continue
        projected = sum(record[k] for k in ('lineup', 'future', 'draft'))
        out[pid] = {'footballSurplus': calibrated_football(projected), 'position': row['pos'],
                    'age': row.get('age'), 'experience': row.get('years_exp'), 'coverage': coverage}
    return {'week': week, 'remainingFraction': context['remainingSeasonFraction'], 'players': out}


def reconstruct(cache, normalized_path=None, use_espn_remaining=False):
    preseason = preseason_inputs(cache)
    boards, normalized_boards, totals_by_week = {}, {}, {}
    # Both the Aug 24 season projection and this Aug 25 roster/2025 stat commit
    # preceded the Aug 26 quote used by the preseason replay.
    august_revision = 'e38cd8342941edfaffd0f6a131cef136c1a53dc3'
    august = '2026-08-26T07:58:34Z'
    registry = source_json(STATS_REPO, august_revision, 'nfl/players-state/2026-08-22.json', cache)
    captured_at = datetime.fromisoformat(registry['capturedAt'].replace('Z', '+00:00'))
    if captured_at >= datetime.fromisoformat(august.replace('Z', '+00:00')):
        raise ValueError('Preseason registry postdates the August origin')
    prior = source_json(STATS_REPO, august_revision, 'nfl/season-totals/2025.json', cache)
    _, season_by_id = registry_matches(registry['players'], preseason)
    raw_august = {}
    for pid in sorted(set(registry['players']) | set(season_by_id)):
        base = preseason[0].get(pid, {})
        info = registry['players'].get(pid, {})
        pos = info.get('position') or base.get('pos')
        if pos not in POSITIONS:
            continue
        last_points, last_games = points_and_games(prior.get(pid, {}))
        raw_august[pid] = dict(base, pos=pos, team=team_abbreviation(info.get('team')),
                               season_ppr=season_by_id.get(pid), last_games=last_games,
                               last_ppr=last_points, injury_status=info.get('injuryStatus'))
    boards[august] = football_evidence(raw_august, 1)
    if normalized_path:
        normalized_boards[august] = {'week': 1, 'players': raw_august}
    for week, stats_sha, stats_time, proj_sha, proj_time in SOURCES:
        when = datetime(2026, 9, 16, 20, tzinfo=timezone.utc) + timedelta(weeks=week - 2)
        if any(datetime.fromisoformat(s.replace('Z', '+00:00')) >= when for s in (stats_time, proj_time)):
            raise ValueError(f'Source commit postdates Week {week} cutoff')
        registry_date = (when - timedelta(days=4)).date()
        paths = {'registry': f'nfl/players-state/{registry_date}.json', 'totals': 'nfl/season-totals/2026.json',
                 'prior': 'nfl/season-totals/2025.json', 'schedule': 'nflverse/schedule/2026.json'}
        files = {name: source_json(STATS_REPO, stats_sha, path, cache) for name, path in paths.items()}
        projections = source_json(PROJECTION_REPO, proj_sha, 'data/projections.json', cache)
        files['projection'] = projections
        totals = files['totals']
        last_week = max(int(w) for r in totals.values() for w in (r.get('weeklyPoints') or {}))
        registry_time = datetime.fromisoformat(files['registry']['capturedAt'].replace('Z', '+00:00'))
        if (last_week != week - 1 or projections['week'] != week or projections['season'] != 2026
                or projections['generatedMs'] / 1000 >= when.timestamp() or registry_time >= when
                or any(datetime.fromisoformat(g['kick'].replace('Z', '+00:00')) <= when
                       for g in projections['games'].values() if g.get('kick'))):
            raise ValueError(f'Mistimed football inputs for Week {week}')
        totals_by_week[week] = totals
        rows = player_inputs(week, when, files, preseason, totals_by_week, use_espn_remaining)
        stamp = when.isoformat().replace('+00:00', 'Z')
        boards[stamp] = football_evidence(rows, week)
        if normalized_path:
            normalized_boards[stamp] = {'week': week, 'players': rows}
    if normalized_path:
        normalized_path.write_text(json.dumps(normalized_boards, separators=(',', ':')))
    return boards


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--espn-remaining', action='store_true',
                        help='Sensitivity check using archived ESPN remaining-season PPR where available')
    parser.add_argument('--normalized-inputs', type=Path, help='Save underlying cutoff observations for audit')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    origin_boards = reconstruct(args.cache_dir, args.normalized_inputs, args.espn_remaining)
    args.output.write_text(json.dumps(origin_boards, separators=(',', ':')))
    for timestamp, board in origin_boards.items():
        print(f"{timestamp}: {len(board['players'])} players with football evidence")
