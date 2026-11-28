"""Estimate unearned regular-season full-PPR points from evidence available today."""

from statistics import mean

# Equivalent preseason team games and additional weight for each of the most
# recent four team games. See research/inseason-forecast.md.
PRIOR_GAMES = 8
RECENT_WEIGHT = 1
RESERVE_MULTIPLIER = 0.56
FORWARD_SHARE = 0.75


def remaining_games(row, week, season_games=17):
    if week >= season_games + 2:
        return 0
    if row.get("remaining_games") is not None:
        return max(0, min(season_games, row["remaining_games"]))
    elapsed = row.get("team_games")
    if elapsed is None:
        elapsed = max(row.get("games") or 0, (week - 1) * season_games / (season_games + 1))
    return max(0, min(season_games, season_games - elapsed))


def observed_rate(row, week, season_games=17, prior_games=PRIOR_GAMES, recent_weight=RECENT_WEIGHT):
    """Shrink recorded points per team opportunity toward the initial forecast."""
    prior = max(0, row.get("season_ppr") or 0) / season_games
    if week <= 1 and not row.get("team_games") and not row.get("games"):
        return prior
    elapsed = row.get("team_games")
    if elapsed is None:
        elapsed = (week - 1) * season_games / (season_games + 1)
    elapsed = max(elapsed, row.get("games") or 0)
    total = prior_games * prior + (row.get("actual_ppr") or 0)
    exposure = prior_games + elapsed
    if row.get("recent_ppr") is not None and row.get("recent_team_games"):
        total += recent_weight * row["recent_ppr"]
        exposure += recent_weight * row["recent_team_games"]
    return max(0, total / exposure) if exposure else 0


def remaining_forecast(row, week, season_games=17, *, prior_games=PRIOR_GAMES,
                       recent_weight=RECENT_WEIGHT, reserve_multiplier=RESERVE_MULTIPLIER):
    left = remaining_games(row, week, season_games)
    if left <= 0:
        return 0.0
    if "team" in row and not row["team"] and not row.get("forward_games"):
        return None
    if not any(row.get(k) is not None for k in ("season_ppr", "actual_ppr", "recent_ppr", "forward_ppr")):
        return None
    pace = observed_rate(row, week, season_games, prior_games, recent_weight)
    # Apply reserve uncertainty to the fallback. A direct forecast for a
    # specific future game may already reflect a projected return to play.
    if row.get("injury_status") in {"IR", "PUP"}:
        pace *= reserve_multiplier
    covered = min(left, max(0, row.get("forward_games") or 0))
    forward = max(0, row.get("forward_ppr") or 0)
    backup = max(0, row.get("backup_games") or 0)
    if row.get("injury_status") == "Out" and row.get("current_week_open"):
        # Remove this game once. A numeric zero already counts toward the
        # provider's coverage and must not remove a second unsupported week.
        left -= 1
        current_week = row.get("week_ppr")
        if current_week is not None and covered:
            covered -= 1
            forward = max(0, forward - max(0, current_week))
        elif row.get("current_week_backup"):
            backup = max(0, backup - 1)
    covered = min(left, covered)
    backup = min(left - covered, backup)
    uncovered = left - backup - covered
    # A teammate forecast for the QB job is evidence of a backup role.
    # Leave the empirical minority share for uncertain later role changes.
    known_weeks = (FORWARD_SHARE * forward if covered else 0) + (1 - FORWARD_SHARE) * (covered + backup) * pace
    return pace * uncovered + known_weeks


def remaining_share(players, week):
    """One vote per NFL club so roster size cannot change the time horizon."""
    if week >= 19:
        return 0
    by_team = {row["team"]: row["remaining_games"] for row in players.values()
               if row.get("team") and row.get("remaining_games") is not None}
    if len(by_team) == 32:
        return mean(by_team.values()) / 17
    return max(0, 1 - (week - 1) / 18)
