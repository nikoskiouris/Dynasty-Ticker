import { draftMarketPrice, draftVerdictModel } from "./trade-draft.js";
import { FEWER_BETTER_LABEL, verdictCopy } from "./verdict-copy.js";
import { formatGenericPickAssetLabel, getGlobalMaxPlayerValue, pickValueBundle } from "./values.js";

// A shared trade is its own state, so no server storage: /t/<code>.
// Code v2: "2", format "s" (Superflex) or "q" (1QB), the 12-digit UTC price
// stamp (YYYYMMDDHHmm of player_values.json asOf), give ids, "~", get ids.
// v1 has no stamp and prices at today's board. The stamp is only a lookup key
// into docs/data/price-history/, so a link carries no verdict to forge.
// A player is its Sleeper id. A pick is p<yy>r<round><a|e|m|l>.
// No usernames, league ids, or roster ids ever go in a code.
export const SHARE_VERSION = "2";
export const PRICE_HISTORY_DIR = "data/price-history";
const STAMP = /^20\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])[0-5]\d$/;
export const SHARE_MAX_SIDE = 8;
export const SHARE_MAX_LENGTH = 220; // 8 twelve-digit ids a side fit
const FORMAT_CODE = Object.freeze({ sf: "s", oneQb: "q" });
const CODE_FORMAT = Object.freeze({ s: "sf", q: "oneQb" });
const BUCKET_CODE = Object.freeze({ any: "a", early: "e", mid: "m", late: "l" });
const CODE_BUCKET = Object.freeze({ a: "any", e: "early", m: "mid", l: "late" });
const PLAYER_ITEM = /^(?!0$)\d{1,12}$/;
const PICK_ITEM = /^p(\d{2})r([1-7])([aeml])$/;
const SHARE_CODE = /^[0-9a-z.~]+$/;

export function encodeShareAsset(assetId) {
  const id = String(assetId || "").trim();
  const player = /^player:((?!0$)\d{1,12})$/.exec(id);
  if (player) return player[1];
  // A league pick (pick:2027:r1:<rosterId>) is shared as the generic pick of that
  // round, so no roster id leaves the league.
  const pick = /^pick:20(\d{2}):r([1-7]):(any|early|mid|late|\d+)$/.exec(id);
  if (pick) return `p${pick[1]}r${pick[2]}${BUCKET_CODE[pick[3]] || "a"}`;
  return "";
}

export function decodeShareAsset(item) {
  const text = String(item || "");
  if (PLAYER_ITEM.test(text)) return `player:${text}`;
  const pick = PICK_ITEM.exec(text);
  if (pick) return `pick:20${pick[1]}:r${pick[2]}:${CODE_BUCKET[pick[3]]}`;
  return "";
}

// asOf like "2026-10-14T19:17:17+00:00" becomes "202610141917" (UTC).
export function priceStamp(asOf) {
  const time = Date.parse(String(asOf || ""));
  if (!Number.isFinite(time)) return "";
  const stamp = new Date(time).toISOString().replace(/[^0-9]/g, "").slice(0, 12);
  return STAMP.test(stamp) ? stamp : "";
}

export function isPriceStamp(stamp) {
  return STAMP.test(String(stamp || ""));
}

