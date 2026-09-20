import { clamp } from "./html.js";
import { formatOddsPct } from "./season.js";

export const WINDOW_CALLS = {
  "all-in": {
    id: "all-in",
    label: "Go all in",
    shortLabel: "All in",
    teamState: "contending",
    tone: "green",
  },
  middle: {
    id: "middle",
    label: "Stay in the middle",
    shortLabel: "Middle",
    teamState: "middle",
    tone: "gold",
  },
  tank: {
    id: "tank",
    label: "Tank",
    shortLabel: "Tank",
    teamState: "rebuilding",
    tone: "rose",
  },
};

export function windowCallMeta(id) {
  return WINDOW_CALLS[id] || WINDOW_CALLS.middle;
}

export function windowCallTeamState(id) {
  return windowCallMeta(id).teamState;
}

export function computeSeasonProgress({
  currentWeek,
  playoffStart,
  startWeek,
  seasonComplete,
  regularSeasonComplete,
  gamesPlayed,
  remainingTeamGames,
} = {}) {
  if (seasonComplete || regularSeasonComplete) return 1;
  const start = Math.max(1, Number(startWeek) || 1);
  const playoff = Math.max(start + 1, Number(playoffStart) || 15);
  const week = Number(currentWeek);
  if (Number.isFinite(week) && week > 0) {
    return clamp((week - start) / Math.max(1, playoff - start - 1), 0, 1);
  }
  const played = Math.max(0, Number(gamesPlayed) || 0);
  const left = Number(remainingTeamGames);
  if (Number.isFinite(left) && played + Math.max(0, left) > 0) {
    return clamp(played / (played + Math.max(0, left)), 0, 1);
  }
  return 0.15;
}

export function windowCallInputFromDesk({ profile, standing, simRow, model } = {}) {
  const rosterId = String(profile?.rosterId ?? standing?.rosterId ?? "");
  const remaining = Array.isArray(model?.remainingGames) ? model.remainingGames : [];
  const remainingTeamGames = remaining.filter((entry) =>
    (entry?.game?.sides || []).some((side) => String(side.rosterId) === rosterId)
  ).length;
  const wins = Number(standing?.wins || 0);
  const losses = Number(standing?.losses || 0);
  const ties = Number(standing?.ties || 0);
  const gamesPlayed = Number(standing?.gamesPlayed || 0) || (wins + losses + ties);
  const decidedGames = wins + losses + ties;
  const winPct = decidedGames > 0 ? (wins + ties * 0.5) / decidedGames : null;

  return {
    rosterId,
    managerName: profile?.managerName || standing?.name || "",
    rank: profile?.rank,
    totalTeams: profile?.totalTeams || model?.standings?.length,
    powerScore: profile?.score,
    starterPercentile: profile?.starterPercentile,
    pickPercentile: profile?.pickPercentile,
    timelineScore: profile?.timelineScore,
    averageAge: profile?.assetSummary?.averageAge,
    youthCount: profile?.assetSummary?.youthCount,
    veteranCount: profile?.assetSummary?.veteranCount,
    firstRoundPickCount: profile?.assetSummary?.firstRoundPickCount,
    weakestPosition: profile?.weakestPosition || null,
    playoffPct: simRow?.playoffPct,
    titlePct: simRow?.titlePct,
    lastPlacePct: simRow?.lastPlacePct,
    winPct,
    gamesPlayed,
    remainingTeamGames,
    currentWeek: model?.currentWeek,
    startWeek: model?.startWeek,
    playoffStart: model?.playoffStart,
    playoffTeams: model?.playoffTeams,
    seasonComplete: Boolean(model?.seasonComplete),
    regularSeasonComplete: Boolean(model?.regularSeasonComplete),
    playoffsStarted: Boolean(model?.playoffsStarted),
    clinched: Boolean(simRow?.clinched),
    eliminated: Boolean(simRow?.eliminated),
    recordLabel: standing?.recordLabel || "",
  };
}

