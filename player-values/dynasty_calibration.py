"""Frozen pre-holdout calibrations for the native 0–100 dynasty price."""

from bisect import bisect_right

# Fit at the 2018 and 2020 preseason and Week 13 cutoffs. X is predicted
# discounted marginal PPR, Y is mean achieved discounted marginal PPR.
FOOTBALL_KNOTS = (
    (0.0, 0.0), (3.51, 4.76), (17.56, 34.16), (44.13, 62.44),
    (78.44, 99.68), (127.52, 124.91), (196.13, 192.01),
    (271.79, 257.96), (396.02, 344.93),
)
# Median best calibrated pre-season estimate across those two as-of boards.
ELITE_EXPECTED_SURPLUS = 361.37


def calibrated_football(projected):
    if projected <= 0:
        return 0.0
    high = bisect_right(FOOTBALL_KNOTS, (projected, float("inf")))
    if high == len(FOOTBALL_KNOTS):
        x, y = FOOTBALL_KNOTS[-1]
        return projected * y / x
    x0, y0 = FOOTBALL_KNOTS[high - 1]
    x1, y1 = FOOTBALL_KNOTS[high]
    return y0 + (projected - x0) * (y1 - y0) / (x1 - x0)


# Quote, season-one marginal PPR, discounted marginal PPR across seasons two
# and three. Guide: May 2026 player quote ranks paired with historical startup
# draft bands. Adjacent year-two/three reversals are pooled by band width.
MARKET_KNOTS = (
    (0.0, 0.0, 0.0), (110.5, 0.96, 2.23), (648.5, 2.36, 4.71),
    (1283.5, 6.02, 8.10), (1741.5, 14.21, 21.94), (2423.5, 37.46, 48.36),
    (3516.5, 54.51, 73.76), (4205.5, 59.82, 83.63), (5673.0, 76.23, 113.42),
    (7146.0, 89.49, 113.42), (8715.0, 115.26, 122.37), (10069.0, 122.92, 122.53),
)


def market_surplus(quote, remaining_fraction):
    """Translate a quote into comparable PPR over the remaining forecast horizon."""
    if quote <= 0:
        return 0.0
    high = bisect_right(MARKET_KNOTS, (quote, float("inf"), float("inf")))
    if high == len(MARKET_KNOTS):
        x, first, later = MARKET_KNOTS[-1]
        return (first * remaining_fraction + later) * quote / x
    x0, first0, later0 = MARKET_KNOTS[high - 1]
    x1, first1, later1 = MARKET_KNOTS[high]
    t = (quote - x0) / (x1 - x0)
    first = first0 + t * (first1 - first0)
    later = later0 + t * (later1 - later0)
    return first * remaining_fraction + later


def native_score(surplus):
    return min(100.0, max(0.0, 100 * surplus / ELITE_EXPECTED_SURPLUS))