export function snapshotPath(stamp) {
  return isPriceStamp(stamp) ? `/${PRICE_HISTORY_DIR}/${stamp}.json` : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function stampLabel(stamp, { year = false } = {}) {
  if (!isPriceStamp(stamp)) return "";
  const text = `${MONTHS[Number(stamp.slice(4, 6)) - 1]} ${Number(stamp.slice(6, 8))}`;
  return year ? `${text}, ${stamp.slice(0, 4)}` : text;
}

export const MISSING_BOARD_NOTE = "That day's prices are no longer saved. Showing today's.";

// A shared link whose snapshot was pruned still opens today's board.
export function missingBoardNote(dateLabel) {
  const date = String(dateLabel || "").trim();
  if (!date) return "";
  return MISSING_BOARD_NOTE;
}

// Index first. A listed stamp is fetched. A stamp the index does not list
// returns "" so the page does not request a missing file.
export function snapshotRequestForStamp(index, stamp) {
  if (!isPriceStamp(stamp)) return "";
  if (index && typeof index === "object") {
    if (index.schemaVersion != null && Number(index.schemaVersion) !== 1) return "";
    const listed = Array.isArray(index.snapshots) ? index.snapshots : [];
    if (!listed.some((row) => String(row?.stamp || "") === stamp)) return "";
  }
  return snapshotPath(stamp);
}

export function encodeTradeShare({ give = [], get = [], format = "sf", asOf = "" } = {}) {
  const side = (list) => (Array.isArray(list) ? list : []).map(encodeShareAsset);
  const left = side(give);
  const right = side(get);
  if (!left.length || !right.length) return "";
  if (left.length > SHARE_MAX_SIDE || right.length > SHARE_MAX_SIDE) return "";
  if ([...left, ...right].some((item) => !item)) return "";
  const stamp = priceStamp(asOf);
  const head = stamp ? `${SHARE_VERSION}${FORMAT_CODE[format] || "s"}${stamp}` : `1${FORMAT_CODE[format] || "s"}`;
  const code = `${head}${left.join(".")}~${right.join(".")}`;
  return code.length <= SHARE_MAX_LENGTH ? code : "";
}

export function decodeTradeShare(code) {
  const text = String(code ?? "");
  if (!text || text.length > SHARE_MAX_LENGTH || !SHARE_CODE.test(text)) return null;
  const version = text[0];
  if (version !== "1" && version !== "2") return null;
  const format = CODE_FORMAT[text[1]];
  if (!format) return null;
  let stamp = "";
  let body = text.slice(2);
  if (version === "2") {
    stamp = body.slice(0, 12);
    if (!isPriceStamp(stamp)) return null;
    body = body.slice(12);
  }
  const halves = body.split("~");
  if (halves.length !== 2) return null;
  const sides = halves.map((half) => half.split("."));
  if (sides.some((list) => !list.length || list.length > SHARE_MAX_SIDE)) return null;
  const [give, get] = sides.map((list) => list.map(decodeShareAsset));
  if ([...give, ...get].some((id) => !id)) return null;
  return { format, give, get, stamp };
}

export function sharePath(code) {
  return code ? `/t/${code}` : "";
}

export function shareImagePath(code, version = "") {
  if (!code) return "";
  const stamp = String(version || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
  return `/og/t/${code}.png${stamp ? `?v=${stamp}` : ""}`;
}

// Same prices and the same verdict math as the calculator, from the public board.
// Same verdict if the label and the gap match. Otherwise the page shows both.
export function sameVerdict(left, right) {
  return Boolean(left && right) && left.label === right.label && left.pct === right.pct;
}

// directory: a payload with players (positions) and names, for archived boards
// that carry prices only. Defaults to the board itself.
export function shareSummary(decoded, payload, playerNames = {}, directory = payload) {
  if (!decoded) return null;
  const bundle = pickValueBundle(payload, decoded.format);
  const values = bundle.values || {};
  const row = (assetId) => {
    const isPick = assetId.startsWith("pick:");
    const id = assetId.slice("player:".length);
    const name = isPick
      ? (bundle.nameMap?.[assetId] || formatGenericPickAssetLabel(assetId))
      : (String(playerNames?.[id] || payload?.names?.[assetId] || directory?.names?.[assetId] || "").trim() || `Player ${id}`);
    // Picks price through the app's own lookup (every round; r2:early falls back to
    // r2:any, then the pick catalog), so a shared link never reads a 2nd as 0.
    const raw = isPick
      ? draftMarketPrice({ assetType: "pick", assetId }, { values, nameMap: bundle.nameMap || {} }).value
      : values[assetId];
    const value = Math.max(0, Math.round(Number(raw) || 0));
    const position = isPick ? "PICK" : String((payload?.players || directory?.players)?.[assetId]?.position || "").toUpperCase().slice(0, 4);
    return { assetId, name: name.slice(0, 40), value, position };
  };
  const give = decoded.give.map(row);
  const get = decoded.get.map(row);
  const model = draftVerdictModel(give.map((r) => r.value), get.map((r) => r.value), {
    globalMaxValue: getGlobalMaxPlayerValue(values),
  });
  const credit = model.adjustment
    ? { amount: Math.round(model.adjustment.amount), side: model.adjustment.side === "left" ? "give" : "get" }
    : null;
  const summary = {
    format: decoded.format,
    formatLabel: decoded.format === "oneQb" ? "1QB" : "Superflex",
    give,
    get,
    giveTotal: model.give,
    getTotal: model.get,
    // Credited totals: the listed prices plus the extra for fewer, better players.
    // The gap, % and verdict all come from these, so the card's math adds up.
    giveCredited: model.compareGive,
    getCredited: model.compareGet,
    credit,
    gap: model.compareGet - model.compareGive,
    pct: model.verdict.pct,
    tone: model.verdict.tone,
    verdict: model.verdict,
    stamp: priceStamp(payload?.asOf),
  };
  summary.label = neutralVerdict(summary);
  return summary;
}

const formatCount = (value) => Math.round(Math.abs(Number(value) || 0)).toLocaleString("en-US");

// All wording comes from verdictCopy (verdict-copy.js), same as the app.
export function neutralVerdict(summary) {
  return summary ? verdictCopy(summary.verdict).line : "";
}

// text: the 48px tier; pctText: "Give side worth 15% more" / "within 5%";
// tone: fair | strong (public surfaces colour only the tier); side: Give | Get | "".
export function cardVerdict(summary) {
  const copy = verdictCopy(summary?.verdict);
  return { text: copy.label, pctText: copy.pctText, tone: copy.publicTone || "fair", side: copy.side, line: copy.line };
}

// The share sheet text (sentence case, no exclamation marks).
export function shareMessage(summary) {
  return `${verdictCopy(summary?.verdict).line}. Check it on Dynasty Ticker.`;
}

// "Fewer, better players +7,413" on the side that gets the extra.
export function creditLine(summary) {
  if (!summary?.credit?.amount) return "";
  return `${FEWER_BETTER_LABEL} +${formatCount(summary.credit.amount)}`;
}
