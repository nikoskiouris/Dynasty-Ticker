import importlib.util
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "check_market_files.py"


def load_module():
    spec = importlib.util.spec_from_file_location("check_market_files", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_market_files"] = module
    spec.loader.exec_module(module)
    return module


class MarketFileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_shipped_files_match_the_desk_schema(self):
        now = datetime(2026, 10, 14, 18, tzinfo=timezone.utc)
        errors, warnings = self.mod.check_files(now=now)
        self.assertEqual(errors, [], warnings)
        self.assertTrue(any("nfl_schedule" in warning for warning in warnings))
        self.assertTrue(any("nfl_draft_picks" in warning for warning in warnings))

    def test_old_player_values_fail(self):
        now = datetime(2026, 12, 1, tzinfo=timezone.utc)
        errors, _warnings = self.mod.check_files(now=now, max_age_days=21)
        self.assertTrue(any("player_values.json is" in error for error in errors))

    def test_readme_does_not_keep_a_stale_holdout_score(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertNotIn("43.25", readme)
        self.assertNotIn("56.86", readme)
        self.assertIn("meta.validation", readme)
        refresh = (ROOT / "scripts" / "refresh_market_data.sh").read_text(encoding="utf-8")
        self.assertIn("update_nfl_draft_picks.py", refresh)


if __name__ == "__main__":
    unittest.main()
