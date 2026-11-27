"""Fit Superflex asset prices using completed trades and their dates."""
from collections import Counter, defaultdict, deque
from datetime import date, datetime, timedelta, timezone
import math

import numpy as np
from scipy.optimize import minimize
from scipy.sparse import csr_matrix

from build import POSITIONS, offensive_position

MODEL_VERSION = "sleeper-trades-v5"
DISPLAY_FIRST = 5000
LOOKBACK = 900
RECENT_DAYS = 210
SPARSE_REGULARIZATION = 1.5
SPARSE_LEAGUE_SEASONS = 5
PICK_ROUNDS = {f"r{round_number}" for round_number in range(1, 6)}
ANCHOR = "pick:r1"


def usable_trades(corpus, sleeper_players, as_of):
    """Limit the trade sample to supported asset types."""
    result = []
    for row in corpus["trades"]:
        when = datetime.fromtimestamp(row["timestamp"] / 1000, timezone.utc).date()
        reversed_at = row.get("reversalConfirmedAt")
        if reversed_at and datetime.fromtimestamp(reversed_at / 1000, timezone.utc).date() <= as_of:
            continue
        if not row.get("transfers") or not 0 <= (as_of - when).days <= LOOKBACK:
            continue
        sides = []
        for side in row["sides"]:
            kept = []
            for asset in side:
                kind, *parts = asset.split(":")
                if (
                    kind == "pick" and len(parts) in (2, 3)
                    and parts[1] in PICK_ROUNDS and parts[0].isdigit()
                    and (len(parts) == 2 or parts[2].isdigit() and 1 <= int(parts[2]) <= 12)
                ):
                    kept.append(asset)
                elif kind == "player" and len(parts) == 1:
                    player = sleeper_players.get(parts[0], {})
                    if offensive_position(player) in POSITIONS:
                        kept.append(asset)
                    else:
                        break
                else:
                    break
            else:
                if kept:
                    sides.append(kept)
        if len(sides) != 2 or Counter(sides[0]) == Counter(sides[1]):
            continue
        if any(asset.startswith("player:") for asset in set(sides[0]) & set(sides[1])):
            continue
        result.append((when, sides, row["league"]))
    return sorted(result, key=lambda trade: trade[0])


def asset_key(asset):
    if asset.startswith("pick:"):
        return f"pick:{asset.split(':')[2]}"
    return asset


def pick_delay(asset, when):
    parts = asset.split(":")
    if len(parts) == 4:  # The pick is already on the clock or waiting in this draft.
        return 0.0
    year = int(parts[1])
    return min(6, max(0, (date(year, 6, 1) - when).days / 365.2425))


def pick_slot_offset(asset):
    parts = asset.split(":")
    return (6.5 - int(parts[3])) / 5.5 if len(parts) == 4 else 0.0


def connected_trades(trades):
    """Only price assets that can be compared with a first through the trade graph."""
    links = defaultdict(set)
    keys_by_trade = []
    for _, sides, _ in trades:
        keys = {asset_key(asset) for side in sides for asset in side}
        keys_by_trade.append(keys)
        first = min(keys)
        links[first].update(keys - {first})
        for other in keys - {first}:
            links[other].add(first)
    connected = {ANCHOR}
    pending = deque(connected)
    while pending:
        for key in links[pending.popleft()] - connected:
            connected.add(key)
            pending.append(key)
    return [trade for trade, keys in zip(trades, keys_by_trade) if keys <= connected]


