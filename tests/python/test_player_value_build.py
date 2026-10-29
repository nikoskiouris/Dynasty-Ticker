"""Builder rules that do not need a fresh nflverse download."""

from __future__ import annotations

import importlib.util
import json
import random
import re
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("player_values_build", ROOT / "player-values" / "build.py")
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


def _pool(qb_count):
    return {
        "QB": [float(qb_count - index) for index in range(qb_count)],
        "RB": [10.0] * 80,
        "WR": [9.0] * 100,
        "TE": [8.0] * 40,
    }


class PlayerValueBuildTests(unittest.TestCase):
    def test_later_pick_cannot_outbid_an_earlier_one(self):
        self.assertEqual(build.force_descending([10, 8, 9, 4]), [10, 8, 8, 4])
        self.assertEqual(build.force_descending([3, 10, 1]), [3, 3, 1])

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
        self.assertTrue(build.player_is_listable({"active": True, "status": "Active"}))
        self.assertFalse(build.played_recently(2022, 2026))
        self.assertTrue(build.played_recently(2025, 2026))
        self.assertTrue(build.played_recently(None, 2026))

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

    def test_top_finishes_lift_a_down_year_and_age_shrinks_that_lift(self):
        finishes = [
            {"season": 2022, "rank": 1, "ppg": 22.0},
            {"season": 2024, "rank": 2, "ppg": 19.0},
            {"season": 2021, "rank": 4, "ppg": 19.0},
        ]
        young, young_info = build.apply_resume(12.0, finishes, 22, 27, "WR", 2026, 5, {}, 80)
        old, _old_info = build.apply_resume(12.0, finishes, 22, 34, "WR", 2026, 5, {}, 80)
        hot, _hot_info = build.apply_resume(24.0, finishes, 22, 27, "WR", 2026, 5, {}, 80)
        self.assertGreater(young, 15)
        self.assertGreater(young, old)
        self.assertGreaterEqual(young_info["top5Finishes"], 3)
        self.assertEqual(hot, 24.0)

    def test_high_draft_pick_keeps_a_young_player_above_a_cold_stretch(self):
        anchors = {("WR", "top10"): 16.0, ("WR", "day3"): 8.0}
        high, high_info = build.apply_resume(10.0, [], 4, 24, "WR", 2026, 2, anchors, 20)
        late, _late_info = build.apply_resume(10.0, [], 180, 24, "WR", 2026, 2, anchors, 20)
        veteran, _veteran_info = build.apply_resume(10.0, [], 4, 32, "WR", 2026, 2, anchors, 20)
        self.assertGreater(high, 12)
        self.assertGreater(high, late)
        self.assertEqual(late, 10.0)
        self.assertEqual(veteran, 10.0)
        self.assertGreater(high_info["draftBlend"], 0)

    def test_one_top12_does_not_lock_a_veteran_role(self):
        developing = build.role_security({"experience": 2, "resume": {"top5Finishes": 0, "top12Finishes": 1}})
        two_finishes = build.role_security({"experience": 3, "resume": {"top5Finishes": 1, "top12Finishes": 2}})
        one_year = build.role_security({"experience": 4, "resume": {"top5Finishes": 0, "top12Finishes": 1}})
        rookie = build.role_security({"experience": 1, "resume": {"top5Finishes": 0, "top12Finishes": 0}})
        proven = build.role_security({"experience": 6, "resume": {"top5Finishes": 3, "top12Finishes": 4}})
        self.assertEqual(developing, 1.0)
        self.assertEqual(two_finishes, 1.0)
        self.assertLess(one_year, 1.0)
        self.assertLess(rookie, 1.0)
        self.assertEqual(proven, 1.0)

    def test_thin_old_age_keeps_the_last_measured_decline(self):
        retention = {("RB", 31, "elite"): [0.70] * 12}
        keep, _surv, _n, _total = build.transition("RB", 34, "elite", retention, {}, {})
        self.assertLess(keep, 0.85)
        self.assertGreater(keep, 0.55)

    def test_long_top5_run_outlasts_one_old_finish(self):
        long_run = [{"season": 2016 + index, "rank": 1, "ppg": 18.0} for index in range(8)]
        one_finish = [{"season": 2018, "rank": 3, "ppg": 17.0}]
        veteran, _info = build.apply_resume(11.0, long_run, 80, 36, "TE", 2026, 12, {}, 160)
        one_hit, _info = build.apply_resume(11.0, one_finish, 80, 34, "WR", 2026, 12, {}, 160)
        self.assertGreater(veteran, 13)
        self.assertGreater(veteran, one_hit)

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

    def test_holdout_freezes_replacement_at_the_training_cutoff(self):
        seen = {}
        real = build.learn_replacement

        def wrapped(rows, through):
            seen["through"] = through
            return {
                "sf": {position: 5.0 for position in build.POSITIONS},
                "oneQb": {position: 4.0 for position in build.POSITIONS},
            }

        build.learn_replacement = wrapped
        try:
            report = build.backtest({})
        finally:
            build.learn_replacement = real
        self.assertEqual(seen["through"], build.CONFIG["validationTrainingThrough"])
        self.assertEqual(report["replacementThrough"], build.CONFIG["validationTrainingThrough"])
        self.assertIn("replacement frozen", report["scope"])

    def test_half_ages_round_up_so_odd_halves_do_not_skip_a_year(self):
        self.assertEqual(build.age_bucket(29.5), 30)
        self.assertEqual(build.age_bucket(30.5), 31)
        self.assertEqual(build.age_bucket(31.5), 32)
        self.assertEqual(build.age_bucket(30.49), 30)

    def test_age_20_keep_rate_is_borrowed_by_the_next_thin_age(self):
        retention = {("RB", 20, "starter"): [0.80] * 12}
        keep, _surv, _n, _total = build.transition("RB", 21, "starter", retention, {}, {})
        self.assertAlmostEqual(keep, 0.80)

    def test_two_seasons_with_no_top12_stay_on_the_rookie_rate(self):
        rookie = build.role_security({"experience": 1, "resume": {"top5Finishes": 0, "top12Finishes": 0}})
        second_year = build.role_security({"experience": 2, "resume": {"top5Finishes": 0, "top12Finishes": 0}})
        veteran_blank = build.role_security({"experience": 3, "resume": {"top5Finishes": 0, "top12Finishes": 0}})
        one_finish = build.role_security({"experience": 2, "resume": {"top5Finishes": 0, "top12Finishes": 1}})
        self.assertEqual(second_year, rookie)
        self.assertLess(second_year, 1.0)
        self.assertLess(veteran_blank, second_year)
        self.assertEqual(one_finish, 1.0)

    def test_clamped_round1_any_cannot_sit_under_a_later_round(self):
        samples = {"sf": {}, "oneQb": {}}
        for fmt in samples:
            for slot in range(1, 61):
                samples[fmt][slot] = [90.0]
            for slot in range(1, 5):
                samples[fmt][slot] = [8.0]
        priced = build.pick_values(samples, 2026)
        for fmt in ("sf", "oneQb"):
            build._assert_pick_order(priced[fmt])
            self.assertGreaterEqual(priced[fmt]["pick:2027:r1:any"], priced[fmt]["pick:2027:r2:any"])
            self.assertGreaterEqual(priced[fmt]["pick:2027:r1:early"], priced[fmt]["pick:2032:r1:early"])

    def test_random_slot_samples_keep_pick_order(self):
        rng = random.Random(20261014)
        samples = {"sf": {}, "oneQb": {}}
        for fmt in samples:
            for slot in range(1, 61):
                samples[fmt][slot] = [float(rng.randint(1, 900)) for _ in range(rng.randint(1, 6))]
            samples[fmt][3] = [20.0, 800.0, 20.0]
            samples[fmt][15] = [900.0]
        priced = build.pick_values(samples, 2026)
        for fmt in ("sf", "oneQb"):
            build._assert_pick_order(priced[fmt])

    def test_superflex_pick_is_never_cheaper_than_the_same_1qb_pick(self):
        samples = {"sf": {}, "oneQb": {}}
        for slot in range(1, 61):
            samples["sf"][slot] = [float(600 - slot * 9)]
            samples["oneQb"][slot] = [float(640 - slot * 9)]
        priced = build.pick_values(samples, 2026)
        for asset_id, one_qb in priced["oneQb"].items():
            self.assertGreaterEqual(priced["sf"][asset_id], one_qb, asset_id)
        build._assert_pick_order(priced["sf"])


