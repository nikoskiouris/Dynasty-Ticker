import { escapeHtml, formatNumber } from "./html.js";

// Cuts from the 2026-10-14 Superflex board (docs/data/player_values.json).
// Priced players (value > 0): n=421. p25=278, p50=1,025, p75=3,018, p95=8,470.
// All listed players: p99≈10,102, max=14,620. Players at or above 3,000: 106,
// about 9 starters × 12 teams. Players at or above 8,000: 27. At or above 10,000: 13.
// The ruler is displayScale 20 in player-values/config.json. It is not a 0–10,000 index.
export const DISPLAY_SCALE = 20;
export const VALUE_TIERS = Object.freeze([
  { id: "elite", label: "Elite", min: 8000, blurb: "Top ~25 players" },
  { id: "starter", label: "Starter", min: 3000, blurb: "Weekly starter" },
  { id: "solid", label: "Solid", min: 1000, blurb: "Flex play" },
  { id: "depth", label: "Depth", min: 250, blurb: "Depth" },
  { id: "deep", label: "Deep stash", min: 1, blurb: "Roster filler" },
]);

export const TEN_THOUSAND_NOTE = "Values aren't capped at 10,000. Elite players start around 8,000; the very best are higher. Superflex QBs are worth less in 1QB.";

export const TREND_WINDOW_DAYS = 30;
export const STALE_AFTER_DAYS = 7;
// docs/data/price-history schema, shared with trade links.
// <YYYYMMDDHHmm>.json = { asOf, sf, oneQb }. sf and oneQb are full price maps.
// index.json schemaVersion 1 lists { stamp, asOf }. Snapshots older than 90
// days before the newest are dropped. The newest file is always kept.
export const PRICE_HISTORY_SCHEMA_VERSION = 1;
export const PRICE_HISTORY_RETENTION_DAYS = 90;
export const PRICE_HISTORY_SCHEMA = Object.freeze({
  schemaVersion: PRICE_HISTORY_SCHEMA_VERSION,
  directory: "docs/data/price-history",
  snapshot: "<YYYYMMDDHHmm>.json = { asOf, sf, oneQb }",
  index: "index.json = { schemaVersion, retentionDays, snapshots: [{ stamp, asOf }] }",
  oneQb: "full 1QB map; a missing player falls back to sf",
  dates: "asOf is UTC; the calendar day is YYYY-MM-DD",
  retentionDays: PRICE_HISTORY_RETENTION_DAYS,
});
const MONTHS = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function tierForValue(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  for (const tier of VALUE_TIERS) {
    if (price >= tier.min) return tier;
  }
  return null;
}

export function renderValueTierBadge(value) {
  const tier = tierForValue(value);
  if (!tier) return "";
  return `<span class="value-tier"><span aria-hidden="true">${escapeHtml(tier.label)}</span><span class="sr-only">Value tier: ${escapeHtml(tier.label)}</span></span>`;
}

function utcDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function playerKey(playerId) {
  return String(playerId || "").replace(/^player:/, "");
}

function formatKey(format) {
  return format === "oneQb" ? "oneQb" : "sf";
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value || "").trim();
  const match = text.match(ISO_DATE);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const day = utcDay(text);
  if (day == null) return "";
  return new Date(day).toISOString().slice(0, 10);
}

function shiftIsoDate(iso, days) {
  const start = utcDay(iso);
  if (start == null) return "";
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10);
}

const PRICE_STAMP = /^20\d{10}$/;

// Stamps inside the window, plus the one closest snapshot before it.
// Callers fetch this list. They do not fetch the rest of the archive.
export function stampsForWindow(rows, { now = new Date(), days = TREND_WINDOW_DAYS } = {}) {
  const today = isoDate(now);
  const span = Number(days);
  if (!today || !Number.isFinite(span) || span < 0) return [];
  const start = shiftIsoDate(today, -span);
  const parsed = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const stamp = String(row?.stamp || "").trim();
    const asOf = String(row?.asOf || "").trim();
    const date = isoDate(asOf);
    if (!PRICE_STAMP.test(stamp) || !date || date > today) continue;
    parsed.push({ stamp, asOf, date });
  }
  parsed.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : 0));
  const inWindow = parsed.filter((row) => row.date >= start);
  const earlier = parsed.filter((row) => row.date < start);
  const anchor = earlier.length ? earlier[earlier.length - 1] : null;
  const chosen = anchor ? [anchor, ...inWindow] : inWindow;
  return chosen.map(({ stamp, asOf }) => ({ stamp, asOf }));
}

