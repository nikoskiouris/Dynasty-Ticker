"""Independent player and pick valuation for 12-team, full-PPR superflex dynasty.

Score the entire league-wide board before filtering its results.
Input fields, assumptions and empirical references are in the model research notes.
"""

from bisect import bisect_left, bisect_right
from math import floor, isfinite
from statistics import median

from inseason import remaining_forecast, remaining_share


VALUE_SCALE = 100
HUNDREDTHS_PER_POINT = 100
TEAMS = 12
STARTERS = {"QB": 1, "RB": 2, "WR": 3, "TE": 1}
WEIGHTS = {"lineup": 0.35, "future": 0.40, "market": 0.25}
# Year-two and year-three expected full-PPR surplus per scheduled team game.
# nflverse, 2000–2016 draft classes. The NFL rounds are 1, 2, 3, and 4+.
DRAFT_SURPLUS = {
    "QB": ((2.30, 2.80), (0.71, 1.10), (0.70, 0.46), (0.08, 0.17)),
    "RB": ((3.57, 4.82), (2.47, 1.81), (1.54, 1.53), (0.27, 0.27)),
    "WR": ((2.21, 2.67), (1.05, 1.58), (0.52, 0.70), (0.18, 0.18)),
    "TE": ((0.51, 1.14), (0.47, 0.27), (0.50, 0.51), (0.03, 0.15)),
}


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (ValueError, TypeError):
        return None
    return result if isfinite(result) else None


def lineup_total(by_position):
    """Maximize PPR subject to each mandatory seat, then FLEX, then SF.

    These eligibility sets are nested. Exchanges within the narrower slots
    cannot decrease the best feasible solution for the wider ones.
    """
    total = 0.0
    available = {}
    for pos, n in STARTERS.items():
        cutoff = TEAMS * n
        scores = by_position[pos]
        total += sum(scores[:cutoff])
        available[pos] = scores[cutoff:]
    skill = sorted(available["RB"] + available["WR"] + available["TE"], reverse=True)
    total += sum(skill[:TEAMS])
    superflex = sorted(available["QB"] + skill[TEAMS:], reverse=True)
    return total + sum(superflex[:TEAMS])


def replacement_levels(board):
    """Score the best lineup without the top player at each position.

    All players at a position have identical eligibility. The replacement
    gained on deleting any selected player there is consequently the same,
    even if the league fills the vacancy by reshuffling a shared slot.
    """
    ordered = {pos: sorted(scores, reverse=True) for pos, scores in board.items()}
    # At least two full SF candidates per team and reserves across eligibility
    # groups are needed to estimate the opportunity cost from this population.
    minima = {"QB": 25, "RB": 25, "WR": 37, "TE": 13}
    if (any(len(ordered[p]) < n for p, n in minima.items())
            or sum(map(len, ordered.values())) < TEAMS * 9 + 12):
        raise ValueError("Insufficient full-PPR player coverage for a 12-team superflex board")
    total = lineup_total(ordered)
    levels = {}
    for pos, scores in ordered.items():
        without_first = dict(ordered)
        without_first[pos] = scores[1:]
        lost_points = total - lineup_total(without_first)
        levels[pos] = max(0.0, scores[0] - lost_points)
    return levels


def future_production(row, season_week):
    """Estimate repeatable season production with partial-season shrinkage.

    A projection has six games of weight. Last year's full-season output has
    up to eight. Estimate team games elapsed from the schedule, including missed
    appearances and averaging the bye across the 18 regular-season weeks.
    """
    projection = number(row.get("season_ppr"))
    total, weight = (projection * 6, 6) if projection is not None else (0, 0)
    last, last_games = number(row.get("last_ppr")), number(row.get("last_games"))
    if last is not None and last_games and last_games > 0:
        reliability = min(8.0, last_games)
        total += last * reliability
        weight += reliability
    points, played = number(row.get("actual_ppr")), number(row.get("games"))
    if season_week > 1 and points is not None and played and played > 0:
        # The active week can be partially complete. Never annualize on fewer
        # team opportunities than the player has actually played.
        elapsed = min(17, max(played, (season_week - 1) * 17 / 18))
        total += 17 * points
        weight += elapsed
    return max(0, total / weight) if weight else None


# Ratios of year +1 and +2 realized surplus to starter-cohort surplus at Y.
# Bins centered on age 23, 26, 29, 32, 35. Pool thin oldest RB and TE bins.
RETENTION = {
    # QB anchors after 35 scale that age's estimates by the relative chance of
    # beating QB24, fitted to age and prior finish in the 2000–16 starter cohort.
    "QB": ((.84, .79), (.86, .76), (.81, .70), (.78, .63), (.61, .53),
           (.539, .450), (.466, .373), (.393, .303), (.323, .241), (.260, .188)),
    "RB": ((.78, .68), (.74, .51), (.49, .29), (.33, .14), (.33, .14)),
    "WR": ((.88, .83), (.70, .63), (.74, .59), (.57, .40), (.46, .16)),
    "TE": ((.72, .75), (.64, .56), (.59, .44), (.61, .39), (.61, .39)),
}
# Future surplus by previous rank. Small adjacent reversals pooled by cohort
# size to keep improving production monotonic. The last anchor fades to zero.
RANK_CENTERS = (2, 5, 9.5, 15.5, 21.5, 27.5, 33.5, 42.5, 56.5, 80.5, 111)
RANK_SURPLUS = {
    "QB": (115.1, 86.7, 65, 48.7, 33.7, 16.4, 8, 5.3, 3, 3, 0),
    "RB": (108.9, 76.1, 65.5, 40, 20.4, 20.4, 17.3, 11.2, 8.5, 3.7, 0),
    "WR": (111.8, 90.2, 67, 52.6, 44.5, 31.1, 31.1, 17.8, 13.4, 8.5, 0),
    "TE": (58.1, 29.2, 18.9, 8.5, 8.5, 4.9, 2.5, 1.6, .9, .4, 0),
}


