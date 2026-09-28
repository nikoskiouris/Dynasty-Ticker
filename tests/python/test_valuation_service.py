import json
import tempfile
import unittest
from pathlib import Path

from src.domain.valuation import ValuationService
from src.integrations.player_value_provider import PlayerValueProvider, league_value_format


class ValuationServiceTests(unittest.TestCase):
    def test_global_max_ignores_pick_prices_and_has_no_star_premium(self):
        service = ValuationService({"player:star": 8000, "pick:2027:r1:early": 14000})
        self.assertEqual(service.max_value, 8000)
        self.assertEqual(service.get_asset_value("player:star"), 8000)

    def test_equal_count_packages_skip_the_consolidation_bump(self):
        service = ValuationService({"player:a": 8000, "player:b": 7900})
        result = service.calculate_package_adjustment([8000], [7900])
        self.assertEqual(result.package_adjustment, 0)
        self.assertEqual(result.my_adjusted_value, 8000)
        self.assertEqual(result.their_adjusted_value, 7900)

    def test_provider_reads_the_same_versioned_snapshot_for_both_formats(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "player_values.json"
            path.write_text(json.dumps({
                "modelVersion": "football-forecast-v1",
                "sf": {"player:qb": 9000, "player:wr": 7000},
                "oneQb": {"player:qb": 5000, "player:wr": 7000},
            }), encoding="utf-8")
            provider = PlayerValueProvider(path)
            sf = provider.load_values("sf")
            one = provider.load_values("oneQb")
        self.assertEqual(sf["player:qb"], 9000)
        self.assertEqual(one["player:qb"], 5000)
        self.assertEqual(sf["player:wr"], one["player:wr"])

    def test_provider_rejects_legacy_models(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "player_values.json"
            path.write_text(json.dumps({
                "modelVersion": "market-v2",
                "sf": {"player:a": 1},
                "oneQb": {"player:a": 1},
            }), encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "Unsupported player-value model"):
                PlayerValueProvider(path).load_values("sf")

    def test_league_format_only_switches_qb_market(self):
        self.assertEqual(league_value_format({"roster_positions": ["QB", "RB", "WR", "FLEX"]}), "oneQb")
        self.assertEqual(league_value_format({"roster_positions": ["QB", "RB", "SUPER_FLEX"]}), "sf")
        self.assertEqual(league_value_format({"roster_positions": ["QB", "QB", "RB"]}), "sf")


if __name__ == "__main__":
    unittest.main()