export function scoreWindowAxes(input = {}) {
  const totalTeams = Math.max(2, Number(input.totalTeams) || 12);
  const rank = clamp(Number(input.rank) || totalTeams, 1, totalTeams);
  const rankPercentile = (totalTeams - rank) / (totalTeams - 1);
  const starterPct = finite01(input.starterPercentile, rankPercentile);
  const pickPct = finite01(input.pickPercentile, 0.5);
  const timeline = finite01(input.timelineScore, ageToTimeline(input.averageAge));
  const seasonProgress = computeSeasonProgress(input);
  const winPct = Number.isFinite(input.winPct) ? clamp(input.winPct, 0, 1) : null;
  const playoffPct = Number.isFinite(input.playoffPct) ? clamp(input.playoffPct, 0, 100) : null;
  const titlePct = Number.isFinite(input.titlePct) ? clamp(input.titlePct, 0, 100) : 0;
  const powerScore = Number.isFinite(input.powerScore) ? clamp(input.powerScore, 35, 99) : 60;
  const recordScore = winPct == null ? starterPct * 100 : winPct * 100;
  const playoffScore = playoffPct == null ? recordScore * 0.5 + starterPct * 50 : playoffPct;
  const titleScore = Math.min(100, titlePct * 3.4);
  const oddsWeight = 0.2 + seasonProgress * 0.62;
  const rosterWeight = 1 - oddsWeight;
  const nowScore = clamp(Math.round(
    playoffScore * oddsWeight * 0.7
    + titleScore * oddsWeight * 0.18
    + recordScore * 0.1
    + starterPct * 100 * rosterWeight * 0.58
    + powerScore * rosterWeight * 0.28
  ), 1, 99);

  const youth = Math.max(0, Number(input.youthCount) || 0);
  const vets = Math.max(0, Number(input.veteranCount) || 0);
  const youthShare = youth + vets > 0 ? youth / (youth + vets) : 0.5;
  const firsts = Math.max(0, Number(input.firstRoundPickCount) || 0);
  const pickScore = clamp(pickPct * 70 + Math.min(30, firsts * 8), 0, 100);
  const ageScore = Number.isFinite(input.averageAge)
    ? clamp((28.6 - Number(input.averageAge)) / 7.2, 0, 1) * 100
    : timeline * 100;
  const futureScore = clamp(Math.round(
    ageScore * 0.4 + youthShare * 100 * 0.22 + pickScore * 0.3 + timeline * 100 * 0.08
  ), 1, 99);

  return {
    nowScore,
    futureScore,
    seasonProgress,
    rankPercentile,
    starterPct,
    pickPct,
    timeline,
    oddsWeight,
    playoffScore,
    aging: Number.isFinite(input.averageAge) && Number(input.averageAge) >= 27.5,
    young: Number.isFinite(input.averageAge) && Number(input.averageAge) <= 25.7,
    pickRich: firsts >= 3 || pickPct >= 0.7,
    pickPoor: firsts <= 1 && pickPct <= 0.38,
    youthShare,
    firsts,
  };
}

export function analyzeWindowCall(input = {}) {
  const axes = scoreWindowAxes(input);
  const picked = pickWindowCall(input, axes);
  const meta = windowCallMeta(picked.id);
  const signals = buildWindowCallSignals(input, axes);
  const copy = buildWindowCallCopy(input, axes, picked.id);
  return {
    ...meta,
    rosterId: String(input.rosterId || ""),
    managerName: String(input.managerName || ""),
    confidence: picked.confidence,
    nowScore: axes.nowScore,
    futureScore: axes.futureScore,
    seasonProgress: axes.seasonProgress,
    headline: copy.headline,
    summary: copy.summary,
    moves: copy.moves,
    signals,
    pressure: picked.pressure,
  };
}

export function groupWindowCalls(calls = []) {
  const groups = { "all-in": [], middle: [], tank: [] };
  (Array.isArray(calls) ? calls : []).forEach((call) => {
    const id = WINDOW_CALLS[call?.id] ? call.id : "middle";
    groups[id].push(call);
  });
  return groups;
}

export function summarizeLeagueWindowCalls(calls = []) {
  const groups = groupWindowCalls(calls);
  return {
    allInCount: groups["all-in"].length,
    middleCount: groups.middle.length,
    tankCount: groups.tank.length,
    groups,
  };
}

function pickWindowCall(input, axes) {
  const override = hardWindowOverride(input, axes);
  const pressure = scoreWindowPressure(input, axes);
  const ranked = Object.entries(pressure).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const id = override || ranked[0][0];
  const winner = pressure[id];
  const runnerUp = ranked.find((entry) => entry[0] !== id)?.[1] ?? winner;
  const confidence = clamp(Math.round(54 + Math.abs(winner - runnerUp) * 1.25 + (override ? 8 : 0)), 55, 96);
  return { id, pressure, confidence };
}

function hardWindowOverride(input, axes) {
  const playoffPct = Number(input.playoffPct);
  const titlePct = Number(input.titlePct) || 0;
  const late = axes.seasonProgress >= 0.38;
  const veryLate = axes.seasonProgress >= 0.58;
  if (input.eliminated) return "tank";
  if (Number.isFinite(playoffPct) && playoffPct <= 3 && late) return "tank";
  if (Number.isFinite(playoffPct) && playoffPct <= 10 && veryLate) return "tank";
  if (input.clinched || titlePct >= 22) return "all-in";
  if (Number.isFinite(playoffPct) && playoffPct >= 82) return "all-in";
  return null;
}

