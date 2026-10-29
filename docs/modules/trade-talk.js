import { formatGenericPickAssetLabel, parsePickAssetId } from "./values.js";
import {
  addValueCalcItem,
  clearValueCalcSides,
  emptyValueCalcState,
  removeValueCalcItem,
  swapValueCalcSides,
  valueCalcHasAsset,
} from "./value-calc.js";

// Describe-a-trade box. Plain rules, no model: the sentence only names pieces and
// sides. Every price and verdict still comes from the calculator's own snapshot.

export const TRADE_TALK_MAX = 300;

export const TRADE_TALK_EXAMPLES = Object.freeze([
  "Gibbs and a 2027 1st for Nabers",
  "add my 2028 2nd",
  "swap Nabers for Puka",
  "what could I get for Bijan",
]);

// Normalized nickname -> normalized full name.
export const PLAYER_ALIASES = Object.freeze({
  cmc: "christian mccaffrey",
  arsb: "amon ra st brown",
  "sun god": "amon ra st brown",
  jsn: "jaxon smith njigba",
  btj: "brian thomas",
  mhj: "marvin harrison",
  ajb: "aj brown",
  jj: "justin jefferson",
  jjeff: "justin jefferson",
  jt: "jonathan taylor",
  kw3: "kenneth walker",
  dk: "dk metcalf",
  tmac: "terry mclaurin",
  tmcl: "terry mclaurin",
  tet: "tetairoa mcmillan",
  hollywood: "marquise brown",
  "a j brown": "aj brown",
  "d k metcalf": "dk metcalf",
  "c j stroud": "cj stroud",
  "t j hockenson": "tj hockenson",
  "j k dobbins": "jk dobbins",
});

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const ROUND_WORDS = {
  "1st": 1, first: 1, "2nd": 2, second: 2, "3rd": 3, third: 3, "4th": 4, fourth: 4, "5th": 5, fifth: 5,
};
const BUCKET_WORDS = { early: "early", mid: "mid", middle: "mid", late: "late" };
const COUNT_WORDS = { a: 1, an: 1, one: 1, two: 2, both: 2, couple: 2, pair: 2, three: 3 };
const PICK_FILLER = new Set(["round", "rounder", "rounders", "pick", "picks", "rookie", "draft", "in", "the", "of", "own", "s"]);
const PIECE_FILLER = /^(?:a|an|the|some|also|like|maybe|just|plus|and)\s+/;

export function normalizePlayerName(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !NAME_SUFFIXES.has(word))
    .join(" ");
}