function finitePrice(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function snapshotList(history) {
  if (Array.isArray(history)) return history;
  return Array.isArray(history?.snapshots) ? history.snapshots : [];
}

function snapshotPrice(snap, assetId, format) {
  const key = formatKey(format);
  const map = snap?.[key];
  const own = map && typeof map === "object" ? finitePrice(map[assetId]) : null;
  if (own != null) return own;
  if (key !== "oneQb") return null;
  const sf = snap?.sf;
  return sf && typeof sf === "object" ? finitePrice(sf[assetId]) : null;
}

export function normalizePriceHistory(history) {
  const rows = [];
  for (const snap of snapshotList(history)) {
    if (!snap || typeof snap !== "object") continue;
    const asOf = String(snap.asOf || "").trim();
    const date = isoDate(asOf);
    if (!date) continue;
    if (!snap.sf || typeof snap.sf !== "object") continue;
    const oneQb = snap.oneQb && typeof snap.oneQb === "object" ? snap.oneQb : null;
    rows.push({
      asOf,
      stamp: String(snap.stamp || "").trim(),
      sf: snap.sf,
      oneQb,
    });
  }
  rows.sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : 0));
  return { schemaVersion: PRICE_HISTORY_SCHEMA_VERSION, snapshots: rows };
}

export function playerSeries(history, assetId, format = "sf") {
  const id = playerKey(assetId);
  if (!id) return [];
  const asset = `player:${id}`;
  const byDate = new Map();
  for (const snap of normalizePriceHistory(history).snapshots) {
    const price = snapshotPrice(snap, asset, format);
    if (price == null) continue;
    const date = isoDate(snap.asOf);
    const prev = byDate.get(date);
    if (!prev || snap.asOf > prev.asOf || (snap.asOf === prev.asOf && snap.stamp >= prev.stamp)) {
      byDate.set(date, { date, value: price, asOf: snap.asOf, stamp: snap.stamp });
    }
  }
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((point) => ({ date: point.date, value: point.value }));
}

function closestOnOrBefore(points, target) {
  let found = null;
  for (const point of points) {
    if (point.date <= target) found = point;
    else break;
  }
  return found;
}

// Closest saved price on or before each end of the window.
// Null when either end has no snapshot, or both ends are the same day.
export function valueChange(playerId, { days = 30, format = "sf", history = null, now = new Date() } = {}) {
  const span = Number(days);
  const today = isoDate(now);
  if (!today || !Number.isFinite(span) || span < 0) return null;
  const points = playerSeries(history, playerId, format);
  if (!points.length) return null;
  const to = closestOnOrBefore(points, today);
  const from = closestOnOrBefore(points, shiftIsoDate(today, -span));
  if (!from || !to || from.date === to.date) return null;
  const delta = to.value - from.value;
  return {
    from: from.value,
    to: to.value,
    delta,
    pct: from.value === 0 ? null : (delta / from.value) * 100,
    fromDate: from.date,
    toDate: to.date,
  };
}

// Biggest percent moves. minValue is the latest price a player must still have.
export function topMovers(count, { days = 30, format = "sf", minValue = 0, history = null, now = new Date() } = {}) {
  const limit = Math.max(0, Math.floor(Number(count) || 0));
  const floor = Number(minValue);
  const minimum = Number.isFinite(floor) ? floor : 0;
  const ids = new Set();
  for (const snap of normalizePriceHistory(history).snapshots) {
    for (const map of [snap.sf, snap.oneQb]) {
      if (!map) continue;
      for (const assetId of Object.keys(map)) {
        if (assetId.startsWith("player:")) ids.add(assetId.slice("player:".length));
      }
    }
  }
  const rows = [];
  for (const playerId of ids) {
    const change = valueChange(playerId, { days, format, history, now });
    if (!change || change.pct == null || change.pct === 0 || change.to < minimum) continue;
    rows.push({ playerId, ...change });
  }
  rows.sort((a, b) => (
    Math.abs(b.pct) - Math.abs(a.pct)
    || Math.abs(b.delta) - Math.abs(a.delta)
    || a.playerId.localeCompare(b.playerId)
  ));
  return rows.slice(0, limit);
}

