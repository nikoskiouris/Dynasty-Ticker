import { draftVerdictModel } from "./trade-draft.js";
import { formatGenericPickAssetLabel, getGlobalMaxPlayerValue, pickValueBundle } from "./values.js";

// A shared trade is its own state, so no server storage: /t/<code>.
// Code: version "1", format "s" (Superflex) or "q" (1QB), give ids, "~", get ids.
// A player is its Sleeper id. A pick is p<yy>r<round><a|e|m|l>.
// No usernames, league ids, or roster ids ever go in a code.
export const SHARE_VERSION = "1";
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

export function encodeTradeShare({ give = [], get = [], format = "sf" } = {}) {
  const side = (list) => (Array.isArray(list) ? list : []).map(encodeShareAsset);
  const left = side(give);
  const right = side(get);
  if (!left.length || !right.length) return "";
  if (left.length > SHARE_MAX_SIDE || right.length > SHARE_MAX_SIDE) return "";
  if ([...left, ...right].some((item) => !item)) return "";
  const code = `${SHARE_VERSION}${FORMAT_CODE[format] || "s"}${left.join(".")}~${right.join(".")}`;
  return code.length <= SHARE_MAX_LENGTH ? code : "";
}

export function decodeTradeShare(code) {
  const text = String(code ?? "");
  if (!text || text.length > SHARE_MAX_LENGTH || !SHARE_CODE.test(text)) return null;
  if (text[0] !== SHARE_VERSION) return null;
  const format = CODE_FORMAT[text[1]];
  if (!format) return null;
  const halves = text.slice(2).split("~");
  if (halves.length !== 2) return null;
  const sides = halves.map((half) => half.split("."));
  if (sides.some((list) => !list.length || list.length > SHARE_MAX_SIDE)) return null;
  const [give, get] = sides.map((list) => list.map(decodeShareAsset));
  if ([...give, ...get].some((id) => !id)) return null;
  return { format, give, get };
}

export function sharePath(code) {
  return code ? `/t/${code}` : "";
}

export function shareImagePath(code, version = "") {
  if (!code) return "";
  const stamp = String(version || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
  return `/og/t/${code}.png${stamp ? `?v=${stamp}` : ""}`;
}

// Neutral wording for a stranger reading the card: Give and Get are the sharer's sides.
const SHARE_LABEL = Object.freeze({
  "Dead even": "Dead even",
  "Fair, leans Get": "Fair, leans Get",
  "Fair, leans Give": "Fair, leans Give",
  "Favors Get": "Favors the Get side",
  "Favors Give": "Favors the Give side",
  "Lopsided for Get": "Lopsided for Get",
  "Lopsided for Give": "Lopsided for Give",
});

// Same prices and the same verdict math as the calculator, from the public board.
export function shareSummary(decoded, payload, playerNames = {}) {
  if (!decoded) return null;
  const bundle = pickValueBundle(payload, decoded.format);
  const values = bundle.values || {};
  const row = (assetId) => {
    const isPick = assetId.startsWith("pick:");
    const id = assetId.slice("player:".length);
    const name = isPick
      ? (bundle.nameMap?.[assetId] || formatGenericPickAssetLabel(assetId))
      : (String(playerNames?.[id] || "").trim() || `Player ${id}`);
    const value = Math.max(0, Math.round(Number(values[assetId]) || 0));
    return { assetId, name: name.slice(0, 40), value };
  };
  const give = decoded.give.map(row);
  const get = decoded.get.map(row);
  const model = draftVerdictModel(give.map((r) => r.value), get.map((r) => r.value), {
    globalMaxValue: getGlobalMaxPlayerValue(values),
  });
  return {
    format: decoded.format,
    formatLabel: decoded.format === "oneQb" ? "1QB" : "Superflex",
    give,
    get,
    giveTotal: model.give,
    getTotal: model.get,
    pct: model.verdict.pct,
    tone: model.verdict.tone,
    label: SHARE_LABEL[model.verdict.label] || model.verdict.label,
  };
}
