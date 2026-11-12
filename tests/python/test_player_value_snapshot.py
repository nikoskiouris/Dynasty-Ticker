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

    def test_every_price_is_the_sum_of_its_forecast_seasons(self):
        """The number on the board is the forecast, added up. Nothing is layered on afterwards."""
        scale = self.data["meta"]["displayScale"]
        horizon = self.data["meta"]["horizonYears"]
        for asset_id, info in self.data["players"].items():
            for fmt in ("sf", "oneQb"):
                rows = info["forecast"].get(fmt) or info["forecast"]["sf"]
                self.assertEqual(len(rows), horizon + 1, asset_id)
                self.assertEqual([row["season"] for row in rows],
                                 list(range(self.data["season"], self.data["season"] + horizon + 1)))
                total = sum(row["discountedAdvantage"] for row in rows)
                self.assertAlmostEqual(self.data[fmt][asset_id], scale * total, delta=3, msg=f"{asset_id} {fmt}")
                discounts = [row["discount"] for row in rows]
                self.assertEqual(discounts, sorted(discounts, reverse=True), asset_id)
                for row in rows:
                    self.assertGreaterEqual(row["expectedAdvantage"], 0, asset_id)

    def test_only_quarterbacks_carry_a_second_forecast(self):
        for asset_id, info in self.data["players"].items():
            self.assertEqual("oneQb" in info["forecast"], info["position"] == "QB", asset_id)
            if info["position"] == "QB":
                self.assertGreaterEqual(self.data["sf"][asset_id], self.data["oneQb"][asset_id], asset_id)

    def test_nobody_who_never_played_is_priced_unless_he_is_new(self):
        for asset_id, info in self.data["players"].items():
            if info.get("lastSeason") is None and self.data["sf"][asset_id] > 0:
                self.assertLessEqual(info["experience"], 1, asset_id)
                self.assertLess(info["age"], 28, asset_id)
        # Retired in 2010, still on Sleeper with a team. He was priced as an unplayed rookie.
        self.assertLessEqual(self.data["sf"].get("player:4914", 0), 0)
        # Two rookies who were priced off older namesakes' draft slots.
        for asset_id in ("player:11863", "player:14064"):
            self.assertLessEqual(self.data["sf"].get(asset_id, 0), 0, asset_id)

    def test_ages_come_from_birthdays(self):
        ages = [info["age"] for info in self.data["players"].values()]
        whole = sum(1 for age in ages if float(age).is_integer())
        self.assertLess(whole, len(ages) * 0.05)
        # Sleeper lists Tyreek Hill at 31. He was born in March 1994.
        hill = self.data["players"].get("player:3321")
        if hill:
            self.assertGreater(hill["age"] - (self.data["season"] - 1994), -0.6)

    def test_a_player_keeps_his_own_career(self):
        """Sleeper once pointed Ryan Izzo at Tyler Conklin's record. Conklin then had no price at all."""
        self.assertIn("player:5133", self.data["players"])
        self.assertEqual(self.data["names"]["player:5133"], "Tyler Conklin")
        self.assertGreater(self.data["players"]["player:5133"]["components"]["careerGames"], 60)
        izzo = self.data["players"].get("player:5094")
        if izzo:
            self.assertLess(izzo["components"]["careerGames"], 60)

    def test_the_quarterback_line_is_a_starter_not_a_kneel_down(self):
        replacement = self.data["meta"]["replacementPpg"]
        self.assertGreater(replacement["sf"]["QB"], 2 * replacement["sf"]["WR"])
        self.assertLess(replacement["sf"]["QB"], replacement["oneQb"]["QB"])

    def test_an_unplayed_first_round_rookie_is_priced_near_the_picks_that_buy_him(self):
        """One ruler for picks and rookies: a top-12 pick who has not played is not worth less than a third."""
        year = min(int(key.split(":")[1]) for key in self.data["sf"] if key.startswith("pick:"))
        third = self.data["sf"][f"pick:{year}:r3:any"]
        for asset_id, info in self.data["players"].items():
            if info["experience"] == 0 and (info.get("draftPick") or 999) <= 12 and info["components"]["careerGames"] == 0:
                self.assertGreater(self.data["sf"][asset_id], third, asset_id)

    def test_the_snapshot_says_how_it_was_checked(self):
        validation = self.data["meta"]["validation"]
        self.assertEqual(validation["status"], "backtested")
        self.assertIn("trade-market prices", validation["notValidated"])
        self.assertNotIn("draftAnchors", self.data["meta"])
        self.assertIn("pricingDate", self.data["meta"])

    def test_a_star_quarterback_is_worth_more_in_superflex(self):
        allen = "player:4984"
        self.assertGreater(self.data["sf"][allen], self.data["oneQb"][allen])


if __name__ == "__main__":
    unittest.main()