function editDistance(a, b, cap = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = row[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

function indexPlayers(rows) {
  return rows
    .filter((row) => row?.assetType !== "pick" && row?.name)
    .map((row) => {
      const norm = normalizePlayerName(row.name);
      const toks = norm.split(" ").filter(Boolean);
      return { row, norm, toks, first: toks[0] || "", last: toks.slice(1).join(" "), lastTok: toks[toks.length - 1] || "" };
    })
    .filter((entry) => entry.norm);
}

function scorePlayer(query, qToks, entry) {
  if (query === entry.norm) return 100;
  if (entry.toks.length > 1 && (query === entry.last || query === entry.lastTok)) return 80;
  if (entry.toks.length > 1 && query === entry.first) return 60;
  const prefixAll = qToks.length > 0 && qToks.every((tok) => tok.length >= 2 && entry.toks.some((word) => word.startsWith(tok)));
  if (prefixAll && qToks.length >= 2) return 55;
  const longTypo = query.length >= 8 && editDistance(query, entry.norm, 2) <= 2;
  if (longTypo) return 50;
  if (prefixAll && query.length >= 4) return 45;
  if (qToks.length === 1 && query.length >= 5) {
    if (editDistance(query, entry.lastTok, 1) <= 1 || (entry.last && editDistance(query, entry.last, 1) <= 1)) return 40;
    if (editDistance(query, entry.first, 1) <= 1) return 30;
  }
  return 0;
}

// { match } when one player is clearly meant, { options } when the user must choose.
export function resolvePlayer(text, index, { ownerRosterId = null, preferRostered = false } = {}) {
  let query = normalizePlayerName(text);
  if (!query) return {};
  if (PLAYER_ALIASES[query]) query = PLAYER_ALIASES[query];
  const qToks = query.split(" ");
  let best = 0;
  let hits = [];
  for (const entry of index) {
    const score = scorePlayer(query, qToks, entry);
    if (score > best) {
      best = score;
      hits = [entry];
    } else if (score && score === best) {
      hits.push(entry);
    }
  }
  if (!hits.length) return {};
  // One bare word ("Jefferson", "Chase") names a person, not a price. Every
  // player with that first or last name is a candidate, and two or more ask.
  const bareName = qToks.length === 1 && (best === 80 || best === 60);
  if (bareName) hits = index.filter((entry) => [80, 60].includes(scorePlayer(query, qToks, entry)));
  let rows = hits.map((entry) => entry.row);
  const narrow = (keep) => {
    const kept = rows.filter(keep);
    if (kept.length) rows = kept;
  };
  if (ownerRosterId != null) narrow((row) => String(row.ownerRosterId ?? "") === String(ownerRosterId));
  if (preferRostered) narrow((row) => row.ownerRosterId != null);
  rows = [...rows].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  if (rows.length === 1) return { match: rows[0] };
  const top = Number(rows[0].value) || 0;
  const next = Number(rows[1].value) || 0;
  if (!bareName && top > 0 && top >= next * 2) return { match: rows[0] };
  return { options: rows.slice(0, 4) };
}

function managerAliases(manager) {
  const out = new Set();
  [manager?.displayName, manager?.teamName].forEach((name) => {
    const flat = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (flat.length >= 3) out.add(flat);
    const first = String(name || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] || "";
    if (first.length >= 3) out.add(first);
  });
  return [...out];
}

export function findManager(word, managers = []) {
  const token = String(word || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, "");
  if (token.length < 3) return null;
  const hits = managers.filter((manager) => managerAliases(manager).some((alias) => (
    alias === token || (alias.startsWith(token) && token.length >= 4) || (token.startsWith(alias) && alias.length >= 4)
  )));
  return hits.length === 1 ? hits[0] : null;
}

function cleanText(text) {
  return String(text || "")
    .slice(0, TRADE_TALK_MAX)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/\s*(?:\+|&)\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

const ASK_TAIL = /(?:^|[\s,.;:!?-]+)(?:what do you think|what do u think|wdyt|thoughts|is (?:this|that|it) (?:fair|good|even|bad|a win|a fleece|a rip ?off|worth it)|should i (?:do|take|accept|make) (?:it|this|that)|would you (?:do|take|accept) (?:it|this|that)|good deal|fair|win or loss|who wins)\s*\??$/;
const LEAD_FILLER = /^(?:hey|so|ok|okay|yo|hmm|um|lol)[,!.\s]+|^(?:would you do|would you take|should i do|should i take|should i accept|should i|would you|is|how about|what about|what if|lets do|let's do|try|check|rate)\s+/;

function stripChatter(text) {
  let body = text;
  let asked = false;
  for (let i = 0; i < 3; i += 1) {
    const next = body.replace(ASK_TAIL, "").trim();
    if (next === body) break;
    asked = true;
    body = next;
  }
  if (/\?\s*$/.test(body)) asked = true;
  body = body.replace(/[?!.]+$/g, "").trim();
  for (let i = 0; i < 3; i += 1) {
    const next = body.replace(LEAD_FILLER, "").trim();
    if (next === body) break;
    body = next;
  }
  return { body, asked };
}

// "from chris", "to chris", "with chris" name the other manager. Possessives are
// read per piece.
function pullPartner(text, managers, meRosterId) {
  let partner = null;
  let body = text.replace(/\b(?:from|to|with)\s+(@?[a-z0-9_.]+)(?:'s)?/g, (whole, word) => {
    const hit = findManager(word, managers);
    if (!hit || String(hit.rosterId) === String(meRosterId ?? "")) return whole;
    partner = hit;
    return " ";
  });
  // No league loaded: "from Chris" at the end still names a person, not a player.
  let unknown = "";
  if (!partner && !managers.length) {
    body = body.replace(/\s+(?:from|with)\s+(@?[a-z][a-z0-9_.]*)$/, (whole, word) => {
      if (PRONOUNS.has(word)) return whole;
      unknown = word.replace(/^@/, "");
      return "";
    });
  }
  return { body: body.replace(/\s+/g, " ").trim(), partner, unknown };
}

function splitPieces(text) {
  return String(text || "")
    .split(/\s*(?:,|;|\band\b|\bplus\b|\balong with\b|\bwith\b)\s*/)
    .map((piece) => piece.trim())
    .filter(Boolean);
}

// Owner words in front of a piece: "my", "his", "their", "chris's".
function pullOwner(piece, managers, meRosterId) {
  let text = piece.replace(PIECE_FILLER, "").trim();
  const mine = text.match(/^(?:my|mine|our)\s+(.*)$/);
  if (mine) return { text: mine[1], owner: "me" };
  const theirs = text.match(/^(?:his|her|their|them|theirs)\s+(.*)$/);
  if (theirs) return { text: theirs[1], owner: "partner" };
  const named = text.match(/^(@?[a-z0-9_.]+)(?:'s|s'|')\s+(.*)$/);
  if (named) {
    const hit = findManager(named[1], managers);
    if (hit) {
      return String(hit.rosterId) === String(meRosterId ?? "")
        ? { text: named[2], owner: "me" }
        : { text: named[2], owner: "manager", manager: hit };
    }
  }
  return { text, owner: "" };
}

export function parsePickPhrase(text, { season = new Date().getUTCFullYear() + 1 } = {}) {
  const words = String(text || "").toLowerCase().replace(/'/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return null;
  const pick = { season: null, round: null, bucket: "", count: 1 };
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const plural = word.replace(/s$/, "");
    if (/^20\d{2}$/.test(word)) pick.season = Number(word);
    else if (/^\d{2}$/.test(word) && Number(word) >= 24 && Number(word) <= 40 && pick.round == null) pick.season = 2000 + Number(word);
    else if ((word === "next" || word === "this") && /^(?:year|years|yr|yrs)$/.test(words[i + 1] || "")) {
      pick.season = Number(season);
      i += 1;
    } else if (word === "future") pick.season = pick.season || Number(season) + 1;
    else if (BUCKET_WORDS[word]) pick.bucket = BUCKET_WORDS[word];
    else if (ROUND_WORDS[word] || ROUND_WORDS[plural]) pick.round = ROUND_WORDS[word] || ROUND_WORDS[plural];
    else if (word === "round" && /^\d$/.test(words[i + 1] || "")) {
      pick.round = Number(words[i + 1]);
      i += 1;
    } else if (/^r\d$/.test(word)) pick.round = Number(word.slice(1));
    else if (/^\d$/.test(word) && pick.round == null) pick.count = Number(word);
    else if (COUNT_WORDS[word] != null && pick.round == null) pick.count = COUNT_WORDS[word];
    else if (!PICK_FILLER.has(word)) return null;
  }
  if (!pick.round || pick.round > 7) return null;
  if (!pick.season) pick.season = Number(season);
  pick.count = Math.max(1, Math.min(3, pick.count));
  return pick;
}

function roundLabel(round) {
  return formatGenericPickAssetLabel(`pick:2000:r${round}:any`).replace(/^2000\s*/, "");
}

function pickLabel(pick) {
  return `${pick.season}${pick.bucket ? ` ${pick.bucket === "mid" ? "Middle" : pick.bucket[0].toUpperCase() + pick.bucket.slice(1)}` : ""} ${roundLabel(pick.round)}`;
}

function genericPickAsset(pick, pickIds) {
  const base = `pick:${pick.season}:r${pick.round}`;
  const order = pick.bucket ? [pick.bucket, "any", "mid"] : ["any", "mid"];
  const id = order.map((bucket) => `${base}:${bucket}`).find((candidate) => pickIds.has(candidate));
  if (!id) return null;
  return { assetId: id, name: formatGenericPickAssetLabel(id), assetType: "pick" };
}

function managerName(managers, rosterId) {
  return managers.find((manager) => String(manager.rosterId) === String(rosterId))?.displayName || "";
}

function asDraftAsset(row) {
  const asset = { assetId: row.assetId, name: row.name, assetType: row.assetType === "pick" ? "pick" : "player" };
  if (row.leagueId) asset.leagueId = row.leagueId;
  return asset;
}

function resolvePick(pick, { side, ownerRosterId, ctx }) {
  const leaguePicks = ctx.catalog.filter((row) => row.assetType === "pick" && row.ownerRosterId != null
    && Number(row.season) === pick.season && Number(row.round) === pick.round);
  const seasonKnown = ctx.catalog.some((row) => row.assetType === "pick" && row.ownerRosterId != null && Number(row.season) === pick.season);
  if (ctx.connected && seasonKnown) {
    let rows = leaguePicks;
    const wanted = ownerRosterId ?? (side === "left" ? ctx.meRosterId : ctx.partnerRosterId);
    if (wanted != null) {
      rows = rows.filter((row) => String(row.ownerRosterId) === String(wanted));
      if (!rows.length) {
        const who = String(wanted) === String(ctx.meRosterId) ? "You have" : `${managerName(ctx.managers, wanted) || "That team"} has`;
        return { reason: `${who} no ${pickLabel({ ...pick, bucket: "" })}.` };
      }
      rows = [...rows].sort((a, b) => Number(String(b.originalRosterId) === String(wanted)) - Number(String(a.originalRosterId) === String(wanted)));
      return { picks: rows.slice(0, pick.count) };
    }
    rows = rows.filter((row) => String(row.ownerRosterId) !== String(ctx.meRosterId ?? ""));
    if (rows.length === 1 && pick.count === 1) return { picks: rows };
    if (rows.length > 1) {
      return {
        options: rows.slice(0, 6).map((row) => ({ ...row, name: `${row.name} · ${managerName(ctx.managers, row.ownerRosterId) || "?"}` })),
        question: `Whose ${pickLabel({ ...pick, bucket: "" })}?`,
      };
    }
  }
  const generic = genericPickAsset(pick, ctx.pickIds);
  if (!generic) return { reason: `No price for ${pickLabel(pick)} picks yet.` };
  const note = ctx.connected && !seasonKnown
    ? `No ${pick.season} picks on rosters here, so ${generic.name} is a generic pick at market price.`
    : "";
  return { picks: Array.from({ length: pick.count }, () => generic), note };
}

function ownerFor(owned, ctx, partner) {
  if (owned.owner === "me") return ctx.meRosterId;
  if (owned.owner === "manager") return owned.manager.rosterId;
  if (owned.owner === "partner") return partner?.rosterId ?? ctx.partnerRosterId ?? null;
  return null;
}

function sideForOwner(rosterId, ctx) {
  if (rosterId == null) return "";
  return String(rosterId) === String(ctx.meRosterId ?? "") ? "left" : "right";
}

// One piece of text -> assets to add (or a question / a miss).
function resolvePiece(raw, { side, ctx, partner, index }) {
  const owned = pullOwner(raw, ctx.managers, ctx.meRosterId);
  const ownerRosterId = ownerFor(owned, ctx, partner);
  const pieceSide = side || sideForOwner(ownerRosterId, ctx) || (owned.owner === "partner" ? "right" : "");
  const pick = parsePickPhrase(owned.text, { season: ctx.season });
  if (pick) {
    const hit = resolvePick(pick, { side: pieceSide || "left", ownerRosterId, ctx });
    if (hit.reason) return { miss: { text: raw, reason: hit.reason } };
    if (hit.options) return { ask: { text: raw, side: pieceSide || "right", options: hit.options.map(asDraftAsset), question: hit.question } };
    return { adds: hit.picks.map((row) => ({ side: pieceSide || "left", asset: asDraftAsset(row) })), partner: owned.manager || null, note: hit.note || "" };
  }
  const found = resolvePlayer(owned.text, index, { ownerRosterId, preferRostered: ctx.connected });
  if (found.options) {
    return { ask: { text: raw, side: pieceSide, options: found.options.map(asDraftAsset), question: `Which ${owned.text.replace(/\b\w/g, (c) => c.toUpperCase())}?` } };
  }
  if (!found.match) return { miss: { text: raw, reason: "" } };
  const row = found.match;
  const placed = pieceSide || sideForOwner(row.ownerRosterId, ctx) || "";
  return { adds: [{ side: placed, asset: asDraftAsset(row) }], partner: owned.manager || null };
}

// The one other team that owns everything on the get side.
function inferPartner(plan, ctx) {
  const owner = new Map(ctx.catalog.filter((row) => row.ownerRosterId != null).map((row) => [row.assetId, String(row.ownerRosterId)]));
  const teams = new Set(plan.adds
    .filter((add) => add.side === "right")
    .map((add) => owner.get(add.asset.assetId))
    .filter((who) => who && who !== String(ctx.meRosterId ?? "")));
  if (teams.size !== 1) return null;
  const id = [...teams][0];
  return ctx.managers.find((manager) => String(manager.rosterId) === id)?.rosterId ?? null;
}

const GET_LEAD = /\b(?:got offered|was offered|been offered|offered me|offers me|offering me|offer me|gives me|give me|giving me|i get|i'd get|id get|i receive|i'm getting|im getting|getting|receiving|receive)\b\s*/;
const GIVE_LEAD = /^(?:[a-z0-9@_.,']+\s+){0,3}?(?:i give|i'd give|id give|i trade|i'm trading|im trading|trading|trade|i offer|i offered|offering|offer|sell|selling|send|sending|give|giving|i do|do)\b\s*/;
const RIGHT_VERB = /^(?:add|adds|throw in|throws in|toss in|include|includes|give|gives|kick in|kicks in)\b\s*/;
const RIGHT_ADD = /^(?:(?:they|he|she|them)\s+(?:add|adds|throw in|throws in|toss in|include|includes|give|gives|kick in|kicks in)|ask for|ask them for|have them add|make them add|i want|i get|get|request|and they add)\b\s*/;
const PRONOUNS = new Set(["me", "him", "her", "them", "my", "his", "their", "us", "it"]);

// Players first, so "Pickens and his 2nd" reads "his" as Pickens's team.
function piecesWithSide(text, side, ctx, partner, index) {
  const out = { adds: [], asks: [], misses: [], notes: [], partner: null };
  const pieces = splitPieces(text);
  const isPick = (piece) => Boolean(parsePickPhrase(pullOwner(piece, ctx.managers, ctx.meRosterId).text, { season: ctx.season }));
  const hits = new Map();
  const run = (piece, i) => {
    const hit = resolvePiece(piece, { side, ctx, partner: partner || out.partner, index });
    hits.set(i, hit);
    if (hit.partner && !out.partner && !partner) out.partner = hit.partner;
  };
  pieces.forEach((piece, i) => { if (!isPick(piece)) run(piece, i); });
  if (!partner && !out.partner && ctx.connected && ctx.partnerRosterId == null) {
    const owner = inferPartner({ adds: [...hits.values()].flatMap((hit) => hit.adds || []).map((add) => ({ ...add, side: "right" })) }, ctx);
    if (owner != null) ctx.partnerRosterId = owner;
  }
  pieces.forEach((piece, i) => { if (isPick(piece)) run(piece, i); });
  pieces.forEach((_, i) => {
    const hit = hits.get(i);
    if (hit.miss) out.misses.push(hit.miss);
    if (hit.ask) out.asks.push(hit.ask);
    if (hit.adds) out.adds.push(...hit.adds);
    if (hit.note) out.notes.push(hit.note);
  });
  return out;
}

function findInDraft(text, draft, ctx) {
  const owned = pullOwner(text, ctx.managers, ctx.meRosterId);
  const items = ["left", "right"].flatMap((side) => (draft?.[side] || []).map((item) => ({ ...item, side })));
  const pick = parsePickPhrase(owned.text, { season: ctx.season });
  if (pick) {
    const explicitSeason = /\b(?:20)?\d{2}\b|next year|this year|future/.test(owned.text);
    return items.filter((item) => {
      const meta = parsePickAssetId(item.assetId);
      if (!meta || Number(meta.round) !== pick.round) return false;
      if (explicitSeason && Number(meta.season) !== pick.season) return false;
      if (owned.owner === "me" && item.side !== "left") return false;
      if ((owned.owner === "partner" || owned.owner === "manager") && item.side !== "right") return false;
      return true;
    }).slice(0, pick.count);
  }
  const index = indexPlayers(items.map((item) => ({ ...item, value: 1 })));
  const found = resolvePlayer(owned.text, index);
  if (found.match) return [found.match];
  return found.options ? found.options.slice(0, 1) : [];
}

function blankPlan(intent) {
  return { intent, adds: [], removes: [], asks: [], misses: [], notes: [], partnerRosterId: null, replace: false, asked: false, shopSide: "" };
}

function absorb(plan, part) {
  plan.adds.push(...part.adds);
  plan.asks.push(...part.asks);
  plan.misses.push(...part.misses);
  plan.notes.push(...(part.notes || []));
  if (part.partner && plan.partnerRosterId == null) plan.partnerRosterId = part.partner.rosterId;
}

// A neutral "A for B" in a league: if B is mostly mine and A mostly theirs, the
// sentence was written get-first.
function ownershipFlip(plan, ctx) {
  if (!ctx.connected || ctx.meRosterId == null) return false;
  const owner = new Map(ctx.catalog.filter((row) => row.ownerRosterId != null).map((row) => [row.assetId, String(row.ownerRosterId)]));
  const me = String(ctx.meRosterId);
  let leftTheirs = 0;
  let rightMine = 0;
  plan.adds.forEach((add) => {
    const who = owner.get(add.asset.assetId);
    if (!who) return;
    if (add.side === "left" && who !== me) leftTheirs += 1;
    if (add.side === "right" && who === me) rightMine += 1;
  });
  return leftTheirs > 0 && rightMine > 0;
}

/**
 * Read one message. ctx:
 *   catalog   [{ assetId, name, assetType, value, ownerRosterId, originalRosterId, season, round, leagueId }]
 *   pickIds   Set of priced pick asset ids
 *   managers  [{ rosterId, displayName, teamName }]
 *   meRosterId, partnerRosterId, season, connected, draft
 */
export function parseTradeTalk(message, ctx = {}) {
  const context = {
    catalog: [],
    pickIds: new Set(),
    managers: [],
    meRosterId: null,
    partnerRosterId: null,
    season: new Date().getUTCFullYear() + 1,
    connected: false,
    draft: emptyValueCalcState(),
    ...ctx,
  };
  const index = indexPlayers(context.catalog);
  const { body: chatter, asked } = stripChatter(cleanText(message));
  const { body, partner, unknown } = pullPartner(chatter, context.managers, context.meRosterId);
  if (partner) context.partnerRosterId = partner.rosterId;
  const finish = (plan) => {
    plan.asked = asked;
    plan.unknownPartner = unknown;
    if (partner && plan.partnerRosterId == null) plan.partnerRosterId = partner.rosterId;
    if (plan.partnerRosterId == null && context.connected && (plan.replace || ctx.partnerRosterId == null)) {
      plan.partnerRosterId = inferPartner(plan, context);
    }
    return plan;
  };

  if (!body) return finish(blankPlan(asked ? "verdict" : "empty"));
  if (/^(?:clear|reset|start over|new trade|empty)(?: it| the trade| everything| all| both sides)?$/.test(body)) return finish(blankPlan("clear"));
  if (/^(?:flip|swap|switch|reverse)(?: it| the trade| sides| the sides| them)?$/.test(body)) return finish(blankPlan("flip"));

  const replace = body.match(/^(?:swap|replace|change|sub|switch|trade)\s+(?:out\s+)?(.+?)\s+(?:for|with|to|into)\s+(.+)$/);
  if (replace && findInDraft(replace[1], context.draft, context).length) {
    const plan = blankPlan("replace");
    const gone = findInDraft(replace[1], context.draft, context);
    plan.removes.push(...gone.map((item) => ({ side: item.side, uid: item.uid, name: item.name })));
    absorb(plan, piecesWithSide(replace[2], gone[0].side, context, partner, index));
    return finish(plan);
  }

  const remove = body.match(/^(?:remove|drop|take out|take off|minus|scratch|cut|nix|delete|lose|get rid of|no|without|pull)\s+(.+)$/)
    || body.match(/^take\s+(.+?)\s+(?:out|off)$/);
  if (remove) {
    const plan = blankPlan("remove");
    splitPieces(remove[1]).forEach((piece) => {
      const found = findInDraft(piece, context.draft, context);
      if (!found.length) plan.misses.push({ text: piece, reason: "Not in the trade." });
      found.forEach((item) => plan.removes.push({ side: item.side, uid: item.uid, name: item.name }));
    });
    return finish(plan);
  }

  const shop = body.match(/^(?:what|who)\s+(?:could|can|would|might|should|do)\s+i\s+(?:get|ask for|target|land)\s+(?:back\s+)?for\s+(.+)$/)
    || body.match(/^(?:shop|sell|move|price check|value of)\s+(.+)$/)
    || body.match(/^what(?:'s| is| are|s)\s+(.+?)\s+worth$/);
  if (shop) {
    const plan = blankPlan("shop");
    absorb(plan, piecesWithSide(shop[1], "left", context, partner, index));
    plan.shopSide = "left";
    plan.replace = plan.adds.length > 0;
    return finish(plan);
  }

  const split = body.match(/^(.*?)\s+(?:for|in exchange for|in return for)\s+(.+)$/);
  if (split && split[1].trim()) {
    let first = split[1];
    let firstSide = "left";
    let lead = "";
    const getLead = first.match(GET_LEAD);
    if (getLead) {
      lead = first.slice(0, getLead.index);
      first = first.slice(getLead.index + getLead[0].length);
      firstSide = "right";
    } else {
      const giveLead = first.match(GIVE_LEAD);
      if (giveLead && first.slice(giveLead[0].length).trim()) {
        lead = giveLead[0];
        first = first.slice(giveLead[0].length);
      }
    }
    let leadPartner = partner;
    lead.split(/\s+/).forEach((word) => {
      const hit = !leadPartner && findManager(word, context.managers);
      if (hit && String(hit.rosterId) !== String(context.meRosterId ?? "")) leadPartner = hit;
    });
    // A new trade: the old draft's partner no longer applies.
    context.partnerRosterId = leadPartner ? leadPartner.rosterId : null;
    const plan = blankPlan("trade");
    plan.replace = true;
    const second = firstSide === "left" ? "right" : "left";
    const a = piecesWithSide(first, firstSide, context, leadPartner, index);
    const b = piecesWithSide(split[2], second, context, leadPartner, index);
    absorb(plan, a);
    absorb(plan, b);
    if (leadPartner) plan.partnerRosterId = leadPartner.rosterId;
    if (!getLead && !lead && ownershipFlip(plan, context)) {
      plan.adds = plan.adds.map((add) => ({ ...add, side: add.side === "left" ? "right" : "left" }));
      plan.asks = plan.asks.map((ask) => ({ ...ask, side: ask.side === "left" ? "right" : "left" }));
    }
    return finish(plan);
  }

  const plan = blankPlan("add");
  let rest = body;
  let side = "";
  let subject = partner;
  const rightAdd = rest.match(RIGHT_ADD);
  const firstWord = rest.split(" ")[0];
  const named = findManager(firstWord, context.managers);
  if (named && String(named.rosterId) !== String(context.meRosterId ?? "") && RIGHT_VERB.test(rest.slice(firstWord.length).trim())) {
    side = "right";
    subject = named;
    context.partnerRosterId = named.rosterId;
    plan.partnerRosterId = named.rosterId;
    rest = rest.slice(firstWord.length).trim().replace(RIGHT_VERB, "");
  } else if (rightAdd) {
    side = "right";
    rest = rest.slice(rightAdd[0].length).trim();
  } else {
    rest = rest.replace(/^(?:add|plus|also|and|throw in|toss in|include|put in|tack on|i add|i'll add|ill add|i throw in)\b\s*/, "");
  }
  const tail = rest.match(/\s+(?:to|on|for)\s+(?:my|their|his|her|the)\s+(side|end|give side|get side)$/);
  if (tail) {
    side = /their|his|her|get/.test(tail[0]) ? "right" : "left";
    rest = rest.slice(0, tail.index);
  }
  absorb(plan, piecesWithSide(rest, side, context, subject, index));
  if (!plan.adds.length && !plan.asks.length && asked && !plan.misses.length) return finish(blankPlan("verdict"));
  return finish(plan);
}

// Apply a plan to the draft. Never invents a side: a piece with no side goes to
// You give, the same default as the search box.
export function applyTradeTalk(draft, plan) {
  let next = draft || emptyValueCalcState();
  const added = [];
  const skipped = [];
  const removed = [];
  if (plan.intent === "clear") return { draft: clearValueCalcSides(next), added, skipped, removed };
  if (plan.intent === "flip") return { draft: swapValueCalcSides(next), added, skipped, removed };
  if (plan.replace && (plan.adds.length || plan.asks.length)) {
    next = { ...clearValueCalcSides(next), partnerRosterId: null };
  }
  plan.removes.forEach((gone) => {
    const before = next;
    next = removeValueCalcItem(next, gone.side, gone.uid);
    if (next !== before) removed.push(gone);
  });
  plan.adds.forEach((add) => {
    const side = add.side === "right" ? "right" : "left";
    if (valueCalcHasAsset(next, add.asset)) {
      skipped.push({ ...add, side });
      return;
    }
    next = addValueCalcItem(next, side, add.asset);
    added.push({ ...add, side });
  });
  if (plan.partnerRosterId != null) next = { ...next, partnerRosterId: plan.partnerRosterId };
  return { draft: next, added, skipped, removed };
}

function listNames(items) {
  const counts = new Map();
  items.map((item) => item.asset?.name || item.name).filter(Boolean).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  const names = [...counts].map(([name, count]) => (count > 1 ? `${name} (x${count})` : name));
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Plain lines for the reply bubble. The verdict line is added by the caller.
export function tradeTalkReply(plan, result, { giveLabel = "You give", getLabel = "You get" } = {}) {
  const lines = [];
  const bySide = (side) => result.added.filter((add) => add.side === side);
  if (plan.intent === "empty") lines.push("Describe a trade, like “Gibbs and a 2027 1st for Nabers.”");
  if (plan.intent === "clear") lines.push("Cleared both sides. Restore draft brings it back.");
  if (plan.intent === "flip") lines.push("Flipped the sides.");
  if (result.removed.length) lines.push(`Took out ${listNames(result.removed)}.`);
  const give = bySide("left");
  const get = bySide("right");
  if (plan.intent === "trade" || plan.intent === "shop") {
    if (give.length) lines.push(`${giveLabel}: ${listNames(give)}.`);
    if (get.length) lines.push(`${getLabel}: ${listNames(get)}.`);
  } else {
    if (give.length) lines.push(`Added ${listNames(give)} to ${giveLabel}.`);
    if (get.length) lines.push(`Added ${listNames(get)} to ${getLabel}.`);
  }
  (plan.notes || []).forEach((note) => lines.push(note));
  if (result.skipped.length) lines.push(`${listNames(result.skipped)} ${result.skipped.length === 1 ? "is" : "are"} already in the trade.`);
  plan.misses.forEach((miss) => {
    lines.push(miss.reason ? `“${miss.text}”: ${miss.reason}` : `Didn’t catch “${miss.text}”. Try a last name or a pick like 2027 1st.`);
  });
  if (!lines.length && plan.intent !== "verdict" && !plan.asks.length) lines.push("Nothing changed.");
  return lines;
}

// Single players priced near a target. A price neighbor, not a prediction that
// anyone accepts.
export function priceNeighbors(catalog, target, { exclude = [], ownerRosterId = null, notOwnerRosterId = null, limit = 4 } = {}) {
  const goal = Number(target) || 0;
  if (goal <= 0) return [];
  const skip = new Set(exclude.map(String));
  return (catalog || [])
    .filter((row) => row.assetType !== "pick" && Number(row.value) > 0 && !skip.has(String(row.assetId)))
    .filter((row) => ownerRosterId == null || String(row.ownerRosterId ?? "") === String(ownerRosterId))
    .filter((row) => notOwnerRosterId == null || String(row.ownerRosterId ?? "") !== String(notOwnerRosterId))
    .filter((row) => row.value >= goal * 0.75 && row.value <= goal * 1.33)
    .sort((a, b) => Math.abs(a.value - goal) - Math.abs(b.value - goal))
    .slice(0, limit);
}