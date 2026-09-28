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