def _age_model(aging, survival=None, max_age=None):
    return {
        "aging": aging,
        "regression": {},
        "survival": survival or {},
        "maxAge": max_age or {},
    }


def _profile(**overrides):
    profile = {
        "position": "RB",
        "projectedPpg": 18.0,
        "availability": 1.0,
        "injuryMultiplier": 1.0,
        "age": 22.0,
        "experience": 1,
        "careerGames": 17,
        "draftPick": 6,
        "resume": {"top5Finishes": 0, "top12Finishes": 0},
    }
    profile.update(overrides)
    return profile


class AgingAndRookieTests(unittest.TestCase):
    replacement = {
        "sf": {"QB": 6.0, "RB": 4.0, "WR": 4.0, "TE": 4.0},
        "oneQb": {"QB": 13.0, "RB": 4.0, "WR": 4.0, "TE": 4.0},
    }

    def test_young_star_only_pays_the_role_haircut_and_regression_once(self):
        retention = {("RB", age, "elite"): [0.90] * 12 for age in range(20, 40)}
        flat = _age_model({("RB", age): 1.0 for age in range(21, 33)})
        _raw, forecast = build.career_value(
            _profile(), "sf", self.replacement, (retention, {}, {}, flat), current_week=1
        )
        year_one = forecast[1]["ppg"]
        self.assertAlmostEqual(year_one, 18.0 * 0.90 * build.role_security(_profile()), places=2)
        for later in forecast[2:]:
            self.assertAlmostEqual(later["ppg"], year_one, places=2)

    def test_old_quarterback_cannot_gain_points_from_a_survivor_sample(self):
        retention = {("QB", 36, "elite"): [1.03] * 12}
        aging = {("QB", age): 1.0 for age in range(22, 31)}
        aging.update({("QB", 31): 0.98, ("QB", 32): 0.95})
        keep, _surv, _n, _total = build.transition("QB", 42, "elite", retention, {}, {}, _age_model(aging))
        self.assertLessEqual(keep, 0.95)

    def test_nobody_outlives_the_oldest_season_on_record(self):
        survival = {("QB", 38): (40, 50)}
        model = _age_model({("QB", 30): 1.0}, survival, {"QB": 45})
        _keep, at_45, _n, _total = build.transition("QB", 45, "elite", {}, {("QB", 45, "elite"): (3, 3)}, {}, model)
        _keep, at_40, _n, _total = build.transition("QB", 40, "elite", {}, {}, {}, model)
        _keep, at_38, _n, _total = build.transition("QB", 38, "elite", {}, {}, {}, model)
        self.assertEqual(at_45, 0.0)
        self.assertLess(at_40, at_38)
        self.assertAlmostEqual(at_38, 0.8)

    def test_age_curve_never_softens_after_the_peak(self):
        by_age = {}
        for age, change in {22: 0.10, 23: 0.06, 24: 0.0, 25: -0.05, 26: -0.08, 27: 0.04, 28: -0.10}.items():
            by_age[age] = [(0.0, change)] * 20
        factors = build._smoothed_age_factors(by_age, 0.0, 0.0)
        self.assertGreater(factors[22], 1.0)
        later = [factors[age] for age in range(25, 29)]
        self.assertEqual(later, sorted(later, reverse=True))
        self.assertLessEqual(max(later), 1.0)

    def test_unplayed_high_pick_is_priced_from_his_draft_slot(self):
        samples = {
            "sf": {("QB", "top10"): [400.0] * 3, ("QB", "round1"): [200.0] * 3, ("QB", "late"): [0.0] * 9},
            "oneQb": {},
        }
        weight, prior = build.rookie_prior(
            _profile(position="QB", experience=0, careerGames=0, draftPick=1), "sf", samples
        )
        self.assertEqual(weight, 1.0)
        self.assertEqual(prior, 300.0)
        weight, prior = build.rookie_prior(
            _profile(position="QB", experience=0, careerGames=1, draftPick=223), "sf", samples
        )
        self.assertGreater(weight, 0.8)
        self.assertEqual(prior, 0.0)

    def test_draft_slot_fades_once_a_player_has_a_track_record(self):
        samples = {"sf": {("WR", "top10"): [300.0] * 8}, "oneQb": {}}
        rookie, _ = build.rookie_prior(_profile(position="WR", experience=0, careerGames=5), "sf", samples)
        second, _ = build.rookie_prior(_profile(position="WR", experience=1, careerGames=22), "sf", samples)
        veteran, _ = build.rookie_prior(_profile(position="WR", experience=4, careerGames=60), "sf", samples)
        self.assertGreater(rookie, second)
        self.assertGreater(second, 0)
        self.assertEqual(veteran, 0)

    def test_thin_draft_range_borrows_its_neighbors_instead_of_pricing_zero(self):
        samples = {"sf": {("RB", "top10"): [500.0] * 2, ("RB", "round1"): [300.0] * 6}, "oneQb": {}}
        weight, prior = build.rookie_prior(_profile(experience=0, careerGames=0, draftPick=3), "sf", samples)
        self.assertEqual(weight, 1.0)
        self.assertGreater(prior, 0)


if __name__ == "__main__":
    unittest.main()