def interpolate(x, xs, ys):
    if x <= xs[0]:
        return ys[0]
    for i in range(1, len(xs)):
        if x <= xs[i]:
            fraction = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
            return ys[i - 1] + fraction * (ys[i] - ys[i - 1])
    return ys[-1]


def retention_factor(pos, age):
    """Give the second forward season 85% of the first season's weight."""
    typical_age = {"QB": 29, "RB": 26, "WR": 27, "TE": 28}[pos]
    years = age if age is not None and 18 <= age <= 50 else typical_age
    retention = [(a + .85 * b) / 1.85 for a, b in RETENTION[pos]]
    anchors = (23, 26, 29, 32, 35)
    if pos == "QB":
        anchors += (38, 41, 44, 47, 50)
    return interpolate(years, anchors, retention)


def expected_surplus(pos, future, threshold, age, ordered):
    if future is None or future <= 0:
        return 0.0
    retention = retention_factor(pos, age)
    individual = max(0, future - threshold) * retention
    # Ties get the same midpoint rank irrespective of source iteration order.
    rank = 1 + len(ordered) - (bisect_left(ordered, future) + bisect_right(ordered, future) + 1) / 2
    cohort = interpolate(rank, RANK_CENTERS, RANK_SURPLUS[pos])
    # Cohort expectations already include average age-related attrition.
    adjusted = cohort * retention / retention_factor(pos, None)
    return (individual + adjusted) / 2


