import { escapeHtml } from "./html.js";
import { chooseBestLineup } from "./lineup.js";
import {
  formatShare,
  formatWeeklyPoints,
  lineupFillValue,
  weeklyPosition,
} from "./weekly-value.js";

export const CLOSE_CALL_GAP = 8;
export const SIT_BYE = "Sit — bye week";
export const SIT_NO_OPPONENT = "Sit — no opponent data";
export const SIT_NO_TEAM = "Sit — not on a team";
export const SIT_NO_ELIGIBLE = "No eligible starter";
export const SIT_START_HINT = "League slots. Bye, out, no team, and missing opponent sit. Dynasty only breaks ties.";

const EXACT_CANDIDATE_LIMIT = 20;
const WEEKLY_SKILL = new Set(["QB", "RB", "WR", "TE"]);
const SIT_INJURY = new Set([
  "out",
  "ir",
  "pup",
  "na",
  "doubtful",
  "sus",
  "suspended",
  "covid",
  "cov",
  "injured reserve",
  "injured_reserve",
]);
const SIT_ROSTER = new Set([
  "inactive",
  "retired",
  "reserve_retired",
  "reserve/did_not_report",
  "did_not_report",
]);

const SLOT_LABELS = {
  SUPER_FLEX: "SFlex",
  REC_FLEX: "Rec Flex",
  WRRB_FLEX: "RB/WR",
  RBWR_FLEX: "RB/WR",
  WRTE_FLEX: "WR/TE",
  FLEX: "Flex",
};

