"""Frozen pre-holdout calibrations for the native 0–100 dynasty price."""

from bisect import bisect_right

# Fit at the 2018 and 2020 preseason and Week 13 cutoffs. X is predicted
# discounted marginal PPR, Y is mean achieved discounted marginal PPR.
FOOTBALL_KNOTS = (
    (0.0, 0.0), (3.51, 4.76), (17.56, 34.16), (44.13, 62.44),
    (78.44, 99.68), (127.52, 124.91), (196.13, 192.01),
    (271.79, 257.96), (396.02, 344.93),
)
# Fixed reference surplus for startup player ranks 21, 7 and 3. Changes in
# the remaining schedule move the reference without re-ranking today's board.
# Anchors combine historical football forecasts and comparable market outcomes.
PHASE_REFERENCES = (
    (0.0, (117.94, 151.35, 164.83)),
    (1 / 3, (145.95, 198.89, 214.95)),
    (1.0, (185.58, 241.85, 282.47)),
)
# Median annual mean of the top three realized three-season surpluses, 2000–16.
HISTORICAL_CEILING = 501.36


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


def rating_anchors(remaining_fraction):
    """Interpolate the frozen draft reference for this point in the schedule."""
    fraction = min(1.0, max(0.0, remaining_fraction))
    interval = 0 if fraction <= PHASE_REFERENCES[1][0] else 1
    left_t, left = PHASE_REFERENCES[interval]
    right_t, right = PHASE_REFERENCES[interval + 1]
    progress = (fraction - left_t) / (right_t - left_t)
    references = [a + progress * (b - a) for a, b in zip(left, right)]
    return ((0.0, 0.0), *zip(references, (87.0, 90.0, 95.0)), (HISTORICAL_CEILING, 100.0))


def rate_from_anchors(surplus, anchors):
    """Keep depth proportional and progressively reduce gaps above the elite threshold."""
    if surplus <= 0:
        return 0.0
    for (lo, low_score), (hi, high_score) in zip(anchors[:3], anchors[1:4]):
        if surplus <= hi:
            return low_score + (surplus - lo) * (high_score - low_score) / (hi - lo)
    elite, previous = anchors[-2][0], anchors[-3][0]
    ceiling = anchors[-1][0]
    if surplus >= ceiling:
        return 100.0
    # This shoulder starts with the same slope as the 90–95 segment, stays
    # strictly increasing and reaches 100 at the historical realized ceiling.
    excess = surplus - elite
    gap = elite - previous
    return 95 + 5 * excess / (gap + (1 - gap / (ceiling - elite)) * excess)


def native_score(surplus, remaining_fraction=1.0):
    return rate_from_anchors(surplus, rating_anchors(remaining_fraction))
