#!/usr/bin/env python3
"""Exit 0 when the value files differ from HEAD only by asOf or generatedAt.

A new generatedAt is not a price change. sf, oneQb, and every other field are.
The refresh workflow restores the files on exit 0, then uses git diff --quiet
on the data files as the commit gate.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "docs/data/player_values.json",
    "player-values/validation.json",
)
STAMP_KEYS = {"asOf", "generatedAt"}


def strip_stamps(payload):
    if not isinstance(payload, dict):
        return payload
    return {key: value for key, value in payload.items() if key not in STAMP_KEYS}


def timestamps_only(before, after) -> bool:
    return strip_stamps(before) == strip_stamps(after)


def head_json(rel: str, repo: Path = ROOT):
    result = subprocess.run(
        ["git", "show", f"HEAD:{rel}"],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def working_tree_timestamps_only(repo: Path = ROOT) -> bool:
    for rel in FILES:
        before = head_json(rel, repo)
        path = repo / rel
        if before is None or not path.is_file():
            return False
        after = json.loads(path.read_text(encoding="utf-8"))
        if not timestamps_only(before, after):
            return False
    return True


if __name__ == "__main__":
    if working_tree_timestamps_only():
        print("Player values match HEAD aside from asOf and generatedAt.")
        sys.exit(0)
    print("Player values changed.")
    sys.exit(1)
