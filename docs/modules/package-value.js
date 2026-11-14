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

function curvePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
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

// Adding a piece to a side never makes that side worth less in the verdict,
// and a throw-in never adds more than its own price to that side.
// The stud curve alone broke that: a straight swap stays at listed prices, so
// a 500-point throw-in on the other side switched the curve on and could turn
// "you give 28% more" into "you give 70% more". Each side's pieces, best
// first, are added one at a time; the lead for (i of mine, j of theirs) stays
// between the leads one piece earlier on either side. That bounds it at both
// ends, so every throw-in moves the verdict toward the side that receives it,
// or leaves it where it was.
export function calculatePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
  const raw = curvePackageAdjustment({ myValues, theirValues, globalMaxValue });
  const mine = (Array.isArray(myValues) ? myValues : []).map(finiteAssetValue).filter((value) => value > 0).sort((a, b) => b - a);
  const theirs = (Array.isArray(theirValues) ? theirValues : []).map(finiteAssetValue).filter((value) => value > 0).sort((a, b) => b - a);
  if (mine.length + theirs.length <= 2) return raw;
  const globalMax = Math.max(Number(globalMaxValue) || 0, ...mine, ...theirs);
  const sum = (list, count) => list.slice(0, count).reduce((total, value) => total + value, 0);
  const lead = [];
  for (let i = 0; i <= mine.length; i++) {
    lead.push([]);
    for (let j = 0; j <= theirs.length; j++) {
      let value;
      if (!i || !j) value = sum(mine, i) - sum(theirs, j);
      else {
        const step = curvePackageAdjustment({ myValues: mine.slice(0, i), theirValues: theirs.slice(0, j), globalMaxValue: globalMax });
        value = step.myAdjustedValue - step.theirAdjustedValue;
        value = Math.min(value, lead[i][j - 1]);
        value = Math.max(value, lead[i - 1][j]);
        // A throw-in (any piece after a side's best) is worth at most its own
        // price to the side that gets it. Without this, a 600-point add-on next
        // to Gibbs switched the stud curve on and moved Gibbs-for-Bijan from
        // "5% more" to "27% more".
        if (j > 1) value = Math.max(value, lead[i][j - 1] - theirs[j - 1]);
        if (i > 1) value = Math.min(value, lead[i - 1][j] + mine[i - 1]);
      }
      lead[i].push(value);
    }
  }
  const bounded = Math.round(lead[mine.length][theirs.length]);
  const rawLead = raw.myAdjustedValue - raw.theirAdjustedValue;
  if (bounded === rawLead) return raw;
  const baseLead = raw.myBaseValue - raw.theirBaseValue;
  const packageAdjustment = Math.abs(bounded - baseLead);
  const side = packageAdjustment > 0 ? (bounded > baseLead ? "my" : "their") : null;
  return {
    ...raw,
    myAdjustedValue: raw.myBaseValue + (side === "my" ? packageAdjustment : 0),
    theirAdjustedValue: raw.theirBaseValue + (side === "their" ? packageAdjustment : 0),
    packageAdjustment,
    packageAdjustmentSide: side,
  };
}
