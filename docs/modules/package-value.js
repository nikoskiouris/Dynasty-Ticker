import { ideaGapMore } from "./verdict-copy.js";
// Consolidation math for uneven packages: one better player is worth more than
// the same total spread across more pieces.
const KTC_RAW_BASE = 0.10;
const KTC_RAW_ELITE_WEIGHT = 0.08;
const KTC_RAW_TRADE_WEIGHT = 0.11;
const KTC_RAW_DEPTH_WEIGHT = 0.18;

export function finiteAssetValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

// Trade ideas use the verdict's shown metric: % more, gap / smaller side
// (verdict-copy.js). Compare it with ideaLimitMore(setting), never a raw setting.
export function calculatePctDiff(a, b) {
  return ideaGapMore(a, b);
}

function calculateKtcRawAdjustment(playerValue, tradeMaxValue, globalMaxValue) {
  if (!Number.isFinite(playerValue) || playerValue <= 0 || !Number.isFinite(tradeMaxValue) || tradeMaxValue <= 0) return 0;

  return playerValue * (
    KTC_RAW_BASE
      + KTC_RAW_ELITE_WEIGHT * (playerValue / globalMaxValue) ** 8
      + KTC_RAW_TRADE_WEIGHT * (playerValue / tradeMaxValue) ** 1.3
      + KTC_RAW_DEPTH_WEIGHT * (playerValue / (globalMaxValue + 2000)) ** 1.28
  );
}

function findEvenValueForRawGap(targetRawGap, tradeMaxValue, globalMaxValue) {
  if (!Number.isFinite(targetRawGap) || targetRawGap <= 0) return 0;

  const maxReachableRaw = calculateKtcRawAdjustment(globalMaxValue, globalMaxValue, globalMaxValue);
  if (targetRawGap >= maxReachableRaw) {
    return Math.round(globalMaxValue);
  }

  let low = 0;
  let high = globalMaxValue;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const rawValue = calculateKtcRawAdjustment(mid, Math.max(tradeMaxValue, mid), globalMaxValue);
    if (rawValue < targetRawGap) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.max(0, Math.round(high));
}

export function calculatePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
  // A missing or removed player is stored as 0. Infinity and NaN are not prices.
  // Those pieces are not real package mates, so they must not mint a stud credit.
  const mine = (Array.isArray(myValues) ? myValues : []).map(finiteAssetValue).filter((value) => value > 0);
  const theirs = (Array.isArray(theirValues) ? theirValues : []).map(finiteAssetValue).filter((value) => value > 0);
  const myBaseValue = mine.reduce((sum, value) => sum + value, 0);
  const theirBaseValue = theirs.reduce((sum, value) => sum + value, 0);

  // A straight swap stays at the listed prices. Any package of two or more runs the
  // stud curve, even when both sides send the same number of pieces. Two lesser
  // pieces are not worth one better piece that adds up to the same total.
  if (!mine.length || !theirs.length || (mine.length <= 1 && theirs.length <= 1)) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  const tradeMaxValue = Math.max(0, ...mine, ...theirs);
  globalMaxValue = Math.max(tradeMaxValue, Number(globalMaxValue) || 0);

  if (!tradeMaxValue) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  const myRawValue = mine.reduce((sum, value) => sum + calculateKtcRawAdjustment(value, tradeMaxValue, globalMaxValue), 0);
  const theirRawValue = theirs.reduce((sum, value) => sum + calculateKtcRawAdjustment(value, tradeMaxValue, globalMaxValue), 0);

  if (Math.abs(myRawValue - theirRawValue) < 1e-6) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  // The side ahead on the stud curve leads by evenValue. When that side also
  // holds the trade's best piece, its listed total may already lead by more;
  // keep the bigger lead. When the other side holds the best piece, it is
  // credited up to evenValue behind, so the verdict slides smoothly through
  // the point where the curve tips. Without that, one step past the tie
  // dropped the stud credit to 0 and "Fair" jumped straight to "Lopsided".
  const myLeads = myRawValue > theirRawValue;
  const evenValue = findEvenValueForRawGap(Math.abs(myRawValue - theirRawValue), tradeMaxValue, globalMaxValue);
  const leadBase = myLeads ? myBaseValue : theirBaseValue;
  const trailBase = myLeads ? theirBaseValue : myBaseValue;
  const myBest = Math.max(...mine);
  const theirBest = Math.max(...theirs);
  const trailHoldsBest = myLeads ? theirBest > myBest : myBest > theirBest;
  let creditLead = Math.max(0, Math.round(trailBase + evenValue - leadBase));
  let creditTrail = 0;
  if (trailHoldsBest) creditTrail = Math.max(0, Math.round(leadBase - evenValue - trailBase));
  const packageAdjustment = creditLead || creditTrail;
  const creditMine = myLeads ? creditLead > 0 : creditTrail > 0;
  const side = packageAdjustment > 0 ? (creditMine ? "my" : "their") : null;
  return {
    myBaseValue,
    theirBaseValue,
    myAdjustedValue: myBaseValue + (side === "my" ? packageAdjustment : 0),
    theirAdjustedValue: theirBaseValue + (side === "their" ? packageAdjustment : 0),
    packageAdjustment,
    packageAdjustmentSide: side,
    evenValue,
  };
}