export function valueTrend(points, { now = new Date(), windowDays = TREND_WINDOW_DAYS } = {}) {
  const today = utcDay(now);
  if (today == null) return null;
  const window = Math.max(0, Number(windowDays) || 0);
  const earliest = today - window * DAY_MS;
  const series = (Array.isArray(points) ? points : [])
    .map((point) => {
      const day = utcDay(point?.date);
      const value = Number(point?.value);
      if (day == null || !Number.isFinite(value)) return null;
      if (day < earliest || day > today) return null;
      return { date: String(point.date).slice(0, 10), day, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || a.value - b.value);
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  return {
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    first: first.value,
    last: last.value,
    fromDate: first.date,
    toDate: last.date,
    series: series.map((point) => ({ date: point.date, value: point.value })),
  };
}

export function formatSince(fromDate, now = new Date()) {
  const iso = isoDate(fromDate);
  if (!iso) return "";
  const match = iso.match(ISO_DATE);
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  const day = Number(match[3]);
  const year = Number(match[1]);
  const currentYear = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getUTCFullYear() : null;
  const when = currentYear && year !== currentYear ? `${month} ${day}, ${year}` : `${month} ${day}`;
  return `since ${when}`;
}

function daysBetween(fromIso, toIso) {
  const start = utcDay(fromIso);
  const end = utcDay(toIso);
  if (start == null || end == null) return null;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function playerValueTrend(history, assetId, format = "sf", now = new Date()) {
  const trend = valueTrend(playerSeries(history, assetId, format), { now });
  if (!trend) return null;
  const span = daysBetween(trend.fromDate, isoDate(now));
  if (span == null) return trend;
  const change = valueChange(assetId, { days: span, format, history, now });
  if (change?.fromDate) {
    trend.fromDate = change.fromDate;
    trend.toDate = change.toDate;
  }
  return trend;
}

export function renderValueSparkline(series) {
  const nums = (Array.isArray(series) ? series : []).map((point) => Number(point?.value)).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const width = 48;
  const height = 16;
  const points = nums.map((value, index) => {
    const x = nums.length === 1 ? 1 : (index / (nums.length - 1)) * (width - 2) + 1;
    const y = (height - 2) - ((value - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="value-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline points="${points}" /></svg>`;
}

export function renderValueTrend(trend, { spark = false, now = new Date() } = {}) {
  if (!trend) return "";
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  const word = trend.direction === "up" ? "up" : trend.direction === "down" ? "down" : "flat";
  const amount = formatNumber(Math.abs(trend.delta));
  const since = formatSince(trend.fromDate || trend.series?.[0]?.date, now);
  const windowText = since || "across saved snapshots";
  const visual = `${arrow}${amount}`;
  return `<span class="value-trend ${trend.direction}" title="Change ${escapeHtml(windowText)}">${spark ? renderValueSparkline(trend.series) : ""}<span aria-hidden="true">${escapeHtml(visual)}</span><span class="sr-only">${escapeHtml(`${word} ${amount} ${windowText}`)}</span></span>`;
}

export function renderTrendSoon() {
  return `<span class="value-trend soon">No trend yet</span>`;
}

function parseStamp(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function valuationStamp(bundle) {
  const generated = String(bundle?.generatedAt || bundle?.meta?.generatedAt || "").trim();
  if (generated) return generated;
  const asOf = String(bundle?.asOf || "").trim();
  if (asOf) return asOf;
  return String(bundle?.lastModified || "").trim();
}

function utcAbsolute(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm} UTC`;
}

export function valuesUpdatedStatus(stamp, now = new Date()) {
  const date = parseStamp(stamp);
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : null;
  if (!date || !current) return null;
  const age = Math.max(0, current.getTime() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  let label;
  if (age < 45 * 1000) label = "Values updated just now";
  else if (age < hour) {
    const minutes = Math.max(1, Math.floor(age / minute));
    label = `Values updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  } else if (age < DAY_MS) {
    const hours = Math.max(1, Math.floor(age / hour));
    label = `Values updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  } else {
    const days = Math.max(1, Math.floor(age / DAY_MS));
    label = `Values updated ${days} day${days === 1 ? "" : "s"} ago`;
  }
  const stale = age > STALE_AFTER_DAYS * DAY_MS;
  if (stale) {
    const days = Math.max(1, Math.floor(age / DAY_MS));
    label = `Values from ${days} day${days === 1 ? "" : "s"} ago`;
  }
  return {
    label,
    absolute: utcAbsolute(date),
    stale,
    iso: date.toISOString(),
  };
}

export function renderValuesFreshness(status, { align = "" } = {}) {
  if (!status?.label) return "";
  const title = status.absolute ? ` title="${escapeHtml(status.absolute)}"` : "";
  const end = align === "end" ? " is-end" : "";
  return `<p class="values-updated${end}" data-values-updated${title}>${escapeHtml(status.label)}</p>`;
}

export function renderValueScaleExplainer() {
  const bands = VALUE_TIERS.map((tier, index) => {
    const next = VALUE_TIERS[index - 1];
    const range = next ? `${formatNumber(tier.min)}–${formatNumber(next.min - 1)}` : `${formatNumber(tier.min)}+`;
    return `<li>${renderValueTierBadge(tier.min)} <span>${escapeHtml(range)}. ${escapeHtml(tier.blurb)}</span></li>`;
  }).join("");
  return `<details class="calc-method value-scale-help">
    <summary>How values work</summary>
    <p>${escapeHtml(TEN_THOUSAND_NOTE)}</p>
    <ul>${bands}</ul>
  </details>`;
}
