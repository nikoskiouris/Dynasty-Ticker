"""The football forecast behind Dynasty Ticker's player values.

One question, asked a year at a time: given what a player did in his last two
seasons, his age, and (while he is new) where he was drafted, how many full-PPR
points above a replacement player should we expect from him next season?

That one-year answer is learned from the most recent seasons only, then chained
forward: next year's expected season becomes the input for the year after. The
relationship is linear in the player's own numbers, so chaining expected values
stays an expected value. Nothing here is a hand-set bonus or penalty.

Standard library only. `build.py` supplies the data; `backtest.py` scores this
file against what players went on to do.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from operator import mul
import math

POSITIONS = ("QB", "RB", "WR", "TE")
FORMATS = ("sf", "oneQb")
SEASON_GAMES = 16          # games a team plays inside fantasy weeks 1-17
FANTASY_WEEKS = 17
MAX_PICK = 300             # an undrafted player sits at the end of the board
ROOKIE_EXPERIENCE = 3      # draft slot still informs the forecast through year 3
INJURY_MULTIPLIER = {"IR": 0.50, "OUT": 0.90, "DOUBTFUL": 0.90, "QUESTIONABLE": 0.95}


def clamp(value, low, high):
    return max(low, min(high, value))


def capital(pick):
    """Draft capital on a 0-1 scale. Pick 1 is 1.0, undrafted is 0.0, and the scale is logarithmic."""
    pick = clamp(int(pick or MAX_PICK), 1, MAX_PICK)
    return 1.0 - math.log(pick) / math.log(MAX_PICK)


def model_group(position, fmt):
    """RB, WR, and TE share one model across formats. Quarterbacks get one per format."""
    return (position, fmt) if position == "QB" else (position, "shared")


def season_state(row, replacement_ppg):
    """(advantage, pace, games share) for one finished season.

    advantage  points above replacement actually banked: max(0, ppg - replacement) * games
    pace       the same rate over a full season, so an injured star still reads as a star
    games      share of the season played
    A missing season is (0, 0, 0). It is not the end of a career.
    """
    if not row:
        return (0.0, 0.0, 0.0)
    # build.summaries sets valueGames/valuePpg. For a quarterback those count real starts only.
    games = min(float(row.get("valueGames", row["games"])), float(SEASON_GAMES))
    if games <= 0:
        return (0.0, 0.0, 0.0)
    rate = max(0.0, row.get("valuePpg", row["ppg"]) - replacement_ppg)
    return (rate * games, rate * SEASON_GAMES, games / SEASON_GAMES)


# ---------------------------------------------------------------- features

def established_pace(paces, decay):
    """A player's best recent pace, fading a little each year since he showed it.

    `paces` runs from last season backwards. One lost or down year does not erase
    what he was; several do.
    """
    return max([pace * decay ** index for index, pace in enumerate(paces)] or [0.0])


def effective_pace(pace, games, established, credit):
    """Last season's pace, with the games he missed read partly from his established level.

    A star who played three games did not become a three-game sample. For the
    share of the season he missed, `credit` of the gap between what he showed and
    what he had established is given back. A full season is taken as it was.
    """
    return pace + credit * (1.0 - games) * max(0.0, established - pace)


def state_features(knots, age, cur, prev, hinges):
    """Everything in the one-year model that depends on the player's own seasons.

    There is no free constant. A player earns expected value through recent
    production or recent games, so someone who has left the league fades to zero
    instead of collecting an average forever.
    """
    a1, q1, g1 = cur
    a2, q2, g2 = prev
    row = [a1, a2, q2, g2, q1, g1]
    for knot in knots:
        over = max(0.0, age - knot)
        row.append(q1 * over)
        row.append(g1 * over)
    under = max(0.0, knots[0] - age)
    row.append(q1 * under)
    row.append(g1 * under)
    # The best seasons regress hardest. Each hinge lets the line bend again at the top.
    for hinge in hinges:
        row.append(max(0.0, q1 - hinge))
    return row


def capital_features(exp, cap, played):
    """Draft slot matters most before a player has played, and fades out after year three.

    In years one to three one extra term counts the slot again for the share of
    last season a player missed. A top pick who sat out is still mostly a top
    pick. One who played has shown what he is.
    """
    row = [0.0] * N_CAPITAL
    if exp <= 0:
        row[0] = 1.0
        row[1] = cap
        row[2] = cap * cap
        row[3] = cap ** 3
    elif exp <= ROOKIE_EXPERIENCE:
        offset = 4 + (int(exp) - 1) * 2
        row[offset] = cap
        row[offset + 1] = cap * cap
        row[N_CAPITAL - 1] = (1.0 - played) * cap
    return row


N_CAPITAL = 4 + ROOKIE_EXPERIENCE * 2 + 1
AGE_TERMS_START = 6    # index of the first age term in state_features


def _solve(matrix, vector):
    """Gaussian elimination with partial pivoting. The systems here are about 30 wide."""
    size = len(vector)
    rows = [list(matrix[i]) + [vector[i]] for i in range(size)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda r: abs(rows[r][col]))
        if abs(rows[pivot][col]) < 1e-12:
            continue
        rows[col], rows[pivot] = rows[pivot], rows[col]
        lead = rows[col][col]
        for r in range(col + 1, size):
            factor = rows[r][col] / lead
            if factor:
                base = rows[col]
                target = rows[r]
                for c in range(col, size + 1):
                    target[c] -= factor * base[c]
    solution = [0.0] * size
    for r in range(size - 1, -1, -1):
        lead = rows[r][r]
        if abs(lead) < 1e-12:
            continue
        total = rows[r][size] - sum(rows[r][c] * solution[c] for c in range(r + 1, size))
        solution[r] = total / lead
    return solution


def _percentile(values, q):
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = (len(ordered) - 1) * q
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] * (1 - (index - low)) + ordered[high] * (index - low)


def fit_group(samples, knots, ridge=1.0, hinge_percentiles=(0.85,), calibration_cuts=(), decay=0.85, credit=0.0):
    """Fit the three one-year equations for one position group.

    samples: dicts with age, exp, cap, cur, prev, and target (next season's state).
    Ridge regression on columns scaled to unit size, so one penalty means the same
    thing for games shares and for point totals.
    """
    paces = [s["cur"][1] for s in samples if s["cur"][1] > 0]
    hinges = [_percentile(paces, q) if paces else 0.0 for q in hinge_percentiles]
    design = [
        state_features(knots, s["age"], _with_credit(s["cur"], s["established"], credit), s["prev"], hinges)
        + capital_features(s["exp"], s["cap"], s["cur"][2])
        for s in samples
    ]
    width = len(design[0])
    columns = [[row[j] for row in design] for j in range(width)]
    count = len(samples)
    scales = []
    for column in columns:
        size = math.sqrt(sum(map(mul, column, column)) / count)
        scales.append(size if size > 0 else 1.0)
    columns = [[value / scale for value in column] for column, scale in zip(columns, scales)]
    gram = [[0.0] * width for _ in range(width)]
    for j in range(width):
        for k in range(j, width):
            total = sum(map(mul, columns[j], columns[k]))
            gram[j][k] = total
            gram[k][j] = total
        gram[j][j] += ridge
    coefficients = []
    for index in range(3):
        target = [s["target"][index] for s in samples]
        rhs = [sum(map(mul, column, target)) for column in columns]
        scaled = _solve(gram, rhs)
        coefficients.append([value / scale for value, scale in zip(scaled, scales)])
    n_state = width - N_CAPITAL
    # Earliest draft slot this position has actually produced: among rookies, and among years one to three.
    earliest = {
        0: min([s["pick"] for s in samples if s["exp"] == 0] or [1]),
        1: min([s["pick"] for s in samples if 1 <= s["exp"] <= ROOKIE_EXPERIENCE] or [1]),
    }
    model = {
        "knots": tuple(knots),
        "hinges": hinges,
        "samples": count,
        "establishedDecay": float(decay),
        "missedGamesCredit": float(credit),
        "earliestPick": earliest[0],
        "state": [coef[:n_state] for coef in coefficients],
        "capital": [_capital_tables(coef[n_state:], earliest) for coef in coefficients],
        "calibration": [None, None],
    }
    if calibration_cuts:
        fitted = [
            _raw_next(model, s["age"], s["exp"], s["pick"], s["cur"], s["prev"], s["established"]) for s in samples
        ]
        for index in range(2):
            model["calibration"][index] = _calibration_curve(
                [max(0.0, row[index]) for row in fitted],
                [s["target"][index] for s in samples],
                calibration_cuts,
            )
    return model


def _calibration_curve(fitted, actual, cuts):
    """Forecast level -> what players at that level went on to average.

    A straight-line model overshoots at the very top. Players are grouped by
    forecast, finer toward the top, and each group's forecast is moved to its
    realized mean. The curve never bends downward.
    """
    pairs = sorted((f, a) for f, a in zip(fitted, actual) if f > 0)
    if len(pairs) < 50:
        return None
    xs = [0.0]
    ys = [0.0]
    edges = [0.0] + [float(cut) for cut in cuts] + [1.0]
    for low, high in zip(edges, edges[1:]):
        chunk = pairs[int(low * len(pairs)):int(high * len(pairs))]
        if len(chunk) < 8:
            continue
        x = sum(f for f, _a in chunk) / len(chunk)
        y = sum(a for _f, a in chunk) / len(chunk)
        if x <= xs[-1]:
            continue
        xs.append(x)
        ys.append(max(y, ys[-1]))
    return (xs, ys) if len(xs) > 2 else None


def _calibrate(curve, value):
    if curve is None or value <= 0:
        return max(0.0, value)
    xs, ys = curve
    if value >= xs[-1]:
        return value * ys[-1] / xs[-1]
    for index in range(1, len(xs)):
        if value <= xs[index]:
            span = xs[index] - xs[index - 1]
            share = (value - xs[index - 1]) / span if span > 0 else 0.0
            return ys[index - 1] + share * (ys[index] - ys[index - 1])
    return value


def _capital_tables(coef, earliest):
    """Expected contribution of draft slot for picks 1..MAX_PICK.

    One table for rookies, then for each of years one to three a pair: last
    season fully missed and last season fully played. A fitted curve can wiggle
    and can run away past the data, so every table is held to three rules. A
    pick earlier than any this position has seen is priced like the earliest one
    seen. An earlier pick is never forecast below a later one. No slot is
    forecast below zero.
    """
    def table(exp, played):
        first = clamp(int(earliest.get(min(exp, 1), 1)), 1, MAX_PICK)
        values = [0.0] * (MAX_PICK + 2)
        for pick in range(first, MAX_PICK + 1):
            values[pick] = sum(map(mul, coef, capital_features(exp, capital(pick), played)))
        floor = 0.0
        for pick in range(MAX_PICK, first - 1, -1):
            floor = max(floor, values[pick])
            values[pick] = floor
        for pick in range(1, first):
            values[pick] = values[first]
        return values

    tables = [(table(0, 0.0), table(0, 0.0))]
    for exp in range(1, ROOKIE_EXPERIENCE + 1):
        tables.append((table(exp, 0.0), table(exp, 1.0)))
    return tables


def _with_credit(cur, established, credit):
    banked, pace, games = cur
    return (banked, effective_pace(pace, games, established, credit), games)


def _raw_next(model, age, exp, pick, cur, prev, established):
    """The fitted line before calibration: (advantage, pace, games share), not yet bounded."""
    knots = model["knots"]
    hinges = model["hinges"]
    cur = _with_credit(cur, established, model["missedGamesCredit"])
    a1, q1, g1 = cur
    features = state_features(knots, age, cur, prev, hinges)
    pick = clamp(int(pick or MAX_PICK), 1, MAX_PICK)
    slot = None
    if exp <= ROOKIE_EXPERIENCE:
        slot = max(0, int(exp))
    first_hinge = len(features) - len(hinges)
    output = []
    for index in range(3):
        coef = model["state"][index]
        total = sum(map(mul, coef, features))
        if index < 2:
            # A better season never forecasts less. Banked points and pace rise together
            # when a player scores more over the same share of games, so the two are
            # taken out and put back as one slope, held at zero or above on every
            # stretch between hinges. When nothing is held this changes nothing.
            slope = coef[4]
            position = AGE_TERMS_START
            for knot in knots:
                slope += coef[position] * max(0.0, age - knot)
                position += 2
            slope += coef[position] * max(0.0, knots[0] - age)
            raw = coef[0] * a1 + slope * q1
            slope += coef[0] * (a1 / q1 if q1 > 0 else 0.0)
            held = 0.0
            floor = 0.0
            for offset, hinge in enumerate(hinges):
                raw += coef[first_hinge + offset] * max(0.0, q1 - hinge)
                held += max(0.0, slope) * max(0.0, min(q1, hinge) - floor)
                slope += coef[first_hinge + offset]
                floor = max(floor, hinge)
            held += max(0.0, slope) * max(0.0, q1 - floor)
            total += held - raw
            # The season before that can add to a forecast. It never subtracts.
            a2, q2, _g2 = prev
            before = coef[1] * a2 + coef[2] * q2
            if before < 0:
                total -= before
        if slot is not None:
            missed, played = model["capital"][index][slot]
            total += (1.0 - g1) * missed[pick] + g1 * played[pick]
        output.append(total)
    return output


def predict_next(model, age, exp, pick, cur, prev, established=None):
    """Expected (advantage, pace, games share) for the coming season.

    `established` is his best recent pace. Left out, it is read from the two seasons given.
    """
    if established is None:
        established = established_pace([cur[1], prev[1]], model["establishedDecay"])
    raw = _raw_next(model, age, exp, pick, cur, prev, max(established, cur[1]))
    curves = model.get("calibration") or [None, None]
    pace = _calibrate(curves[1], raw[1])
    advantage = clamp(_calibrate(curves[0], raw[0]), 0.0, pace)
    games = clamp(raw[2], 0.0, 1.0)
    return (advantage, pace, games)


def project(model, age, exp, pick, cur, prev, steps, established=None):
    """Chain the one-year forecast. Returns the expected state for each coming season."""
    decay = model["establishedDecay"]
    if established is None:
        established = established_pace([cur[1], prev[1]], decay)
    established = max(established, cur[1])
    path = []
    for step in range(steps):
        nxt = predict_next(model, age + step, exp + step, pick, cur, prev, established)
        path.append(nxt)
        prev, cur = cur, nxt
        established = max(nxt[1], established * decay)
    return path


# ---------------------------------------------------------------- training table

def rookie_years(meta, weekly):
    """First NFL year per player: the earliest of draft year, listed rookie season, and first game.

    The upstream rookie_season column lists the whole 2012 class as 2013, so it is
    never trusted on its own.
    """
    output = {}
    for pid, info in meta.items():
        years = []
        for key in ("draft_year", "rookie_season"):
            try:
                year = int(float(info.get(key) or 0))
            except (TypeError, ValueError):
                year = 0
            if year > 1900:
                years.append(year)
        games = weekly.get(pid)
        if games:
            years.append(int(games[0]["season"]))
        if years:
            output[pid] = min(years)
    for pid, games in weekly.items():
        if pid not in output and games:
            output[pid] = int(games[0]["season"])
    return output


def draft_pick(info):
    try:
        pick = int(float((info or {}).get("draft_pick") or 0))
    except (TypeError, ValueError):
        pick = 0
    return pick if 1 <= pick <= MAX_PICK else MAX_PICK


def age_on(info, season):
    """Age on September 1 of a season, from the birth date. None when the date is missing."""
    birth = str((info or {}).get("birth_date") or "").strip()
    if not birth:
        return None
    try:
        return (date(int(season), 9, 1) - date.fromisoformat(birth[:10])).days / 365.2425
    except ValueError:
        return None


def universe(season, rows_by_player, rookie_year, meta):
    """Who could be priced entering a season: anyone with a game in the last two, plus players in their first two years."""
    players = {}
    for pid, by_season in rows_by_player.items():
        recent = [by_season.get(season - 1), by_season.get(season - 2)]
        last = recent[0] or recent[1]
        if last:
            players[pid] = last["position"]
    for pid, first in rookie_year.items():
        if pid in players or first not in (season, season - 1):
            continue
        if any(year < season for year in rows_by_player.get(pid, {})):
            continue
        position = str((meta.get(pid) or {}).get("position") or "").upper()
        if position in POSITIONS:
            players[pid] = position
    return players


def index_rows(rows):
    by_player = defaultdict(dict)
    for (pid, season), row in rows.items():
        by_player[pid][season] = row
    return by_player


def default_age(exp):
    return 22.5 + max(0, exp)


def training_samples(rows_by_player, meta, rookie_year, replacement_for, origins, decay=0.85):
    """One sample per player per origin season: his state entering it and what he then did.

    replacement_for(origin) is the replacement line as it stood entering that
    season. State and outcome are both measured against that one line, which is
    how a published value works: today's line, held for the whole forecast.
    """
    samples = defaultdict(list)
    for origin in origins:
        replacement = replacement_for(origin)
        for pid, position in universe(origin, rows_by_player, rookie_year, meta).items():
            by_season = rows_by_player.get(pid, {})
            info = meta.get(pid) or {}
            exp = max(0, origin - rookie_year.get(pid, origin))
            age = age_on(info, origin)
            if age is None:
                age = default_age(exp)
            pick = draft_pick(info)
            cap = capital(pick)
            for fmt in FORMATS:
                group = model_group(position, fmt)
                if group[1] == "shared" and fmt != "sf":
                    continue
                line = replacement[fmt][position]
                paces = [season_state(by_season.get(origin - back), line)[1] for back in (1, 2, 3)]
                samples[group].append({
                    "established": established_pace(paces, decay),
                    "pid": pid,
                    "origin": origin,
                    "age": age,
                    "exp": exp,
                    "pick": pick,
                    "cap": cap,
                    "cur": season_state(by_season.get(origin - 1), line),
                    "prev": season_state(by_season.get(origin - 2), line),
                    "target": season_state(by_season.get(origin), line),
                })
    return samples


def fit_models(rows_by_player, meta, rookie_year, replacement_for, origins, config):
    settings = config["oneYearModel"]
    decay = float(settings["establishedDecay"])
    samples = training_samples(rows_by_player, meta, rookie_year, replacement_for, origins, decay)
    models = {}
    for group, group_samples in samples.items():
        if len(group_samples) < 200:
            raise RuntimeError(f"Too few seasons to fit {group}: {len(group_samples)}")
        models[group] = fit_group(
            group_samples,
            settings["ageKnots"][group[0]],
            ridge=float(settings["ridge"]),
            hinge_percentiles=[float(value) for value in settings["paceHingePercentiles"]],
            calibration_cuts=[float(value) for value in settings.get("calibrationCuts") or []],
            decay=decay,
            credit=float(settings["missedGamesCredit"]),
        )
        models[group]["origins"] = [min(origins), max(origins)]
    return models


# ---------------------------------------------------------------- today

def blend_weight(weeks_elapsed, shrink_weeks):
    """How much this season's games count against the preseason forecast for the weeks still to play.

    Zero before kickoff. With `shrink_weeks` weeks played the two count equally.
    """
    elapsed = clamp(float(weeks_elapsed), 0.0, float(FANTASY_WEEKS))
    if elapsed <= 0:
        return 0.0
    return elapsed / (elapsed + float(shrink_weeks))


def current_season(preseason, observed, weeks_elapsed, shrink_weeks, injury=1.0):
    """Split the current season into what is left to earn and where it will likely finish.

    preseason  expected (advantage, pace, games) for the full season, made before it started
    observed   (advantage, pace, games) banked so far this season
    Returns (rest_of_season_advantage, expected_final_state). Before kickoff the
    final state is the preseason forecast. After week 17 it is what happened.
    """
    elapsed = clamp(float(weeks_elapsed), 0.0, float(FANTASY_WEEKS))
    remaining = FANTASY_WEEKS - elapsed
    weight = blend_weight(elapsed, shrink_weeks)
    pre_a, pre_q, pre_g = preseason
    obs_a, obs_q, obs_g = observed
    per_week_seen = obs_a / elapsed if elapsed > 0 else 0.0
    rest = remaining * ((1 - weight) * pre_a / FANTASY_WEEKS + weight * per_week_seen) * injury
    games_so_far = obs_g * SEASON_GAMES
    possible_so_far = max(1.0, elapsed * SEASON_GAMES / FANTASY_WEEKS)
    seen_share = clamp(games_so_far / possible_so_far, 0.0, 1.0) if elapsed > 0 else 0.0
    rest_games = remaining * SEASON_GAMES / FANTASY_WEEKS * ((1 - weight) * pre_g + weight * seen_share) * injury
    rest_pace = (1 - weight) * pre_q + weight * obs_q
    final_games = games_so_far + rest_games
    if final_games > 0:
        final_pace = (games_so_far * obs_q + rest_games * rest_pace) / final_games
    else:
        # No games banked and none expected. Keep the forecast pace early on and let it
        # run out with the season, so week 17 ends at what happened: nothing.
        final_pace = rest_pace * remaining / FANTASY_WEEKS
    final = (obs_a + rest, final_pace, clamp(final_games / SEASON_GAMES, 0.0, 1.0))
    return rest, final


def years_until(start, as_of):
    """Years from `as_of` to `start`, never negative. The same day next year is exactly 1."""
    if start <= as_of:
        return 0.0
    anniversary = date(as_of.year, start.month, min(start.day, 28))
    return max(0.0, (start.year - as_of.year) + (anniversary - as_of).days / 365.25)


def season_start(season, known=None):
    """Kickoff date for a season. Uses the known date for its own year, else the second Tuesday-ish of September."""
    if known is not None and known.year == int(season):
        return known
    return date(int(season), 9, 8)


def value_player(model, age, exp, pick, last, prior, observed, season, weeks_elapsed, as_of, config, injury=1.0,
                 kickoff=None, established=None):
    """Discounted expected advantage over the next eight seasons of games.

    The current season counts only for the weeks left. Once it is under way a
    ninth season fills in behind it, so the horizon is always eight seasons long.
    Each future season is discounted by how far away its kickoff is today, which
    keeps a value from jumping when the calendar rolls over.
    """
    horizon = int(config["horizonYears"])
    discount = float(config["annualDiscount"])
    shrink = float(config["oneYearModel"]["inSeasonShrinkWeeks"])
    elapsed = clamp(float(weeks_elapsed), 0.0, float(FANTASY_WEEKS))
    decay = model["establishedDecay"]
    if established is None:
        established = established_pace([last[1], prior[1]], decay)
    established = max(established, last[1])
    preseason = predict_next(model, age, exp, pick, last, prior, established)
    rest, final = current_season(preseason, observed, elapsed, shrink, injury)
    path = project(model, age + 1, exp + 1, pick, final, last, horizon, max(final[1], established * decay))
    forecast = []
    total = 0.0
    for step in range(horizon + 1):
        if step == 0:
            expected = rest
            weight = 1.0
        else:
            expected = path[step - 1][0]
            weight = elapsed / FANTASY_WEEKS if step == horizon else 1.0
        years = years_until(season_start(season + step, kickoff), as_of)
        factor = discount ** years
        discounted = expected * weight * factor
        total += discounted
        forecast.append({
            "season": int(season + step),
            "expectedAdvantage": round(expected, 2),
            "weight": round(weight, 4),
            "discount": round(factor, 5),
            "discountedAdvantage": round(discounted, 2),
        })
    return total, forecast, {"preseason": preseason, "final": final}


def rookie_value(model, pick, config, age=None):
    """What a rookie is worth on the day his first season kicks off: the same eight-season ruler as everyone else."""
    horizon = int(config["horizonYears"])
    discount = float(config["annualDiscount"])
    start_age = default_age(0) if age is None else age
    zero = (0.0, 0.0, 0.0)
    path = project(model, start_age, 0, pick, zero, zero, horizon)
    return sum(state[0] * discount ** step for step, state in enumerate(path))
