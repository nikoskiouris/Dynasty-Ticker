import { escapeHtml } from "./html.js";
import { playerIdFromAssetId, renderPlayerFace } from "./player-face.js";
import {
  LEAGUE_BOARD_MAX_ABS_SHIFT,
  playerAgeForAsset,
  playerPositionForAsset,
} from "./values.js";

export const LEAGUE_BOARD_APPLY_KEY = "dynasty_ticker_apply_league_board";
export const LEAGUE_BOARD_MIN_TRADES = 4;
export const LEAGUE_BOARD_PLAYER_SHRINK = 0.8;
export const LEAGUE_BOARD_ATTR_SHRINK = 3;
export const LEAGUE_BOARD_SHOW_RATIO = 0.04;
export const LEAGUE_BOARD_SHOW_ABS = 150;
export const BOOM_BUST_SCORE_FLOOR = 0.55;

const ATTR_WEIGHTS = {
  position: 0.22,
  age: 0.12,
  boom: 0.28,
};

export function readApplyLeagueBoard(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(LEAGUE_BOARD_APPLY_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeApplyLeagueBoard(on, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(LEAGUE_BOARD_APPLY_KEY, on ? "1" : "0");
  } catch {
    // Storage can be blocked; the in-memory flag still works for the session.
  }
}

export function emptyLeagueBoard() {
  return {
    ready: false,
    tradeCount: 0,
    shifts: {},
    biases: [],
    examples: [],
    summary: "Need a few completed trades before this room has a taste of its own.",
  };
}

export function boomBustScore(asset, marketValue) {
  if (asset?.assetType !== "player") return 0;
  const position = playerPositionForAsset(asset);
  const age = playerAgeForAsset(asset);
  const years = Number(asset?.raw?.years_exp);
  let score = 0;
  if (position === "WR") score += 0.34;
  else if (position === "RB") score += 0.22;
  if (Number.isFinite(age) && age <= 25) score += 0.28;
  if (Number.isFinite(years) && years <= 3) score += 0.18;
  if (Number.isFinite(marketValue) && marketValue >= 1600 && marketValue <= 6400) score += 0.22;
  if (Number.isFinite(marketValue) && marketValue >= 7500) score -= 0.35;
  return Math.max(0, Math.min(1, score));
}

export function isBoomBustAsset(asset, marketValue) {
  return boomBustScore(asset, marketValue) >= BOOM_BUST_SCORE_FLOOR;
}

export function ageBucketForAsset(asset) {
  if (asset?.assetType === "pick") return "pick";
  const age = playerAgeForAsset(asset);
  if (!Number.isFinite(age)) return "";
  if (age <= 24) return "youth";
  if (age >= 28) return "vet";
  return "prime";
}

export function packagesFromTransaction(transaction) {
  if (transaction?.type !== "trade" || transaction?.status !== "complete") return null;
  const rosterIds = [...new Set((transaction.roster_ids || []).map((id) => String(id)).filter(Boolean))];
  if (rosterIds.length !== 2) return null;

  const packages = {
    [rosterIds[0]]: [],
    [rosterIds[1]]: [],
  };
  const adds = transaction.adds && typeof transaction.adds === "object" ? transaction.adds : {};
  Object.entries(adds).forEach(([playerId, toRosterId]) => {
    const rosterId = String(toRosterId);
    if (!packages[rosterId]) return;
    packages[rosterId].push({
      assetType: "player",
      playerId: String(playerId),
      assetId: `player:${playerId}`,
    });
  });

  (Array.isArray(transaction.draft_picks) ? transaction.draft_picks : []).forEach((pick) => {
    const rosterId = String(pick?.owner_id ?? "");
    const season = pick?.season != null ? String(pick.season) : "";
    const round = Number(pick?.round);
    if (!packages[rosterId] || !season || !Number.isFinite(round)) return;
    packages[rosterId].push({
      assetType: "pick",
      pick,
      assetId: `pick:${season}:r${round}:any`,
    });
  });

  if (!packages[rosterIds[0]].length || !packages[rosterIds[1]].length) return null;
  return {
    rosterIds,
    packages,
    created: Number(transaction.status_updated || transaction.created || 0),
  };
}

export function buildLeagueBoard({
  trades = [],
  resolveAsset,
  now = Date.now(),
} = {}) {
  const parsed = [];
  for (const transaction of Array.isArray(trades) ? trades : []) {
    const row = packagesFromTransaction(transaction);
    if (!row) continue;
    const packages = {};
    let ok = true;
    for (const rosterId of row.rosterIds) {
      const assets = [];
      for (const token of row.packages[rosterId]) {
        const resolved = resolveAsset?.(token, transaction);
        const marketValue = Number(resolved?.marketValue);
        if (!resolved || !Number.isFinite(marketValue) || marketValue <= 0) {
          ok = false;
          break;
        }
        assets.push({
          assetId: String(resolved.assetId || token.assetId),
          assetType: resolved.assetType || token.assetType,
          name: resolved.name || token.assetId,
          marketValue,
          position: resolved.position || (token.assetType === "pick" ? "PICK" : ""),
          ageBucket: resolved.ageBucket || ageBucketForAsset(resolved.asset || resolved),
          boomBust: Boolean(resolved.boomBust ?? isBoomBustAsset(resolved.asset || resolved, marketValue)),
        });
      }
      if (!ok || assets.length === 0) {
        ok = false;
        break;
      }
      packages[rosterId] = assets;
    }
    if (!ok) continue;
    const left = packages[row.rosterIds[0]];
    const right = packages[row.rosterIds[1]];
    const leftValue = sumValues(left);
    const rightValue = sumValues(right);
    if (leftValue < 400 || rightValue < 400) continue;
    parsed.push({
      created: row.created,
      sides: [left, right],
      values: [leftValue, rightValue],
    });
  }

  if (parsed.length < LEAGUE_BOARD_MIN_TRADES) {
    return {
      ...emptyLeagueBoard(),
      tradeCount: parsed.length,
    };
  }

  const player = makeBucket();
  const position = makeBucket();
  const age = makeBucket();
  const boom = makeBucket();

  for (const trade of parsed) {
    const recency = recencyWeight(trade.created, now);
    const gap = Math.log(trade.values[1]) - Math.log(trade.values[0]);
    addSide(trade.sides[0], gap, recency, { player, position, age, boom });
    addSide(trade.sides[1], -gap, recency, { player, position, age, boom });
  }

  const posShifts = shrinkBucket(position, LEAGUE_BOARD_ATTR_SHRINK);
  const ageShifts = shrinkBucket(age, LEAGUE_BOARD_ATTR_SHRINK);
  const boomShifts = shrinkBucket(boom, LEAGUE_BOARD_ATTR_SHRINK);
  const playerShifts = shrinkBucket(player, LEAGUE_BOARD_PLAYER_SHRINK);
  const shifts = {};
  const examples = [];

  Object.keys(player.sample).forEach((assetId) => {
    const sample = player.sample[assetId];
    const playerShift = playerShifts[assetId] || 0;
    if (!sample) return;
    const combined = clampShift(
      playerShift
      + ATTR_WEIGHTS.position * (posShifts[sample.position] || 0)
      + ATTR_WEIGHTS.age * (ageShifts[sample.ageBucket] || 0)
      + ATTR_WEIGHTS.boom * (sample.boomBust ? (boomShifts.boom || 0) : 0)
    );
    if (Math.abs(combined) < 0.005) return;
    shifts[assetId] = combined;
    examples.push({
      assetId,
      name: sample.name,
      assetType: sample.assetType,
      marketValue: Math.round(sample.marketValue),
      leagueValue: Math.max(1, Math.round(sample.marketValue * (1 + combined))),
      shift: combined,
    });
  });

  const biases = [
    biasRow("pos:WR", "wide receivers", posShifts.WR),
    biasRow("pos:RB", "running backs", posShifts.RB),
    biasRow("pos:QB", "quarterbacks", posShifts.QB),
    biasRow("pos:TE", "tight ends", posShifts.TE),
    biasRow("age:youth", "young players", ageShifts.youth),
    biasRow("age:vet", "veterans", ageShifts.vet),
    biasRow("boom", "boom-or-bust skill players", boomShifts.boom),
    biasRow("pick", "draft picks", posShifts.PICK),
  ].filter(Boolean).sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift) || a.label.localeCompare(b.label));

  examples.sort((a, b) => {
    const aPlayer = String(a.assetId).startsWith("player:") ? 0 : 1;
    const bPlayer = String(b.assetId).startsWith("player:") ? 0 : 1;
    return aPlayer - bPlayer || Math.abs(b.shift) - Math.abs(a.shift) || a.name.localeCompare(b.name);
  });
  const headline = biases[0];
  return {
    ready: true,
    tradeCount: parsed.length,
    shifts,
    biases,
    examples: examples.slice(0, 6),
    summary: headline
      ? headline.sentence.replace("This league", "This room")
      : "This room has a slight local board. Apply it when you want room prices instead of the open market.",
  };
}