function scoreWindowPressure(input, axes) {
  const { nowScore, futureScore, seasonProgress, aging, young, pickRich, pickPoor } = axes;
  const playoffPct = Number.isFinite(input.playoffPct) ? Number(input.playoffPct) : null;
  const titlePct = Number(input.titlePct) || 0;
  const lastPlacePct = Number(input.lastPlacePct) || 0;

  let allIn = nowScore * 1.04;
  let tank = (100 - nowScore) * 1.03;
  let middle = 48 + Math.max(0, 16 - Math.abs(nowScore - 52) * 0.4);

  if (nowScore >= 62 && aging) allIn += 16;
  if (nowScore >= 68 && pickPoor) allIn += 10;
  if (titlePct >= 10) allIn += 10;
  if (titlePct >= 18) allIn += 8;
  if (playoffPct != null && playoffPct >= 68) allIn += 14;
  if (playoffPct != null && playoffPct >= 52 && nowScore >= 56) allIn += 8;
  if (input.clinched) allIn += 12;
  if (input.playoffsStarted && nowScore >= 58) allIn += 10;
  if (nowScore >= 74) allIn += 8;

  if (input.eliminated) tank += 26;
  if (playoffPct != null && playoffPct <= 10 && seasonProgress >= 0.32) tank += 16;
  if (playoffPct != null && playoffPct <= 20 && seasonProgress >= 0.52) tank += 12;
  if (nowScore <= 38) tank += 12;
  if (nowScore <= 46 && (young || pickRich)) tank += 12;
  if (nowScore <= 50 && aging && !pickRich) tank += 14;
  if (lastPlacePct >= 32 && nowScore <= 52) tank += 8;
  if (futureScore >= 68 && nowScore <= 48) tank += 8;

  if (nowScore >= 66) tank -= 22;
  if (playoffPct != null && playoffPct >= 48) tank -= 16;
  if (nowScore <= 42) allIn -= 20;
  if (playoffPct != null && playoffPct <= 22 && seasonProgress >= 0.28) allIn -= 12;
  if (pickRich && young && nowScore <= 54) allIn -= 12;

  if (nowScore >= 44 && nowScore <= 66 && futureScore >= 40 && futureScore <= 72) middle += 10;
  if (playoffPct != null && playoffPct >= 26 && playoffPct <= 58 && titlePct < 12) middle += 12;
  if (Math.abs(nowScore - futureScore) <= 12 && nowScore >= 42 && nowScore <= 64) middle += 8;
  if (nowScore >= 70 && young && !pickPoor) middle += 6;

  const gap = Math.abs(allIn - tank);
  if (gap >= 20) middle -= 12;
  if (gap >= 30) middle -= 10;
  if (input.eliminated) middle -= 22;
  if (playoffPct != null && playoffPct >= 75) middle -= 16;
  if (titlePct >= 18) middle -= 12;

  return { "all-in": allIn, middle, tank };
}

function buildWindowCallSignals(input, axes) {
  const playoffPct = Number.isFinite(input.playoffPct) ? Number(input.playoffPct) : null;
  const titlePct = Number.isFinite(input.titlePct) ? Number(input.titlePct) : null;
  const rank = Number(input.rank);
  const totalTeams = Number(input.totalTeams);
  const age = Number(input.averageAge);
  const firsts = axes.firsts;
  const hole = input.weakestPosition;
  return [
    {
      id: "playoffs",
      label: "Playoff odds",
      value: playoffPct == null ? "Pending" : percentText(playoffPct),
      detail: playoffPct == null ? "Sim still warming" : input.eliminated ? "Eliminated" : input.clinched ? "Clinched" : "Monte Carlo",
      lean: leanFromNow(playoffPct == null ? axes.nowScore : playoffPct),
    },
    {
      id: "title",
      label: "Title odds",
      value: titlePct == null ? "Pending" : percentText(titlePct),
      detail: "Championship share",
      lean: titlePct == null ? "middle" : titlePct >= 12 ? "all-in" : titlePct <= 3 ? "tank" : "middle",
    },
    {
      id: "lineup",
      label: "Lineup",
      value: Number.isFinite(rank) && Number.isFinite(totalTeams) ? `${ordinal(rank)} / ${totalTeams}` : "Unranked",
      detail: `${axes.nowScore} this-year score`,
      lean: leanFromNow(axes.starterPct * 100),
    },
    {
      id: "timeline",
      label: "Timeline",
      value: Number.isFinite(age) ? `${age.toFixed(1)}y` : "N/A",
      detail: `${Number(input.youthCount) || 0} youth / ${Number(input.veteranCount) || 0} vets`,
      lean: axes.aging ? "all-in" : axes.young ? "tank" : "middle",
    },
    {
      id: "picks",
      label: "Pick vault",
      value: `${firsts} first${firsts === 1 ? "" : "s"}`,
      detail: axes.pickRich ? "Future ammo" : axes.pickPoor ? "Thin capital" : "Balanced capital",
      lean: axes.pickRich ? "tank" : axes.pickPoor ? "all-in" : "middle",
    },
    {
      id: "hole",
      label: hole?.position ? `${hole.position} hole` : "Roster hole",
      value: hole?.rankLabel || (hole?.percentile != null ? `${Math.round(hole.percentile * 100)}th pct` : "Balanced"),
      detail: hole?.position ? "Cleanest upgrade path" : "No screaming gap",
      lean: Number(hole?.percentile) <= 0.32 ? "all-in" : "middle",
    },
  ];
}

