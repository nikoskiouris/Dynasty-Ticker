// Additive accessibility hooks. History decisions stay in history-route.js.

export const ROUTE_LIVE_ID = "route-announcer";
export const ROUTE_SITE_NAME = "Dynasty Ticker";
export const ROUTE_TAB_LABELS = Object.freeze({
  players: "Players",
  trades: "Trade",
  league: "My League",
});
export const ROUTE_ROOM_TITLES = Object.freeze({
  board: "League",
  scores: "This week",
  activity: "Activity",
  history: "History",
});

const PAGE_ROOTS = new Set(["players", "trades", "league"]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function routeDocumentTitle({ playerName = "", tab = "", room = "", siteName = ROUTE_SITE_NAME } = {}) {
  const player = clean(playerName);
  if (player) return `${player} · ${siteName}`;
  const roomLabel = tab === "league" ? (ROUTE_ROOM_TITLES[room] || "") : "";
  if (roomLabel) return `${roomLabel} · ${siteName}`;
  const label = ROUTE_TAB_LABELS[tab] || "";
  if (label) return `${label} · ${siteName}`;
  return "";
}

function placeChanged(before, place) {
  if (!before?.tab) return false;
  return before.tab !== place.tab
    || before.view !== place.view
    || String(before.playerId || "") !== String(place.playerId || "");
}

export function routeAnnouncement(place = {}, before = {}) {
  const overlay = String(place.overlay || "");
  const player = clean(place.playerName);
  const changed = placeChanged(before, place);
  if (overlay === "help") return "Help";
  if (overlay === "trade") return "Trade";
  if (overlay === "rail" && !changed) return "Menu";
  if (overlay === "player" || player) return player || "Player";
  if (overlay === "public-ranks") return ROUTE_TAB_LABELS.players;
  const roomLabel = place.tab === "league" ? (ROUTE_ROOM_TITLES[place.view] || "") : "";
  if (roomLabel) return roomLabel;
  return ROUTE_TAB_LABELS[place.tab] || "";
}

export function focusWithoutScroll(el, { focusVisible = false } = {}) {
  if (!el || typeof el.focus !== "function") return false;
  const opts = { preventScroll: true };
  if (focusVisible) opts.focusVisible = true;
  try {
    el.focus(opts);
  } catch {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }
  return true;
}

function classListHas(el, name) {
  const cls = typeof el?.className === "string"
    ? el.className
    : (el?.getAttribute?.("class") || "");
  if (typeof cls !== "string" || !cls) return false;
  return cls.split(/\s+/).includes(name);
}

function isHidden(el) {
  let node = el;
  while (node) {
    if (node.hidden === true) return true;
    const hiddenAttr = node.getAttribute?.("hidden");
    if (hiddenAttr != null && hiddenAttr !== "false") return true;
    if (classListHas(node, "hidden")) return true;
    node = node.parentElement || null;
  }
  return false;
}

function visibleHeading(root, selector) {
  if (!root) return null;
  if (root.matches?.(selector) && !isHidden(root)) return root;
  const nodes = root.querySelectorAll?.(selector) || [];
  for (const node of nodes) {
    if (!isHidden(node)) return node;
  }
  return null;
}

// Prefer the view's h1 or h2. Dialogs that only have an h3 still receive focus.
export function focusViewHeading(root) {
  const heading = visibleHeading(root, "h1, h2") || visibleHeading(root, "h3");
  if (!heading) return null;
  if (typeof heading.setAttribute === "function") heading.setAttribute("tabindex", "-1");
  focusWithoutScroll(heading, { focusVisible: true });
  return heading;
}

export function headingSelectorFor(place = {}) {
  const overlay = String(place.overlay || "");
  if (overlay === "player" || place.playerId) return ".ranks-card h2, .player-week-sheet h2";
  const page = place.page || place.tab || "";
  const room = String(place.view || "");
  if (page === "league" && (room === "board" || room === "scores" || room === "activity" || room === "history")) {
    return `[data-room-panel="${room}"] h2`;
  }
  return "";
}

function firstVisible(doc, selector) {
  const nodes = doc?.querySelectorAll?.(selector) || [];
  for (const node of nodes) {
    if (!isHidden(node)) return node;
  }
  return null;
}

function railOpen(doc) {
  const body = doc?.body;
  if (!body) return false;
  if (typeof body.classList?.contains === "function" && body.classList.contains("rail-open")) return true;
  return classListHas(body, "rail-open");
}

function mayMoveFocus(doc, active) {
  if (!active || active === doc.body || active === doc.documentElement) return true;
  if (active.id === "workspace") return true;
  // Closing the phone menu parks focus on Sections. The room heading should take it.
  if ((active.id === "mobile-rail-toggle" || active.id === "mobile-rail-close") && !railOpen(doc)) return true;
  const cls = typeof active.className === "string" ? active.className : "";
  return cls.split(/\s+/).some((name) => (
    name === "room-tab" || name === "page-tab" || name === "phone-desk-room" || name === "phone-desk-page"
  ));
}

let headingWatch = 0;

// Retry until the heading is in the document and still focused on a later frame.
// A render that replaces the node drops focus to the body, so the watch continues.
export function focusHeadingWhenPresent(doc, selector, { schedule, maxMs = 20000, settleMs = 400, now, onStuck, stillWanted } = {}) {
  if (!doc || !selector) return 0;
  const watch = ++headingWatch;
  const clock = now || (() => Date.now());
  const wanted = () => (typeof stillWanted === "function" ? stillWanted() !== false : true);
  const queue = schedule || ((fn) => {
    if (typeof requestAnimationFrame === "function") return requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  });
  const started = clock();
  const tick = () => {
    if (watch !== headingWatch) return;
    if (!wanted()) return;
    const active = doc.activeElement;
    const heading = firstVisible(doc, selector);
    const already = Boolean(heading) && active === heading;
    if (!already && !mayMoveFocus(doc, active)) return;
    if (heading) {
      if (heading.getAttribute?.("tabindex") == null && typeof heading.setAttribute === "function") {
        heading.setAttribute("tabindex", "-1");
      }
      if (!already) focusWithoutScroll(heading, { focusVisible: true });
      if (doc.activeElement === heading) {
        const stableAt = clock();
        const confirm = () => {
          if (watch !== headingWatch) return;
          if (!wanted()) return;
          if (heading.isConnected === false || doc.activeElement !== heading) {
            if (clock() - started < maxMs) queue(tick);
            return;
          }
          if (clock() - stableAt < settleMs) {
            queue(confirm);
            return;
          }
          if (typeof onStuck === "function") onStuck(heading);
        };
        queue(confirm);
        return;
      }
    }
    if (clock() - started < maxMs) queue(tick);
  };
  tick();
  return watch;
}

export function elementConnected(doc, el) {
  if (!el || !doc) return false;
  if (el === doc.body || el === doc.documentElement) return false;
  if (el.isConnected === false) return false;
  if (typeof doc.contains === "function" && doc.contains(el) === false) return false;
  return true;
}

export function fallbackLandmark(doc) {
  if (!doc?.querySelector) return null;
  return doc.querySelector("main, [role='main']")
    || doc.getElementById?.("workspace")
    || doc.querySelector("h1, h2");
}

function cssAttr(value) {
  const text = String(value || "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(text);
  return text.replace(/["\\]/g, "\\$&");
}

export function invokerKey(el) {
  const action = el?.getAttribute?.("data-action") || "";
  const asset = el?.getAttribute?.("data-asset-id") || "";
  const player = el?.getAttribute?.("data-player-id") || "";
  const trade = el?.getAttribute?.("data-trade-id") || "";
  const manager = el?.getAttribute?.("data-manager-key") || "";
  if (action === "rank-open" && asset) return `asset:${asset}`;
  if (action === "open-player" && player) return `player:${player}`;
  if (action === "open-trade" && trade) return `trade\n${trade}\n${manager}`;
  return "";
}

export function findInvokerRow(doc, trigger) {
  const key = invokerKey(trigger);
  if (!key || !doc?.querySelectorAll) return null;
  const kind = key.startsWith("trade\n") ? "trade" : key.slice(0, key.indexOf(":"));
  const rest = kind === "trade" ? "" : key.slice(kind.length + 1);
  let selector = "";
  if (kind === "player") selector = `[data-action="open-player"][data-player-id="${cssAttr(rest)}"]`;
  if (kind === "asset") selector = `[data-action="rank-open"][data-asset-id="${cssAttr(rest)}"]`;
  if (kind === "trade") {
    const [, trade, manager] = key.split("\n");
    selector = `[data-action="open-trade"][data-trade-id="${cssAttr(trade)}"]`;
    if (manager) selector += `[data-manager-key="${cssAttr(manager)}"]`;
  }
  if (!selector) return null;
  const nodes = [...doc.querySelectorAll(selector)].filter((node) => !isHidden(node) && !classListHas(node, "ranks-neighbor"));
  return nodes.find((node) => classListHas(node, "ranks-row"))
    || nodes.find((node) => node.getAttribute?.("data-action") === "open-player")
    || nodes.find((node) => node.getAttribute?.("data-action") === "open-trade")
    || nodes[0]
    || null;
}

export function restoreTriggerFocus(doc, trigger) {
  if (elementConnected(doc, trigger)) {
    focusWithoutScroll(trigger);
    return trigger;
  }
  const row = findInvokerRow(doc, trigger);
  if (row) {
    focusWithoutScroll(row);
    return row;
  }
  const land = fallbackLandmark(doc);
  if (!land) return null;
  const focusable = land.matches?.("a, button, input, select, textarea, [tabindex]");
  if (!focusable && land.getAttribute?.("tabindex") == null && typeof land.setAttribute === "function") {
    land.setAttribute("tabindex", "-1");
  }
  focusWithoutScroll(land);
  return land;
}

export function syncAriaCurrent(nodes, isCurrent) {
  for (const node of nodes || []) {
    if (!node || typeof node.setAttribute !== "function" || typeof node.removeAttribute !== "function") continue;
    if (isCurrent(node)) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  }
}

export function ensureRouteLive(doc) {
  if (!doc || typeof doc.getElementById !== "function") return null;
  const existing = doc.getElementById(ROUTE_LIVE_ID);
  if (existing) return existing;
  if (typeof doc.createElement !== "function" || !doc.body || typeof doc.body.appendChild !== "function") return null;
  const node = doc.createElement("div");
  node.id = ROUTE_LIVE_ID;
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-atomic", "true");
  node.className = "sr-only";
  doc.body.appendChild(node);
  return node;
}

export function announceRoute(doc, message) {
  const node = ensureRouteLive(doc);
  if (!node) return null;
  const text = clean(message);
  node.textContent = "";
  if (text) node.textContent = text;
  return node;
}

// Pushed overlays use history.back(), the same path as Back. Otherwise close in place.
export function applyEscape({ overlay = "", pushed = false, back, close } = {}) {
  if (!overlay) return "none";
  if (pushed && typeof back === "function") {
    back();
    return "back";
  }
  if (typeof close === "function") close();
  return "close";
}

function pageRoot(doc, page) {
  if (!doc?.querySelector) return null;
  if (!PAGE_ROOTS.has(page)) return doc.querySelector("main");
  const root = doc.querySelector(`#${page}-page`);
  if (!root) return doc.querySelector("main");
  const rooms = root.querySelectorAll?.("[data-room-panel]") || [];
  for (const room of rooms) {
    if (!isHidden(room)) return room;
  }
  return root;
}

export function headingRootFor(doc, place = {}, before = {}) {
  if (!doc?.querySelector) return null;
  const overlay = String(place.overlay || "");
  const changed = placeChanged(before, place);
  if (overlay === "player" || place.playerId) {
    return doc.querySelector(".ranks-card")
      || doc.querySelector(".player-week-sheet")
      || pageRoot(doc, place.page);
  }
  if (overlay === "help") {
    return doc.querySelector("#weekly-help-pop")
      || doc.querySelector(".weekly-help-pop")
      || pageRoot(doc, place.page);
  }
  if (overlay === "trade") {
    return doc.querySelector("#trade-log-dashboard")
      || doc.querySelector("[data-room-panel='activity']")
      || pageRoot(doc, place.page);
  }
  if (overlay === "rail" && !changed) return doc.querySelector("#control-rail");
  if (overlay === "public-ranks") {
    return doc.querySelector("#public-ranks") || pageRoot(doc, place.page);
  }
  return pageRoot(doc, place.page) || doc.querySelector("main");
}

export function createRouteFocusMemory() {
  let index = 0;
  let armed = null;
  let remembered = null;
  const returns = new Map();

  return {
    arm(el) {
      if (!el) return;
      armed = el;
      queueMicrotask(() => {
        if (armed === el) armed = null;
      });
    },
    consumeArmed() {
      const el = armed;
      armed = null;
      return el || null;
    },
    remember(el) {
      if (!el) return;
      remembered = el;
    },
    forget() {
      remembered = null;
    },
    takeRemembered() {
      const el = remembered;
      remembered = null;
      return el || null;
    },
    index() {
      return index;
    },
    opener() {
      return returns.get(index - 1) || null;
    },
    push(trigger) {
      const el = this.takeRemembered() || trigger || null;
      returns.set(index, el);
      index += 1;
      armed = null;
      return { index, focus: "heading" };
    },
    pop(nextIndex) {
      const next = Number(nextIndex);
      const goingBack = next < index;
      const trigger = returns.get(next) || null;
      if (goingBack) {
        for (const key of [...returns.keys()]) {
          if (key > next) returns.delete(key);
        }
      }
      index = Number.isFinite(next) ? next : index;
      armed = null;
      return { index, focus: goingBack ? "restore" : "heading", trigger };
    },
  };
}

function unshown(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.hidden) return true;
    if (typeof node.hasAttribute === "function" && node.hasAttribute("inert")) return true;
    const view = node.ownerDocument?.defaultView;
    const style = view?.getComputedStyle?.(node);
    if (style && (style.display === "none" || style.visibility === "hidden")) return true;
    const cls = typeof node.className === "string" ? node.className : "";
    if (cls.split(/\s+/).includes("hidden")) return true;
    node = node.parentElement || null;
  }
  return false;
}

const TABBABLE = "a[href], button, input, select, textarea, summary, [tabindex]";

export function tabbableControls(doc) {
  const nodes = doc?.querySelectorAll?.(TABBABLE) || [];
  const list = [];
  for (const el of nodes) {
    if (!el || el.tabIndex < 0 || el.disabled) continue;
    const type = String(el.getAttribute?.("type") || el.type || "").toLowerCase();
    if (type === "hidden") continue;
    if (unshown(el)) continue;
    list.push(el);
  }
  return list;
}

// Null when Tab should stay with the browser. The ends wrap so the document
// itself is not an extra stop after the last control.
export function nextTabWrap(list, current, shift) {
  const index = list.indexOf(current);
  if (index < 0 || list.length < 2) return null;
  if (!shift && index === list.length - 1) return list[0];
  if (shift && index === 0) return list[list.length - 1];
  return null;
}

export function bindInPageTab(doc) {
  if (!doc?.addEventListener) return;
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const next = nextTabWrap(tabbableControls(doc), doc.activeElement, event.shiftKey);
    if (!next || typeof next.focus !== "function") return;
    event.preventDefault();
    focusWithoutScroll(next, { focusVisible: true });
  });
}