export function leagueValueDelta(marketValue, leagueValue) {
  const market = Number(marketValue);
  const league = Number(leagueValue);
  if (!Number.isFinite(market) || !Number.isFinite(league) || market <= 0) return 0;
  return league - market;
}

export function shouldShowLeagueAlt(marketValue, leagueValue) {
  const delta = Math.abs(leagueValueDelta(marketValue, leagueValue));
  const market = Number(marketValue) || 0;
  return delta >= LEAGUE_BOARD_SHOW_ABS && delta >= market * LEAGUE_BOARD_SHOW_RATIO;
}

function exampleName(row) {
  const playerId = playerIdFromAssetId(row?.assetId);
  const face = playerId ? renderPlayerFace(playerId, row?.name, { size: "sm" }) : "";
  const name = escapeHtml(row?.name || "");
  if (!face) return name;
  return `<span class="player-name">${face}<span class="player-name-text">${name}</span></span>`;
}

export function renderLeagueBoardMarkup(board, { applied = false, formatNumber = String } = {}) {
  const ready = Boolean(board?.ready);
  const biases = Array.isArray(board?.biases) ? board.biases : [];
  const examples = Array.isArray(board?.examples) ? board.examples : [];
  const applyLabel = applied ? "Using league board" : "Apply league board";
  const status = ready
    ? `${board.tradeCount} local trade${board.tradeCount === 1 ? "" : "s"} read`
    : `${board?.tradeCount || 0} local trade${(board?.tradeCount || 0) === 1 ? "" : "s"} so far`;
  return `
    <section class="workspace-panel league-board-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">League board</span>
          <h2>League estimate</h2>
        </div>
        <button
          type="button"
          class="ghost-btn league-board-apply${applied ? " is-on" : ""}"
          data-action="toggle-league-board"
          aria-pressed="${applied ? "true" : "false"}"
          ${ready ? "" : "disabled"}
        >${escapeHtml(applyLabel)}</button>
      </div>
      <p class="section-copy">${escapeHtml(board?.summary || emptyLeagueBoard().summary)}</p>
      <p class="muted small">Market stays Sleeper trades from many dynasty leagues, mixed with KeepTradeCut. This overlay is just your room.${status ? ` ${escapeHtml(status)}.` : ""}</p>
      ${biases.length ? `<ul class="league-bias-list">${biases.map((bias) => `<li>${escapeHtml(bias.sentence)}</li>`).join("")}</ul>` : ""}
      ${examples.length ? `<div class="league-board-examples">${examples.slice(0, 4).map((row) => `
        <article class="league-board-example">
          <strong>${exampleName(row)}</strong>
          <span>market ${escapeHtml(formatNumber(row.marketValue))}</span>
          <span>your league ${escapeHtml(formatNumber(row.leagueValue))}</span>
        </article>`).join("")}</div>` : ""}
    </section>
  `;
}

