from __future__ import annotations

import json
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from src.config import settings
from src.domain.models import Asset, LeagueContext, Manager, Roster


class SleeperClient:
    def __init__(self, base_url: str | None = None, timeout: int | None = None):
        self.base_url = (base_url or settings.sleeper_base_url).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.request_timeout

    def _get(self, path: str) -> dict | list:
        url = f"{self.base_url}{path}"
        try:
            with urlopen(url, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError) as exc:
            raise RuntimeError(f"Sleeper API request failed for {url}: {exc}") from exc

    def get_user(self, username: str) -> dict:
        return self._get(f"/user/{username}")

    def get_league(self, league_id: str) -> dict:
        data = self._get(f"/league/{league_id}")
        assert isinstance(data, dict)
        return data

    def get_leagues_for_user(self, user_id: str, season: str, sport: str = "nfl") -> list[dict]:
        data = self._get(f"/user/{user_id}/leagues/{sport}/{season}")
        assert isinstance(data, list)
        return data

    def get_users_in_league(self, league_id: str) -> list[dict]:
        data = self._get(f"/league/{league_id}/users")
        assert isinstance(data, list)
        return data

    def get_rosters(self, league_id: str) -> list[dict]:
        data = self._get(f"/league/{league_id}/rosters")
        assert isinstance(data, list)
        return data

    def get_traded_picks(self, league_id: str) -> list[dict]:
        data = self._get(f"/league/{league_id}/traded_picks")
        assert isinstance(data, list)
        return data

    def get_players(self, sport: str = "nfl") -> dict:
        data = self._get(f"/players/{sport}")
        assert isinstance(data, dict)
        return data


def _display_name_for_user(user: dict | None, fallback: str) -> str:
    if not user:
        return fallback
    return user.get("display_name") or user.get("username") or fallback


def _extract_roster_points(roster: dict) -> float | None:
    settings = roster.get("settings") or {}
    whole = settings.get("fpts")
    if whole is None or isinstance(whole, bool):
        return None
    return sleeper_points(whole, settings.get("fpts_decimal", 0))


def sleeper_points(whole, decimal) -> float:
    whole_value = float(whole)
    if not whole_value.is_integer():
        return round(whole_value, 2)
    if decimal is None or isinstance(decimal, bool):
        decimal_value = 0.0
    else:
        decimal_value = float(decimal)
    if decimal_value == 0:
        return round(whole_value, 2)
    fraction = decimal_value if abs(decimal_value) < 1 else decimal_value / 100
    return round(whole_value + fraction, 2)


def _ordinal(rank: int) -> str:
    if 10 <= rank % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(rank % 10, "th")
    return f"{rank}{suffix}"


def _format_previous_year_rank_label(rank: int, total_teams: int) -> str:
    if rank <= 0 or total_teams <= 0:
        return "Previous Year"
    return f"{_ordinal(rank)}/{_ordinal(total_teams)} in Previous Year"


def _build_previous_finish_lookup(previous_league: dict | None, previous_rosters: list[dict] | None) -> tuple[dict[str, str], dict[str, str]]:
    if not previous_league or not previous_rosters:
        return {}, {}

    ranked = [
        {
            "roster_id": str(roster.get("roster_id")),
            "owner_id": str(roster.get("owner_id")) if roster.get("owner_id") is not None else None,
            "points": points,
        }
        for roster in previous_rosters
        if (points := _extract_roster_points(roster)) is not None
    ]
    ranked.sort(key=lambda row: (-row["points"], int(row["roster_id"])))

    by_roster_id: dict[str, str] = {}
    by_user_id: dict[str, str] = {}
    total_teams = len(ranked)
    for idx, row in enumerate(ranked, start=1):
        label = _format_previous_year_rank_label(idx, total_teams)
        by_roster_id[row["roster_id"]] = label
        if row["owner_id"] is not None:
            by_user_id[row["owner_id"]] = label
    return by_roster_id, by_user_id


def _resolve_pick_owner_name(original_owner: object, user_by_id: dict[str, dict], roster_by_id: dict[str, dict]) -> str | None:
    if original_owner is None:
        return None

    owner_key = str(original_owner)
    roster = roster_by_id.get(owner_key)
    if roster is not None:
        roster_id = roster.get("roster_id", owner_key)
        owner = user_by_id.get(str(roster.get("owner_id"))) if roster.get("owner_id") is not None else None
        return _display_name_for_user(owner, f"Roster {roster_id}")

    user = user_by_id.get(owner_key)
    if user is not None:
        return _display_name_for_user(user, owner_key)

    return None


def _resolve_previous_finish_label(
    original_owner: object,
    current_roster_by_id: dict[str, dict],
    previous_finish_by_roster_id: dict[str, str],
    previous_finish_by_user_id: dict[str, str],
) -> str | None:
    if original_owner is None:
        return None

    owner_key = str(original_owner)
    if owner_key in previous_finish_by_roster_id:
        return previous_finish_by_roster_id[owner_key]
    if owner_key in previous_finish_by_user_id:
        return previous_finish_by_user_id[owner_key]

    roster = current_roster_by_id.get(owner_key)
    if roster is None:
        return None

    roster_id = str(roster.get("roster_id"))
    if roster_id in previous_finish_by_roster_id:
        return previous_finish_by_roster_id[roster_id]

    owner_id = roster.get("owner_id")
    if owner_id is not None and str(owner_id) in previous_finish_by_user_id:
        return previous_finish_by_user_id[str(owner_id)]

    return None


