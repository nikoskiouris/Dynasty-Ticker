"""Fit Superflex asset prices by balancing the sides of completed trades."""
from bisect import bisect_left
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
import math

import numpy as np
from scipy.optimize import minimize
from scipy.sparse import csr_matrix

from build import POSITIONS, offensive_position, parse_date, resolve_nfl_id, num

MODEL_VERSION = "sleeper-trades-v1"
DISPLAY_FIRST = 5000
HALF_LIFE = 210
LOOKBACK = 900
DEFENSE_ASSETS = set(f"player:{team}" for team in
                     "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS".split())
PEAK_AGE = {"QB": 29, "RB": 25, "WR": 27, "TE": 28}


def week_available(season, week):
    september = date(season, 9, 1)
    labor_day = september + timedelta(days=(-september.weekday()) % 7)
    # Use Wednesday following the last scheduled game of a normal NFL week.
    return labor_day + timedelta(days=9 + 7 * (week - 1))


class Features:
    def __init__(self, inputs):
        self.inputs = inputs
        self.profiles = {}
        self.games = {}

    def register(self, asset):
        if asset in self.profiles:
            return True
        player = self.inputs["sleeper"].get(asset.split(":")[1], {})
        position = offensive_position(player)
        if position not in POSITIONS:
            return False
        pid, _ = resolve_nfl_id(player, self.inputs["identity"], position)
        info = self.inputs["meta"].get(pid, {})
        birth = parse_date(info.get("birth_date")) or parse_date(player.get("birth_date"))
        draft_year = int(num(info.get("draft_year") or player.get("rookie_year")))
        games = self.inputs["weekly"].get(pid, [])
        if not draft_year and games:
            draft_year = games[0]["season"]
        if not draft_year and player.get("years_exp") is not None:
            draft_year = self.inputs["currentSeason"] - int(num(player["years_exp"]))
        draft_pick = num(info.get("draft_pick"))
        self.profiles[asset] = (position, birth, draft_year, draft_pick)
        rows = [(week_available(row["season"], row["week"]), row) for row in games
                if position != "QB" or row["attempts"] >= 15 or row["carries"] >= 8]
        self.games[asset] = ([stamp for stamp, _ in rows], [row for _, row in rows])
        return True

    @lru_cache(maxsize=125000)
    def __call__(self, asset, when):
        if asset.startswith("pick:"):
            _, year, round_text = asset.split(":")
            round_number = int(round_text[1:])
            years = max(0, (date(int(year), 6, 1) - when).days / 365.2425)
            return {("pick", f"r{round_number}"): 1.0, ("pick", "delay"): min(years, 6)}
        position, birth, draft_year, draft_pick = self.profiles[asset]
        draft_season = when.year if when >= date(when.year, 4, 26) else when.year - 1
        experience = max(0, draft_season - draft_year) if draft_year else 3
        age = (when - birth).days / 365.2425 if birth else 22 + experience
        dates, rows = self.games[asset]
        end = bisect_left(dates, when)
        start = bisect_left(dates, when - timedelta(days=365))
        games = rows[start:end]
        recent = games[-8:]
        rate = max(0, sum(row["ppr"] for row in recent) / max(3, len(recent)))
        previous = rows[bisect_left(dates, when - timedelta(days=730)):start]
        previous_rate = max(0, sum(row["ppr"] for row in previous) / max(6, len(previous)))
        capital = math.log1p(160 / max(draft_pick, 1)) if draft_pick else 0.0
        return {
            (position, "base"): 1.0,
            (position, "postPrime"): max(0, age - PEAK_AGE[position]) / 4,
            (position, "young"): max(0, PEAK_AGE[position] - age) / 4,
            (position, "production"): math.log1p(rate / 5),
            (position, "priorProduction"): math.log1p(previous_rate / 5),
            (position, "participation"): len(games) / 17,
            (position, "draft"): capital / (1 + 0.6 * experience),
        }


def usable_trades(corpus, features, as_of):
    result = []
    for row in corpus["trades"]:
        when = datetime.fromtimestamp(row["timestamp"] / 1000, timezone.utc).date()
        if not 0 <= (as_of - when).days <= LOOKBACK:
            continue
        sides = []
        for side in row["sides"]:
            kept = []
            for asset in side:
                if asset.startswith("pick:"):
                    if asset.split(":")[2] not in {f"r{rnd}" for rnd in range(1, 6)}:
                        break
                elif not features.register(asset):
                    player = features.inputs["sleeper"].get(asset.split(":")[1], {})
                    if player.get("position") in {"K", "DEF", "FB"} or asset in DEFENSE_ASSETS:
                        continue
                    break
                kept.append(asset)
            else:
                if kept:
                    sides.append(kept)
        if len(sides) == 2 and not (set(sides[0]) & set(sides[1])):
            result.append((when, sides, row["league"]))
    return sorted(result, key=lambda trade: trade[0])


