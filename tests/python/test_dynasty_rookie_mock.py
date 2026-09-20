import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_dynasty_rookie_mock.py"
FIXTURE = ROOT / "tests" / "python" / "fixtures" / "dynasty_nerds_sf_rookie_mock.html"
SHIPPED = ROOT / "docs" / "data" / "nfl_mock_drafts.json"
SKILL = {"QB", "RB", "WR", "TE"}


def load_module():
    spec = importlib.util.spec_from_file_location("update_dynasty_rookie_mock", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_dynasty_rookie_mock"] = module
    spec.loader.exec_module(module)
    return module


class DynastyRookieMockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()
        cls.html = FIXTURE.read_text(encoding="utf-8")

    def test_fixture_keeps_two_skill_rounds_and_drops_the_rest(self):
        picks = self.mod.parse_picks(self.html)
        self.assertEqual(len(picks), 24)
        self.assertEqual(picks[0]["name"], "Jeremiah Smith")
        self.assertEqual((picks[0]["round"], picks[0]["slot"]), (1, 1))
        self.assertEqual(picks[12]["name"], "Justice Haynes")
        self.assertEqual((picks[12]["round"], picks[12]["slot"]), (2, 1))
        names = [pick["name"] for pick in picks]
        self.assertIn("Trey’Dez Green", names)
        self.assertNotIn("Fake Prospect", names)
        self.assertTrue(all(pick["pos"] in SKILL for pick in picks))
        self.assertTrue(all(pick["round"] <= 2 for pick in picks))

    def test_article_meta_and_payload(self):
        payload = self.mod.build_payload(self.html, url=self.mod.DEFAULT_URL)
        self.assertEqual(payload["season"], 2027)
        self.assertEqual(payload["rounds"], 2)
        self.assertEqual(payload["completedNflDraftYear"], 2026)
        mock = payload["mocks"][0]
        self.assertEqual(mock["source"], "Dynasty Nerds")
        self.assertEqual(mock["author"], "Keith Ensminger")
        self.assertEqual(mock["date"], "2026-08-31")
        self.assertEqual(mock["url"], self.mod.DEFAULT_URL)
        self.assertEqual(mock["format"], "superflex")

    def test_writes_json_from_local_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "nfl_mock_drafts.json"
            code = self.mod.main(["--html", str(FIXTURE), "--output", str(out)])
            self.assertEqual(code, 0)
            payload = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(len(payload["mocks"][0]["picks"]), 24)

    def test_shipped_board_is_dynasty_nerds_skill_only(self):
        payload = json.loads(SHIPPED.read_text(encoding="utf-8"))
        self.assertEqual(payload["season"], 2027)
        self.assertEqual(len(payload["mocks"]), 1)
        mock = payload["mocks"][0]
        self.assertEqual(mock["source"], "Dynasty Nerds")
        self.assertIn("dynastynerds.com", mock["url"])
        picks = mock["picks"]
        self.assertGreaterEqual(len(picks), 20)
        self.assertEqual(picks[0]["name"], "Jeremiah Smith")
        second = next(pick for pick in picks if pick["round"] == 2 and pick["slot"] == 1)
        self.assertEqual(second["name"], "Justice Haynes")
        self.assertTrue(all(pick["pos"] in SKILL for pick in picks))
        self.assertTrue(all(pick["round"] <= 2 for pick in picks))
        blob = json.dumps(payload)
        self.assertNotRegex(blob, r"\b(EDGE|OT|CB|IOL|DT)\b")


if __name__ == "__main__":
    unittest.main()