class TradeFit:
    def __init__(self, trades, as_of, half_life, penalty):
        trades = connected_trades(trades)
        if not trades:
            raise RuntimeError("No trades connected to the first-round price anchor")
        keys = sorted({asset_key(asset) for _, sides, _ in trades for side in sides for asset in side})
        self.columns = {key: index for index, key in enumerate(keys)}
        rounds = sorted(key for key in keys if key.startswith("pick:"))
        # A round's log price is the sum of its step and the steps for
        # previous rounds. A non-positive step enforces ordering at fit time.
        self.pick_steps = {
            key: [self.columns[previous] for previous in rounds[:index + 1]]
            for index, key in enumerate(rounds)
        }
        delay_index = len(keys)
        slot_index = delay_index + 1
        self.count = Counter()
        self.recent = Counter()
        self.latest = {}
        self.league_seasons = defaultdict(set)
        self.recent_leagues = defaultdict(set)
        self.recent_partners = {}
        rows, columns, data, side_start = [], [], [], []
        row = 0
        for when, sides, league in trades:
            for side in sides:
                side_start.append(row)
                for asset in side:
                    key = asset_key(asset)
                    if key.startswith("player:"):
                        self.count[asset] += 1
                        self.league_seasons[asset].add(league)
                        self.latest[asset] = when
                        if (as_of - when).days <= RECENT_DAYS:
                            self.recent[asset] += 1
                            self.recent_leagues[asset].add(league)
                            partners = {asset_key(other) for other in side if other != asset}
                            self.recent_partners.setdefault(asset, partners).intersection_update(partners)
                    else:
                        rows.append(row)
                        columns.append(delay_index)
                        data.append(pick_delay(asset, when))
                        slot_offset = pick_slot_offset(asset)
                        if slot_offset:
                            rows.append(row)
                            columns.append(slot_index)
                            data.append(slot_offset)
                    steps = self.pick_steps[key] if key in self.pick_steps else [self.columns[key]]
                    rows.extend([row] * len(steps))
                    columns.extend(steps)
                    data.extend([1] * len(steps))
                    row += 1

        weights = np.array([2 ** (-(as_of - when).days / half_life) for when, _, _ in trades])
        matrix = csr_matrix((data, (rows, columns)), shape=(row, slot_index + 1))
        boundaries = np.asarray(side_start)
        counts = np.diff(np.append(boundaries, row))
        initial = np.zeros(slot_index + 1)
        player_columns = np.array([key.startswith("player:") for key in keys] + [False, False])
        if not player_columns.any():
            raise RuntimeError("No players connected to the first-round price anchor")
        # One league's deals give a weaker price signal than the same evidence
        # spread across several league seasons. Learn a common center and
        # give estimates based on fewer leagues a stronger pull toward it.
        precision = np.full(slot_index + 1, penalty * 0.1)
        for key, index in self.columns.items():
            if key.startswith("player:"):
                missing = max(0, SPARSE_LEAGUE_SEASONS - len(self.league_seasons[key]))
                precision[index] = penalty + SPARSE_REGULARIZATION * missing / (SPARSE_LEAGUE_SEASONS - 1)
        bounds = [(-7, 4) if key.startswith("player:") else (-7, 0) for key in keys]
        bounds.extend(((-1.5, 0), (0, 1.5)))
        bounds[self.columns[ANCHOR]] = (0, 0)

        def loss(coefs):
            prices = np.exp(matrix @ coefs)
            totals = np.add.reduceat(prices, boundaries)
            residual = np.log(totals[::2]) - np.log(totals[1::2])
            scaled = np.sqrt(1 + (residual / 0.4) ** 2)
            offset = coefs.copy()
            offset[player_columns] -= np.average(coefs[player_columns], weights=precision[player_columns])
            regularization = precision * offset
            error = np.dot(weights, 0.16 * (scaled - 1)) + 0.5 * np.dot(offset, regularization)
            side_grad = (weights * residual / scaled)[:, None] * np.array([1, -1])
            asset_grad = prices * np.repeat(side_grad.ravel() / totals, counts)
            return error, matrix.T @ asset_grad + regularization

        fitted = minimize(loss, initial, method="L-BFGS-B", jac=True, bounds=bounds,
                          options={"maxiter": 500, "ftol": 1e-9})
        if not fitted.success or not np.isfinite(fitted.x).all():
            raise RuntimeError(f"Trade model fit failed: {fitted.message}")
        self.coefs = fitted.x
        self.annual_discount = math.exp(fitted.x[delay_index])
        self.pick_slot_coefficient = float(fitted.x[slot_index])

    def price(self, asset, when):
        key = asset_key(asset)
        index = self.columns.get(key)
        if index is None:
            return None
        if key not in self.pick_steps:
            return DISPLAY_FIRST * math.exp(self.coefs[index])
        log_price = sum(self.coefs[step] for step in self.pick_steps[key])
        value = DISPLAY_FIRST * math.exp(log_price)
        value *= self.annual_discount ** pick_delay(asset, when)
        value *= math.exp(self.pick_slot_coefficient * pick_slot_offset(asset))
        return value

    def publishable(self, asset):
        return (
            self.recent[asset] >= 3
            and len(self.recent_leagues[asset]) >= 3
            and not self.recent_partners.get(asset)
        )

    def evidence(self, asset):
        return {
            "completedTrades": self.count[asset],
            "recentTrades": self.recent[asset],
            "leagueSeasons": len(self.league_seasons.get(asset, ())),
            "recentDays": RECENT_DAYS,
            "recentLeagueSeasons": len(self.recent_leagues.get(asset, ())),
            "alwaysPackagedWith": sorted(self.recent_partners.get(asset, ())),
            "priceSupported": self.publishable(asset),
            "lastTradeDate": self.latest[asset].isoformat() if asset in self.latest else None,
            "limited": self.recent[asset] < 5 or len(self.league_seasons.get(asset, ())) < SPARSE_LEAGUE_SEASONS,
        }


def side_gap(first, second):
    return abs(first - second) / (first + second) * 200


def summarize(gaps):
    return {
        "scored": len(gaps),
        "medianSideGapPct": round(float(np.median(gaps)), 2) if gaps else None,
        "p90SideGapPct": round(float(np.percentile(gaps, 90)), 2) if gaps else None,
    }


