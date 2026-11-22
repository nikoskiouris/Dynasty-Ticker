import { safeStorage } from "./safe-storage.js";
import { DEFAULT_ROOMS, PAGE_LABELS } from "./constants.js";
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

export const DEFAULT_TITLE = "Dynasty Ticker — Trade Calculator, Player Rankings & League History";
export const DEFAULT_DESCRIPTION =
  "Trade Calculator, Player Rankings and Sleeper League History. Values optimized for 12-team Superflex PPR dynasty.";

export const PAGE_META = {
  league: {
    title: PAGE_LABELS.league,
    description: "Your Sleeper league at a glance: standings, your team, recent trades and all-time history.",
  },
  trades: {
    title: PAGE_LABELS.trades,
    description: "Is this trade fair? Build both sides and get one verdict on 12-team Superflex PPR dynasty values.",
  },
};

const ROOM_DESCRIPTIONS = {
  league: {
    standings: "Standings, all-play luck and playoff odds from your Sleeper matchups.",
    team: "Your roster's value, position ranks and draft picks.",
    trades: "Every completed trade in your league, graded on today's values.",
    history: "All-time standings, champions, records, rivalries and awards.",
  },
  trades: {
    calculator: "You give and you get. Same verdict with or without a league. A league adds roster picks and team impact.",
    find: "1-for-1 and 2-for-1 ideas from team needs. Review trade opens the calculator.",
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

export function buildDocumentTitle({ page = "", leagueName = "", loaded = false, room = "", league = null } = {}) {
  const pageLabel = pageMetaFor({ page, room, league })?.title || "";
  const name = String(leagueName || "").trim();
  if (loaded && name && pageLabel) return `${pageLabel} · ${name} — ${SITE_NAME}`;
  if (loaded && name) return `${name} — ${SITE_NAME}`;
  if (loaded && pageLabel) return `${pageLabel} — ${SITE_NAME}`;
  return DEFAULT_TITLE;
}

export function buildPageDescription({
  page = "",
  leagueName = "",
  loaded = false,
  room = "",
  league = null,
} = {}) {
  const name = String(leagueName || "").trim();
  const pageMeta = pageMetaFor({ page, room, league });
  if (loaded && name && pageMeta) return `${pageMeta.description} Now open: ${name}.`;
  return pageMeta?.description || DEFAULT_DESCRIPTION;
}

let renderedTitleToken = 0;

// Chrome stores document.title on the history entry and writes that copy back
// after popstate and back-forward cache. The rendered page is the source of
// truth, so put its title back on the next turn.
export function holdDocumentTitle(doc, title) {
  if (!doc || !title) return;
  const token = ++renderedTitleToken;
  doc.title = title;
  const restore = () => {
    if (token !== renderedTitleToken || !doc) return;
    if (doc.title !== title) doc.title = title;
  };
  if (typeof queueMicrotask === "function") queueMicrotask(restore);
  if (typeof setTimeout === "function") setTimeout(restore, 0);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => setTimeout(restore, 0));
  }
}

// A page that only exists to say "not found" asks search engines not to index
// it. Every other route drops the tag again.
export function applyNoIndex(doc, noindex) {
  if (!doc?.head) return;
  let tag = doc.head.querySelector('meta[name="robots"]');
  if (!noindex) {
    if (tag?.dataset?.route) tag.remove();
    return;
  }
  if (!tag) {
    tag = doc.createElement("meta");
    tag.setAttribute("name", "robots");
    tag.dataset.route = "1";
    doc.head.appendChild(tag);
  }
  tag.setAttribute("content", "noindex");
}

export function applyDocumentMeta(doc, { title, description } = {}) {
  if (!doc) return;
  if (title) {
    holdDocumentTitle(doc, title);
    setMetaContent(doc, "property", "og:title", title);
    setMetaContent(doc, "name", "twitter:title", title);
  }
  if (description) {
    setMetaContent(doc, "name", "description", description);
    setMetaContent(doc, "property", "og:description", description);
    setMetaContent(doc, "name", "twitter:description", description);
  }
}

// index.html ships one canonical (the home page) for every route, so search
// engines folded /players, /trade and every /player/<id> page into "/". Point
// it, and og:url, at the page actually shown. Query strings (?league=…) are
// per-visitor state, not a different page.
export function applyCanonical(doc, pathname = "/") {
  if (!doc?.head) return;
  const path = String(pathname || "/").split(/[?#]/)[0] || "/";
  const href = `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
  let link = doc.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = doc.createElement("link");
    link.setAttribute("rel", "canonical");
    doc.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  setMetaContent(doc, "property", "og:url", href);
}

export function readStorageNoticeDismissed(storage = safeStorage("localStorage")) {
  try {
    return storage?.getItem(STORAGE_NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeStorageNoticeDismissed(storage = safeStorage("localStorage")) {
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
