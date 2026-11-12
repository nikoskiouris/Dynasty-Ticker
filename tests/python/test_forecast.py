"""What the forecast must do for a manager, checked on a made-up league.

These pin behavior, not coefficients: a better season is never worth less, a
missed year is not the end of a career, a pick is priced as the rookie it
becomes, and a price does not jump when the calendar turns.
"""

from __future__ import annotations

import unittest
from datetime import date, timedelta

from synthetic_league import KICKOFF, build, forecast, league

CONFIG = build.CONFIG
ZERO = (0.0, 0.0, 0.0)


def season(pace, games=1.0):
    """A season at `pace` points above replacement over a full year, playing `games` share of it."""
    return (pace * games, pace, games)


def model_for(position, fmt="sf"):
    _inputs, _rows, world = league()
    return world["models"][forecast.model_group(position, fmt)]


def value(position, age, last, prior, exp=6, pick=40, observed=ZERO, weeks=0, as_of=KICKOFF, year=2026, injury=1.0):
    total, rows, _detail = forecast.value_player(
        model_for(position), age, exp, pick, last, prior, observed, year, weeks, as_of, CONFIG, injury, KICKOFF
    )
    return total, rows


class ProductionTests(unittest.TestCase):
    def test_a_better_season_is_never_worth_less(self):
        for position in forecast.POSITIONS:
            for age in (22, 25, 28, 31, 34):
                previous = -1.0
                for pace in range(0, 360, 20):
                    total, _rows = value(position, age, season(pace), season(120))
                    self.assertGreaterEqual(total, previous - 1e-6, f"{position} age {age} pace {pace}")
                    previous = total

    def test_a_better_season_two_years_ago_is_never_worth_less(self):
        for position in forecast.POSITIONS:
            for age in (23, 27, 31):
                previous = -1.0
                for pace in range(0, 360, 40):
                    total, _rows = value(position, age, season(120), season(pace))
                    self.assertGreaterEqual(total, previous - 1e-6, f"{position} age {age} prior pace {pace}")
                    previous = total

    def test_the_same_season_is_worth_less_from_an_older_back(self):
        young, _rows = value("RB", 24, season(180), season(170))
        old, _rows = value("RB", 31, season(180), season(170))
        self.assertGreater(young, 0)
        self.assertLess(old, young * 0.8)

    def test_a_quarterback_ages_later_than_a_running_back(self):
        def kept(position):
            prime, _ = value(position, 25, season(180), season(180))
            late, _ = value(position, 31, season(180), season(180))
            return late / prime

        self.assertGreater(kept("QB"), kept("RB"))

    def test_a_missed_season_is_not_the_end_of_a_career(self):
        healthy, _rows = value("WR", 26, season(200), season(200))
        missed, rows = value("WR", 26, ZERO, season(200))
        nobody, _rows = value("WR", 26, ZERO, ZERO)
        self.assertGreater(missed, healthy * 0.25)
        self.assertLess(missed, healthy)
        self.assertGreater(missed, nobody * 3 + 1)
        # And the forecast expects him back on the field, not gone.
        self.assertGreater(rows[0]["expectedAdvantage"], 20)

    def test_a_player_who_left_the_league_fades_to_nothing(self):
        total, rows = value("RB", 29, ZERO, ZERO)
        self.assertLess(total, 5)
        self.assertLess(rows[-1]["expectedAdvantage"], 1)

    def test_the_best_season_is_not_expected_to_repeat(self):
        for position in ("RB", "WR"):
            model = model_for(position)
            pace = model["hinges"][-1] * 1.3
            advantage, next_pace, _games = forecast.predict_next(model, 26, 5, 20, season(pace), season(pace * 0.6))
            self.assertLess(next_pace, pace)
            self.assertLess(advantage, pace)
            self.assertGreater(advantage, pace * 0.3)

    def test_nobody_is_forecast_to_play_at_forty_five(self):
        for position, age in (("RB", 37), ("WR", 39), ("QB", 46)):
            _total, rows = value(position, age, season(150), season(150))
            self.assertLess(rows[-1]["expectedAdvantage"], 15, position)


