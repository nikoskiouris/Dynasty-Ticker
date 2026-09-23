import json
import tempfile
import unittest
from pathlib import Path

from src.domain.valuation import ValuationService
from src.integrations.ktc_provider import KeepTradeCutProvider


class ValuationServiceTests(unittest.TestCase):
    def test_global_max_ignores_pick_prices(self):
        service = ValuationService({"player:star": 8000, "pick:2027:r1:early": 14000})
        self.assertNotEqual(service.max_value, 14000)
        self.assertEqual(service.max_value, 10160)

    def test_equal_count_packages_skip_the_consolidation_bump(self):
        service = ValuationService({"player:a": 8000, "player:b": 7900})
        result = service.calculate_package_adjustment([8000], [7900])
        self.assertEqual(result.package_adjustment, 0)
        self.assertEqual(result.my_adjusted_value, 8000)
        self.assertEqual(result.their_adjusted_value, 7900)

    def test_fresh_cache_coerces_strings_and_drops_bools(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.json"
            path.write_text(json.dumps({"player:a": "8000", "player:b": True, "player:c": "nope"}), encoding="utf-8")
            loaded = KeepTradeCutProvider(cache_file=str(path), ttl_seconds=10**9).load_values()
        self.assertEqual(loaded.get("player:a"), 8000)
        self.assertNotIn("player:b", loaded)
        self.assertNotIn("player:c", loaded)
        ValuationService(loaded)


if __name__ == "__main__":
    unittest.main()
