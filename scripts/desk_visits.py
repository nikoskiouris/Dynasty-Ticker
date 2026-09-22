#!/usr/bin/env python3
"""Print the desk tally in US Eastern time.

views: page loads. people: distinct browsers. active: loaded a league
or saved a rather pick. days: last 14 Eastern dates. sources: referring
host only. landings: home, shared league link, or legal page.
"""
from __future__ import annotations

import json
import sys
from urllib.error import URLError
from urllib.request import urlopen

API = "https://dynastyticker.com/api/views"
PERIODS = ("today", "week", "year", "all")


def num(value: object) -> int:
    try:
        parsed = int(value or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, parsed)


def counts(payload: object) -> list[int]:
    data = payload if isinstance(payload, dict) else {}
    rows: list[int] = []
    for period in PERIODS:
        bucket = data.get(period) if isinstance(data.get(period), dict) else {}
        for key in ("views", "people"):
            rows.append(num(bucket.get(key)))
    return rows


def _bucket(data: dict, period: str) -> dict:
    bucket = data.get(period)
    return bucket if isinstance(bucket, dict) else {}


def report(payload: object) -> str:
    data = payload if isinstance(payload, dict) else {}
    lines = ["US Eastern. Week is Monday-Sunday.", ""]
    for period in PERIODS:
        bucket = _bucket(data, period)
        lines.append(
            f"{period:<5} views {num(bucket.get('views')):<6} "
            f"people {num(bucket.get('people')):<6} active {num(bucket.get('active'))}"
        )
    days = data.get("days") if isinstance(data.get("days"), list) else []
    lines.extend(["", "days"])
    if not days:
        lines.append("none")
    for row in days:
        if not isinstance(row, dict):
            continue
        lines.append(
            f"{row.get('day') or 'unknown'}  views {num(row.get('views')):<6} "
            f"people {num(row.get('people')):<6} active {num(row.get('active'))}"
        )
    for period in ("today", "week"):
        bucket = _bucket(data, period)
        sources = bucket.get("sources") if isinstance(bucket.get("sources"), dict) else {}
        landings = bucket.get("landings") if isinstance(bucket.get("landings"), dict) else {}
        ranked = sorted(sources.items(), key=lambda item: (-num(item[1]), str(item[0])))
        lines.extend(["", f"{period} sources"])
        if not ranked:
            lines.append("direct 0")
        for host, value in ranked:
            lines.append(f"{host} {num(value)}")
        lines.append(f"{period} landings")
        for key in ("home", "shared", "legal"):
            lines.append(f"{key} {num(landings.get(key))}")
    return "\n".join(lines)


def main() -> int:
    with urlopen(API, timeout=10) as response:
        payload = json.load(response)
    print(report(payload))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, URLError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1)
