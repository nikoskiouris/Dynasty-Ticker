#!/usr/bin/env python3
"""Archive the current board so shared trade links can show what the sharer saw.

Writes docs/data/price-history/<YYYYMMDDHHmm>.json (UTC, from player_values.json
asOf) with only asOf, sf, and oneQb. An existing stamp is never rewritten, so a
snapshot is immutable once published. Keeps the newest KEEP files.

Run by .github/workflows/refresh-player-values.yml right after the build, and
safe to run by hand: python3 scripts/archive_price_snapshot.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALUES = ROOT / "docs/data/player_values.json"
HISTORY = ROOT / "docs/data/price-history"
KEEP = 60  # about 14 months of weekly refreshes
STAMP = re.compile(r"^20\d{10}\.json$")


def price_stamp(as_of: str) -> str:
    when = datetime.fromisoformat(str(as_of).replace("Z", "+00:00"))
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(timezone.utc).strftime("%Y%m%d%H%M")


def archive(values_path: Path = VALUES, history: Path = HISTORY, keep: int = KEEP) -> Path:
    data = json.loads(values_path.read_text())
    stamp = price_stamp(data["asOf"])
    history.mkdir(parents=True, exist_ok=True)
    target = history / f"{stamp}.json"
    if not target.exists():
        snapshot = {"asOf": data["asOf"], "sf": data["sf"], "oneQb": data["oneQb"]}
        target.write_text(json.dumps(snapshot, separators=(",", ":"), sort_keys=True) + "\n")
    files = sorted(p for p in history.iterdir() if STAMP.match(p.name))
    for old in files[:-keep] if keep > 0 else []:
        old.unlink()
    return target


if __name__ == "__main__":
    path = archive()
    print(f"price snapshot {path.relative_to(ROOT)}")
    sys.exit(0)