class RookieAndPickTests(unittest.TestCase):
    def test_an_earlier_pick_is_never_worth_less_than_a_later_one(self):
        for position in forecast.POSITIONS:
            for fmt in forecast.FORMATS:
                model = model_for(position, fmt)
                previous = None
                for pick in range(1, forecast.MAX_PICK + 1):
                    worth = forecast.rookie_value(model, pick, CONFIG)
                    self.assertGreaterEqual(worth, 0)
                    if previous is not None:
                        self.assertLessEqual(worth, previous + 1e-9, f"{position} {fmt} pick {pick}")
                    previous = worth
                self.assertGreater(forecast.rookie_value(model, 5, CONFIG), forecast.rookie_value(model, 150, CONFIG))

    def test_an_unplayed_rookie_at_kickoff_is_priced_like_his_pick(self):
        """One ruler: the rookie a pick becomes is worth what the pick was, the day he can first play."""
        for position in forecast.POSITIONS:
            for pick in (3, 20, 70, 180):
                player, _rows = value(position, forecast.default_age(0), ZERO, ZERO, exp=0, pick=pick)
                slot = forecast.rookie_value(model_for(position), pick, CONFIG)
                self.assertAlmostEqual(player, slot, places=6)

    def test_draft_slot_fades_once_a_player_has_a_record(self):
        def gap(exp):
            high, _ = value("WR", 22 + exp, season(60), season(60) if exp > 1 else ZERO, exp=exp, pick=8)
            low, _ = value("WR", 22 + exp, season(60), season(60) if exp > 1 else ZERO, exp=exp, pick=200)
            return high - low

        self.assertGreater(gap(1), 0)
        self.assertGreater(gap(1), gap(3))
        self.assertAlmostEqual(gap(6), 0.0, places=6)

    def test_pick_prices_follow_the_rookies_they_buy(self):
        slots = {
            "sf": [600.0 - 9 * index for index in range(build.PICK_SLOTS)],
            "oneQb": [560.0 - 9 * index for index in range(build.PICK_SLOTS)],
        }
        priced = build.pick_values(slots, KICKOFF - timedelta(days=300), KICKOFF)
        for fmt in ("sf", "oneQb"):
            build._assert_pick_order(priced[fmt])
        for asset_id, one_qb in priced["oneQb"].items():
            self.assertGreaterEqual(priced["sf"][asset_id], one_qb, asset_id)
        self.assertGreater(priced["sf"]["pick:2026:r1:early"], priced["sf"]["pick:2026:r1:mid"])
        self.assertGreater(priced["sf"]["pick:2026:r1:mid"], priced["sf"]["pick:2026:r1:late"])
        self.assertGreater(priced["sf"]["pick:2026:r1:any"], priced["sf"]["pick:2026:r2:any"])
        self.assertGreater(priced["sf"]["pick:2026:r1:early"], priced["sf"]["pick:2027:r1:early"])

    def test_a_pick_is_discounted_by_the_wait_until_its_rookie_can_play(self):
        slots = {fmt: [500.0] * build.PICK_SLOTS for fmt in forecast.FORMATS}
        scale = float(CONFIG["displayScale"])
        at_kickoff = build.pick_values(slots, date(2027, 9, 8))
        self.assertEqual(at_kickoff["sf"]["pick:2028:r1:early"], round(500 * scale * CONFIG["annualDiscount"]))
        self.assertEqual(at_kickoff["sf"]["pick:2030:r1:early"], round(500 * scale * CONFIG["annualDiscount"] ** 3))
        waiting = build.pick_values(slots, date(2027, 3, 9))
        half_year = (date(2027, 9, 8) - date(2027, 3, 9)).days / 365.25
        self.assertEqual(waiting["sf"]["pick:2027:r1:early"], round(500 * scale * CONFIG["annualDiscount"] ** half_year))

    def test_this_years_picks_are_listed_until_the_draft_and_not_after(self):
        slots = {fmt: [500.0 - index for index in range(build.PICK_SLOTS)] for fmt in forecast.FORMATS}
        before = build.pick_values(slots, date(2027, 3, 9))
        after = build.pick_values(slots, date(2027, 5, 4))
        self.assertIn("pick:2027:r1:early", before["sf"])
        self.assertNotIn("pick:2027:r1:early", after["sf"])
        self.assertIn("pick:2028:r1:early", after["sf"])
        self.assertIn("pick:2033:r5:any", after["sf"])

    def test_later_pick_cannot_outbid_an_earlier_one(self):
        self.assertEqual(build.force_descending([10, 8, 9, 4]), [10, 8, 8, 4])
        self.assertEqual(build.force_descending([3, 10, 1]), [3, 3, 1])


