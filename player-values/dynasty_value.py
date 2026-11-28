"""Independent player and pick valuation for 12-team, full-PPR superflex dynasty.

Score the entire league-wide board before filtering its results.
Input fields, assumptions and empirical references are in the model research notes.
"""

from bisect import bisect_left, bisect_right
from math import floor, isfinite

from dynasty_calibration import calibrated_football, market_surplus, rate_from_anchors, rating_anchors
from inseason import remaining_forecast, remaining_share


VALUE_SCALE = 100
HUNDREDTHS_PER_POINT = 100
TEAMS = 12
STARTERS = {"QB": 1, "RB": 2, "WR": 3, "TE": 1}
MARKET_SHARE = 0.25
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
        # A trade across bye weeks can give a player an 18-game regular
        # season. Compare its scoring rate on the same 17-game horizon.
        total += last * min(1.0, 17 / last_games) * reliability
        weight += reliability
    points, played = number(row.get("actual_ppr")), number(row.get("games"))
    if points is not None and played and played > 0:
        # A settled opener counts while Week 1 is still active. An 18th
        # appearance counts as exposure even after the ordinary 17 games.
        elapsed = max(played, min(17, (season_week - 1) * 17 / 18))
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


DISCOUNT = 0.85
FUTURE_SEASONS = DISCOUNT + DISCOUNT ** 2


def raw_board(players, *, season_week=1):
    """Discounted lineup PPR before cross-season outcome or market calibration."""
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
        if number(row.get("games")) and number(row.get("actual_ppr")) is not None:
            coverage.append("currentSeason")
        age = number(row.get("age"))
        current_value = max(0, (current or 0) - now_level[pos])
        future_value = expected_surplus(pos, future, future_level[pos], age, ordered_future[pos])
        draft, share = prospect_prior(row)
        if share:
            coverage.append("draftCapital")
        if quote:
            coverage.append("market")
        raw[key] = {"lineup": current_value, "future": FUTURE_SEASONS * (1 - share) * future_value,
                    "draft": FUTURE_SEASONS * share * draft, "market": quote, "coverage": coverage,
                    "remainingPpr": round(current, 1) if current is not None else None}
    return raw, {"seasonReplacement": {p: round(v, 3) for p, v in now_level.items()},
                 "futureReplacement": {p: round(v, 3) for p, v in future_level.items()},
                 "remainingSeasonFraction": remaining_share(players, week)}


def value_board(players, picks, *, season_week=1):
    """Estimate three-season surplus and quote it in native dynasty points."""
    raw, context = raw_board(players, season_week=season_week)
    time_left = context["remainingSeasonFraction"]
    anchors = rating_anchors(time_left)
    player_results = {}
    for key, row in raw.items():
        football = {factor: row[factor] for factor in ("lineup", "future", "draft")}
        projected = sum(football.values())
        # A real projection or recorded season can give an estimated surplus
        # of zero. A schedule with no observed player role is missing evidence.
        has_football = any(source in row["coverage"] for source in (
            "seasonProjection", "forwardWeeks", "priorSeason", "currentSeason", "draftCapital"))
        if "recentTeamGames" in row["coverage"] and (number(players[key].get("recent_games")) or 0) > 0:
            has_football = True
        has_market = row["market"] > 0
        if not has_football and not has_market:
            continue
        market_share = MARKET_SHARE if has_market and has_football else float(has_market)
        football_units = calibrated_football(projected) * (1 - market_share)
        components = {k: football_units * v / projected if projected > 0 else 0.0
                      for k, v in football.items()}
        components["market"] = market_share * market_surplus(row["market"], time_left)
        expected = sum(components.values())
        if expected <= 0:
            continue
        score = rate_from_anchors(expected, anchors)
        # Allocate the final rating to the four underlying discounted-surplus
        # signals in proportion to the amount each contributed.
        target_scale = HUNDREDTHS_PER_POINT * score / expected
        cents, allocated = apportion({k: v * target_scale for k, v in components.items()})
        if cents == 0:
            continue
        player_results[key] = {
            "value": cents / HUNDREDTHS_PER_POINT,
            "factors": {k: v / HUNDREDTHS_PER_POINT for k, v in allocated.items()},
            "coverage": row["coverage"], "remainingPpr": row["remainingPpr"],
            "projectedSurplus": round(projected, 3) if has_football else None,
            "calibratedSurplus": round(expected, 3), "marketShare": market_share,
        }

    # Picks have no individual NFL production history. Convert each supported
    # quote using the identical fixed reference used for players' market input.
    pick_results = {}
    for key, row in picks.items():
        quote = number(row.get("market"))
        if quote is None or quote <= 0:
            continue
        expected = market_surplus(quote, time_left)
        price = round(rate_from_anchors(expected, anchors) * HUNDREDTHS_PER_POINT) / HUNDREDTHS_PER_POINT
        if price > 0:
            pick_results[key] = {
                "value": price, "factors": {"market": price}, "coverage": ["market"],
                "projectedSurplus": None, "calibratedSurplus": round(expected, 3), "marketShare": 1.0,
            }
    return player_results, pick_results, {
        **context,
        "lineup": {"teams": TEAMS, **STARTERS, "FLEX": 1, "SUPER_FLEX": 1},
        "method": "seasonal-startup-rating",
        "scoreAnchors": [{"score": score, "surplus": surplus} for surplus, score in anchors],
        "ratingReference": {"earlyDraftScore": 87, "eliteScore": 90, "upperCurve": "rational-above-95"},
        "marketWeight": MARKET_SHARE, "horizonDiscount": DISCOUNT,
        "futureSeasons": 2, "secondYearDiscount": DISCOUNT, "futureCohortShare": 0.5,
        "draftPriorShare": {"rookieStart": 0.65, "rookieEnd": 0.25, "secondYearEnd": 0},
        "marketPlayers": sum(row["market"] > 0 for row in raw.values()),
    }
