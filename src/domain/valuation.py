from __future__ import annotations

from dataclasses import dataclass

KTC_RAW_BASE = 0.10
KTC_RAW_ELITE_WEIGHT = 0.08
KTC_RAW_TRADE_WEIGHT = 0.11
KTC_RAW_DEPTH_WEIGHT = 0.18
KTC_GLOBAL_MAX_FALLBACK = 9999
ELITE_VALUE_PREMIUM_TIERS = (
    (9000, 1.32),
    (8000, 1.27),
    (7000, 1.21),
    (6000, 1.15),
    (5000, 1.09),
)


@dataclass
class ValuationResult:
    asset_id: str
    value: int | None


@dataclass
class PackageAdjustmentResult:
    my_base_value: int
    their_base_value: int
    my_adjusted_value: int
    their_adjusted_value: int
    package_adjustment: int
    package_adjustment_side: str | None
    even_value: int


class ValuationService:
    def __init__(self, values: dict[str, int]):
        self._values = values
        player_values = [
            self._apply_elite_player_premium(asset_id, value)
            for asset_id, value in values.items()
            if str(asset_id).startswith("player:")
        ]
        self._max_value = max(max(player_values, default=0), KTC_GLOBAL_MAX_FALLBACK)

    def get_asset_value(self, asset_id: str) -> int | None:
        exact = self._values.get(asset_id)
        if exact is not None:
            return self._apply_elite_player_premium(asset_id, exact)

        if asset_id.startswith("pick:"):
            any_id = asset_id.rsplit(":", 1)[0] + ":any"
            return self._values.get(any_id)

        return None

    def _apply_elite_player_premium(self, asset_id: str, base_value: int) -> int:
        if not asset_id.startswith("player:"):
            return base_value

        for floor, multiplier in ELITE_VALUE_PREMIUM_TIERS:
            if base_value >= floor:
                return round(base_value * multiplier)
        return base_value

    def get_many(self, asset_ids: list[str]) -> list[ValuationResult]:
        return [ValuationResult(asset_id=a, value=self.get_asset_value(a)) for a in asset_ids]

    @property
    def max_value(self) -> int:
        return self._max_value

    def calculate_ktc_raw_adjustment(self, player_value: int | float, trade_max_value: int | float) -> float:
        if player_value <= 0 or trade_max_value <= 0:
            return 0.0

        return float(player_value) * (
            KTC_RAW_BASE
            + KTC_RAW_ELITE_WEIGHT * (float(player_value) / self._max_value) ** 8
            + KTC_RAW_TRADE_WEIGHT * (float(player_value) / float(trade_max_value)) ** 1.3
            + KTC_RAW_DEPTH_WEIGHT * (float(player_value) / (self._max_value + 2000)) ** 1.28
        )

    def find_even_value(self, target_raw_gap: float, trade_max_value: int) -> int:
        if target_raw_gap <= 0:
            return 0

        max_reachable_raw = self.calculate_ktc_raw_adjustment(self._max_value, self._max_value)
        if target_raw_gap >= max_reachable_raw:
            return self._max_value

        low = 0.0
        high = float(self._max_value)
        for _ in range(50):
            mid = (low + high) / 2
            raw_value = self.calculate_ktc_raw_adjustment(mid, max(trade_max_value, mid))
            if raw_value < target_raw_gap:
                low = mid
            else:
                high = mid

        return max(0, round(high))

    def calculate_package_adjustment(self, my_values: list[int], their_values: list[int]) -> PackageAdjustmentResult:
        my_base_value = sum(my_values)
        their_base_value = sum(their_values)
        if len(my_values) == len(their_values):
            return PackageAdjustmentResult(
                my_base_value=my_base_value,
                their_base_value=their_base_value,
                my_adjusted_value=my_base_value,
                their_adjusted_value=their_base_value,
                package_adjustment=0,
                package_adjustment_side=None,
                even_value=0,
            )

        trade_max_value = max([0, *my_values, *their_values])

        if trade_max_value <= 0:
            return PackageAdjustmentResult(
                my_base_value=my_base_value,
                their_base_value=their_base_value,
                my_adjusted_value=my_base_value,
                their_adjusted_value=their_base_value,
                package_adjustment=0,
                package_adjustment_side=None,
                even_value=0,
            )

        my_raw_value = sum(self.calculate_ktc_raw_adjustment(value, trade_max_value) for value in my_values)
        their_raw_value = sum(self.calculate_ktc_raw_adjustment(value, trade_max_value) for value in their_values)

        if abs(my_raw_value - their_raw_value) < 1e-6:
            return PackageAdjustmentResult(
                my_base_value=my_base_value,
                their_base_value=their_base_value,
                my_adjusted_value=my_base_value,
                their_adjusted_value=their_base_value,
                package_adjustment=0,
                package_adjustment_side=None,
                even_value=0,
            )

        if my_raw_value > their_raw_value:
            even_value = self.find_even_value(my_raw_value - their_raw_value, trade_max_value)
            package_adjustment = max(0, their_base_value + even_value - my_base_value)
            return PackageAdjustmentResult(
                my_base_value=my_base_value,
                their_base_value=their_base_value,
                my_adjusted_value=my_base_value + package_adjustment,
                their_adjusted_value=their_base_value,
                package_adjustment=package_adjustment,
                package_adjustment_side="my" if package_adjustment > 0 else None,
                even_value=even_value,
            )

        even_value = self.find_even_value(their_raw_value - my_raw_value, trade_max_value)
        package_adjustment = max(0, my_base_value + even_value - their_base_value)
        return PackageAdjustmentResult(
            my_base_value=my_base_value,
            their_base_value=their_base_value,
            my_adjusted_value=my_base_value,
            their_adjusted_value=their_base_value + package_adjustment,
            package_adjustment=package_adjustment,
            package_adjustment_side="their" if package_adjustment > 0 else None,
            even_value=even_value,
        )
