"""Fit Superflex asset prices using completed trades and their dates."""
from collections import Counter, defaultdict, deque
from datetime import date, datetime, timedelta, timezone
import math

import numpy as np
from scipy.optimize import minimize
from scipy.sparse import csr_matrix

from build import POSITIONS, offensive_position

MODEL_VERSION = "sleeper-trades-v3"
DISPLAY_FIRST = 5000
LOOKBACK = 900
RECENT_DAYS = 210
SPARSE_REGULARIZATION = 1.5
SPARSE_LEAGUE_SEASONS = 5
DEFENSE_ASSETS = {f"player:{team}" for team in
                  "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS".split()}
PICK_ROUNDS = {f"r{round_number}" for round_number in range(1, 6)}
ANCHOR = "pick:r1"


def usable_trades(corpus, sleeper_players, as_of):
    """Limit the trade sample to supported asset types."""
    result = []
    for row in corpus["trades"]:
        when = datetime.fromtimestamp(row["timestamp"] / 1000, timezone.utc).date()
        if not 0 <= (as_of - when).days <= LOOKBACK:
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
                    elif player.get("position") not in {"K", "DEF", "FB"} and asset not in DEFENSE_ASSETS:
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
        delay_index = len(keys)
        slot_index = delay_index + 1
        weights = np.array([2 ** (-(as_of - when).days / half_life) for when, _, _ in trades])
        self.count = Counter()
        self.recent = Counter()
        self.latest = {}
        self.league_seasons = defaultdict(set)
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
                    else:
                        rows.append(row)
                        columns.append(delay_index)
                        data.append(pick_delay(asset, when))
                        slot_offset = pick_slot_offset(asset)
                        if slot_offset:
                            rows.append(row)
                            columns.append(slot_index)
                            data.append(slot_offset)
                    rows.append(row)
                    columns.append(self.columns[key])
                    data.append(1)
                    row += 1

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
        index = self.columns.get(asset_key(asset))
        if index is None:
            return None
        value = DISPLAY_FIRST * math.exp(self.coefs[index])
        if asset.startswith("pick:"):
            value *= self.annual_discount ** pick_delay(asset, when)
            value *= math.exp(self.pick_slot_coefficient * pick_slot_offset(asset))
        return value

    def evidence(self, asset):
        return {
            "completedTrades": self.count[asset],
            "recentTrades": self.recent[asset],
            "leagueSeasons": len(self.league_seasons.get(asset, ())),
            "recentDays": RECENT_DAYS,
            "lastTradeDate": self.latest[asset].isoformat() if asset in self.latest else None,
            "limited": self.recent[asset] < 5 or len(self.league_seasons.get(asset, ())) < SPARSE_LEAGUE_SEASONS,
        }


def holdout_error(model, trades):
    residuals = []
    for when, sides, _ in trades:
        if any(asset_key(asset) not in model.columns for side in sides for asset in side):
            continue
        first, second = [sum(model.price(asset, when) for asset in side) for side in sides]
        residuals.append(abs(first - second) / (first + second) * 200)
    return (round(float(np.median(residuals)), 2) if residuals else None, len(residuals))


def train(trades, as_of):
    trades = connected_trades(trades)
    league_seasons = len({league for _, _, league in trades})
    if len(trades) < 1000 or league_seasons < 30:
        raise RuntimeError(f"Only {len(trades)} connected trades available for training")
    split = as_of - timedelta(days=42)
    past = [row for row in trades if row[0] < split]
    future = [row for row in trades if row[0] >= split]
    windows = []
    for days_before in (84, 42):
        start = split - timedelta(days=days_before)
        end = start + timedelta(days=42)
        history = [row for row in trades if row[0] < start]
        validation = [row for row in trades if start <= row[0] < end]
        if len(history) >= 700 and len(validation) >= 100:
            windows.append((start, history, validation))

    half_life, penalty = 90, 0.1
    trials = []
    for days in (60, 90, 150):
        for shrinkage in (0.1, 0.5):
            scores = []
            for start, history, validation in windows:
                error, scored = holdout_error(TradeFit(history, start, days, shrinkage), validation)
                if scored >= 100:
                    scores.append(error)
            if scores and len(scores) == len(windows):
                trials.append((sum(scores) / len(scores), days, shrinkage))
    if trials:
        _, half_life, penalty = min(trials)
    error, scored = holdout_error(TradeFit(past, split, half_life, penalty), future) if len(past) >= 700 else (None, 0)
    fitted = TradeFit(trades, as_of, half_life, penalty)
    return fitted, {
        "trainingTrades": len(trades),
        "leagueSeasons": league_seasons,
        "firstTradeDate": trades[0][0].isoformat(),
        "lastTradeDate": trades[-1][0].isoformat(),
        "tradeHalfLifeDays": half_life,
        "holdoutStart": split.isoformat(),
        "holdoutTrades": len(future),
        "holdoutTradesScored": scored,
        "holdoutMedianSideGapPct": error,
        "regularization": penalty,
        "sparseRegularization": SPARSE_REGULARIZATION,
        "knownSlotTrades": sum(any(asset.startswith("pick:") and asset.count(":") == 3
                                   for side in sides for asset in side) for _, sides, _ in trades),
        "pickSlotLogSlope": round(fitted.pick_slot_coefficient, 5),
        "pickAnnualDiscount": round(fitted.annual_discount, 5),
    }
