import { DEFAULT_ROOMS, PAGE_HINTS, PAGE_LABELS, ROOM_HINTS, ROOM_LABELS } from "./constants.js";
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
  "Pick a job, then open your Sleeper dynasty league. Live scores, roster scout, trade tools, and league history.";

export function tickerDurationSeconds(itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  return Math.max(50, count * 9);
}

export const PAGE_META = {
  league: {
    title: PAGE_LABELS.league,
    description: "Live scores, standings, playoff odds, power rankings, weekly awards, and a group-chat recap.",
  },
  teams: {
    title: PAGE_LABELS.teams,
    description: "Scout any roster: sit/start this week, tank-or-contend call, bench, pick vault, 2027 mock board, roster DNA, and player passports.",
  },
  trades: {
    title: PAGE_LABELS.trades,
    description: "Trade match for complementary rosters, a graded trade log, a two-team calculator, and Sleeper-trade values.",
  },
  history: {
    title: PAGE_LABELS.history,
    description: "All-time hall, season ledger, manager comparisons, and the league record book.",
  },
};

const ROOM_DESCRIPTIONS = {
  league: {
    recap: "Group-chat recap of scores, awards, standings, and odds. Copy text or save an image card.",
  },
  teams: {
    roster: "Sit/start this week for this roster. League slots, close-call reasons, bye and missing opponent sit.",
    mock: "Dynasty Nerds Superflex 2-round rookie mock. 1sts and 2nds get names; 3rds stay pick labels.",
    call: "Desk call for this roster: tank, go all in, or stay in the middle. Built from playoff odds, lineup rank, age, and pick capital.",
  },
  trades: {
    match: "Match with teams that have the positions you need, want what you can spare, or are tanking while you contend.",
  },
};

function pageMetaFor({ page = "", room = "" } = {}) {
  const pageId = normalizeDeskTab(page);
  const base = PAGE_META[pageId];
  if (!base) return null;
  const roomId = normalizeRoom(pageId, room) || normalizeRoom(pageId, page);
  if (roomId && roomId !== DEFAULT_ROOMS[pageId]) {
    return {
      title: ROOM_LABELS[pageId]?.[roomId] || base.title,
      description: ROOM_DESCRIPTIONS[pageId]?.[roomId]
        || (ROOM_HINTS[pageId]?.[roomId] ? `${ROOM_HINTS[pageId][roomId]}.` : base.description),
    };
  }
  return base;
}

export function pageHintFor(page) {
  return PAGE_HINTS[normalizeDeskTab(page)] || "";
}

export function buildDocumentTitle({ page = "", leagueName = "", loaded = false, room = "" } = {}) {
  const pageLabel = pageMetaFor({ page, room })?.title || "";
  const league = String(leagueName || "").trim();
  if (loaded && league && pageLabel) return `${pageLabel} · ${league} — ${SITE_NAME}`;
  if (loaded && league) return `${league} — ${SITE_NAME}`;
  if (loaded && pageLabel) return `${pageLabel} — ${SITE_NAME}`;
  return DEFAULT_TITLE;
}

export function buildPageDescription({ page = "", leagueName = "", loaded = false, room = "" } = {}) {
  const pageMeta = pageMetaFor({ page, room });
  const league = String(leagueName || "").trim();
  if (loaded && league && pageMeta) return `${pageMeta.description} Now open: ${league}.`;
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
