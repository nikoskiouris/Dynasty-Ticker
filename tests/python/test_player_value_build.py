"""Builder rules that do not need a fresh nflverse download."""

from __future__ import annotations

import json
import random
import re
import tempfile
import unittest
from pathlib import Path


from synthetic_league import build, forecast

ROOT = Path(__file__).resolve().parents[2]


def _pool(qb_count):
    return {
        "QB": [float(qb_count - index) for index in range(qb_count)],
        "RB": [10.0] * 80,
        "WR": [9.0] * 100,
        "TE": [8.0] * 40,
    }


class PlayerValueBuildTests(unittest.TestCase):
    def test_one_qb_leaves_a_real_quarterback_outside_the_cap(self):
        allocated = build.allocate_reference_league(_pool(30), "oneQb")
        self.assertIsNotNone(allocated)
        self.assertEqual(allocated["QB"], 6)

    def test_superflex_uses_the_last_rostered_quarterback_when_the_pool_is_short(self):
        allocated = build.allocate_reference_league(_pool(7), "sf")
        self.assertIsNotNone(allocated)
        self.assertEqual(allocated["QB"], 1)
        self.assertGreater(allocated["QB"], 0)

    def test_superflex_replacement_is_scarcer_than_one_qb(self):
        one_qb = build.allocate_reference_league(_pool(30), "oneQb")
        superflex = build.allocate_reference_league(_pool(30), "sf")
        self.assertLess(superflex["QB"], one_qb["QB"])

    def test_same_name_at_another_position_does_not_block_a_skill_player(self):
        identity = build.build_identity_index({
            "00-0036322": {"espn_id": "4262921", "display_name": "Justin Jefferson", "position": "WR"},
            "00-0041075": {"espn_id": "5150249", "display_name": "Justin Jefferson", "position": "LB"},
            "00-0040718": {"display_name": "Travis Hunter", "position": "CB"},
            "00-0038134": {"display_name": "Kenneth Walker III", "position": "RB"},
        })
        pid, how = build.resolve_nfl_id(
            {"espn_id": 4262921, "full_name": "Justin Jefferson", "position": "WR"},
            identity,
            "WR",
        )
        self.assertEqual((pid, how), ("00-0036322", "espn"))
        pid, how = build.resolve_nfl_id(
            {"full_name": "Travis Hunter", "position": "DB", "fantasy_positions": ["DB", "WR"]},
            identity,
            "WR",
        )
        self.assertEqual((pid, how), ("00-0040718", "name"))
        pid, how = build.resolve_nfl_id({"full_name": "Kenneth Walker", "position": "RB"}, identity, "RB")
        self.assertEqual((pid, how), ("00-0038134", "name-position"))

    def test_slim_player_keeps_only_desk_fields(self):
        record = build.slim_nfl_player({
            "player_id": "6794",
            "full_name": "Justin Jefferson",
            "first_name": "Justin",
            "last_name": "Jefferson",
            "position": "WR",
            "team": "MIN",
            "age": 27,
            "fantasy_positions": ["WR"],
            "injury_status": "Questionable",
            "search_rank": 1,
            "metadata": {"rookie_year": 2020, "channel_id": "nope"},
        }, "6794")
        self.assertEqual(record["full_name"], "Justin Jefferson")
        self.assertEqual(record["position"], "WR")
        self.assertEqual(record["team"], "MIN")
        self.assertNotIn("search_rank", record)
        self.assertEqual(record["metadata"], {"rookie_year": 2020})
        self.assertIsNone(build.slim_nfl_player({
            "player_id": "1",
            "full_name": "Some Linebacker",
            "position": "LB",
            "fantasy_positions": ["LB"],
        }, "1"))

    def test_slim_file_bytes_do_not_change_when_the_input_order_does(self):
        sleeper = {
            "20": {
                "player_id": "20",
                "full_name": "Amon-Ra St. Brown",
                "position": "WR",
                "team": "DET",
                "age": 25,
                "status": "Active",
                "years_exp": 5,
            },
            "3": {
                "player_id": "3",
                "full_name": "No Team Yet",
                "position": "RB",
                "status": "Active",
                "years_exp": 1,
            },
        }
        flipped = {"3": sleeper["3"], "20": sleeper["20"]}
        teams = {"3": "SEA"}
        with tempfile.TemporaryDirectory() as tmp:
            first = Path(tmp) / "a.json"
            second = Path(tmp) / "b.json"
            build.write_slim_players(sleeper, output=first, teams_by_id=teams)
            build.write_slim_players(flipped, output=second, teams_by_id=dict(reversed(list(teams.items()))))
            self.assertEqual(first.read_bytes(), second.read_bytes())
            text = first.read_text(encoding="utf-8")
            self.assertNotIn("asOf", text)
            self.assertNotIn("generatedAt", text)
            self.assertIsNone(re.search(r"\d{4}-\d{2}-\d{2}T", text))
            payload = json.loads(text)
            self.assertEqual(list(payload["players"]), ["20", "3"])
            self.assertEqual(payload["players"]["3"][2], "SEA")

    def test_shipped_slim_file_covers_priced_players_without_a_clock(self):
        # Shipped file is 140744 bytes. 180KB leaves room for a season of
        # call-ups and still rejects the old ~900KB object dump.
        cap = 180_000
        path = ROOT / "docs" / "data" / "nfl_players_slim.json"
        raw = path.read_bytes()
        self.assertLess(len(raw), cap, f"slim file is {len(raw)} bytes")
        self.assertIsNone(re.search(r"\d{4}-\d{2}-\d{2}T", raw.decode("utf-8")))
        payload = json.loads(raw)
        self.assertEqual(sorted(payload), ["fields", "players", "source"])
        self.assertEqual(
            payload["fields"],
            ["full_name", "position", "team", "age", "injury_status", "status", "years_exp"],
        )
        name_at = payload["fields"].index("full_name")
        position_at = payload["fields"].index("position")
        team_at = payload["fields"].index("team")
        values = json.loads((ROOT / "docs" / "data" / "player_values.json").read_text(encoding="utf-8"))
        missing = []
        for asset_id, info in (values.get("players") or {}).items():
            if not str(asset_id).startswith("player:"):
                continue
            player_id = str(asset_id).split(":", 1)[1]
            row = payload["players"].get(player_id)
            published_team = str((info or {}).get("team") or "").strip()
            if (
                not isinstance(row, list)
                or not str(row[name_at] or "").strip()
                or not str(row[position_at] or "").strip()
                or (published_team and not str(row[team_at] or "").strip())
            ):
                missing.append(player_id)
        self.assertEqual(missing, [])

    def test_partial_sleeper_clock_does_not_wipe_the_season(self):
        self.assertEqual(build.resolve_nfl_clock({"season": "2026", "week": 6}), (2026, 6))
        self.assertEqual(
            build.resolve_nfl_clock({"season": "2026", "season_type": "regular", "week": 6}),
            (2026, 6),
        )
        self.assertEqual(
            build.resolve_nfl_clock({"season": "2026", "season_type": "off", "week": 6}),
            (2026, 1),
        )
        self.assertEqual(
            build.resolve_nfl_clock({"season": "2026", "season_type": "post", "week": 2}),
            (2026, 19),
        )
        with self.assertRaises(RuntimeError):
            build.resolve_nfl_clock({})
        with self.assertRaises(RuntimeError):
            build.resolve_nfl_clock({"season": "2026"})
        with self.assertRaises(RuntimeError):
            build.resolve_nfl_clock({"season": "2026", "season_type": "regular"})

    def test_short_upstream_body_does_not_truncate_the_cache(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sleeper_state.json"
            path.write_text('{"season":"2026","season_type":"regular","week":6}', encoding="utf-8")
            before = path.read_bytes()
            with self.assertRaises(RuntimeError):
                build.cache_payload(path, b"{}")
            self.assertEqual(path.read_bytes(), before)
            build.cache_payload(path, b'{"season":"2026","season_type":"regular","week":7}')
            self.assertIn(b"week\":7", path.read_bytes())

    def test_inactive_and_stale_players_are_not_listable(self):
        self.assertFalse(build.player_is_listable({"active": False, "status": "Active"}))
        self.assertFalse(build.player_is_listable({"active": True, "status": "Inactive"}))
        self.assertFalse(build.player_is_listable({"active": True, "status": "Inactive", "team": ""}))
        self.assertFalse(build.player_is_listable({"active": False, "status": "Retired", "team": "NO"}))
        self.assertTrue(build.player_is_listable({"active": True, "status": "Active"}))
        self.assertFalse(build.played_recently(2022, 2026))
        self.assertTrue(build.played_recently(2025, 2026))
        self.assertTrue(build.played_recently(None, 2026))

    def test_rostered_reserve_list_players_stay_listable(self):
        # Sleeper's record for an IR player: status "Inactive", injury "IR", still on a team.
        etienne = {
            "full_name": "Travis Etienne Jr.",
            "position": "RB",
            "team": "NO",
            "active": True,
            "status": "Inactive",
            "injury_status": "IR",
        }
        self.assertTrue(build.player_is_listable(etienne))
        for suffixed in ("Michael Pittman Jr.", "Calvin Austin III", "Chris Brazzell II"):
            self.assertTrue(build.player_is_listable({**etienne, "full_name": suffixed}))
        self.assertTrue(build.player_is_listable({**etienne, "status": "Reserve/Did_Not_Report"}))

    def test_two_way_receiving_charts_as_a_receiver(self):
        self.assertEqual(build.chart_position({"position": "CB", "targets": 8, "carries": 0}), "WR")
        self.assertEqual(
            build.chart_position({"position": "CB", "targets": 0, "carries": 0, "def_tackles_solo": 8}),
            "",
        )
        self.assertEqual(
            build.offensive_position({"position": "DB", "fantasy_positions": ["DB", "WR"]}),
            "WR",
        )

    def test_recent_name_breaks_a_retired_namesake(self):
        identity = build.build_identity_index({
            "00-0007024": {"display_name": "Marvin Harrison", "position": "WR"},
            "00-0039849": {"display_name": "Marvin Harrison Jr.", "position": "WR"},
        })
        pid, how = build.resolve_nfl_id(
            {"full_name": "Marvin Harrison", "position": "WR"},
            identity,
            "WR",
            active_pids={"00-0039849"},
        )
        self.assertEqual((pid, how), ("00-0039849", "name-recent"))

    def test_short_slump_does_not_erase_a_season_of_work(self):
        slump = [{"opportunities": 10}] * 30 + [{"opportunities": 2}] * 4
        lost_season = [{"opportunities": 10}] * 17 + [{"opportunities": 3}] * 17
        slump_opp, _trend = build.smoothed_role(slump)
        lost_opp, _trend = build.smoothed_role(lost_season)
        self.assertGreater(slump_opp, 7.5)
        self.assertLess(lost_opp, slump_opp)
        self.assertGreaterEqual(build.CONFIG["opportunityHalfLifeGames"], 17)
        self.assertLessEqual(build.CONFIG["roleTrendWeight"], 0.2)

    def test_points_ignore_defense_and_return_scores(self):
        row = {
            "fantasy_points_ppr": 21.3,
            "special_teams_tds": 1,
            "def_tackles_solo": 4,
            "def_sacks": 1,
            "def_interceptions": 1,
            "receptions": 6,
            "receiving_yards": 33,
        }
        self.assertAlmostEqual(build.ppr(row), 9.3)
        self.assertAlmostEqual(build.ppr({"fantasy_points_ppr": 12, "special_teams_tds": 2}), 0.0)


def _world(rookie_year):
    return {"rookieYear": rookie_year, "season": 2026}


def _inputs(weekly, meta, week=10):
    return {"weekly": weekly, "meta": meta, "currentSeason": 2026, "currentWeek": week}


def _games(season, count, position="WR", points=12.0):
    return [
        {"season": season, "week": week, "position": position, "team": "DET", "ppr": points,
         "opportunities": 8.0, "attempts": 0.0}
        for week in range(1, count + 1)
    ]


class IdentityTests(unittest.TestCase):
    """Sleeper and nflverse describe the same person, or the player is not priced off that record."""

    def test_a_namesake_born_decades_earlier_is_someone_else(self):
        identity = build.build_identity_index({
            "00-0008321": {"display_name": "Leon Johnson", "position": "RB", "birth_date": "1974-07-13"},
        })
        rookie = {"full_name": "Leon Johnson", "position": "WR", "birth_date": "2001-06-12"}
        self.assertEqual(build.resolve_nfl_id(rookie, identity, "WR"), ("", ""))
        # With no birthday to compare, the unique name still resolves.
        self.assertEqual(
            build.resolve_nfl_id({"full_name": "Leon Johnson", "position": "WR"}, identity, "WR"),
            ("00-0008321", "name"),
        )

    def test_a_birthday_typo_does_not_lose_the_player(self):
        identity = build.build_identity_index({
            "00-0040001": {"display_name": "Bhayshul Tuten", "position": "RB", "birth_date": "2002-02-14"},
        })
        sleeper = {"full_name": "Bhayshul Tuten", "position": "RB", "birth_date": "2003-02-14"}
        self.assertEqual(build.resolve_nfl_id(sleeper, identity, "RB"), ("00-0040001", "name-position"))

    def test_a_wrong_id_from_sleeper_does_not_hand_over_another_players_career(self):
        identity = build.build_identity_index({
            "00-0034270": {"display_name": "Tyler Conklin", "position": "TE", "birth_date": "1995-07-30"},
            "00-0034401": {"display_name": "Ryan Izzo", "position": "TE", "birth_date": "1995-12-21"},
        })
        izzo = {"full_name": "Ryan Izzo", "position": "TE", "birth_date": "1995-12-21", "gsis_id": "00-0034270"}
        conklin = {"full_name": "Tyler Conklin", "position": "TE", "birth_date": "1995-07-30"}
        self.assertEqual(build.resolve_nfl_id(izzo, identity, "TE"), ("00-0034401", "name-position"))
        self.assertEqual(build.resolve_nfl_id(conklin, identity, "TE"), ("00-0034270", "name-position"))

    def test_a_nickname_keeps_its_id_when_the_birthday_matches(self):
        identity = build.build_identity_index({
            "00-0035662": {"display_name": "Marquise Brown", "position": "WR", "birth_date": "1997-06-04"},
        })
        sleeper = {"full_name": "Hollywood Brown", "position": "WR", "birth_date": "1997-06-04", "gsis_id": "00-0035662"}
        self.assertEqual(build.resolve_nfl_id(sleeper, identity, "WR"), ("00-0035662", "gsis"))

    def test_two_players_with_one_name_are_told_apart_by_birthday(self):
        identity = build.build_identity_index({
            "00-0030001": {"display_name": "Mike Williams", "position": "WR", "birth_date": "1994-10-04"},
            "00-0030002": {"display_name": "Mike Williams", "position": "WR", "birth_date": "1995-03-01"},
        })
        sleeper = {"full_name": "Mike Williams", "position": "WR", "birth_date": "1994-10-04"}
        self.assertEqual(build.resolve_nfl_id(sleeper, identity, "WR"), ("00-0030001", "name-birth"))
        self.assertEqual(build.resolve_nfl_id({"full_name": "Mike Williams", "position": "WR"}, identity, "WR"), ("", ""))

    def test_a_verified_id_beats_a_name_when_two_records_claim_one_player(self):
        meta = {"00-0034270": {"display_name": "Tyler Conklin", "position": "TE", "birth_date": "1995-07-30"}}
        inputs = {
            "identity": build.build_identity_index(meta),
            "sleeper": {
                "5094": {"full_name": "Ryan Izzo", "position": "TE", "team": "NYJ", "active": True,
                         "birth_date": "1995-12-21", "gsis_id": "00-0034270"},
                "5133": {"full_name": "Tyler Conklin", "position": "TE", "team": "LAC", "active": True,
                         "birth_date": "1995-07-30"},
            },
        }
        chosen = build.choose_sleeper_players(inputs, set())
        self.assertEqual(list(chosen), ["00-0034270"])
        self.assertEqual(chosen["00-0034270"][3], "5133")


class PlayerFactsTests(unittest.TestCase):
    def test_age_comes_from_the_birthday_not_a_stale_whole_number(self):
        hill = {"age": 31, "birth_date": "1994-03-01"}
        self.assertAlmostEqual(build.player_age(hill, {"birth_date": "1994-03-01"}, 2026), 32.5, places=1)
        self.assertAlmostEqual(build.player_age(hill, {}, 2026), 32.5, places=1)
        # No birthday anywhere: a whole-number age means somewhere in that year.
        self.assertEqual(build.player_age({"age": 31}, {}, 2026), 31.5)
        self.assertIsNone(build.player_age({}, {}, 2026))

    def test_a_draftee_from_years_ago_who_never_played_is_not_a_rookie(self):
        coffee = {"full_name": "Glen Coffee", "position": "RB", "team": "SF", "years_exp": 1, "age": 30}
        meta = {"coffee": {"birth_date": "1987-05-01", "draft_year": "2009", "draft_pick": "74", "position": "RB"}}
        self.assertIsNone(build.current_profile("coffee", coffee, _inputs({}, meta), _world({"coffee": 2009})))

    def test_this_years_unplayed_pick_is_still_priced(self):
        rookie = {"full_name": "New Guy", "position": "WR", "team": "NYG", "years_exp": 0}
        meta = {"new": {"birth_date": "2004-04-01", "draft_year": "2026", "draft_pick": "8", "position": "WR"}}
        profile = build.current_profile("new", rookie, _inputs({}, meta), _world({"new": 2026}))
        self.assertEqual(profile["experience"], 0)
        self.assertEqual(profile["draftPick"], 8)
        self.assertEqual(profile["careerGames"], 0)
        self.assertIsNone(profile["availability"])
        self.assertAlmostEqual(profile["age"], 22.4, places=1)

    def test_a_player_with_no_game_since_the_season_before_last_is_left_out(self):
        vet = {"full_name": "Gone Guy", "position": "WR", "team": "", "years_exp": 9}
        weekly = {"gone": _games(2024, 12)}
        self.assertIsNone(build.current_profile("gone", vet, _inputs(weekly, {}), _world({"gone": 2017})))
        weekly = {"gone": _games(2025, 12)}
        self.assertIsNotNone(build.current_profile("gone", vet, _inputs(weekly, {}), _world({"gone": 2017})))

    def test_first_nfl_year_is_the_earliest_evidence_not_one_mislabeled_column(self):
        # nflverse lists the whole 2012 draft class with rookie_season 2013.
        meta = {
            "luck": {"draft_year": "2012", "rookie_season": "2013"},
            "udfa": {"rookie_season": "2019"},
            "early": {"rookie_season": "2021"},
        }
        weekly = {"early": _games(2020, 3)}
        years = forecast.rookie_years(meta, weekly)
        self.assertEqual(years, {"luck": 2012, "udfa": 2019, "early": 2020})

    def test_a_quarterback_cameo_is_not_a_start(self):
        starts = [
            {"season": 2025, "week": week, "position": "QB", "team": "DET", "ppr": 18.0,
             "opportunities": 34.0, "attempts": 31.0}
            for week in range(1, 10)
        ]
        cameos = [
            {"season": 2025, "week": week, "position": "QB", "team": "DET", "ppr": 0.4,
             "opportunities": 2.0, "attempts": 1.0}
            for week in range(10, 16)
        ]
        row = build.summaries({}, {"qb": starts + cameos})[("qb", 2025)]
        self.assertEqual(row["games"], 15)
        self.assertEqual(row["valueGames"], 9)
        self.assertAlmostEqual(row["valuePpg"], 18.0)
        advantage, pace, games = forecast.season_state(row, 10.0)
        self.assertAlmostEqual(advantage, 8.0 * 9)
        self.assertAlmostEqual(pace, 8.0 * 16)
        self.assertAlmostEqual(games, 9 / 16)
        # A receiver's games are just his games.
        wr = build.summaries({}, {"wr": _games(2025, 15)})[("wr", 2025)]
        self.assertEqual(wr["valueGames"], wr["games"])

    def test_a_backup_who_only_kneels_does_not_set_the_quarterback_replacement_line(self):
        weekly = {}
        for index in range(30):
            weekly[f"starter{index}"] = [
                {"season": 2025, "week": week, "position": "QB", "team": "X", "ppr": 22.0 - index * 0.4,
                 "opportunities": 35.0, "attempts": 32.0}
                for week in range(1, 15)
            ]
        for index in range(12):
            weekly[f"backup{index}"] = [
                {"season": 2025, "week": week, "position": "QB", "team": "X", "ppr": 0.3,
                 "opportunities": 1.0, "attempts": 0.0}
                for week in range(1, 12)
            ]
        for position, count, points in (("RB", 90, 14.0), ("WR", 120, 14.0), ("TE", 45, 10.0)):
            for index in range(count):
                weekly[f"{position}{index}"] = _games(2025, 14, position, max(1.0, points - index * 0.12))
        rows = build.summaries({}, weekly)
        line = build.ReplacementTable(rows).season(2025)
        # 30 real starters, fewer than the 36 a Superflex league rosters: the last starter is the line.
        self.assertAlmostEqual(line["sf"]["QB"], 22.0 - 29 * 0.4)
        self.assertGreater(line["sf"]["QB"], 5)
        self.assertLess(line["sf"]["QB"], line["oneQb"]["QB"])

    def test_the_replacement_line_only_looks_at_recent_seasons(self):
        table = build.ReplacementTable({})
        window = build.CONFIG["replacementSeasons"]
        for offset in range(window + 6):
            season = 2000 + offset
            table._pools[season]  # season exists
            level = 2.0 if offset < 6 else 4.0
            table._seasons[season] = {
                fmt: {position: level for position in build.POSITIONS} for fmt in ("sf", "oneQb")
            }
        latest = 2000 + window + 5
        self.assertEqual(table.through(latest)["sf"]["WR"], 4.0)
        self.assertEqual(table.through(2005)["sf"]["WR"], 2.0)


class ClockTests(unittest.TestCase):
    def test_a_season_sleeper_still_lists_as_off_after_it_ended_is_over_not_about_to_start(self):
        from datetime import date
        stale = {"season": "2026", "season_type": "off", "season_start_date": "2026-09-09"}
        self.assertEqual(build.resolve_nfl_clock(stale, date(2027, 2, 20)), (2026, 19))
        upcoming = {"season": "2027", "season_type": "off", "season_start_date": "2027-09-08"}
        self.assertEqual(build.resolve_nfl_clock(upcoming, date(2027, 3, 20)), (2027, 1))
        self.assertEqual(build.resolve_nfl_clock({"season": "2027", "season_type": "pre"}, date(2027, 8, 20)), (2027, 1))

    def test_prices_move_with_the_week_not_with_every_midnight(self):
        from datetime import date
        days = [build.pricing_date(date(2026, 11, day)) for day in range(10, 17)]
        self.assertEqual(set(days), {date(2026, 11, 10)})
        self.assertEqual(build.pricing_date(date(2026, 11, 17)), date(2026, 11, 17))
        self.assertEqual(build.pricing_date(date(2026, 11, 9)), date(2026, 11, 3))


if __name__ == "__main__":
    unittest.main()
