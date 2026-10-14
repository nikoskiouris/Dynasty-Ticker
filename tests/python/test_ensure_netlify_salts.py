import importlib.util
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ensure_netlify_salts.py"


def load_module():
    spec = importlib.util.spec_from_file_location("ensure_netlify_salts", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["ensure_netlify_salts"] = module
    spec.loader.exec_module(module)
    return module


class EnsureNetlifySaltsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_keeps_a_function_scoped_secret(self):
        action = self.mod.salt_action({
            "key": "VISIT_SALT",
            "scopes": ["functions", "runtime"],
            "is_secret": True,
            "values": [{"context": "all", "value": ""}],
        })
        self.assertEqual(action, "keep")

    def test_keeps_a_readable_non_default(self):
        action = self.mod.salt_action({
            "scopes": ["runtime"],
            "values": [{"context": "production", "value": "real-secret"}],
        })
        self.assertEqual(action, "keep")

    def test_replaces_public_defaults_and_build_only_values(self):
        self.assertEqual(self.mod.salt_action(None), "set")
        self.assertEqual(self.mod.salt_action({}), "set")
        self.assertEqual(self.mod.salt_action({
            "scopes": ["functions"],
            "values": [{"context": "all", "value": "dynasty-ticker-traffic-v1"}],
        }), "set")
        self.assertEqual(self.mod.salt_action({
            "scopes": ["functions"],
            "values": [{"context": "production", "value": "dynasty-ticker-rather-v1"}],
        }), "set")
        self.assertEqual(self.mod.salt_action({
            "scopes": ["builds"],
            "values": [{"context": "all", "value": "real-secret"}],
        }), "set")
        self.assertEqual(self.mod.salt_action({
            "scopes": ["functions"],
            "values": [{"context": "dev", "value": "real-secret"}],
        }), "set")

    def test_choose_secret_ignores_public_defaults(self):
        old_visit = os.environ.get("VISIT_SALT")
        old_rather = os.environ.get("RATHER_SALT")
        try:
            os.environ["VISIT_SALT"] = "dynasty-ticker-traffic-v1"
            secret = self.mod.choose_secret("VISIT_SALT")
            self.assertNotIn(secret, self.mod.REJECTED_SALTS)
            self.assertGreaterEqual(len(secret), 32)
            os.environ["RATHER_SALT"] = "copied-from-deploy-env"
            self.assertEqual(self.mod.choose_secret("RATHER_SALT"), "copied-from-deploy-env")
        finally:
            if old_visit is None:
                os.environ.pop("VISIT_SALT", None)
            else:
                os.environ["VISIT_SALT"] = old_visit
            if old_rather is None:
                os.environ.pop("RATHER_SALT", None)
            else:
                os.environ["RATHER_SALT"] = old_rather


if __name__ == "__main__":
    unittest.main()
