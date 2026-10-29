import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
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
        now = datetime(2026, 10, 28, 21, tzinfo=timezone.utc)
        errors, warnings = self.mod.check_files(now=now)
        self.assertEqual(errors, [], warnings)
        self.assertTrue(any("nfl_schedule" in warning for warning in warnings))
        self.assertTrue(any("nfl_draft_picks" in warning for warning in warnings))

    def test_old_player_values_warn_unless_publish_mode(self):
        now = datetime(2026, 12, 1, tzinfo=timezone.utc)
        errors, warnings = self.mod.check_files(now=now, max_age_days=21, fail_on_age=False)
        self.assertFalse(any("player_values.json is" in error for error in errors))
        self.assertTrue(any("player_values.json is" in warning for warning in warnings))
        errors, warnings = self.mod.check_files(now=now, max_age_days=21, fail_on_age=True)
        self.assertTrue(any("player_values.json is" in error for error in errors))
        self.assertFalse(any("player_values.json is" in warning for warning in warnings))

    def test_bad_schema_fails_in_both_modes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in (
                "player_values.json",
                "nfl_schedule.json",
                "nfl_mock_drafts.json",
                "nfl_draft_picks.json",
            ):
                (root / name).write_text("[]", encoding="utf-8")
            for fail_on_age in (False, True):
                errors, _warnings = self.mod.check_files(root=root, fail_on_age=fail_on_age)
                self.assertTrue(any("not an object" in error for error in errors))
                self.assertGreaterEqual(len(errors), 4)

    def test_cli_warns_by_default_and_fails_on_age_flag(self):
        original = self.mod.check_files

        def fake_check(**kwargs):
            if kwargs.get("fail_on_age"):
                return ["player_values.json is 30.0 days old (max 21)"], []
            return [], ["player_values.json is 30.0 days old (max 21)"]

        self.mod.check_files = fake_check
        try:
            out = io.StringIO()
            err = io.StringIO()
            with redirect_stdout(out), redirect_stderr(err):
                code = self.mod.main([])
            self.assertEqual(code, 0)
            self.assertIn("warning: player_values.json is", out.getvalue())
            self.assertEqual(err.getvalue(), "")

            out = io.StringIO()
            err = io.StringIO()
            with redirect_stdout(out), redirect_stderr(err):
                code = self.mod.main(["--fail-on-age"])
            self.assertEqual(code, 1)
            self.assertIn("error: player_values.json is", err.getvalue())
            self.assertNotIn("market files ok", out.getvalue())
        finally:
            self.mod.check_files = original

    def test_npm_test_warns_and_publish_paths_fail(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        test_script = package["scripts"]["test"]
        self.assertIn("python3 scripts/check_market_files.py", test_script)
        self.assertNotIn("check_market_files.py --fail-on-age", test_script)
        deploy = (ROOT / "scripts" / "deploy_live_site.sh").read_text(encoding="utf-8")
        refresh_at = deploy.index("refresh_market_data.sh")
        age_at = deploy.index("check_market_files.py --fail-on-age")
        publish_at = deploy.index("netlify-cli@${NETLIFY_CLI_VERSION}\" deploy")
        self.assertLess(refresh_at, age_at)
        self.assertLess(age_at, publish_at)
        workflow = (ROOT / ".github/workflows/refresh-player-values.yml").read_text(encoding="utf-8")
        build_at = workflow.index("player-values/build.py")
        age_at = workflow.index("check_market_files.py --fail-on-age")
        test_at = workflow.index("npm test")
        self.assertLess(build_at, age_at)
        self.assertLess(age_at, test_at)

    def test_readme_does_not_keep_a_stale_holdout_score(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertNotIn("43.25", readme)
        self.assertNotIn("56.86", readme)
        self.assertIn("meta.validation", readme)
        refresh = (ROOT / "scripts" / "refresh_market_data.sh").read_text(encoding="utf-8")
        self.assertIn("update_nfl_draft_picks.py", refresh)


if __name__ == "__main__":
    unittest.main()
