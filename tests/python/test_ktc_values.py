import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_ktc_values.py"


def load_ktc_module():
    spec = importlib.util.spec_from_file_location("update_ktc_values", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_ktc_values"] = module
    spec.loader.exec_module(module)
    return module


class KtcScraperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ktc = load_ktc_module()

    def test_parse_rankings_reads_player_and_pick_rows(self):
        lines = [
            "RANK",
            "PLAYER NAME",
            "POS",
            "AGE",
            "TIER",
            "VALUE",
            "1",
            "Jahmyr Gibbs DET",
            "RB",
            "24.2",
            "Tier 1",
            "0",
            "9998",
            "2",
            "2026 Early 1st",
            "PICK",
            "0",
            "Tier 1",
            "12",
            "6120",
            "3",
            "Not seeing a player you're looking for?",
        ]
        rows = self.ktc.parse_rankings(lines)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].label, "Jahmyr Gibbs")
        self.assertEqual(rows[0].position, "RB")
        self.assertEqual(rows[0].team, "DET")
        self.assertEqual(rows[0].value, 9998)
        self.assertEqual(rows[1].position, "PICK")
        self.assertEqual(rows[1].value, 6120)

    def test_parse_pick_asset_keeps_bucket_and_round(self):
        asset_id, bucket = self.ktc.parse_pick_asset("2026 Early 1st")
        self.assertEqual(asset_id, "pick:2026:r1:any")
        self.assertEqual(bucket, "early")
        self.assertEqual(self.ktc.parse_pick_asset("2026 Pick 1.01FA"), ("pick:2026:r1:any", "early"))
        self.assertEqual(self.ktc.parse_pick_asset("not a pick"), (None, None))

    def test_concatenated_names_and_unnumbered_picks_do_not_eat_jayden(self):
        lines = [
            "RANK",
            "PLAYER NAME",
            "POS",
            "AGE",
            "TIER",
            "30DT",
            "30 DAY TREND",
            "VALUE",
            "16",
            "Jeremiyah LoveRARI",
            "RB4",
            "•",
            "21.3 y.o.",
            "Tier 5",
            "3",
            "7194",
            "-",
            "2026 Pick 1.01FA",
            "PICK",
            "Tier 5",
            "2",
            "7184",
            "17",
            "CeeDee LambDAL",
            "WR7",
            "•",
            "27.4 y.o.",
            "Tier 5",
            "1",
            "7166",
            "18",
            "Joe BurrowCIN",
            "QB5",
            "•",
            "29.8 y.o.",
            "Tier 5",
            "2",
            "7155",
            "-",
            "2027 Early 1stFA",
            "PICK",
            "Tier 6",
            "0",
            "7024",
            "19",
            "Jayden DanielsWAS",
            "QB6",
            "•",
            "25.7 y.o.",
            "Tier 6",
            "5",
            "7008",
            "20",
            "Omarion HamptonLAC",
            "RB5",
            "•",
            "23.5 y.o.",
            "Tier 6",
            "0",
            "6962",
            "Not seeing a player you're looking for?",
            "INSIGHTS",
            "Top 5 Risers (30 Days)",
        ]
        rows = self.ktc.parse_rankings(lines)
        labels = [row.label for row in rows]
        self.assertIn("Jayden Daniels", labels)
        self.assertIn("CeeDee Lamb", labels)
        self.assertIn("Jeremiyah Love", labels)
        self.assertIn("Joe Burrow", labels)
        jayden = next(row for row in rows if row.label == "Jayden Daniels")
        self.assertEqual(jayden.position, "QB")
        self.assertEqual(jayden.team, "WAS")
        self.assertEqual(jayden.value, 7008)
        ceedee = next(row for row in rows if row.label == "CeeDee Lamb")
        self.assertEqual(ceedee.value, 7166)
        love = next(row for row in rows if row.label == "Jeremiyah Love")
        self.assertEqual(love.value, 7194)
        self.assertTrue(any(row.position == "PICK" and "1.01" in row.label for row in rows))
        self.assertTrue(any(row.position == "PICK" and "Early 1st" in row.label for row in rows))
        self.assertFalse(any("7024" in row.label or "7184" in row.label for row in rows))

    def test_split_label_strips_rookie_marker_and_stuck_team(self):
        name, team = self.ktc.split_label_and_team("Jeremiyah LoveRARI", "RB")
        self.assertEqual(name, "Jeremiyah Love")
        self.assertEqual(team, "ARI")
        name, team = self.ktc.split_label_and_team("Jayden DanielsWAS", "QB")
        self.assertEqual(name, "Jayden Daniels")
        self.assertEqual(team, "WAS")

    def test_page_start_signature_does_not_treat_unnumbered_picks_as_repeats(self):
        start_a = tuple((row.rank, row.label) for row in [
            self.ktc.KtcRow(0, "2026 Pick 1.10", "PICK", 4000, "FA"),
            self.ktc.KtcRow(85, "Sam Darnold", "QB", 3900, "SEA"),
        ][:3])
        start_b = tuple((row.rank, row.label) for row in [
            self.ktc.KtcRow(0, "2026 Mid 3rd", "PICK", 1800, "FA"),
            self.ktc.KtcRow(200, "Tank Dell", "WR", 1700, "HOU"),
        ][:3])
        self.assertNotEqual(start_a, start_b)

    def test_broken_scrape_is_rejected(self):
        players = {
            "11566": {"full_name": "Jayden Daniels", "position": "QB"},
            "7564": {"full_name": "Ja'Marr Chase", "position": "WR"},
        }
        tiny = {"player:7564": 9000}
        self.assertFalse(self.ktc.accept_scrape(tiny, players))
        self.assertGreaterEqual(self.ktc.MIN_MAPPED_PLAYERS, 180)

    def test_failed_1qb_scrape_never_copies_superflex(self):
        players = {}
        scraped = {"player:1": 10}
        existing = {"player:9": 2222, "pick:2027:r1:early": 9000}
        superflex = {"player:1": 9999, "pick:2027:r1:early": 9999}
        self.assertEqual(self.ktc.resolve_one_qb_values(scraped, players, existing), existing)
        self.assertIsNone(self.ktc.resolve_one_qb_values(scraped, players, {}))
        self.assertIsNone(self.ktc.resolve_one_qb_values(scraped, players, None))
        self.assertNotEqual(self.ktc.resolve_one_qb_values(scraped, players, None), superflex)

    def test_json_writer_leaves_1qb_null_instead_of_copying_superflex(self):
        sf = {"player:1": 1000}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ktc_values.json"
            self.ktc.write_values_json(path, sf, None, {})
            payload = json.loads(path.read_text(encoding="utf-8"))
        self.assertIsNone(payload["oneQb"])
        self.assertEqual(payload["sf"], sf)
        self.assertNotIn("9999", json.dumps(payload["oneQb"]))

    def test_build_urls_include_1qb_format_and_filters(self):
        sf_url = self.ktc.build_ktc_url(0, {"filters": self.ktc.KTC_FILTERS})
        one_qb_url = self.ktc.build_ktc_url(2, {"filters": self.ktc.KTC_FILTERS, "format": 1})
        self.assertIn("filters=", sf_url)
        self.assertIn("format=1", one_qb_url)
        self.assertIn("page=2", one_qb_url)
        self.assertNotIn("page=", self.ktc.build_ktc_url(0, {"filters": self.ktc.KTC_FILTERS}))


if __name__ == "__main__":
    unittest.main()
