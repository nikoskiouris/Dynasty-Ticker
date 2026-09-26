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
  "See what your players are worth, check a trade, and find your team's next move.";

export function tickerDurationSeconds(itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  return Math.max(50, count * 9);
}

export const PAGE_META = {
  players: {
    title: PAGE_LABELS.players,
    description: "Search a player and see what he is worth. Add him to a trade.",
  },
  league: {
    title: PAGE_LABELS.league,
    description: "Your outlook, this week's scores, standings, and league history.",
  },
  trades: {
    title: PAGE_LABELS.trades,
    description: "One calculator: you give and you get. Find a deal that opens in that same calculator.",
  },
};

const ROOM_DESCRIPTIONS = {
  players: {
    ranks: "Player and pick values. Open one, then add him to a trade.",
  },
  league: {
    team: "Your outlook, why, and the roster. The rest of the league is one step away.",
    scores: "This week's matchups.",
    board: "One league table: record, playoff odds, and roster rank.",
    activity: "Past trades for your team and the league.",
    history: "Last season's champion, titles, records, and who stayed.",
  },
  trades: {
    calculator: "You give and you get. Same verdict with or without a league. A league adds roster picks and team impact.",
    find: "Shop one of yours, target one of theirs, or find a partner. Review trade opens the calculator.",
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
