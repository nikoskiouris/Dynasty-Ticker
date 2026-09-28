from __future__ import annotations

import argparse
import logging
from datetime import datetime

from src.domain.valuation import ValuationService
from src.engine.trade_generator import TradeGenerator
from src.engine.validation import ValidationError, find_asset_by_name, find_manager_roster
from src.integrations.player_value_provider import PlayerValueProvider, league_value_format
from src.integrations.sleeper_client import SleeperClient, build_league_context

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suggest dynasty trades using Dynasty Ticker independent full-PPR values.")
    parser.add_argument("--me", required=True, help="Your Sleeper display name.")
    parser.add_argument("--target-manager", required=True, help="Manager to trade with.")
    parser.add_argument("--target-player", required=True, help="Player you want to acquire.")
    parser.add_argument("--league", help="League ID. If omitted, will use your first league for season.")
    parser.add_argument("--username", help="Sleeper username for league discovery (if --league omitted).")
    parser.add_argument("--season", default=str(datetime.utcnow().year), help="Season for league discovery.")
    parser.add_argument("--max-results", type=int, default=5)
    parser.add_argument("--fairness-pct", type=float, default=15.0)
    parser.add_argument("--value-file", help="Optional path to a football-forecast player_values.json snapshot.")
    parser.add_argument(
        "--allow-extra-target-assets",
        action="store_true",
        help="Allow the other manager to include extra players/picks alongside your target player.",
    )
    return parser.parse_args()


def resolve_league_id(client: SleeperClient, league_id: str | None, username: str | None, season: str) -> str:
    if league_id:
        return league_id
    if not username:
        raise ValidationError("Provide --league or --username for automatic league discovery.")
    user = client.get_user(username)
    leagues = client.get_leagues_for_user(user_id=user["user_id"], season=season)
    if not leagues:
        raise ValidationError(f"No leagues found for user '{username}' in season {season}.")
    return leagues[0]["league_id"]


def format_value(value: int) -> str:
    return f"{value:,}"


def format_asset_with_value(asset, valuation: ValuationService) -> str:
    value = valuation.get_asset_value(asset.asset_id)
    if value is None:
        return asset.name
    return f"{asset.name} ({format_value(value)})"


def main() -> int:
    args = parse_args()
    client = SleeperClient()

    try:
        league_id = resolve_league_id(client, args.league, args.username, args.season)
        league = client.get_league(league_id)
        users = client.get_users_in_league(league_id)
        rosters = client.get_rosters(league_id)
        traded_picks = []
        try:
            traded_picks = client.get_traded_picks(league_id)
        except RuntimeError as exc:
            logging.warning("Could not load traded picks for league %s: %s", league_id, exc)
        players = client.get_players("nfl")

        previous_league = None
        previous_rosters = None
        previous_league_id = league.get("previous_league_id")
        if previous_league_id:
            try:
                previous_league = client.get_league(previous_league_id)
                previous_rosters = client.get_rosters(previous_league_id)
            except RuntimeError as exc:
                logging.warning("Could not load previous league context for pick labels: %s", exc)

        ctx = build_league_context(
            league_id,
            users,
            rosters,
            players,
            previous_league=previous_league,
            previous_rosters=previous_rosters,
            league=league,
            traded_picks=traded_picks,
        )

        my_roster = find_manager_roster(ctx, args.me)
        their_roster = find_manager_roster(ctx, args.target_manager)
        target_asset = find_asset_by_name(their_roster, args.target_player)

        value_format = league_value_format(league)
        values = PlayerValueProvider(args.value_file).load_values(value_format)
        valuation = ValuationService(values)
        generator = TradeGenerator(valuation=valuation, fairness_pct=args.fairness_pct)
        suggestions = generator.generate(
            my_roster,
            their_roster,
            target_asset,
            max_results=args.max_results,
            allow_extra_target_assets=args.allow_extra_target_assets,
        )

        if not suggestions:
            print("No fair trades found with current valuation data and fairness threshold.")
            return 0

        print(f"Suggested trades for {my_roster.manager.display_name} to acquire {target_asset.name} from {their_roster.manager.display_name}:")
        for idx, suggestion in enumerate(suggestions, start=1):
            my_side = ", ".join(format_asset_with_value(asset, valuation) for asset in suggestion.my_assets)
            their_side = ", ".join(format_asset_with_value(asset, valuation) for asset in suggestion.their_assets)
            print(f"\n{idx}. You send: {my_side}")
            print(f"   They send: {their_side}")
            print(f"   Base value: you {format_value(suggestion.my_base_value)} vs them {format_value(suggestion.their_base_value)}")
            if suggestion.package_adjustment:
                side = "your side" if suggestion.package_adjustment_side == "my" else "their side"
                print(f"   Package adjustment: +{format_value(suggestion.package_adjustment)} on {side}")
            else:
                print("   Package adjustment: none")
            print(
                f"   Adjusted total: you {format_value(suggestion.my_adjusted_value)} vs them {format_value(suggestion.their_adjusted_value)} "
                f"(diff {suggestion.pct_diff}%)"
            )
            print(f"   Add value to even: {format_value(suggestion.even_value)}")

        return 0
    except ValidationError as exc:
        logging.error(str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
