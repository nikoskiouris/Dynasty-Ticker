from __future__ import annotations

from src.domain.models import LeagueContext, Roster


class ValidationError(ValueError):
    pass


def find_manager_roster(ctx: LeagueContext, manager_name: str) -> Roster:
    normalized = manager_name.strip().lower()
    matches = [r for r in ctx.rosters if r.manager.display_name.lower() == normalized]
    if not matches:
        partial = [r for r in ctx.rosters if normalized in r.manager.display_name.lower()]
        if len(partial) == 1:
            return partial[0]
        if len(partial) > 1:
            raise ValidationError(f"Manager name '{manager_name}' is ambiguous.")
        raise ValidationError(f"Manager '{manager_name}' not found in league.")
    return matches[0]


def find_asset_by_name(roster: Roster, target_name: str):
    normalized = target_name.strip().lower()
    exact = [asset for asset in roster.assets if asset.name.lower() == normalized]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise ValidationError(f"Target asset '{target_name}' is ambiguous.")
    partial = [
        asset for asset in roster.assets
        if normalized and normalized in asset.name.lower()
    ]
    if len(partial) == 1:
        return partial[0]
    if len(partial) > 1:
        raise ValidationError(f"Target asset '{target_name}' is ambiguous.")
    raise ValidationError(f"Target asset '{target_name}' not found on roster for {roster.manager.display_name}.")
