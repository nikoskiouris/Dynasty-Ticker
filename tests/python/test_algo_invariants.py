"""Property checks that hold for any fitted forecast, run on the made-up league."""

from __future__ import annotations

import random
import unittest

from synthetic_league import KICKOFF, build, forecast, league

CONFIG = build.CONFIG


class AlgoInvariantTests(unittest.TestCase):
    def test_force_descending_never_lets_a_later_slot_jump(self):
        rng = random.Random(20261014)
        for _ in range(40):
            values = [rng.uniform(0, 80) for _ in range(12)]
            ordered = build.force_descending(values)
            self.assertEqual(len(ordered), len(values))
            for earlier, later in zip(ordered, ordered[1:]):
                self.assertGreaterEqual(earlier, later)
            self.assertEqual(ordered[0], values[0])

    def test_every_forecast_is_a_real_season(self):
        """Random players: advantage never negative, never above pace, games share between 0 and 1."""
        _inputs, _rows, world = league()
        rng = random.Random(7)
        for _ in range(400):
            position = rng.choice(forecast.POSITIONS)
            model = world["models"][forecast.model_group(position, rng.choice(forecast.FORMATS))]
            pace = rng.uniform(0, 380)
            games = rng.uniform(0, 1)
            cur = (pace * games, pace, games)
            prev_pace = rng.uniform(0, 380)
            prev = (prev_pace, prev_pace, 1.0) if rng.random() < 0.8 else (0.0, 0.0, 0.0)
            path = forecast.project(
                model, rng.uniform(21, 41), rng.randint(0, 15), rng.randint(1, forecast.MAX_PICK), cur, prev, 8
            )
            for advantage, next_pace, share in path:
                self.assertGreaterEqual(advantage, 0.0)
                self.assertLessEqual(advantage, next_pace + 1e-9)
                self.assertGreaterEqual(share, 0.0)
                self.assertLessEqual(share, 1.0)

    def test_draft_slot_tables_never_reward_a_later_pick(self):
        _inputs, _rows, world = league()
        for group, model in world["models"].items():
            for equation in model["capital"]:
                for missed, played in equation:
                    for table in (missed, played):
                        for pick in range(1, forecast.MAX_PICK):
                            self.assertGreaterEqual(table[pick], table[pick + 1], f"{group} pick {pick}")
                        self.assertGreaterEqual(table[forecast.MAX_PICK], 0.0)

    def test_the_calibration_curve_never_bends_downward(self):
        _inputs, _rows, world = league()
        for group, model in world["models"].items():
            for curve in model["calibration"]:
                self.assertIsNotNone(curve, group)
                xs, ys = curve
                self.assertEqual(xs, sorted(xs))
                self.assertEqual(ys, sorted(ys))
                for level in (0.0, xs[1] / 2, xs[-1], xs[-1] * 2):
                    self.assertGreaterEqual(forecast._calibrate(curve, level * 1.01), forecast._calibrate(curve, level))

    def test_a_superflex_quarterback_is_never_worth_less_than_in_one_qb(self):
        inputs, _rows, world = league()
        checked = 0
        for pid, by_season in world["rowsByPlayer"].items():
            if 2025 not in by_season or by_season[2025]["position"] != "QB":
                continue
            info = inputs["meta"][pid]
            valued = build.value_player(
                world, pid, "QB", forecast.age_on(info, 2026), 2026 - world["rookieYear"][pid],
                forecast.draft_pick(info), 0, KICKOFF, 1.0, KICKOFF,
            )
            self.assertGreaterEqual(valued["sf"]["total"], valued["oneQb"]["total"])
            checked += 1
        self.assertGreater(checked, 20)

    def test_skill_positions_share_one_price_across_formats(self):
        inputs, _rows, world = league()
        pid = next(p for p, by_season in world["rowsByPlayer"].items()
                   if 2025 in by_season and by_season[2025]["position"] == "WR")
        info = inputs["meta"][pid]
        valued = build.value_player(
            world, pid, "WR", forecast.age_on(info, 2026), 3, forecast.draft_pick(info), 0, KICKOFF, 1.0, KICKOFF
        )
        self.assertIs(valued["sf"], valued["oneQb"])


if __name__ == "__main__":
    unittest.main()