class CalendarTests(unittest.TestCase):
    last = season(170)
    prior = season(150)
    banked = season(190, 0.9)

    def test_a_price_does_not_jump_when_the_season_turns_over(self):
        """The day after week 17 and the first day of the next league year describe the same future."""
        today = date(2027, 2, 16)
        ended, _rows = value("WR", 25, self.last, self.prior, observed=self.banked, weeks=17, as_of=today, year=2026)
        rolled, _rows = value("WR", 26, self.banked, self.last, exp=7, weeks=0, as_of=today, year=2027)
        self.assertAlmostEqual(ended, rolled, places=6)

    def test_a_week_of_waiting_barely_moves_a_price(self):
        monday, _rows = value("WR", 26, self.last, self.prior, as_of=date(2027, 3, 2), year=2027)
        next_monday, _rows = value("WR", 26, self.last, self.prior, as_of=date(2027, 3, 9), year=2027)
        self.assertGreater(next_monday, monday)
        self.assertLess(next_monday / monday, 1.005)

    def test_the_forecast_always_covers_eight_seasons_of_games(self):
        for weeks in (0, 5, 9, 17):
            _total, rows = value("WR", 25, self.last, self.prior, observed=season(170, weeks / 17), weeks=weeks,
                                 as_of=KICKOFF + timedelta(days=7 * weeks))
            self.assertEqual(len(rows), CONFIG["horizonYears"] + 1)
            covered = (17 - weeks) / 17 + sum(row["weight"] for row in rows[1:])
            self.assertAlmostEqual(covered, CONFIG["horizonYears"], places=3)

    def test_a_published_value_is_the_sum_of_its_seasons(self):
        total, rows = value("RB", 24, self.last, self.prior, observed=season(200, 0.5), weeks=9,
                            as_of=KICKOFF + timedelta(days=63))
        self.assertAlmostEqual(total, sum(row["discountedAdvantage"] for row in rows), delta=0.05)
        discounts = [row["discount"] for row in rows]
        self.assertEqual(discounts, sorted(discounts, reverse=True))
        self.assertEqual(discounts[0], 1.0)

    def test_the_weeks_already_played_are_spent(self):
        """Nine weeks in and exactly on his forecast, a player has less left to give this year."""
        kickoff, _rows = value("RB", 27, self.last, self.prior)
        expected = forecast.predict_next(model_for("RB"), 27, 6, 40, self.last, self.prior)
        on_forecast = (expected[0] * 9 / 17, expected[1], expected[2] * 9 / 17)
        midway, rows = value("RB", 27, self.last, self.prior, observed=on_forecast, weeks=9,
                             as_of=KICKOFF + timedelta(days=63))
        self.assertAlmostEqual(rows[0]["expectedAdvantage"], expected[0] * 8 / 17, delta=0.02)
        self.assertLess(midway, kickoff)
        self.assertGreater(midway, kickoff * 0.7)


class InSeasonTests(unittest.TestCase):
    def test_a_hot_start_moves_the_forecast_part_of_the_way(self):
        model = model_for("WR")
        before = forecast.predict_next(model, 24, 2, 30, season(80), season(60))
        hot = (300 * 5 / 17, 300.0, 5 / 16)
        rest, final = forecast.current_season(before, hot, 5, CONFIG["oneYearModel"]["inSeasonShrinkWeeks"])
        on_forecast = before[0] * 12 / 17
        on_pace = hot[0] / 5 * 12
        self.assertGreater(rest, on_forecast)
        self.assertLess(rest, on_pace)
        self.assertGreater(final[1], before[1])
        self.assertLess(final[1], 300.0)

    def test_before_kickoff_the_season_is_the_forecast_and_after_week_17_it_is_what_happened(self):
        before = (120.0, 150.0, 0.8)
        rest, final = forecast.current_season(before, (0.0, 0.0, 0.0), 0, 4)
        self.assertAlmostEqual(rest, 120.0)
        for got, want in zip(final, before):
            self.assertAlmostEqual(got, want)
        banked = (201.0, 230.0, 14 / 16)
        rest, final = forecast.current_season(before, banked, 17, 4)
        self.assertEqual(rest, 0.0)
        for got, want in zip(final, banked):
            self.assertAlmostEqual(got, want)

    def test_injured_reserve_cuts_what_is_left_of_this_season(self):
        before = (120.0, 150.0, 0.8)
        healthy, _final = forecast.current_season(before, (40.0, 150.0, 0.3), 6, 4)
        on_ir, _final = forecast.current_season(before, (40.0, 150.0, 0.3), 6, 4, forecast.INJURY_MULTIPLIER["IR"])
        self.assertAlmostEqual(on_ir, healthy * 0.5)


if __name__ == "__main__":
    unittest.main()
