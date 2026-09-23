#!/usr/bin/env python3
"""Debug probes the unit tests do not run. Exit 1 when a hidden bug shows up."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.domain.models import Asset, LeagueContext, Manager, Roster
from src.domain.valuation import ValuationService
from src.engine.trade_generator import TradeGenerator
from src.engine.validation import ValidationError, find_asset_by_name, find_manager_roster
from src.integrations.ktc_provider import KeepTradeCutProvider, _coerce_value
from src.integrations.sleeper_client import sleeper_points


FAILURES: list[str] = []
CHECKS = 0


def check(name: str, run) -> None:
    global CHECKS
    CHECKS += 1
    try:
        detail = run()
        if detail:
            FAILURES.append(f"{name}: {detail}")
    except Exception as exc:  # noqa: BLE001 - the probe should report, not crash
        FAILURES.append(f"{name}: {type(exc).__name__}: {exc}")


def asset(asset_id: str, name: str) -> Asset:
    return Asset(asset_id=asset_id, name=name, asset_type="player")


def roster(roster_id: int, name: str, assets: list[Asset]) -> Roster:
    return Roster(roster_id=roster_id, manager=Manager(user_id=str(roster_id), display_name=name), assets=assets)


def check_asset_names() -> str:
    bag = roster(1, "Niko", [
        asset("player:1", "Jeremiah Smith"),
        asset("player:2", "Smithson"),
        asset("player:3", "Jahmyr Gibbs"),
    ])
    found = find_asset_by_name(bag, "Jahmyr Gibbs")
    if found.asset_id != "player:3":
        return f"exact match returned {found.name}"
    try:
        find_asset_by_name(bag, "smith")
    except ValidationError:
        return ""
    return "partial name smith silently picked one player"


def check_manager_names() -> str:
    ctx = LeagueContext(league_id="L", rosters=[
        roster(1, "Niko Ball", []),
        roster(2, "Niko West", []),
    ])
    try:
        find_manager_roster(ctx, "niko")
    except ValidationError:
        return ""
    return "partial manager niko silently picked one roster"


def check_value_coercion() -> str:
    samples = {
        0: 0,
        "0": 0,
        True: None,
        9000.5: 9001,
        "1,234": 1234,
        "nope": None,
        None: None,
    }
    for raw, expected in samples.items():
        got = _coerce_value(raw)
        if got != expected:
            return f"{raw!r} -> {got!r}, wanted {expected!r}"
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "values.csv"
        path.write_text("asset_id,value,name\nplayer:a,9000.5,Ace\nplayer:b,0,Zero\n", encoding="utf-8")
        loaded = KeepTradeCutProvider(cache_file=str(Path(tmp) / "missing.json"), ttl_seconds=0)._load_from_csv(str(path))
    if loaded.get("player:a") != 9001 or loaded.get("player:b") != 0:
        return f"csv load {loaded}"
    return ""


def check_sleeper_points() -> str:
    if sleeper_points(100.45, 45) != 100.45:
        return f"float whole {sleeper_points(100.45, 45)}"
    if sleeper_points(140, 50) != 140.5:
        return f"split stat {sleeper_points(140, 50)}"
    return ""


def check_even_value() -> str:
    service = ValuationService({"player:a": 4000, "player:b": 2500})
    previous = -1
    for gap in (0, 1, 10, 50, 100, 400, 1200, 5000):
        even = service.find_even_value(gap, 4000)
        if even < previous:
            return f"gap {gap} -> {even} after {previous}"
        previous = even
        if even < 0:
            return f"negative even value {even}"
    return ""


def check_fair_trades() -> str:
    values = {"player:mine": 3000, "player:theirs": 3000, "player:extra": 200}
    service = ValuationService(values)
    generator = TradeGenerator(service, fairness_pct=8)
    mine = roster(1, "Me", [asset("player:mine", "Mine"), asset("player:extra", "Extra")])
    theirs = roster(2, "Them", [asset("player:theirs", "Theirs")])
    suggestions = generator.generate(mine, theirs, asset("player:theirs", "Theirs"), max_results=5)
    if not suggestions:
        return "even swap was dropped"
    for suggestion in suggestions:
        if suggestion.pct_diff > 8:
            return f"pct diff {suggestion.pct_diff}"
        mine_ids = {item.asset_id for item in suggestion.my_assets}
        their_ids = {item.asset_id for item in suggestion.their_assets}
        if mine_ids & their_ids:
            return f"same asset on both sides {mine_ids & their_ids}"
        if "player:theirs" not in their_ids:
            return "target missing from their side"
    wide = TradeGenerator(ValuationService({"player:cheap": 400, "player:star": 4200}), fairness_pct=5)
    unfair = wide.generate(
        roster(1, "Me", [asset("player:cheap", "Cheap")]),
        roster(2, "Them", [asset("player:star", "Star")]),
        asset("player:star", "Star"),
    )
    if unfair:
        return f"unfair trade survived at {unfair[0].pct_diff}%"
    return ""


def main() -> int:
    check("asset names", check_asset_names)
    check("manager names", check_manager_names)
    check("value coercion", check_value_coercion)
    check("sleeper points", check_sleeper_points)
    check("even value", check_even_value)
    check("fair trades", check_fair_trades)
    if FAILURES:
        print(f"debug invariants found {len(FAILURES)} bug{'s' if len(FAILURES) != 1 else ''} in {CHECKS} checks", file=sys.stderr)
        for failure in FAILURES:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"debug invariants ok ({CHECKS} checks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
