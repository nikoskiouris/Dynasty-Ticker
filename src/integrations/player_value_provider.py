from __future__ import annotations

import json
from pathlib import Path

MODEL_VERSION = "football-forecast-v1"
DEFAULT_VALUE_FILE = Path(__file__).resolve().parents[2] / "docs" / "data" / "player_values.json"


def league_value_format(league: dict | None) -> str:
    slots = [str(slot or "").upper() for slot in (league or {}).get("roster_positions", [])]
    if any(slot in {"SUPER_FLEX", "OP"} for slot in slots) or slots.count("QB") >= 2:
        return "sf"
    return "oneQb"


class PlayerValueProvider:
    """Read the same generated value snapshot consumed by the web app."""

    def __init__(self, value_file: str | Path | None = None):
        self.value_file = Path(value_file) if value_file else DEFAULT_VALUE_FILE

    def load_bundle(self) -> dict:
        payload = json.loads(self.value_file.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise RuntimeError("Player-value snapshot is not an object.")
        if payload.get("modelVersion") != MODEL_VERSION:
            raise RuntimeError(
                f"Unsupported player-value model: {payload.get('modelVersion') or 'missing'}"
            )
        return payload

    def load_values(self, value_format: str) -> dict[str, int]:
        payload = self.load_bundle()
        key = "oneQb" if value_format == "oneQb" else "sf"
        raw = payload.get(key)
        if not isinstance(raw, dict):
            raise RuntimeError(f"Player-value snapshot is missing {key}.")
        values: dict[str, int] = {}
        for asset_id, value in raw.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            if value < 0:
                continue
            values[str(asset_id)] = round(value)
        if not any(asset_id.startswith("player:") for asset_id in values):
            raise RuntimeError(f"Player-value snapshot contains no {key} players.")
        return values
