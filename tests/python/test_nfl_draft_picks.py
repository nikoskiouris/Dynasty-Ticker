import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_nfl_draft_picks.py"


def load_module():
    spec = importlib.util.spec_from_file_location("update_nfl_draft_picks", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_nfl_draft_picks"] = module
    spec.loader.exec_module(module)
    return module


class NflDraftPickMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_matches_rookie_by_name_college_and_year(self):
        players = {
            "13287": {
                "player_id": "13287",
                "full_name": "Jeremiyah Love",
                "first_name": "Jeremiyah",
                "last_name": "Love",
                "team": "ARI",
                "college": "Notre Dame",
                "position": "RB",
                "metadata": {"rookie_year": "2026"},
            },
            "999": {
                "player_id": "999",
                "full_name": "Jeremiyah Love",
                "team": "CHI",
                "college": "Alabama",
                "position": "WR",
                "metadata": {"rookie_year": "2024"},
            },
        }
        rows = [
            {
                "season": "2026",
                "round": 1,
                "pick": 3,
                "team": "ARI",
                "college": "Notre Dame",
                "position": "RB",
                "pfr_player_name": "Jeremiyah Love",
                "gsis_id": "",
            }
        ]
        picks = self.mod.build_draft_pick_map(players, rows)
        self.assertEqual(picks["13287"]["round"], 1)
        self.assertEqual(picks["13287"]["pick"], 3)

    def test_gsis_id_wins_when_present(self):
        players = {
            "12527": {
                "player_id": "12527",
                "full_name": "Ashton Jeanty",
                "gsis_id": "00-0039999",
                "metadata": {"rookie_year": "2025"},
            }
        }
        rows = [
            {
                "season": "2025",
                "round": 1,
                "pick": 6,
                "team": "LVR",
                "college": "Boise St.",
                "position": "RB",
                "pfr_player_name": "Wrong Name",
                "gsis_id": "00-0039999",
            }
        ]
        picks = self.mod.build_draft_pick_map(players, rows)
        self.assertEqual(picks["12527"]["pick"], 6)

    def test_veteran_namesake_is_not_this_years_pick(self):
        players = {
            "6794": {
                "player_id": "6794",
                "full_name": "Justin Jefferson",
                "team": "MIN",
                "college": "LSU",
                "position": "WR",
                "metadata": {"rookie_year": "2020"},
            }
        }
        rows = [{
            "season": "2026",
            "round": 5,
            "pick": 149,
            "team": "GB",
            "college": "Tennessee",
            "position": "WR",
            "pfr_player_name": "Justin Jefferson",
            "gsis_id": "",
        }]
        self.assertEqual(self.mod.build_draft_pick_map(players, rows), {})

    def test_undated_unique_name_still_matches(self):
        players = {
            "13524": {
                "player_id": "13524",
                "full_name": "Justin Jefferson",
                "team": None,
                "college": "Tennessee",
                "position": "WR",
                "metadata": {},
            }
        }
        rows = [{
            "season": "2026",
            "round": 5,
            "pick": 149,
            "team": "",
            "college": "Tennessee",
            "position": "WR",
            "pfr_player_name": "Justin Jefferson",
            "gsis_id": "",
        }]
        picks = self.mod.build_draft_pick_map(players, rows)
        self.assertEqual(picks["13524"]["pick"], 149)

    def test_short_map_does_not_replace_the_file(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "nfl_draft_picks.json"
            path.write_text('{"picks":{"1":{"name":"keep"}}}', encoding="utf-8")
            before = path.read_text(encoding="utf-8")
            with self.assertRaises(RuntimeError):
                self.mod.publish_draft_picks(path, {"picks": {"1": {"name": "new"}}}, min_picks=2)
            self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_shipped_json_keeps_love_as_first_round_pick_three(self):
        payload = (ROOT / "docs/data/nfl_draft_picks.json").read_text(encoding="utf-8")
        self.assertIn('"13287":{"year":2026,"round":1,"pick":3', payload)


if __name__ == "__main__":
    unittest.main()