def _format_pick_name(
    pick: dict,
    user_by_id: dict[str, dict],
    roster_by_id: dict[str, dict],
    previous_finish_by_roster_id: dict[str, str],
    previous_finish_by_user_id: dict[str, str],
) -> str:
    season = pick.get("season")
    round_ = pick.get("round")
    original_owner = pick.get("original_owner")

    details: list[str] = []
    owner_name = _resolve_pick_owner_name(original_owner, user_by_id, roster_by_id)
    if owner_name:
        details.append(f"from {owner_name}")

    finish_label = _resolve_previous_finish_label(
        original_owner,
        roster_by_id,
        previous_finish_by_roster_id,
        previous_finish_by_user_id,
    )
    if finish_label:
        details.append(finish_label)

    suffix = f" ({', '.join(details)})" if details else ""
    return f"{season} Round {round_} Pick{suffix}"


def normalize_pick(
    pick: dict,
    user_by_id: dict[str, dict],
    roster_by_id: dict[str, dict],
    previous_finish_by_roster_id: dict[str, str],
    previous_finish_by_user_id: dict[str, str],
) -> Asset:
    season = pick.get("season")
    round_ = pick.get("round")
    original_owner = pick.get("original_owner") or "any"
    asset_id = f"pick:{season}:r{round_}:{original_owner}"
    name = _format_pick_name(
        pick,
        user_by_id=user_by_id,
        roster_by_id=roster_by_id,
        previous_finish_by_roster_id=previous_finish_by_roster_id,
        previous_finish_by_user_id=previous_finish_by_user_id,
    )
    return Asset(asset_id=asset_id, name=name, asset_type="pick", raw=pick)


def _normalize_roster_key(value: object) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _coerce_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_owned_pick_record(pick: dict, fallback_owner_id: object | None = None) -> dict | None:
    season = pick.get("season")
    round_ = _coerce_int(pick.get("round"))
    if season in (None, "") or round_ is None:
        return None

    original_owner = pick.get("original_owner")
    if original_owner is None:
        original_owner = pick.get("roster_id", fallback_owner_id)
    current_owner = pick.get("owner_id")
    if current_owner is None:
        current_owner = fallback_owner_id if fallback_owner_id is not None else original_owner
    return {
        **pick,
        "season": str(season),
        "round": round_,
        "roster_id": original_owner,
        "original_owner": original_owner,
        "owner_id": current_owner,
        "previous_owner_id": pick.get("previous_owner_id", current_owner),
    }


def _normalize_traded_pick_record(pick: dict) -> dict | None:
    season = pick.get("season")
    round_ = _coerce_int(pick.get("round"))
    original_owner = pick.get("roster_id")
    if original_owner is None:
        original_owner = pick.get("original_owner")
    current_owner = pick.get("owner_id")
    if season in (None, "") or round_ is None or original_owner is None or current_owner is None:
        return None

    return {
        **pick,
        "season": str(season),
        "round": round_,
        "roster_id": original_owner,
        "original_owner": original_owner,
        "owner_id": current_owner,
        "previous_owner_id": pick.get("previous_owner_id", current_owner),
    }


def _infer_league_pick_seasons(league: dict | None, rosters: list[dict], traded_picks: list[dict]) -> list[str]:
    explicit_seasons = [
        season
        for roster in rosters
        for pick in roster.get("picks", []) or []
        if (season := _coerce_int((pick or {}).get("season"))) is not None
    ]
    traded_seasons = [season for pick in traded_picks if (season := _coerce_int((pick or {}).get("season"))) is not None]

    base_season = _coerce_int((league or {}).get("season")) or datetime.utcnow().year
    observed_start_seasons = [*explicit_seasons, *traded_seasons]
    start_season = min(observed_start_seasons) if observed_start_seasons else base_season
    end_season = max([*explicit_seasons, *traded_seasons, start_season + (1 if observed_start_seasons else 2)])
    return [str(season) for season in range(start_season, end_season + 1)]


def _infer_league_draft_rounds(league: dict | None, rosters: list[dict], traded_picks: list[dict]) -> int:
    configured_rounds = _coerce_int(((league or {}).get("settings") or {}).get("draft_rounds")) or 0
    explicit_rounds = [
        round_
        for roster in rosters
        for pick in roster.get("picks", []) or []
        if (round_ := _coerce_int((pick or {}).get("round"))) is not None
    ]
    traded_rounds = [round_ for pick in traded_picks if (round_ := _coerce_int((pick or {}).get("round"))) is not None]
    if configured_rounds > 0:
        return max([configured_rounds, *explicit_rounds, *traded_rounds])
    return max([*explicit_rounds, *traded_rounds, 5])


