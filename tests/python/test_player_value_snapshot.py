"""The committed snapshot is the price the app ships. Do not rebuild it in CI."""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "docs" / "data" / "player_values.json"


class PlayerValueSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))

    def test_replacement_is_a_real_player_and_superflex_quarterbacks_are_scarcer(self):
        replacement = self.data["meta"]["replacementPpg"]
        for fmt in ("sf", "oneQb"):
            for position in ("QB", "RB", "WR", "TE"):
                self.assertGreater(replacement[fmt][position], 0, f"{fmt} {position}")
        self.assertLess(replacement["sf"]["QB"], replacement["oneQb"]["QB"])

    def test_known_skill_players_resolve_and_dead_players_do_not(self):
        players = self.data["players"]
        jefferson = players["player:6794"]
        self.assertEqual(jefferson["position"], "WR")
        self.assertGreater(self.data["sf"]["player:6794"], 1000)
        self.assertEqual(self.data["sf"]["player:6794"], self.data["oneQb"]["player:6794"])

        hunter = players["player:12530"]
        self.assertEqual(hunter["position"], "WR")
        self.assertGreater(self.data["sf"]["player:12530"], 0)

        walker = players["player:8151"]
        self.assertEqual(walker["position"], "RB")
        self.assertGreater(self.data["sf"]["player:8151"], 1000)

        harrison = players["player:11628"]
        self.assertEqual(harrison["position"], "WR")
        self.assertEqual(harrison["draftPick"], 4)
        self.assertLess(harrison["age"], 26)
        self.assertGreater(self.data["sf"]["player:11628"], 0)
        self.assertGreater(harrison["components"]["resume"]["draftBlend"], 0)

        self.assertGreaterEqual(jefferson["components"]["resume"]["top5Finishes"], 3)

        for asset_id in ("player:167", "player:4634"):
            self.assertLessEqual(self.data["sf"].get(asset_id, 0), 0)
            self.assertLessEqual(self.data["oneQb"].get(asset_id, 0), 0)

    def test_priced_players_played_recently(self):
        season = int(self.data["season"])
        for asset_id, info in self.data["players"].items():
            if self.data["sf"].get(asset_id, 0) <= 0:
                continue
            last_season = info.get("lastSeason")
            if last_season is None:
                continue
            self.assertGreaterEqual(int(last_season), season - 1, asset_id)

    def test_first_round_picks_decline_from_early_to_late(self):
        for fmt in ("sf", "oneQb"):
            values = self.data[fmt]
            years = sorted({
                int(key.split(":")[1])
                for key in values
                if key.startswith("pick:") and ":r1:" in key
            })
            self.assertGreaterEqual(len(years), 4)
            previous_early = None
            for year in years:
                early = values[f"pick:{year}:r1:early"]
                mid = values[f"pick:{year}:r1:mid"]
                late = values[f"pick:{year}:r1:late"]
                any_first = values[f"pick:{year}:r1:any"]
                self.assertGreater(early, mid)
                self.assertGreater(mid, late)
                self.assertGreaterEqual(early, any_first)
                self.assertGreaterEqual(any_first, late)
                rounds = [values[f"pick:{year}:r{rnd}:any"] for rnd in range(1, 6)]
                self.assertEqual(rounds, sorted(rounds, reverse=True))
                if previous_early is not None:
                    self.assertGreaterEqual(previous_early, early)
                previous_early = early

    def test_superflex_picks_are_never_cheaper_than_1qb_picks(self):
        for asset_id, one_qb in self.data["oneQb"].items():
            if asset_id.startswith("pick:"):
                self.assertGreaterEqual(self.data["sf"][asset_id], one_qb, asset_id)

    def test_recent_top_ten_picks_are_priced_before_they_play(self):
        season = int(self.data["season"])
        for asset_id, info in self.data["players"].items():
            if info.get("experience") == 0 and (info.get("draftPick") or 999) <= 10:
                self.assertGreater(self.data["sf"][asset_id], 1000, asset_id)

    def test_forty_year_olds_are_not_superflex_cornerstones(self):
        board = sorted(
            (key for key in self.data["sf"] if key in self.data["players"]),
            key=lambda key: -self.data["sf"][key],
        )[:60]
        for asset_id in board:
            self.assertLess(self.data["players"][asset_id]["age"], 40, asset_id)

    def test_young_stars_do_not_lose_points_every_year_before_their_prime(self):
        for asset_id, info in self.data["players"].items():
            if info["position"] not in ("WR", "TE") or info["age"] > 23 or self.data["sf"].get(asset_id, 0) < 3000:
                continue
            ppg = [year["ppg"] for year in info["forecast"]["sf"]]
            self.assertGreaterEqual(ppg[3], ppg[1] * 0.97, asset_id)

    def test_a_star_quarterback_is_worth_more_in_superflex(self):
        allen = "player:4984"
        self.assertGreater(self.data["sf"][allen], self.data["oneQb"][allen])


if __name__ == "__main__":
    unittest.main()
