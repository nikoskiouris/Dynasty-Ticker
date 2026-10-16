import { DEFAULT_ROOMS, PAGE_HINTS, PAGE_LABELS } from "./constants.js";
import { roomDescriptionFor, roomHintFor, roomLabelFor } from "./league-format.js";
import { normalizeDeskTab, normalizeRoom } from "./parse.js";
import { sampleDescription, sampleRosterLabels } from "./sample-voice.js";

export const SITE_NAME = "Dynasty Ticker";
export const SITE_ORIGIN = "https://dynastyticker.com";
export const SITE_PATH = "/";
export const SITE_URL = `${SITE_ORIGIN}${SITE_PATH}`;
export const REPO_URL = "https://github.com/nikoskiouris/Dynasty-Ticker";
export const CONTACT_URL = `${REPO_URL}/issues`;
export const OG_IMAGE_URL = `${SITE_URL}og-image.jpg`;
export const STORAGE_NOTICE_KEY = "dynasty_ticker_storage_notice";
export const SAMPLE_BANNER_KEY = "dynasty_ticker_sample_banner_off";

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

export function buildPageDescription({
  page = "",
  leagueName = "",
  loaded = false,
  room = "",
  league = null,
  viewingSample = false,
  ownerName = "",
} = {}) {
  const name = String(leagueName || "").trim();
  if (viewingSample) {
    const voice = sampleRosterLabels({ viewingSample: true, ownerName });
    const custom = sampleDescription({ page, room, voice });
    if (custom) return loaded && name ? `${custom} Now open: ${name}.` : custom;
  }
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

// Banner dismiss lasts this visit only. A stored flag must not hide it next time.
export function sampleBannerDismissed(memoryFlag = false) {
  return Boolean(memoryFlag);
}

export function clearSampleBannerDismissal(storage = globalThis.sessionStorage) {
  try {
    storage?.removeItem(SAMPLE_BANNER_KEY);
    return true;
  } catch {
    return false;
  }
}

export function sampleConnectEntryVisible({ sampleOn = false, bannerDismissed = false } = {}) {
  return Boolean(sampleOn && bannerDismissed);
}

export function focusAfterSampleBannerDismiss(doc = globalThis.document) {
  if (!doc || typeof doc.getElementById !== "function") return null;
  const workspace = doc.getElementById("workspace");
  const username = doc.getElementById("sleeper-username");
  const target = workspace || username;
  if (!target || target === doc.body) return null;
  if (target === workspace && target.getAttribute("tabindex") == null) {
    target.setAttribute("tabindex", "-1");
  }
  if (typeof target.focus === "function") {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }
  return target;
}

function setMetaContent(doc, attr, key, value) {
  const node = doc.querySelector(`meta[${attr}="${key}"]`);
  if (!node) return;
  if (typeof node.setAttribute === "function") node.setAttribute("content", value);
  node.content = value;
}