def evaluate(model, trades):
    segments = defaultdict(list)
    shapes = defaultdict(list)
    scored = 0
    for when, sides, league in trades:
        if any(asset_key(asset) not in model.columns or (
            asset.startswith("player:") and not model.publishable(asset)
        ) for side in sides for asset in side):
            continue
        scored += 1
        sizes = tuple(map(len, sides))
        totals = [sum(model.price(asset, when) for asset in side) for side in sides]
        kind = "equalSize" if sizes[0] == sizes[1] else "unequalSize"
        segments["all"].append(side_gap(*totals))
        segments[kind].append(side_gap(*totals))
        segments[f"{kind}FlatControl"].append(side_gap(*sizes))
        # Pair trades of the same shape in the same UTC week. Shuffle the
        # second side across leagues while leaving the first side untouched.
        if sizes[0] > sizes[1] or (sizes[0] == sizes[1] and tuple(sides[0]) > tuple(sides[1])):
            sizes = sizes[::-1]
            sides = sides[::-1]
        shapes[(when.toordinal() // 7, *sizes)].append((when, sides, league))
    wins = comparisons = 0
    for group in shapes.values():
        for index, (when, sides, league) in enumerate(group):
            alternatives = group[index + 1:] + group[:index]
            other = next((second for _, (_, second), peer in alternatives
                          if peer != league and second != sides[1]
                          and not set(sides[0]) & set(second)), None)
            if other is None:
                continue
            first, actual = [sum(model.price(asset, when) for asset in side) for side in sides]
            alternate = sum(model.price(asset, when) for asset in other)
            observed_gap = side_gap(first, actual)
            alternative_gap = side_gap(first, alternate)
            comparisons += 1
            wins += 0.5 if abs(observed_gap - alternative_gap) < 1e-9 else observed_gap < alternative_gap
    return {
        "eligibleTrades": len(trades),
        **{key: summarize(segments[key]) for key in
           ("all", "equalSize", "unequalSize", "equalSizeFlatControl", "unequalSizeFlatControl")},
        "matchedAlternativeComparisons": comparisons,
        "matchedAlternativeWinPct": round(100 * wins / comparisons, 2) if comparisons else None,
    }


def train(eligible, as_of, history_at):
    trades = connected_trades(eligible)
    league_seasons = len({league for _, _, league in trades})
    if len(trades) < 1000 or league_seasons < 30:
        raise RuntimeError(f"Only {len(trades)} connected trades available for training")
    split = as_of - timedelta(days=42)
    windows = []
    for days_before in (84, 42):
        start = split - timedelta(days=days_before)
        end = start + timedelta(days=42)
        history = history_at(start)
        # Freeze each scoring set at the end of its own window. A reversal
        # or a path discovered later cannot revise the tuning sample.
        validation = [row for row in history_at(end) if row[0] >= start]
        if len(history) >= 700 and len(validation) >= 100:
            windows.append((start, history, validation))

    half_life, penalty = 150, 0.1
    trials = []
    for days in (60, 90, 150):
        for shrinkage in (0.1, 0.5):
            scores = []
            for start, history, validation in windows:
                report = evaluate(TradeFit(history, start, days, shrinkage), validation)
                unequal = report["unequalSize"]
                if unequal["scored"] >= 30:
                    scores.append(unequal["medianSideGapPct"])
            if scores and len(scores) == len(windows):
                trials.append((sum(scores) / len(scores), days, shrinkage))
    if trials:
        _, half_life, penalty = min(trials)

    past = history_at(split)
    if len(past) < 700:
        raise RuntimeError("Too few trades before the validation cutoff")
    holdout = evaluate(TradeFit(past, split, half_life, penalty),
                       [row for row in eligible if row[0] >= split])
    fitted = TradeFit(trades, as_of, half_life, penalty)
    return fitted, {
        "trainingTrades": len(trades),
        "leagueSeasons": league_seasons,
        "firstTradeDate": trades[0][0].isoformat(),
        "lastTradeDate": trades[-1][0].isoformat(),
        "tradeHalfLifeDays": half_life,
        "holdoutStart": split.isoformat(),
        "holdoutTrades": holdout["eligibleTrades"],
        "holdoutTradesScored": holdout["all"]["scored"],
        "holdoutMedianSideGapPct": holdout["all"]["medianSideGapPct"],
        "holdout": holdout,
        "tuningWindows": len(windows),
        "usedTunedParameters": bool(trials),
        "regularization": penalty,
        "sparseRegularization": SPARSE_REGULARIZATION,
        "knownSlotTrades": sum(any(asset.startswith("pick:") and asset.count(":") == 3
                                   for side in sides for asset in side) for _, sides, _ in trades),
        "pickSlotLogSlope": round(fitted.pick_slot_coefficient, 5),
        "pickAnnualDiscount": round(fitted.annual_discount, 5),
    }
