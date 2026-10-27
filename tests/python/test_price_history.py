"""Price-archive retention. Does not rebuild the forecast."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "archive_price_snapshot",
    ROOT / "scripts" / "archive_price_snapshot.py",
)
archive = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(archive)

PRICES = importlib.util.spec_from_file_location(
    "prices_unchanged",
    ROOT / "scripts" / "prices_unchanged.py",
)
prices = importlib.util.module_from_spec(PRICES)
PRICES.loader.exec_module(prices)

SNAPSHOT = ROOT / "docs/data/player_values.json"
HISTORY = ROOT / "docs/data/price-history"


def board(day, hhmm, players, one_qb=None):
    hour, minute = hhmm.split(":")
    as_of = f"{day}T{hour}:{minute}:00+00:00"
    sf = {f"player:{sid}": value for sid, value in players.items()}
    one = dict(sf)
    for sid, value in (one_qb or {}).items():
        one[f"player:{sid}"] = value
    return {
        "asOf": as_of,
        "generatedAt": as_of,
        "sf": sf,
        "oneQb": one,
    }


class PriceHistoryTests(unittest.TestCase):
    def test_existing_stamp_is_kept_and_index_lists_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            values = root / "values.json"
            history = root / "history"
            values.write_text(json.dumps(board("2026-10-14", "19:17", {"4984": 14620}, {"4984": 8175})), encoding="utf-8")
            first = archive.archive(values, history)
            first.write_text('{"asOf":"keep","sf":{},"oneQb":{}}\n', encoding="utf-8")
            archive.archive(values, history)
            self.assertEqual(first.read_text(encoding="utf-8"), '{"asOf":"keep","sf":{},"oneQb":{}}\n')
            index = json.loads((history / "index.json").read_text(encoding="utf-8"))
            self.assertEqual(index["schemaVersion"], 1)
            self.assertEqual(index["retentionDays"], 90)
            self.assertEqual(index["schema"]["dates"], "filename and asOf are UTC; the calendar day is YYYY-MM-DD")
            self.assertEqual(index["snapshots"], [{"asOf": "keep", "stamp": "202610141917"}])

    def test_age_drops_snapshots_older_than_90_days_and_keeps_the_newest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            history = root / "history"
            for day in ("2026-01-01", "2026-07-20", "2026-10-15"):
                values = root / f"{day}.json"
                values.write_text(json.dumps(board(day, "12:00", {"1": 1})), encoding="utf-8")
                archive.archive(values, history)
            names = sorted(path.name for path in history.glob("20*.json"))
            self.assertEqual(names, ["202607201200.json", "202610151200.json"])
            index = json.loads((history / "index.json").read_text(encoding="utf-8"))
            self.assertEqual([row["stamp"] for row in index["snapshots"]], ["202607201200", "202610151200"])
            alone = root / "alone"
            only = root / "only.json"
            only.write_text(json.dumps(board("2025-01-01", "00:00", {"1": 1})), encoding="utf-8")
            archive.archive(only, alone)
            self.assertTrue((alone / "202501010000.json").exists())

    def test_timestamp_fields_do_not_count_as_a_price_change(self):
        before = {"asOf": "2026-10-14T19:17:17+00:00", "generatedAt": "2026-10-14T19:17:17+00:00", "sf": {"player:1": 10}, "oneQb": {"player:1": 4}}
        after = {"asOf": "2026-10-15T11:17:00+00:00", "generatedAt": "2026-10-15T11:17:00+00:00", "sf": {"player:1": 10}, "oneQb": {"player:1": 4}}
        moved = {"asOf": "2026-10-15T11:17:00+00:00", "generatedAt": "2026-10-15T11:17:00+00:00", "sf": {"player:1": 11}, "oneQb": {"player:1": 4}}
        self.assertTrue(prices.timestamps_only(before, after))
        self.assertFalse(prices.timestamps_only(before, moved))

    def test_committed_archive_matches_the_live_board(self):
        index_path = HISTORY / "index.json"
        self.assertTrue(index_path.exists(), "price-history index is missing")
        index = json.loads(index_path.read_text(encoding="utf-8"))
        snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        self.assertEqual(index["schemaVersion"], archive.SCHEMA_VERSION)
        self.assertEqual(index["retentionDays"], archive.RETENTION_DAYS)
        stamps = [row["stamp"] for row in index["snapshots"]]
        files = sorted(path.stem for path in HISTORY.glob("20*.json"))
        self.assertEqual(stamps, files)
        self.assertGreaterEqual(len(stamps), 1)
        self.assertEqual(stamps, sorted(stamps))
        self.assertIn("202609282149", stamps)
        newest = HISTORY / f"{stamps[-1]}.json"
        stored = json.loads(newest.read_text(encoding="utf-8"))
        self.assertEqual(set(stored), {"asOf", "oneQb", "sf"})
        self.assertEqual(stored["asOf"], snapshot["asOf"])
        self.assertEqual(stored["sf"], snapshot["sf"])
        self.assertEqual(stored["oneQb"], snapshot["oneQb"])
        size = newest.stat().st_size
        self.assertGreater(size, 30_000)
        self.assertLess(size, archive.MAX_SNAPSHOT_BYTES)
        self.assertLess(size * archive.RETENTION_DAYS, archive.MAX_ARCHIVE_BYTES)
        september = HISTORY / "202609282149.json"
        if september.exists():
            old = json.loads(september.read_text(encoding="utf-8"))
            self.assertEqual(old["asOf"][:10], "2026-09-28")
            self.assertEqual(old["sf"]["player:4984"], 14839)
            self.assertEqual(old["oneQb"]["player:4984"], 8452)
            self.assertIn("oneQb", old)


if __name__ == "__main__":
    unittest.main()
