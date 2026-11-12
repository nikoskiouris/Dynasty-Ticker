"""The backtest must be an honest replay, and the saved report must be for the model that ships."""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from synthetic_league import build, forecast, league, load

backtest = load("backtest")
ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "player-values" / "validation.json"
SNAPSHOT = ROOT / "docs" / "data" / "player_values.json"


class ReplayTests(unittest.TestCase):
    def test_a_replay_cannot_see_the_future(self):
        """Wipe everything from the replayed kickoff onward. The forecast must not change."""
        inputs, _rows, _world = league()
        _world_then, before = backtest.replay(inputs, 2019)
        blind = copy.copy(inputs)
        blind["weekly"] = {}
        for pid, games in inputs["weekly"].items():
            kept = [dict(game) for game in games if game["season"] < 2019]
            later = [dict(game, ppr=999.0) for game in games if game["season"] >= 2019]
            blind["weekly"][pid] = kept + later
        _world_blind, after = backtest.replay(blind, 2019)
        self.assertEqual(sorted(before), sorted(after))
        for pid in before:
            self.assertEqual(before[pid]["years"], after[pid]["years"], pid)

    def test_a_replay_trains_only_on_seasons_that_had_finished(self):
        inputs, _rows, _world = league()
        world, _players = backtest.replay(inputs, 2019)
        self.assertEqual(max(world["origins"]), 2018)
        self.assertEqual(world["season"], 2019)
        for model in world["models"].values():
            self.assertLessEqual(model["origins"][1], 2018)

    def test_the_players_scored_are_chosen_before_the_outcome(self):
        inputs, _rows, _world = league()
        _world_then, players = backtest.replay(inputs, 2019)
        chosen = backtest.relevant(players, "sf")
        self.assertGreater(len(chosen), 150)
        for pid in chosen:
            player = players[pid]
            known_good = player["last"]["sf"][0] > 0
            young_pick = player["exp"] <= 3 and player["pick"] <= 100
            self.assertTrue(known_good or young_pick, pid)

    def test_on_the_made_up_league_the_forecast_beats_repeating_last_season(self):
        inputs, _rows, _world = league()
        all_rows = build.summaries(inputs["meta"], inputs["weekly"])
        scored = [backtest.score_origin(inputs, all_rows, season, 3) for season in (2018, 2020, 2022)]
        summary = backtest.summarize(scored, 3)
        self.assertGreater(summary["rankCorrelation"]["model"], summary["rankCorrelation"]["lastSeason"])
        self.assertGreater(summary["rankCorrelation"]["model"], 0.5)
        overall = summary["realizedOverForecast"]["overall"]
        self.assertGreater(overall, 0.8)
        self.assertLess(overall, 1.25)

    def test_a_saved_report_goes_stale_when_a_season_finishes_or_the_model_changes(self):
        import tempfile
        version = build.CONFIG["modelVersion"]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "validation.json"
            self.assertFalse(backtest.report_is_current(2026, path))
            path.write_text(json.dumps({"modelVersion": version, "dataThroughSeason": 2025}), encoding="utf-8")
            self.assertTrue(backtest.report_is_current(2026, path))
            self.assertFalse(backtest.report_is_current(2027, path))
            path.write_text(json.dumps({"modelVersion": "football-forecast-v1", "dataThroughSeason": 2025}), encoding="utf-8")
            self.assertFalse(backtest.report_is_current(2026, path))
        workflow = (ROOT / ".github/workflows/refresh-player-values.yml").read_text(encoding="utf-8")
        self.assertLess(workflow.index("backtest.py --write --if-stale"), workflow.index("python3 player-values/build.py"))

    def test_rank_correlation_handles_ties_and_flat_input(self):
        self.assertAlmostEqual(backtest.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1.0)
        self.assertAlmostEqual(backtest.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1.0)
        self.assertIsNone(backtest.spearman([1, 1, 1, 1, 1], [1, 2, 3, 4, 5]))
        self.assertIsNone(backtest.spearman([1, 2], [2, 1]))
        tied = backtest.spearman([1, 1, 2, 2, 3, 3], [1, 1, 2, 2, 3, 3])
        self.assertAlmostEqual(tied, 1.0)


class SavedReportTests(unittest.TestCase):
    """A model change does not ship until backtest.py --write has scored it."""

    @classmethod
    def setUpClass(cls):
        cls.report = json.loads(REPORT.read_text(encoding="utf-8"))
        cls.snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))

    def test_the_saved_report_scored_the_model_that_ships(self):
        self.assertEqual(self.report["modelVersion"], build.CONFIG["modelVersion"])
        self.assertEqual(self.snapshot["modelVersion"], build.CONFIG["modelVersion"])
        published = self.snapshot["meta"]["validation"]
        self.assertEqual(published["status"], "backtested")
        self.assertEqual(published["summary"], self.report["summary"])
        self.assertGreaterEqual(self.report["dataThroughSeason"], self.snapshot["season"] - 1)

    def test_the_forecast_beats_both_naive_forecasts_at_every_horizon(self):
        horizons = [str(value) for value in build.CONFIG["backtest"]["horizons"]]
        self.assertEqual(sorted(self.report["summary"]), sorted(horizons))
        for horizon, block in self.report["summary"].items():
            ranks = block["rankCorrelation"]
            capture = block["top60Capture"]
            for naive in ("lastSeason", "lastTwoSeasons"):
                self.assertGreater(ranks["model"], ranks[naive] + 0.05, f"{horizon} seasons vs {naive}")
                self.assertGreater(capture["model"], capture[naive], f"{horizon} seasons vs {naive}")

    def test_forecast_totals_land_near_what_happened(self):
        for horizon, block in self.report["summary"].items():
            cal = block["realizedOverForecast"]
            self.assertGreater(cal["overall"], 0.9, horizon)
            self.assertLess(cal["overall"], 1.1, horizon)
            for year, ratio in enumerate(cal["byYear"]):
                self.assertGreater(ratio, 0.8, f"{horizon} seasons, year {year}")
                self.assertLess(ratio, 1.2, f"{horizon} seasons, year {year}")
            for group, ratio in cal["byGroup"].items():
                self.assertGreater(ratio, 0.75, f"{horizon} seasons, {group}")
                self.assertLess(ratio, 1.3, f"{horizon} seasons, {group}")

    def test_the_in_season_update_beats_ignoring_this_season(self):
        mid = self.report["inSeason"]
        for label in ("restOfSeason", "nextSeason"):
            ranks = mid[label]["rankCorrelation"]
            self.assertGreater(ranks["model"], ranks["kickoffOnly"], label)
        self.assertGreater(mid["nextSeason"]["rankCorrelation"]["model"], mid["nextSeason"]["rankCorrelation"]["paceOnly"])

    def test_the_report_says_what_it_did_not_test(self):
        untested = " ".join(self.report["notValidated"])
        for topic in ("trade-market prices", "annual discount", "rookie-pick board"):
            self.assertIn(topic, untested)


if __name__ == "__main__":
    unittest.main()
