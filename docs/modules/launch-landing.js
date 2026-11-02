import { escapeHtml, formatNumber } from "./html.js";
import { draftVerdictModel } from "./trade-draft.js";
import { getGlobalMaxPlayerValue } from "./values.js";
import { sumValueCalcSide, valueCalcVerdict } from "./value-calc.js";
import { verdictCopy } from "./verdict-copy.js";
import { calcPointer, compareMetersMarkup, sharedBarSegments, starsPremiumMarkup, bestRowName } from "./verdict-bars.js";
import { tradeHref } from "./history-route.js";
import { playerSlug } from "./history-route.js";
import { renderPlayerFace } from "./player-face.js";

export const EXAMPLE_GIVE = Object.freeze(["player:9509"]);
export const EXAMPLE_GET = Object.freeze(["player:11632", "pick:2027:r1:early"]);
export const LAUNCH_ROW_HEIGHT = 40;
export const LAUNCH_TREND_COUNT = 5;
export const LAUNCH_TOP_COUNT = 9;
export const LAUNCH_EXAMPLE_MIN_HEIGHT = 360;
export const LAUNCH_TREND_MIN_HEIGHT = LAUNCH_ROW_HEIGHT * LAUNCH_TREND_COUNT;

export function exampleTradeHref() {
  return tradeHref(EXAMPLE_GIVE, EXAMPLE_GET);
}

export function playerTradeHref(playerId) {
  const id = String(playerId || "").replace(/^player:/, "");
  return tradeHref([`player:${id}`], []);
}

export function launchPlayerHref(playerId, name = "") {
  const id = String(playerId || "").replace(/^player:/, "");
  if (!/^\d+$/.test(id) || id === "0") return playerTradeHref(id);
  const slug = playerSlug(name);
  return slug ? `/player/${id}/${slug}` : `/player/${id}`;
}

export function exampleTradeFromValues(values = {}, { globalMaxValue } = {}) {
  const price = (id) => Math.round(Number(values?.[id]) || 0);
  const givePrices = EXAMPLE_GIVE.map(price);
  const getPrices = EXAMPLE_GET.map(price);
  const giveSum = sumValueCalcSide(givePrices.map((value) => ({ value })));
  const getSum = sumValueCalcSide(getPrices.map((value) => ({ value })));
  const raw = valueCalcVerdict(giveSum, getSum, {
    leftCount: givePrices.length,
    rightCount: getPrices.length,
  });
  const model = draftVerdictModel(givePrices, getPrices, {
    globalMaxValue: Number.isFinite(Number(globalMaxValue))
      ? Number(globalMaxValue)
      : getGlobalMaxPlayerValue(values),
  });
  return { giveSum, getSum, raw, model };
}

function assetMeta(assetId, { names = {}, players = {} } = {}) {
  const id = String(assetId || "");
  const raw = players?.[id] || {};
  const pick = id.startsWith("pick:");
  const name = String(names?.[id] || "").trim();
  const age = Number(raw.age);
  return {
    assetId: id,
    name: name || (pick ? id : ""),
    pos: pick ? "Pick" : String(raw.position || "").toUpperCase(),
    team: pick ? "" : String(raw.team || ""),
    age: Number.isFinite(age) && age > 0 ? Math.round(age) : 0,
  };
}

function rowMarkup(row, { href = "", trend = "" } = {}) {
  const meta = [row.pos, row.team, row.age ? String(row.age) : ""].filter(Boolean).join(" · ");
  const face = row.playerId ? renderPlayerFace(row.playerId, row.name, { size: "sm" }) : "";
  const inner = `
    ${face || `<span class="pos">${escapeHtml(row.pos || "")}</span>`}
    <span class="nm">${escapeHtml(row.name || "Player")}${meta ? ` <span class="meta">${escapeHtml(meta)}</span>` : ""}</span>
    <span class="v">${escapeHtml(formatNumber(row.value))}${trend}</span>
  `;
  if (!href) return `<div class="launch-row">${inner}</div>`;
  return `<a class="launch-row" href="${escapeHtml(href)}">${inner}</a>`;
}