export function renderValueBoardBar({ applied = false, ready = false, formatNumber = String, marketHint = "" } = {}) {
  return `
    <div class="value-board-bar">
      <div>
        <span class="analytics-kicker">${applied ? "League board on" : "Open market"}</span>
        <p>${escapeHtml(marketHint || (applied
          ? "Calculator, find-deals, and power now use this room's prices."
          : "Numbers are the Sleeper trade market. League prices stay on the side until you apply them."))}</p>
      </div>
      <button
        type="button"
        class="ghost-btn league-board-apply${applied ? " is-on" : ""}"
        data-action="toggle-league-board"
        aria-pressed="${applied ? "true" : "false"}"
        ${ready ? "" : "disabled"}
      >${applied ? "Using league board" : "Apply league board"}</button>
    </div>
  `;
}

function makeBucket() {
  return { sum: {}, weight: {}, sample: {} };
}

function addObservation(bucket, key, amount, weight, sample) {
  if (!key || !Number.isFinite(amount) || !Number.isFinite(weight) || weight <= 0) return;
  bucket.sum[key] = (bucket.sum[key] || 0) + amount * weight;
  bucket.weight[key] = (bucket.weight[key] || 0) + weight;
  if (sample && !bucket.sample[key]) bucket.sample[key] = sample;
}

function addSide(assets, gap, recency, buckets) {
  const total = sumValues(assets);
  if (total <= 0) return;
  assets.forEach((asset) => {
    const share = asset.marketValue / total;
    const amount = gap * share;
    const weight = recency * share;
    addObservation(buckets.player, asset.assetId, amount, recency, asset);
    addObservation(buckets.position, asset.position, amount, weight);
    addObservation(buckets.age, asset.ageBucket, amount, weight);
    if (asset.boomBust) addObservation(buckets.boom, "boom", amount, weight);
  });
}

function shrinkBucket(bucket, shrink) {
  const out = {};
  Object.keys(bucket.sum).forEach((key) => {
    const weight = bucket.weight[key] || 0;
    const raw = bucket.sum[key] / Math.max(weight + shrink, 0.001);
    const shift = clampShift(raw);
    if (Math.abs(shift) >= 0.008) out[key] = shift;
  });
  return out;
}

function biasRow(id, label, shift) {
  if (!Number.isFinite(shift) || Math.abs(shift) < 0.04) return null;
  const pct = Math.round(shift * 100);
  const verb = shift > 0 ? "pays up" : "discounts";
  return {
    id,
    label,
    shift,
    sentence: `This league ${verb} for ${label} (${pct > 0 ? "+" : ""}${pct}%).`,
  };
}

function recencyWeight(created, now) {
  const age = Math.max(0, Number(now) - Number(created || 0));
  const halfLife = 180 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(created) || created <= 0) return 0.65;
  return 2 ** (-age / halfLife);
}

function sumValues(assets) {
  return assets.reduce((sum, asset) => sum + (Number(asset.marketValue) || 0), 0);
}

function clampShift(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-LEAGUE_BOARD_MAX_ABS_SHIFT, Math.min(LEAGUE_BOARD_MAX_ABS_SHIFT, numeric));
}