const SLOT_POSITIONS = {
  FLEX: ["RB", "WR", "TE"],
  WRT: ["RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  WRRB: ["RB", "WR"],
  RBWR_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  WRTE_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  OP: ["QB", "RB", "WR", "TE"],
};

export function formatSitStartSlot(slot) {
  const normalized = String(slot || "").trim().toUpperCase();
  return SLOT_LABELS[normalized] || normalized.replace(/_/g, " ");
}

export function injurySitReason(injuryStatus, playerStatus) {
  const injury = String(injuryStatus || "").trim();
  const injuryKey = injury.toLowerCase();
  if (injury && SIT_INJURY.has(injuryKey)) return `Sit — ${injury}`;
  const status = String(playerStatus || "").trim().toLowerCase();
  if (SIT_ROSTER.has(status)) return "Sit — Inactive";
  if (SIT_INJURY.has(status) || status.includes("injured reserve") || status.includes("pup")) {
    return "Sit — IR";
  }
  return "";
}

export function weeklySitReason(weekly, position) {
  if (weekly?.noTeam) return SIT_NO_TEAM;
  if (weekly?.bye) return SIT_BYE;
  const pos = weeklyPosition(weekly?.position || position);
  if (weekly?.opponentMissing && WEEKLY_SKILL.has(pos)) return SIT_NO_OPPONENT;
  if (!weekly && WEEKLY_SKILL.has(pos)) return SIT_NO_OPPONENT;
  return "";
}

export function sitStartEligibility(player = {}) {
  const injury = injurySitReason(player.injuryStatus, player.playerStatus);
  if (injury) return { eligible: false, reason: injury };
  const weekly = weeklySitReason(player.weekly, player.position);
  if (weekly) return { eligible: false, reason: weekly };
  return { eligible: true, reason: "" };
}

export function sitStartFillValue({ weekly, dynastyValue } = {}) {
  const chance = Number(weekly?.score);
  const dynasty = Number.isFinite(Number(dynastyValue)) ? Number(dynastyValue) : 0;
  if (Number.isFinite(chance)) return lineupFillValue({ startChance: chance, dynastyValue: dynasty });
  return dynasty;
}

export function playerCanFillSlot(player, slot) {
  if (typeof player?.canFill === "function") return Boolean(player.canFill(slot));
  const normalized = String(slot || "").trim().toUpperCase();
  const allowed = SLOT_POSITIONS[normalized] || [normalized];
  const positions = [
    ...(Array.isArray(player?.positions) ? player.positions : []),
    player?.position,
    player?.weekly?.position,
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  return positions.some((position) => allowed.includes(position));
}

function numberSlotLabels(starters) {
  const counts = {};
  starters.forEach((entry) => {
    counts[entry.slot] = (counts[entry.slot] || 0) + 1;
  });
  const seen = {};
  return starters.map((entry) => {
    const base = formatSitStartSlot(entry.slot);
    if ((counts[entry.slot] || 0) <= 1) return { ...entry, slotLabel: base };
    seen[entry.slot] = (seen[entry.slot] || 0) + 1;
    return { ...entry, slotLabel: `${base}${seen[entry.slot]}` };
  });
}

function usageBit(weekly) {
  const pos = weeklyPosition(weekly?.position) || String(weekly?.position || "").toUpperCase();
  if (pos === "RB") {
    const bits = [];
    if (weekly?.rushShare != null) bits.push(`${formatShare(weekly.rushShare)} rush`);
    if (weekly?.targetShare != null) bits.push(`${formatShare(weekly.targetShare)} targets`);
    return bits.join(", ");
  }
  if (pos === "WR" || pos === "TE") {
    if (weekly?.targetShare != null) return `${formatShare(weekly.targetShare)} targets`;
  }
  if (pos === "QB" && Number.isFinite(Number(weekly?.recentPoints))) {
    return `${formatWeeklyPoints(weekly.recentPoints)} PPR/game`;
  }
  return "";
}

function matchupBit(weekly) {
  if (weekly?.bye) return "bye";
  const opp = weekly?.upcomingOpponent || "";
  const ease = weekly?.opponentEase?.label || "";
  if (opp && ease) return `${ease} vs ${opp}`;
  if (opp) return `vs ${opp}`;
  return "";
}

function lastWeekBit(weekly) {
  const last = weekly?.games?.[0];
  if (!last) return "";
  if (Number.isFinite(Number(last.pts))) return `${formatWeeklyPoints(last.pts)} PPR last week`;
  if (Number.isFinite(Number(last.recTgt))) return `${last.recTgt} targets last week`;
  if (Number.isFinite(Number(last.rushAtt))) return `${last.rushAtt} rushes last week`;
  return "";
}

export function playerWhyBits(weekly) {
  return {
    matchup: matchupBit(weekly),
    usage: usageBit(weekly),
    last: lastWeekBit(weekly),
  };
}

function playerWhyPhrase(name, bits) {
  const detail = [bits.usage, bits.matchup].filter(Boolean).join(", ");
  if (detail) return `${name}: ${detail}`;
  if (bits.last) return `${name}: ${bits.last}`;
  return "";
}

export function closeCallReason({ starter, challenger, slotLabel } = {}) {
  const startName = starter?.name || "Starter";
  const sitName = challenger?.name || "Bench";
  const label = slotLabel || formatSitStartSlot(starter?.slot);
  const startBits = playerWhyBits(starter?.weekly);
  const sitBits = playerWhyBits(challenger?.weekly);
  const phrases = [
    playerWhyPhrase(startName, startBits),
    playerWhyPhrase(sitName, sitBits),
  ].filter(Boolean);
  if (phrases.length < 2 && startBits.last && !phrases.some((line) => line.includes("last week"))) {
    phrases.push(`${startName}: ${startBits.last}`);
  }
  const why = phrases.join(". ") || "matchup and usage are close";
  return `${label}: ${startName} over ${sitName} — ${why}`;
}

function chooseGreedyLineup(slotEntries, candidates) {
  const used = new Set();
  const picks = [];
  let score = 0;
  for (const slotEntry of slotEntries) {
    let bestIndex = null;
    for (let i = 0; i < candidates.length; i += 1) {
      if (used.has(i)) continue;
      if (!playerCanFillSlot(candidates[i], slotEntry.slot)) continue;
      if (bestIndex == null || candidates[i].fillValue > candidates[bestIndex].fillValue) bestIndex = i;
    }
    if (bestIndex == null) {
      picks.push(null);
      continue;
    }
    used.add(bestIndex);
    picks.push(bestIndex);
    score += candidates[bestIndex].fillValue;
  }
  return { score, picks };
}

function slotFlexWeight(slot) {
  const normalized = String(slot || "").trim().toUpperCase();
  return (SLOT_POSITIONS[normalized] || [normalized]).length;
}

function candidatePool(players, slots) {
  const slotList = Array.isArray(slots) ? slots : [];
  const ranked = [...(Array.isArray(players) ? players : [])]
    .filter((player) => slotList.some((slot) => playerCanFillSlot(player, slot)))
    .sort((left, right) => right.fillValue - left.fillValue || String(left.id).localeCompare(String(right.id)));
  const kept = new Map();
  const scarceFirst = slotList
    .map((slot) => ({
      slot,
      options: ranked.filter((player) => playerCanFillSlot(player, slot)),
    }))
    .sort((left, right) => left.options.length - right.options.length);
  scarceFirst.forEach(({ options }) => {
    let added = 0;
    for (const player of options) {
      if (kept.size >= EXACT_CANDIDATE_LIMIT || added >= 2) break;
      if (kept.has(player.id)) continue;
      kept.set(player.id, player);
      added += 1;
    }
  });
  for (const player of ranked) {
    if (kept.size >= EXACT_CANDIDATE_LIMIT) break;
    kept.set(player.id, player);
  }
  return [...kept.values()].sort((left, right) => right.fillValue - left.fillValue);
}

function fillLineup(slots, candidates) {
  const pool = candidatePool(candidates, slots);
  const slotEntries = (Array.isArray(slots) ? slots : []).map((slot, index) => ({ slot, index }));
  slotEntries.sort((left, right) => {
    const eligibleDiff = pool.filter((player) => playerCanFillSlot(player, left.slot)).length
      - pool.filter((player) => playerCanFillSlot(player, right.slot)).length;
    if (eligibleDiff !== 0) return eligibleDiff;
    return slotFlexWeight(left.slot) - slotFlexWeight(right.slot);
  });
  const plan = solveLineup(slotEntries, pool) || chooseGreedyLineup(slotEntries, pool);
  return slotEntries
    .map((entry, index) => ({
      slot: entry.slot,
      originalIndex: entry.index,
      player: plan.picks[index] == null ? null : pool[plan.picks[index]],
    }))
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map(({ slot, player }) => ({ slot, player }));
}

function solveLineup(slotEntries, pool) {
  return chooseBestLineup(slotEntries, pool, playerCanFillSlot, { valueFor: fillValueOf });
}

function fillValueOf(player) {
  return player.fillValue;
}

function finiteWeeklyScore(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildCloseCalls(starters, eligible) {
  const starterIds = new Set(starters.filter((entry) => entry.player).map((entry) => entry.player.id));
  const calls = [];
  const usedChallengers = new Set();

  starters.forEach((entry) => {
    if (!entry.player) return;
    const startChance = finiteWeeklyScore(entry.player.weekly?.score);
    if (startChance == null) return;
    const challenger = eligible
      .filter((player) => !starterIds.has(player.id) && !usedChallengers.has(player.id) && playerCanFillSlot(player, entry.slot))
      .sort((left, right) => Number(right.weekly?.score) - Number(left.weekly?.score) || right.fillValue - left.fillValue)[0];
    if (!challenger) return;
    const sitChance = finiteWeeklyScore(challenger.weekly?.score);
    if (sitChance == null) return;
    const gap = Math.abs(startChance - sitChance);
    if (gap > CLOSE_CALL_GAP) return;
    usedChallengers.add(challenger.id);
    calls.push({
      slot: entry.slot,
      slotLabel: entry.slotLabel,
      gap,
      starterId: entry.player.id,
      challengerId: challenger.id,
      starter: entry.player,
      challenger,
      reason: closeCallReason({ starter: entry.player, challenger, slotLabel: entry.slotLabel }),
    });
  });

  return calls
    .sort((left, right) => left.gap - right.gap || String(left.starterId).localeCompare(String(right.starterId)))
    .slice(0, 4);
}

export function buildSitStart({
  players = [],
  slots = [],
  week = 0,
} = {}) {
  const decorated = (Array.isArray(players) ? players : []).map((player, index) => {
    const eligibility = sitStartEligibility(player);
    return {
      ...player,
      id: player.id || player.playerId || `player-${index}`,
      name: player.name || "Player",
      eligible: eligibility.eligible,
      sitReason: eligibility.reason,
      fillValue: eligibility.eligible ? sitStartFillValue(player) : Number.NEGATIVE_INFINITY,
    };
  });
  const eligible = decorated.filter((player) => player.eligible).sort((left, right) => right.fillValue - left.fillValue);
  const starters = numberSlotLabels(fillLineup(slots, eligible)).map((entry) => ({
    ...entry,
    asset: entry.player?.asset || null,
  }));
  const starterIds = new Set(starters.filter((entry) => entry.player).map((entry) => entry.player.id));
  const closeCalls = buildCloseCalls(starters, eligible);
  const closeById = new Map();
  closeCalls.forEach((call) => {
    closeById.set(call.starterId, `Close vs ${call.challenger.name}`);
    closeById.set(call.challengerId, `Close vs ${call.starter.name}`);
  });

  const bench = decorated
    .filter((player) => !starterIds.has(player.id))
    .sort((left, right) => {
      const leftCause = left.sitReason ? 0 : 1;
      const rightCause = right.sitReason ? 0 : 1;
      if (leftCause !== rightCause) return leftCause - rightCause;
      return right.fillValue - left.fillValue;
    })
    .map((player) => ({
      player,
      asset: player.asset || null,
      sitReason: player.sitReason,
      rowNote: player.sitReason || closeById.get(player.id) || "",
    }));

  return {
    week: Number(week) || 0,
    starters: starters.map((entry) => ({
      ...entry,
      rowNote: entry.player ? (closeById.get(entry.player.id) || "") : SIT_NO_ELIGIBLE,
    })),
    bench,
    closeCalls,
  };
}

export function renderSitStartCallout(board, { loading = false, error = "", week = 0 } = {}) {
  const weekNum = Number(board?.week) || Number(week) || 0;
  const weekLabel = weekNum > 0 ? ` · W${weekNum}` : "";
  if (loading) {
    return `
      <section class="sit-start-board" data-sit-start="loading">
        <header class="sit-start-head">
          <span class="eyebrow">This week${escapeHtml(weekLabel)}</span>
          <h4>Sit / start</h4>
        </header>
        <p class="muted small lineup-basis">Loading this week's sit/start…</p>
      </section>
    `;
  }
  if (error) {
    return `
      <section class="sit-start-board" data-sit-start="error">
        <header class="sit-start-head">
          <span class="eyebrow">This week${escapeHtml(weekLabel)}</span>
          <h4>Sit / start</h4>
        </header>
        <p class="muted small lineup-basis">Sit/start unavailable (${escapeHtml(error)}). Dynasty lineup still shows.</p>
      </section>
    `;
  }
  if (!board) return "";
  const calls = (board.closeCalls || [])
    .map((call) => `<li>${escapeHtml(call.reason)}</li>`)
    .join("");
  return `
    <section class="sit-start-board" data-sit-start="ready">
      <header class="sit-start-head">
        <span class="eyebrow">This week${escapeHtml(weekLabel)}</span>
        <h4>Sit / start</h4>
      </header>
      <p class="muted small lineup-basis">${escapeHtml(SIT_START_HINT)}</p>
      ${calls
        ? `<ul class="sit-start-calls">${calls}</ul>`
        : `<p class="muted small">No close calls this week.</p>`}
    </section>
  `;
}