def prospect_prior(row):
    """Blend an NFL draft cohort estimate into an early-career player's outlook."""
    years = number(row.get("draft_seasons_ago"))
    if years is None:
        years = number(row.get("years_exp"))
    overall = number(row.get("draft_pick"))
    nfl_round = number(row.get("draft_round"))
    if nfl_round is None and overall is not None and 1 <= overall <= 270:
        nfl_round = min(7, (int(overall) - 1) // 32 + 1)
    if years not in (0, 1) or nfl_round not in range(1, 8):
        return 0.0, 0.0
    second, third = DRAFT_SURPLUS[row["pos"]][min(int(nfl_round), 4) - 1]
    appearances = max(0, min(17, number(row.get("games")) or 0)) / 17
    if years == 0:
        return 17 * (second + 0.85 * third) / 1.85, 0.65 - 0.40 * appearances
    return 17 * third, 0.25 * (1 - appearances)


def apportion(components):
    """Largest-remainder rounding keeps the published explanation additive."""
    target = round(sum(components.values()))
    parts = {key: floor(val) for key, val in components.items()}
    order = sorted(parts, key=lambda key: components[key] - parts[key], reverse=True)
    for key in order[:target - sum(parts.values())]:
        parts[key] += 1
    return target, parts


def value_board(players, picks, *, season_week=1):
    """Return (players, picks, diagnostics). Invalid or unsupported assets are omitted."""
    week = max(1, min(19, int(season_week)))
    forecasts = {}
    season_board = {pos: [] for pos in STARTERS}
    future_board = {pos: [] for pos in STARTERS}
    for key, row in players.items():
        pos = row.get("pos")
        if pos not in STARTERS:
            continue
        # A preseason projection can linger for a player who has left the NFL.
        if ("team" in row and not row["team"] and not row.get("market")
                and not row.get("games")):
            continue
        current = remaining_forecast(row, week)
        future = future_production(row, week)
        forecasts[key] = current, future
        # Finished teams have no unearned points. Their zeros still occupy
        # eligible seats late in Week 18, when only one game may remain.
        if current is not None:
            season_board[pos].append(current)
        if future is not None and future > 0:
            future_board[pos].append(future)
    now_level = replacement_levels(season_board)
    future_level = replacement_levels(future_board)
    ordered_future = {pos: sorted(scores) for pos, scores in future_board.items()}
    raw = {}
    evidence = {}
    for key, (current, future) in forecasts.items():
        row, pos = players[key], players[key]["pos"]
        coverage = []
        quote = max(0, number(row.get("market")) or 0)
        if number(row.get("season_ppr")) is not None:
            coverage.append("seasonProjection")
        if row.get("forward_games"):
            coverage.append("forwardWeeks")
        if row.get("recent_team_games") and row.get("recent_ppr") is not None:
            coverage.append("recentTeamGames")
        if number(row.get("last_games")) and number(row.get("last_ppr")) is not None:
            coverage.append("priorSeason")
        if week > 1 and number(row.get("games")) and number(row.get("actual_ppr")) is not None:
            coverage.append("currentSeason")
        age = number(row.get("age"))
        current_value = max(0, (current or 0) - now_level[pos])
        future_value = expected_surplus(pos, future, future_level[pos], age, ordered_future[pos])
        draft, share = prospect_prior(row)
        if share:
            coverage.append("draftCapital")
        if quote:
            coverage.append("market")
        raw[key] = {"lineup": current_value, "future": (1 - share) * future_value,
                    "draft": share * draft, "market": quote}
        evidence[key] = coverage

    # Put each signal on an elite-relative scale. Use the same denominator for
    # outlook and draft capital because both express future PPR surplus.
    current_scale = max(row["lineup"] for row in raw.values())
    future_scale = max(row["future"] + row["draft"] for row in raw.values())
    market_scale = max(row["market"] for row in raw.values())
    if future_scale <= 0:
        raise ValueError("Missing usable full-board scoring spread")
    # Independent normalization would otherwise make six games of lineup
    # advantage worth as much as seventeen. Shift only unplayable weeks to
    # the outlook, retaining the independent market anchor throughout.
    time_left = remaining_share(players, week) if current_scale > 0 else 0
    lineup_weight = WEIGHTS["lineup"] * time_left
    future_weight = WEIGHTS["future"] + WEIGHTS["lineup"] - lineup_weight
    factors = {}
    for key, row in raw.items():
        factors[key] = {
            "lineup": lineup_weight * row["lineup"] / current_scale if current_scale > 0 else 0,
            "future": future_weight * row["future"] / future_scale,
            "draft": future_weight * row["draft"] / future_scale,
            "market": WEIGHTS["market"] * row["market"] / market_scale if market_scale else 0,
        }

    # A pick has no projected production. Translate its direct market quote
    # onto our board using similarly quoted players, preserving quote order.
    peak = max(sum(row.values()) for row in factors.values())
    # Allocate integer hundredths before exposing a price. This keeps ties,
    # cross-asset interpolation and all four contributions exact to one cent.
    scale = VALUE_SCALE * HUNDREDTHS_PER_POINT / peak
    player_results = {}
    for key, row in factors.items():
        value, parts = apportion({name: val * scale for name, val in row.items()})
        if value > 0:
            current = forecasts[key][0]
            player_results[key] = {"value": value, "factors": parts, "coverage": evidence[key],
                                   "remainingPpr": round(current, 1) if current is not None else None}

    # The picker interpolates on the same integer grid as player prices.
    pick_results = {}
    if market_scale:
        reference = sorted((raw[k]["market"], r["value"]) for k, r in player_results.items()
                           if raw[k]["market"] > 0)
        for key, row in picks.items():
            quote = number(row.get("market"))
            if quote is not None and quote > 0:
                value = quote_to_board(quote, reference)
                pick_results[key] = {"value": value, "factors": {"market": value}, "coverage": ["market"]}
    for board in (player_results, pick_results):
        for result in board.values():
            result["value"] /= HUNDREDTHS_PER_POINT
            result["factors"] = {key: cents / HUNDREDTHS_PER_POINT for key, cents in result["factors"].items()}
    return player_results, pick_results, {
        "lineup": {"teams": TEAMS, **STARTERS, "FLEX": 1, "SUPER_FLEX": 1},
        "weights": {"lineup": lineup_weight, "future": future_weight, "market": WEIGHTS["market"]},
        "baseWeights": dict(WEIGHTS),
        "remainingSeasonFraction": time_left,
        "futureSeasons": 2,
        "secondYearDiscount": 0.85,
        "futureCohortShare": 0.5,
        "draftPriorShare": {"rookieStart": 0.65, "rookieEnd": 0.25, "secondYearEnd": 0},
        "seasonReplacement": {p: round(v, 3) for p, v in now_level.items()},
        "futureReplacement": {p: round(v, 3) for p, v in future_level.items()},
        "marketPlayers": sum(row["market"] > 0 for row in raw.values()),
    }


def quote_to_board(quote, reference):
    """Map an external quote to a local price via monotone cohort medians."""
    # Twelve-player cohorts reduce single-player noise (roughly one round
    # of a startup). Highest and lowest anchors keep interpolation bounded.
    anchors = [(0, 0)]
    for start in range(0, len(reference), TEAMS):
        cohort = reference[start:start + TEAMS]
        if len(cohort) < TEAMS // 2:
            continue
        x = median([m for m, _ in cohort])
        y = median([v for _, v in cohort])
        if x > anchors[-1][0]:
            anchors.append((x, max(y, anchors[-1][1])))
    maximum_quote = reference[-1][0]
    if maximum_quote > anchors[-1][0]:
        anchors.append((maximum_quote, max(v for _, v in reference)))
    for (x0, y0), (x1, y1) in zip(anchors, anchors[1:]):
        if quote <= x1:
            return max(1, round(y0 + (quote - x0) * (y1 - y0) / (x1 - x0)))
    return max(1, round(anchors[-1][1]))