class TradeFit:
    def __init__(self, trades, features, as_of, player_penalty):
        self.features = features
        self.columns = {}
        weights = np.array([2 ** (-(as_of - when).days / HALF_LIFE) for when, _, _ in trades])
        self.count = Counter()
        self.recent = Counter()
        self.latest = {}
        self.penalty = player_penalty
        self.bounds = []
        self.prior = []
        self.regularization = []
        groups, columns, data = [], [], []
        side_start = []
        row = 0
        for when, sides, _ in trades:
            for side in sides:
                side_start.append(row)
                for asset in side:
                    if asset.startswith("player:"):
                        self.count[asset] += 1
                        if (as_of - when).days <= HALF_LIFE:
                            self.recent[asset] += 1
                        self.latest[asset] = when
                    for key, value in self.asset_features(asset, when).items():
                        if value:
                            if key not in self.columns:
                                self.add_column(key)
                            groups.append(row)
                            columns.append(self.columns[key])
                            data.append(value)
                    row += 1
        matrix = csr_matrix((data, (groups, columns)), shape=(row, len(self.columns)))
        boundaries = np.asarray(side_start)
        counts = np.diff(np.append(boundaries, row))
        prior = np.asarray(self.prior)
        regularization = np.asarray(self.regularization)

        def loss(coefs):
            prices = np.exp(matrix @ coefs)
            totals = np.add.reduceat(prices, boundaries)
            residual = np.log(totals[::2]) - np.log(totals[1::2])
            # A lopsided deal remains evidence, with a bounded influence.
            scaled = np.sqrt(1 + (residual / 0.4) ** 2)
            offset = coefs - prior
            error = np.dot(weights, 0.16 * (scaled - 1)) + 0.5 * np.dot(regularization, offset ** 2)
            side_grad = (weights * residual / scaled)[:, None] * np.array([1, -1])
            asset_grad = prices * np.repeat(side_grad.ravel() / totals, counts)
            return error, matrix.T @ asset_grad + regularization * offset

        fitted = minimize(loss, prior, method="L-BFGS-B", jac=True, bounds=self.bounds,
                          options={"maxiter": 450, "ftol": 1e-9})
        if not fitted.success or not np.isfinite(fitted.x).all():
            raise RuntimeError(f"Trade model fit failed: {fitted.message}")
        self.coefs = fitted.x

    def add_column(self, key):
        group, term = key
        prior, bounds, penalty = 0.0, (-4.0, 4.0), 0.35
        if group == "player":
            bounds, penalty = (-3.0, 3.0), self.penalty
        elif group == "pick":
            if term == "r1":
                bounds = (0.0, 0.0)
            elif term == "delay":
                prior, bounds = -0.18, (-1.5, 0.0)
            else:
                prior, bounds = -0.75 * (int(term[1:]) - 1), (-7.0, 0.0)
        elif term == "postPrime":
            prior, bounds = -0.2, (-3.0, 0.0)
        elif term in {"production", "priorProduction", "participation", "draft"}:
            bounds = (0.0, 4.0)
        elif term == "base":
            prior, bounds = -3.0, (-8.0, 0.0)
        self.columns[key] = len(self.columns)
        self.prior.append(prior)
        self.bounds.append(bounds)
        self.regularization.append(penalty)

    def asset_features(self, asset, when):
        values = self.features(asset, when)
        if self.penalty is not None and asset.startswith("player:"):
            return {**values, ("player", asset): 1.0}
        return values

    def price(self, asset, when):
        terms = self.asset_features(asset, when)
        score = sum(self.coefs[self.columns[key]] * value for key, value in terms.items() if key in self.columns)
        if asset.startswith("pick:"):
            round_number = int(asset.rsplit("r", 1)[1])
            base = self.columns.get(("pick", f"r{round_number}"))
            if base is None:
                score -= 0.75 * (round_number - 1)
        return DISPLAY_FIRST * math.exp(score)

    def evidence(self, asset):
        return {
            "completedTrades": self.count[asset],
            "recentTrades": self.recent[asset],
            "lastTradeDate": self.latest[asset].isoformat() if asset in self.latest else None,
            "limited": self.recent[asset] < 5,
        }


def holdout_error(model, trades):
    residuals = []
    for when, sides, _ in trades:
        first, second = [sum(model.price(asset, when) for asset in side) for side in sides]
        residuals.append(abs(first - second) / (first + second) * 200)
    return round(float(np.median(residuals)), 2)


def train(inputs, corpus, as_of):
    features = Features(inputs)
    trades = usable_trades(corpus, features, as_of)
    if len(trades) < 1000 or len({league for _, _, league in trades}) < 30:
        raise RuntimeError(f"Only {len(trades)} comparable trades available for training")
    split = as_of - timedelta(days=42)
    tuning_start = split - timedelta(days=42)
    early = [row for row in trades if row[0] < tuning_start]
    tuning = [row for row in trades if tuning_start <= row[0] < split]
    past = [row for row in trades if row[0] < split]
    future = [row for row in trades if row[0] >= split]
    if len(early) >= 700 and len(tuning) >= 100:
        penalty = min(
            (2.0, 6.0, 18.0),
            key=lambda candidate: holdout_error(TradeFit(early, features, tuning_start, candidate), tuning),
        )
    else:
        penalty = 6.0
    # This last window is for reporting only. Fit the published board on all trades.
    has_holdout = len(past) >= 700 and len(future) >= 100
    error = holdout_error(TradeFit(past, features, split, penalty), future) if has_holdout else None
    shared_error = holdout_error(TradeFit(past, features, split, None), future) if has_holdout else None
    fitted = TradeFit(trades, features, as_of, penalty)
    report = {
        "trainingTrades": len(trades),
        "leagueSeasons": len({league for _, _, league in trades}),
        "firstTradeDate": trades[0][0].isoformat(),
        "lastTradeDate": trades[-1][0].isoformat(),
        "tradeHalfLifeDays": HALF_LIFE,
        "holdoutStart": split.isoformat(),
        "holdoutTrades": len(future),
        "holdoutMedianSideGapPct": error,
        "holdoutSharedModelMedianSideGapPct": shared_error,
        "playerRegularization": penalty,
        "postPrimeLogPricePerYear": {position: round(float(fitted.coefs[fitted.columns[(position, "postPrime")]]) / 4, 4)
                                     for position in POSITIONS if (position, "postPrime") in fitted.columns},
    }
    return fitted, report
