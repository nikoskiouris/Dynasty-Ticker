import { DEFAULT_ROOMS, PAGE_HINTS, PAGE_LABELS } from "./constants.js";
import { roomDescriptionFor, roomHintFor, roomLabelFor } from "./league-format.js";
import { normalizeDeskTab, normalizeRoom } from "./parse.js";

export const SITE_NAME = "Dynasty Ticker";
export const SITE_ORIGIN = "https://dynastyticker.com";
export const SITE_PATH = "/";
export const SITE_URL = `${SITE_ORIGIN}${SITE_PATH}`;
export const REPO_URL = "https://github.com/nikoskiouris/Dynasty-Ticker";
export const CONTACT_URL = `${REPO_URL}/issues`;
export const OG_IMAGE_URL = `${SITE_URL}og-image.jpg`;
export const STORAGE_NOTICE_KEY = "dynasty_ticker_storage_notice";

export const DEFAULT_TITLE = "Dynasty Ticker — Your Sleeper dynasty league";
export const DEFAULT_DESCRIPTION =
  "Your Sleeper dynasty league, live. Scores, rosters, trades, and history in one desk.";

export function tickerDurationSeconds(itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  return Math.max(50, count * 9);
}

export const PAGE_META = {
  league: {
    title: PAGE_LABELS.league,
    description: "Live scores, standings, playoff odds, power rankings, weekly awards, and league history.",
  },
  teams: {
    title: PAGE_LABELS.teams,
    description: "Scout any roster: sit/start this week, tank-or-contend call, bench, pick vault, player passport, and the 2027 mock board.",
  },
  trades: {
    title: PAGE_LABELS.trades,
    description: "Find a partner who has your holes, use the calculator, or shop a name.",
  },
};

const ROOM_DESCRIPTIONS = {
  league: {
    history: "Last season's champion, the title hall, and a short record book.",
  },
  teams: {
    roster: "Sit/start this week for this roster. League slots, close-call reasons, bye and missing opponent sit.",
    mock: "Dynasty Nerds Superflex 2-round rookie mock. 1sts and 2nds get names; 3rds stay pick labels.",
    call: "Ticker call for this roster: tank, go all in, or stay in the middle. Built from playoff odds, lineup rank, age, and pick capital.",
    passports: "Player passport: who owned each player, season by season.",
  },
  trades: {
    value: "Blank trade calculator: search any player or pick and build both sides.",
    ranks: "Player and pick values from Sleeper trades mixed with the crowd. Open one to see the pick he equals.",
    calculator: "Two-team calculator: pick a partner and tap assets on both sides.",
    match: "Match with teams that have the positions you need, want what you can spare, or are tanking while you contend.",
  },
};

function pageMetaFor({ page = "", room = "", league = null } = {}) {
  const pageId = normalizeDeskTab(page);
  const base = PAGE_META[pageId];
  if (!base) return null;
  const roomId = normalizeRoom(pageId, room) || normalizeRoom(pageId, page);
  if (roomId && roomId !== DEFAULT_ROOMS[pageId]) {
    const described = roomDescriptionFor(pageId, roomId, league);
    return {
      title: roomLabelFor(pageId, roomId, league) || base.title,
      description: described
        || ROOM_DESCRIPTIONS[pageId]?.[roomId]
        || (roomHintFor(pageId, roomId, league) ? `${roomHintFor(pageId, roomId, league)}.` : base.description),
    };
  }
  return base;
}

export function pageHintFor(page) {
  return PAGE_HINTS[normalizeDeskTab(page)] || "";
}

export function buildDocumentTitle({ page = "", leagueName = "", loaded = false, room = "", league = null } = {}) {
  const pageLabel = pageMetaFor({ page, room, league })?.title || "";
  const name = String(leagueName || "").trim();
  if (loaded && name && pageLabel) return `${pageLabel} · ${name} — ${SITE_NAME}`;
  if (loaded && name) return `${name} — ${SITE_NAME}`;
  if (loaded && pageLabel) return `${pageLabel} — ${SITE_NAME}`;
  return DEFAULT_TITLE;
}

export function buildPageDescription({ page = "", leagueName = "", loaded = false, room = "", league = null } = {}) {
  const pageMeta = pageMetaFor({ page, room, league });
  const name = String(leagueName || "").trim();
  if (loaded && name && pageMeta) return `${pageMeta.description} Now open: ${name}.`;
  return pageMeta?.description || DEFAULT_DESCRIPTION;
}

export function applyDocumentMeta(doc, { title, description } = {}) {
  if (!doc) return;
  if (title) {
    doc.title = title;
    setMetaContent(doc, "property", "og:title", title);
    setMetaContent(doc, "name", "twitter:title", title);
  }
  if (description) {
    setMetaContent(doc, "name", "description", description);
    setMetaContent(doc, "property", "og:description", description);
    setMetaContent(doc, "name", "twitter:description", description);
  }
}

export function readStorageNoticeDismissed(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(STORAGE_NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeStorageNoticeDismissed(storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_NOTICE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function applyStorageNoticeHidden(notice, dismissed) {
  if (!notice) return;
  const hide = Boolean(dismissed);
  notice.hidden = hide;
  notice.classList?.toggle?.("hidden", hide);
}

function setMetaContent(doc, attr, key, value) {
  const node = doc.querySelector(`meta[${attr}="${key}"]`);
  if (!node) return;
  if (typeof node.setAttribute === "function") node.setAttribute("content", value);
  node.content = value;
}
