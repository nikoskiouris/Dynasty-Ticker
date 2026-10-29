"""Property checks for pick order and the age-curve helpers that already hold."""

from __future__ import annotations

import importlib.util
import random
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("player_values_build", ROOT / "player-values" / "build.py")
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


class AlgoInvariantTests(unittest.TestCase):
    def test_force_descending_never_lets_a_later_slot_jump(self):
        rng = random.Random(20261014)
        for _ in range(40):
            values = [rng.uniform(0, 80) for _ in range(12)]
            ordered = build.force_descending(values)
            self.assertEqual(len(ordered), len(values))
            for earlier, later in zip(ordered, ordered[1:]):
                self.assertGreaterEqual(earlier, later)
            self.assertLessEqual(ordered[0], max(values[0], ordered[0]))
            self.assertEqual(ordered[0], values[0])

    def test_identical_production_does_not_gain_value_as_a_back_ages(self):
        retention = {}
        for age in range(21, 40):
            rate = 1.02 if age < 25 else max(0.72, 1.0 - 0.02 * (age - 25))
            retention[("RB", age, "elite")] = [rate] * 12
        age_model = {
            "aging": {(position, age): rates[0] for (position, age, _tier), rates in retention.items()},
            "regression": {},
            "survival": {},
            "maxAge": {},
        }
        replacement = {
            "sf": {"QB": 8, "RB": 6, "WR": 6, "TE": 5},
            "oneQb": {"QB": 14, "RB": 6, "WR": 6, "TE": 5},
        }

        def profile(age):
            return {
                "position": "RB",
                "projectedPpg": 18.0,
                "availability": 0.9,
                "age": age,
                "experience": 6,
                "resume": {"top5Finishes": 3, "top12Finishes": 4},
                "injuryMultiplier": 1.0,
            }

        previous = None
        for age in range(24, 36):
            total, _explanation = build.career_value(profile(age), "sf", replacement, (retention, {}, {}, age_model), 1)
            self.assertGreater(total, 0)
            if previous is not None:
                self.assertLessEqual(total, previous * 1.01)
            previous = total

    def test_a_quarterback_curve_declines_later_than_a_running_back_curve(self):
        def table(position, drop_age):
            retention = {}
            for age in range(21, 40):
                rate = 1.01 if age < drop_age else max(0.7, 1.0 - 0.03 * (age - drop_age))
                retention[(position, age, "elite")] = [rate] * 12
            return retention

        rb = table("RB", 26)
        qb = table("QB", 32)
        for age in (28, 30):
            rb_keep = build.transition("RB", age, "elite", rb, {}, {})[0]
            qb_keep = build.transition("QB", age, "elite", qb, {}, {})[0]
            self.assertLess(rb_keep, qb_keep)


if __name__ == "__main__":
    unittest.main()
