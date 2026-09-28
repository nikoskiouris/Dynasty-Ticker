"""Builder rules that do not need a fresh nflverse download."""

from __future__ import annotations

import importlib.util
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


if __name__ == "__main__":
    unittest.main()
