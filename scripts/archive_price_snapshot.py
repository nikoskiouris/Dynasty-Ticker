#!/usr/bin/env python3
"""Archive the current board so shared links and trends read one price history.

Writes docs/data/price-history/<YYYYMMDDHHmm>.json (UTC, from player_values.json
asOf) with only asOf, sf, and oneQb. An existing stamp is never rewritten.
The same asOf writes nothing.

Also rewrites docs/data/price-history/index.json (schemaVersion 1) when the
stamp list changes, so the site can fetch the window without listing the
directory. Snapshot files stay {asOf, sf, oneQb}. The index is not a second store.

Drops a snapshot more than 90 days older than the newest one. The newest file
is always kept.

Run by .github/workflows/refresh-player-values.yml right after the build, and
safe to run by hand: python3 scripts/archive_price_snapshot.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALUES = ROOT / "docs/data/player_values.json"
HISTORY = ROOT / "docs/data/price-history"
RETENTION_DAYS = 90
SCHEMA_VERSION = 1
INDEX_NAME = "index.json"
# The live board is about 37 KB. Ninety of those stay under about 3.3 MB.
MAX_SNAPSHOT_BYTES = 40 * 1024
MAX_ARCHIVE_BYTES = int(3.3 * 1024 * 1024)
STAMP = re.compile(r"^20\d{10}\.json$")


def price_stamp(as_of: str) -> str:
    when = datetime.fromisoformat(str(as_of).replace("Z", "+00:00"))
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(timezone.utc).strftime("%Y%m%d%H%M")


def snapshot_files(history: Path) -> list[Path]:
    return sorted(path for path in history.iterdir() if STAMP.match(path.name))


def stamp_day(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        as_of = str(data.get("asOf") or "")
        when = datetime.fromisoformat(as_of.replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return when.astimezone(timezone.utc).date()
    except (OSError, json.JSONDecodeError, ValueError):
        return datetime.strptime(path.stem[:8], "%Y%m%d").date()


def prune(history: Path, keep: int | None = None) -> None:
    files = snapshot_files(history)
    if keep is not None:
        for old in files[:-keep] if keep > 0 else []:
            old.unlink()
        return
    if len(files) < 2:
        return
    newest_day = stamp_day(files[-1])
    for path in files[:-1]:
        if (newest_day - stamp_day(path)).days > RETENTION_DAYS:
            path.unlink()


def write_index(history: Path) -> None:
    rows = []
    for path in snapshot_files(history):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        as_of = data.get("asOf")
        if not isinstance(as_of, str) or not as_of:
            continue
        rows.append({"asOf": as_of, "stamp": path.stem})
    index = {
        "schemaVersion": SCHEMA_VERSION,
        "retentionDays": RETENTION_DAYS,
        "schema": {
            "snapshot": "docs/data/price-history/<YYYYMMDDHHmm>.json",
            "snapshotKeys": ["asOf", "sf", "oneQb"],
            "dates": "filename and asOf are UTC; the calendar day is YYYY-MM-DD",
            "oneQb": "full 1QB price map, same asset ids as sf",
            "retention": "drop a file more than 90 days older than the newest; always keep the newest",
        },
        "snapshots": rows,
    }
    text = json.dumps(index, separators=(",", ":"), sort_keys=True) + "\n"
    path = history / INDEX_NAME
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return
    path.write_text(text, encoding="utf-8")


def archive(values_path: Path = VALUES, history: Path = HISTORY, keep: int | None = None) -> Path:
    data = json.loads(values_path.read_text())
    stamp = price_stamp(data["asOf"])
    history.mkdir(parents=True, exist_ok=True)
    target = history / f"{stamp}.json"
    if not target.exists():
        snapshot = {"asOf": data["asOf"], "sf": data["sf"], "oneQb": data["oneQb"]}
        target.write_text(json.dumps(snapshot, separators=(",", ":"), sort_keys=True) + "\n")
    prune(history, keep)
    if keep is None:
        write_index(history)
    return target


if __name__ == "__main__":
    path = archive()
    print(f"price snapshot {path.relative_to(ROOT)}")
    sys.exit(0)