function buildWindowCallCopy(input, axes, id) {
  const hole = input.weakestPosition?.position;
  const age = Number.isFinite(input.averageAge) ? Number(input.averageAge).toFixed(1) : null;
  const record = input.recordLabel || (Number(input.gamesPlayed) > 0 ? "this season" : "preseason");
  if (id === "all-in") {
    const headline = axes.aging
      ? "Window is open now. Spend future picks for a title shot."
      : axes.young
        ? "This roster can win it. Push for the chip."
        : "Go get the missing starter. This year is live.";
    const summary = axes.aging
      ? `The core is aging${age ? ` (${age}y)` : ""} and the board still says contend. Do not sit on firsts while the window closes.`
      : `Lineup juice and ${record} both say compete. Buy the win-now piece${hole ? ` at ${hole}` : ""} and keep the stars.`;
    return {
      headline,
      summary,
      moves: [
        hole ? `Pay up for a proven ${hole} starter, even if it costs a future first.` : "Buy a proven starter if it closes a weekly hole.",
        "Do not sell your aging stars for picks.",
        axes.pickPoor
          ? "Consolidate two depth pieces into one every-week starter."
          : "Spend a future pick, not the young core, if you need one more hammer.",
        input.playoffsStarted
          ? "Treat the next two weeks as a title window, not a value exercise."
          : "Stop collecting dart throws until after the trade deadline.",
      ],
    };
  }
  if (id === "tank") {
    const headline = axes.young || axes.pickRich
      ? "Commit to the rebuild. Do not buy aging production."
      : "Tear it down. Sell veterans for youth and firsts.";
    const summary = input.eliminated || (Number(input.playoffPct) <= 8 && axes.seasonProgress >= 0.35)
      ? "This year is dead. Trade 2026 production for 2027 capital before the rest of the room wakes up."
      : `The weekly team is not a title threat, and the future is the real asset. Sit out the veteran market${hole ? `, even at ${hole}` : ""}.`;
    return {
      headline,
      summary,
      moves: [
        "Shop veterans 27+ for firsts and young players.",
        "Do not buy a 28-year-old to patch a hole this year.",
        axes.pickRich
          ? "Keep the firsts. The draft is the plan, not a 7-7 finish."
          : "Collect extra firsts until the pick vault is actually scary.",
        "Protect the youth core. Those names are the next contention window.",
      ],
    };
  }
  const headline = Number(input.playoffPct) >= 28 && Number(input.playoffPct) <= 58
    ? "Bubble team. One starter upgrade, not a fire sale."
    : "Do not blow it up, and do not sell the farm.";
  const summary = `This roster is not a tank and not a finished title team. Stay in the middle: keep the core, fill ${hole || "the weakest starter spot"} without mortgaging two firsts.`;
  return {
    headline,
    summary,
    moves: [
      hole ? `Upgrade ${hole} with a prime-age starter, not a 30-year-old rental.` : "Make one starter upgrade. Stop after that.",
      "Do not dump two firsts for a fading veteran.",
      "Do not sell a core starter just because the record looks ugly this week.",
      "One-for-one youth/prime swaps beat both a teardown and a panic buy.",
    ],
  };
}

function leanFromNow(score) {
  if (!Number.isFinite(score)) return "middle";
  if (score >= 62) return "all-in";
  if (score <= 38) return "tank";
  return "middle";
}

function percentText(value) {
  return formatOddsPct(value);
}

function ordinal(rank) {
  const value = Number(rank);
  if (!Number.isFinite(value)) return "";
  const mod100 = value % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${value}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th";
  return `${value}${suffix}`;
}

function finite01(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return clamp(numeric, 0, 1);
  const backup = Number(fallback);
  return Number.isFinite(backup) ? clamp(backup, 0, 1) : 0.5;
}

function ageToTimeline(age) {
  if (!Number.isFinite(age)) return 0.5;
  return clamp((28.8 - Number(age)) / 7, 0, 1);
}