def _build_pick_ownership_key(season: str, round_: int, original_owner_key: str) -> str:
    return f"{season}:{round_}:{original_owner_key}"


def _build_owned_picks_by_roster(league: dict | None, rosters: list[dict], traded_picks: list[dict] | None) -> dict[str, list[dict]]:
    roster_keys = [key for roster in rosters if (key := _normalize_roster_key(roster.get("roster_id"))) is not None]
    owned_by_roster = {roster_key: [] for roster_key in roster_keys}
    explicit_pick_count = sum(len(roster.get("picks", []) or []) for roster in rosters)

    if explicit_pick_count:
        for roster in rosters:
            roster_key = _normalize_roster_key(roster.get("roster_id"))
            if roster_key is None:
                continue
            owned_by_roster[roster_key] = [
                normalized
                for pick in roster.get("picks", []) or []
                if (normalized := _normalize_owned_pick_record(pick, roster.get("roster_id"))) is not None
            ]
        return owned_by_roster

    normalized_traded_picks = [
        normalized
        for pick in (traded_picks or [])
        if (normalized := _normalize_traded_pick_record(pick)) is not None
    ]
    seasons = _infer_league_pick_seasons(league, rosters, normalized_traded_picks)
    draft_rounds = _infer_league_draft_rounds(league, rosters, normalized_traded_picks)
    roster_key_set = set(roster_keys)
    current_owner_by_pick: dict[str, str] = {}

    for season in seasons:
        for round_ in range(1, draft_rounds + 1):
            for original_owner_key in roster_keys:
                current_owner_by_pick[_build_pick_ownership_key(season, round_, original_owner_key)] = original_owner_key

    for pick in normalized_traded_picks:
        original_owner_key = _normalize_roster_key(pick.get("roster_id"))
        current_owner_key = _normalize_roster_key(pick.get("owner_id"))
        if (
            original_owner_key is None
            or current_owner_key is None
            or original_owner_key not in roster_key_set
            or current_owner_key not in roster_key_set
        ):
            continue
        current_owner_by_pick[_build_pick_ownership_key(str(pick["season"]), int(pick["round"]), original_owner_key)] = current_owner_key

    for ownership_key, current_owner_key in current_owner_by_pick.items():
        season, round_token, original_owner_key = ownership_key.split(":")
        owned_by_roster[current_owner_key].append(
            {
                "season": season,
                "round": int(round_token),
                "roster_id": int(original_owner_key) if original_owner_key.isdigit() else original_owner_key,
                "original_owner": int(original_owner_key) if original_owner_key.isdigit() else original_owner_key,
                "owner_id": int(current_owner_key) if current_owner_key.isdigit() else current_owner_key,
                "previous_owner_id": int(current_owner_key) if current_owner_key.isdigit() else current_owner_key,
            }
        )

    for picks in owned_by_roster.values():
        picks.sort(key=lambda pick: (_coerce_int(pick.get("season")) or 0, _coerce_int(pick.get("round")) or 0, str(pick.get("original_owner"))))

    return owned_by_roster


def build_league_context(
    league_id: str,
    users: list[dict],
    rosters: list[dict],
    players: dict,
    previous_league: dict | None = None,
    previous_rosters: list[dict] | None = None,
    league: dict | None = None,
    traded_picks: list[dict] | None = None,
) -> LeagueContext:
    user_by_id = {str(u["user_id"]): u for u in users}
    roster_by_id = {str(r["roster_id"]): r for r in rosters}
    previous_finish_by_roster_id, previous_finish_by_user_id = _build_previous_finish_lookup(previous_league, previous_rosters)
    owned_picks_by_roster = _build_owned_picks_by_roster(league, rosters, traded_picks)
    normalized_rosters: list[Roster] = []

    for roster in rosters:
        owner_id = roster.get("owner_id")
        owner = user_by_id.get(str(owner_id), {})
        manager = Manager(
            user_id=str(owner_id) if owner_id is not None else "unknown",
            display_name=_display_name_for_user(owner, f"Roster {roster['roster_id']}"),
        )

        assets: list[Asset] = []
        for pid in roster.get("players", []) or []:
            player_meta = players.get(pid, {})
            name = (
                f"{player_meta.get('first_name', '').strip()} {player_meta.get('last_name', '').strip()}".strip()
                or player_meta.get("full_name")
                or pid
            )
            assets.append(Asset(asset_id=f"player:{pid}", name=name, asset_type="player", raw=player_meta))

        for pick in owned_picks_by_roster.get(str(roster.get("roster_id")), []):
            assets.append(
                normalize_pick(
                    pick,
                    user_by_id=user_by_id,
                    roster_by_id=roster_by_id,
                    previous_finish_by_roster_id=previous_finish_by_roster_id,
                    previous_finish_by_user_id=previous_finish_by_user_id,
                )
            )

        normalized_rosters.append(Roster(roster_id=roster["roster_id"], manager=manager, assets=assets))

    return LeagueContext(league_id=league_id, rosters=normalized_rosters)