export function launchExampleMarkup({ values = {}, names = {}, players = {}, globalMaxValue } = {}) {
  const priced = exampleTradeFromValues(values, { globalMaxValue });
  const give = EXAMPLE_GIVE.map((id) => ({ ...assetMeta(id, { names, players }), value: Math.round(Number(values?.[id]) || 0) }));
  const get = EXAMPLE_GET.map((id) => ({ ...assetMeta(id, { names, players }), value: Math.round(Number(values?.[id]) || 0) }));
  const model = priced.model;
  const copy = verdictCopy(model.verdict);
  const bars = sharedBarSegments(model, null);
  const tone = copy.publicTone === "fair" || copy.publicTone === "strong" ? copy.publicTone : "";
  const giveMark = copy.side === "Give" ? `${calcPointer("◀")} ` : "";
  const getMark = copy.side === "Get" ? ` ${calcPointer("▶")}` : "";
  const href = exampleTradeHref();
  return `
    <a class="launch-card-hit" href="${escapeHtml(href)}" data-launch="example">
      <div class="launch-side">
        <div class="sh"><span>${giveMark}You give</span><span>${escapeHtml(formatNumber(bars.give.total))}</span></div>
        ${give.map((row) => rowMarkup(row)).join("")}
      </div>
      <div class="launch-side">
        <div class="sh"><span>You get${getMark}</span><span>${escapeHtml(formatNumber(bars.get.total))}</span></div>
        ${get.map((row) => rowMarkup(row)).join("")}
      </div>
      <div class="launch-verdict ${tone}">
        <div class="vt"><b>${escapeHtml(copy.line)}</b></div>
        ${compareMetersMarkup(model)}
        ${starsPremiumMarkup(model, { best: bestRowName(model.adjustment?.side === "left" ? give : get) })}
        <span class="meta">Tap to change any player</span>
      </div>
    </a>
  `;
}

export function launchErrorMarkup() {
  return `
    <div class="launch-error" role="alert">
      <b>Values didn't load.</b>
      <p class="meta">Check your connection and try again.</p>
      <button type="button" class="ghost-btn" data-launch="retry">Try again</button>
    </div>
  `;
}

export function hotSleeperRows(adds = [], { values = {}, names = {}, players = {}, limit = LAUNCH_TREND_COUNT } = {}) {
  const rows = [];
  for (const entry of Array.isArray(adds) ? adds : []) {
    const id = String(entry?.player_id || entry?.playerId || "").replace(/^player:/, "");
    if (!/^\d+$/.test(id)) continue;
    const assetId = `player:${id}`;
    const value = Number(values?.[assetId]);
    if (!(value > 0)) continue;
    const meta = assetMeta(assetId, { names, players });
    if (!meta.name) continue;
    rows.push({
      ...meta,
      playerId: id,
      value: Math.round(value),
      href: launchPlayerHref(id, meta.name),
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export function launchTrendErrorMarkup() {
  return `
    <div class="launch-error" role="alert">
      <b>Hot list didn't load.</b>
      <p class="meta">Check your connection and try again.</p>
      <button type="button" class="ghost-btn" data-launch="retry">Retry</button>
    </div>
  `;
}

export function launchTrendMarkup(rows = [], { failed = false, trendFor = null } = {}) {
  if (failed) return launchTrendErrorMarkup();
  if (!rows.length) {
    return `<p class="meta launch-empty">Nothing's moving yet this week. Check back after Sunday's games.</p>`;
  }
  return rows.map((row) => rowMarkup(row, { href: row.href, trend: trendFor ? trendFor(row.assetId) : "" })).join("");
}

// The most valuable players, highest first: the faces strip on the home page.
export function topPlayerRows(values = {}, { names = {}, limit = LAUNCH_TOP_COUNT } = {}) {
  return Object.entries(values || {})
    .filter(([id, value]) => /^player:\d+$/.test(id) && Number(value) > 0 && String(names?.[id] || "").trim())
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([id, value]) => {
      const playerId = id.slice("player:".length);
      const name = String(names[id]).trim();
      return { assetId: id, playerId, name, value: Math.round(Number(value)), href: launchPlayerHref(playerId, name) };
    });
}

export function launchTopMarkup(rows = []) {
  return rows.map((row) => `
    <a class="launch-face" href="${escapeHtml(row.href)}">
      ${renderPlayerFace(row.playerId, row.name, { size: "md" })}
      <span class="launch-face-name">${escapeHtml(row.name)}</span>
      <strong>${escapeHtml(formatNumber(row.value))}</strong>
    </a>
  `).join("");
}

export function launchSkeletonRows(count) {
  return Array.from({ length: count }, () => `<div class="launch-row launch-row-skel" aria-hidden="true"><span class="sk"></span></div>`).join("");
}
