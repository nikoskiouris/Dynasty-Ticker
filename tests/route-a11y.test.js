import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, get as httpGet } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_LABELS, ROOM_LABELS } from "../docs/modules/constants.js";
import { createSiteServer } from "../scripts/serve_site.mjs";
import { SITE_NAME } from "../docs/modules/site.js";
import {
  ROUTE_LIVE_ID,
  ROUTE_ROOM_TITLES,
  ROUTE_SITE_NAME,
  ROUTE_TAB_LABELS,
  announceRoute,
  applyEscape,
  createRouteFocusMemory,
  ensureRouteLive,
  focusHeadingWhenPresent,
  focusViewHeading,
  headingRootFor,
  headingSelectorFor,
  restoreTriggerFocus,
  routeAnnouncement,
  routeDocumentTitle,
  syncAriaCurrent,
} from "../docs/modules/route-a11y.js";

const root = dirname(fileURLToPath(import.meta.url));

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function heading(tag, id) {
  return {
    id,
    tag,
    attrs: {},
    className: "",
    parentElement: null,
    hidden: false,
    focusOpts: null,
    scrolled: false,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    matches(selector) {
      return selector.split(",").some((part) => part.trim() === tag);
    },
    focus(opts) {
      this.focusOpts = opts || {};
    },
    scrollIntoView() {
      this.scrolled = true;
    },
  };
}

function rootWith(nodes) {
  return {
    matches() {
      return false;
    },
    querySelector(selector) {
      return nodes.find((node) => node.matches(selector)) || null;
    },
    querySelectorAll(selector) {
      return nodes.filter((node) => node.matches(selector));
    },
  };
}

test("route navigation focuses the new view heading without scrolling", () => {
  const title = heading("h2", "trade-heading");
  const rootNode = rootWith([title]);
  const focused = focusViewHeading(rootNode);
  assert.equal(focused, title);
  assert.equal(title.getAttribute("tabindex"), "-1");
  assert.equal(title.focusOpts.preventScroll, true);
  assert.equal(title.scrolled, false);

  const hidden = heading("h2", "hidden-heading");
  hidden.className = "hidden";
  const visible = heading("h2", "visible-heading");
  const picked = focusViewHeading(rootWith([hidden, visible]));
  assert.equal(picked, visible);

  const card = heading("h2", "player-heading");
  const pageHeading = heading("h2", "page-heading");
  const doc = {
    querySelector(selector) {
      if (selector === ".ranks-card") return rootWith([card]);
      if (selector === "#players-page") return rootWith([pageHeading]);
      return null;
    },
  };
  const playerRoot = headingRootFor(doc, { overlay: "player", page: "players", playerId: "9221" });
  assert.equal(focusViewHeading(playerRoot), card);

  const tabDoc = {
    querySelector(selector) {
      if (selector === "#trades-page") return rootWith([pageHeading]);
      if (selector === "main") return rootWith([pageHeading]);
      return null;
    },
  };
  const tabRoot = headingRootFor(tabDoc, { overlay: "", page: "trades", tab: "trades" });
  assert.equal(focusViewHeading(tabRoot), pageHeading);
});

test("back and overlay close restore the trigger, or a landmark when it is gone", () => {
  const memory = createRouteFocusMemory();
  const opener = { id: "gibbs-row", isConnected: true };
  memory.push(opener);
  assert.equal(memory.index(), 1);
  const back = memory.pop(0);
  assert.equal(back.focus, "restore");
  assert.equal(back.trigger, opener);

  const forward = memory.pop(1);
  assert.equal(forward.focus, "heading");

  const main = {
    id: "workspace",
    attrs: { tabindex: "-1" },
    focusOpts: null,
    matches() {
      return true;
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    focus(opts) {
      this.focusOpts = opts || {};
    },
  };
  const gone = { id: "gone", isConnected: false, focus() {} };
  const doc = {
    body: { id: "body" },
    contains() {
      return false;
    },
    querySelector(selector) {
      return selector.includes("main") ? main : null;
    },
    getElementById(id) {
      return id === "workspace" ? main : null;
    },
  };
  assert.equal(restoreTriggerFocus(doc, gone), main);
  assert.equal(main.focusOpts.preventScroll, true);

  const live = {
    id: "live-trigger",
    isConnected: true,
    focusOpts: null,
    focus(opts) {
      this.focusOpts = opts || {};
    },
  };
  const liveDoc = {
    body: {},
    contains(el) {
      return el === live;
    },
    querySelector() {
      return main;
    },
  };
  assert.equal(restoreTriggerFocus(liveDoc, live), live);
  assert.equal(live.focusOpts.preventScroll, true);
});

test("document titles name the player or the tab", () => {
  assert.equal(ROUTE_SITE_NAME, SITE_NAME);
  assert.equal(ROUTE_TAB_LABELS.trades, PAGE_LABELS.trades);
  assert.equal(ROUTE_TAB_LABELS.players, PAGE_LABELS.players);
  assert.equal(ROUTE_TAB_LABELS.league, PAGE_LABELS.league);
  assert.equal(routeDocumentTitle({ playerName: "Jahmyr Gibbs" }), "Jahmyr Gibbs · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ playerName: "  Jahmyr   Gibbs  " }), "Jahmyr Gibbs · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ tab: "trades" }), "Trade · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ tab: "players" }), "Players · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ tab: "league" }), "My League · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ playerName: "Jahmyr Gibbs", tab: "trades" }), "Jahmyr Gibbs · Dynasty Ticker");
  assert.equal(routeDocumentTitle({}), "");
});

function control(attrs, { id = "", className = "", connected = true } = {}) {
  return {
    id,
    className,
    attrs: { ...attrs },
    isConnected: connected,
    parentElement: null,
    hidden: false,
    focusOpts: null,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    focus(opts) {
      this.focusOpts = opts || {};
    },
  };
}

test("back and escape restore the player row, or the same player id when that node is gone", () => {
  const memory = createRouteFocusMemory();
  const playersTab = control({ "data-page": "players" }, { id: "players-tab", className: "page-tab" });
  const gibbs = control({
    "data-action": "rank-open",
    "data-asset-id": "player:9221",
  }, { id: "gibbs-row", className: "ranks-row" });
  memory.remember(gibbs);
  memory.push(playersTab);
  const back = memory.pop(0);
  assert.equal(back.focus, "restore");
  assert.equal(back.trigger, gibbs);

  gibbs.isConnected = false;
  const live = control({
    "data-action": "rank-open",
    "data-asset-id": "player:9221",
  }, { id: "gibbs-live", className: "ranks-row" });
  const neighbor = control({
    "data-action": "rank-open",
    "data-asset-id": "player:9221",
  }, { id: "gibbs-neighbor", className: "ranks-row ranks-neighbor" });
  const shelf = control({
    "data-action": "rank-open",
    "data-asset-id": "player:9221",
  }, { id: "gibbs-shelf", className: "ranks-shelf-item" });
  const doc = {
    body: { id: "body" },
    contains(el) {
      return el === live || el === shelf || el === playersTab;
    },
    querySelector(selector) {
      return selector.includes("main") ? playersTab : null;
    },
    querySelectorAll() {
      return [neighbor, shelf, live];
    },
  };
  assert.equal(restoreTriggerFocus(doc, back.trigger), live);
  assert.equal(live.focusOpts.preventScroll, true);
  assert.equal(playersTab.focusOpts, null);

  const trade = control({
    "data-action": "open-trade",
    "data-trade-id": "88",
    "data-manager-key": "mine",
  }, { id: "trade-row" });
  trade.isConnected = false;
  const liveTrade = control({
    "data-action": "open-trade",
    "data-trade-id": "88",
    "data-manager-key": "mine",
  }, { id: "trade-live" });
  const tradeDoc = {
    contains() {
      return false;
    },
    querySelector() {
      return playersTab;
    },
    querySelectorAll() {
      return [liveTrade];
    },
  };
  assert.equal(restoreTriggerFocus(tradeDoc, trade), liveTrade);
});

test("league, activity, history, and this week have distinct document titles", () => {
  assert.equal(ROUTE_ROOM_TITLES.board, ROOM_LABELS.league.board);
  assert.equal(ROUTE_ROOM_TITLES.scores, ROOM_LABELS.league.scores);
  assert.equal(ROUTE_ROOM_TITLES.activity, ROOM_LABELS.league.activity);
  assert.equal(ROUTE_ROOM_TITLES.history, ROOM_LABELS.league.history);
  const league = routeDocumentTitle({ tab: "league", room: "board" });
  const week = routeDocumentTitle({ tab: "league", room: "scores" });
  const activity = routeDocumentTitle({ tab: "league", room: "activity" });
  const history = routeDocumentTitle({ tab: "league", room: "history" });
  assert.equal(league, "League · Dynasty Ticker");
  assert.equal(week, "This week · Dynasty Ticker");
  assert.equal(activity, "Activity · Dynasty Ticker");
  assert.equal(history, "History · Dynasty Ticker");
  assert.equal(new Set([league, week, activity, history]).size, 4);
  assert.equal(routeDocumentTitle({ tab: "league", room: "team" }), "My League · Dynasty Ticker");
  assert.equal(routeDocumentTitle({ playerName: "Jahmyr Gibbs", tab: "league", room: "activity" }), "Jahmyr Gibbs · Dynasty Ticker");
  assert.equal(headingSelectorFor({ overlay: "player", playerId: "9221" }), ".ranks-card h2, .player-week-sheet h2");
  assert.equal(headingSelectorFor({ page: "league", view: "team" }), "#power-heading");
  assert.equal(headingSelectorFor({ page: "league", view: "board" }), "#league-heading");
  assert.equal(headingSelectorFor({ page: "league", view: "scores" }), "#scores-heading");
  assert.equal(headingSelectorFor({ tab: "league", view: "activity" }), "#activity-heading");
  assert.equal(headingSelectorFor({ page: "league", view: "history" }), "#history-heading");
});

test("user-facing slot, scoring, and record words are plain", () => {
  const app = read("../docs/app.js");
  const ranks = read("../docs/modules/ranks.js");
  const sit = read("../docs/modules/sit-start.js");
  const weekly = read("../docs/modules/weekly-value.js");
  assert.match(app, /Full PPR · \$\{escapeHtml\(rankFormatLabel\(format\)\)\}/);
  assert.equal((app.match(/PPR · \$\{escapeHtml\(rankFormatLabel/g) || []).length, 1);
  assert.match(app, /<h3>Titles, career record, playoff trips<\/h3>/);
  assert.match(app, /Career record is the rest of the story/);
  assert.match(app, /<span>#<\/span><span>Team<\/span><span>Record<\/span>/);
  assert.match(app, /SUPER_FLEX: "Superflex"/);
  assert.match(app, /BN: "Bench"/);
  assert.match(ranks, /label: "Projected points per game"/);
  assert.doesNotMatch(ranks, /Projected PPR\/G/);
  assert.match(sit, /points per game/);
  assert.doesNotMatch(sit, /PPR\/game/);
  assert.match(weekly, /SFO: "SF"/);
});

test("a cold /player load focuses the card heading", () => {
  const card = heading("h2", "player-heading");
  const pageHeading = heading("h2", "page-heading");
  const doc = {
    querySelector(selector) {
      if (selector === ".ranks-card") return rootWith([card]);
      if (selector === "#players-page") return rootWith([pageHeading]);
      if (selector === "main") return rootWith([pageHeading]);
      return null;
    },
  };
  const root = headingRootFor(doc, { overlay: "player", page: "players", playerId: "9221", tab: "players" });
  assert.equal(focusViewHeading(root), card);
  assert.equal(card.getAttribute("tabindex"), "-1");
  assert.equal(card.focusOpts.preventScroll, true);

  const app = read("../docs/app.js");
  assert.match(app, /coldPlayerHeading = bootRoute\?\.name === "player"/);
  assert.match(app, /function focusColdPlayerHeading\(\)/);
  assert.match(app, /focusColdPlayerHeading\(\)/);
  assert.match(app, /focusHeadingWhenPresent\(document, "\.ranks-card h2, \.player-week-sheet h2"/);
  assert.match(app, /headingSelectorFor\(place\)/);
});

test("heading focus waits for the node and follows a replacement", () => {
  const body = { id: "body", className: "" };
  const doc = {
    body,
    documentElement: { id: "html" },
    activeElement: body,
    nodes: [],
    querySelectorAll() {
      return this.nodes;
    },
  };
  const queued = [];
  let now = 0;
  const first = heading("h2", "one");
  first.isConnected = true;
  first.focus = (opts) => {
    first.focusOpts = opts || {};
    doc.activeElement = first;
  };
  const second = heading("h2", "two");
  second.isConnected = true;
  second.focus = (opts) => {
    second.focusOpts = opts || {};
    doc.activeElement = second;
  };
  let stuck = null;
  focusHeadingWhenPresent(doc, ".ranks-card h2", {
    maxMs: 1000,
    settleMs: 50,
    now: () => now,
    schedule(fn) {
      queued.push(fn);
    },
    onStuck(node) {
      stuck = node;
    },
  });
  assert.equal(doc.activeElement, body);
  assert.equal(queued.length, 1);
  doc.nodes = [first];
  queued.shift()();
  assert.equal(doc.activeElement, first);
  assert.equal(first.getAttribute("tabindex"), "-1");
  assert.equal(first.focusOpts.preventScroll, true);
  now = 10;
  queued.shift()();
  assert.equal(stuck, null);
  first.isConnected = false;
  doc.activeElement = body;
  doc.nodes = [second];
  now = 20;
  queued.shift()();
  queued.shift()();
  assert.equal(doc.activeElement, second);
  assert.equal(second.getAttribute("tabindex"), "-1");
  now = 80;
  queued.shift()();
  assert.equal(stuck, second);

  const field = { id: "search", className: "", tagName: "INPUT" };
  doc.activeElement = field;
  doc.nodes = [];
  const before = queued.length;
  focusHeadingWhenPresent(doc, ".ranks-card h2", {
    maxMs: 1000,
    now: () => now,
    schedule(fn) {
      queued.push(fn);
    },
  });
  assert.equal(doc.activeElement, field);
  assert.equal(queued.length, before);

  doc.activeElement = body;
  doc.nodes = [first];
  first.isConnected = true;
  const skipped = queued.length;
  focusHeadingWhenPresent(doc, ".ranks-card h2", {
    maxMs: 1000,
    now: () => now,
    stillWanted: () => false,
    schedule(fn) {
      queued.push(fn);
    },
  });
  assert.equal(doc.activeElement, body);
  assert.equal(queued.length, skipped);

  const hiddenRoom = {
    className: "room hidden",
    parentElement: null,
    hidden: false,
    getAttribute() {
      return null;
    },
  };
  const stale = heading("h2", "power-heading");
  stale.tagName = "H2";
  stale.parentElement = hiddenRoom;
  const roomHeading = heading("h2", "league-heading");
  roomHeading.tagName = "H2";
  roomHeading.isConnected = true;
  roomHeading.focus = () => {
    doc.activeElement = roomHeading;
  };
  doc.activeElement = stale;
  doc.nodes = [roomHeading];
  focusHeadingWhenPresent(doc, "#league-heading", {
    maxMs: 1000,
    now: () => now,
    schedule(fn) {
      queued.push(fn);
    },
  });
  assert.equal(doc.activeElement, roomHeading);

  const visibleRoom = { ...hiddenRoom, className: "room" };
  const playerHeading = heading("h2", "player-heading");
  playerHeading.tagName = "H2";
  playerHeading.parentElement = visibleRoom;
  doc.activeElement = playerHeading;
  doc.nodes = [roomHeading];
  const held = queued.length;
  focusHeadingWhenPresent(doc, "#league-heading", {
    maxMs: 1000,
    now: () => now,
    schedule(fn) {
      queued.push(fn);
    },
  });
  assert.equal(doc.activeElement, playerHeading);
  assert.equal(queued.length, held);
});

test("aria-current page sits on the active tab and comes off the others", () => {
  const tabs = ["players", "trades", "league"].map((page) => ({
    attrs: page === "players" ? { "aria-current": "page" } : {},
    dataset: { page },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
  }));
  syncAriaCurrent(tabs, (tab) => tab.dataset.page === "trades");
  assert.equal(tabs[0].getAttribute("aria-current"), null);
  assert.equal(tabs[1].getAttribute("aria-current"), "page");
  assert.equal(tabs[2].getAttribute("aria-current"), null);
  syncAriaCurrent(tabs, (tab) => tab.dataset.page === "league");
  assert.equal(tabs[1].getAttribute("aria-current"), null);
  assert.equal(tabs[2].getAttribute("aria-current"), "page");
});

test("escape mirrors back when the overlay pushed, and closes in place otherwise", () => {
  let backed = 0;
  let closed = 0;
  assert.equal(applyEscape({
    overlay: "player",
    pushed: true,
    back() {
      backed += 1;
    },
    close() {
      closed += 1;
    },
  }), "back");
  assert.equal(backed, 1);
  assert.equal(closed, 0);

  assert.equal(applyEscape({
    overlay: "rail",
    pushed: false,
    back() {
      backed += 1;
    },
    close() {
      closed += 1;
    },
  }), "close");
  assert.equal(backed, 1);
  assert.equal(closed, 1);
  assert.equal(applyEscape({ overlay: "", pushed: true, back() {}, close() {} }), "none");
});

test("one polite live region announces the route", () => {
  const region = {
    id: "",
    attrs: {},
    textContent: "",
    className: "",
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
  };
  const doc = {
    body: {
      children: [],
      appendChild(node) {
        this.children.push(node);
        return node;
      },
    },
    getElementById(id) {
      return region.id === id ? region : null;
    },
    createElement() {
      return region;
    },
  };
  const first = announceRoute(doc, "Jahmyr Gibbs");
  const second = announceRoute(doc, "Trade");
  assert.equal(first, second);
  assert.equal(doc.body.children.length, 1);
  assert.equal(region.id, ROUTE_LIVE_ID);
  assert.equal(region.getAttribute("aria-live"), "polite");
  assert.equal(region.getAttribute("aria-atomic"), "true");
  assert.equal(region.textContent, "Trade");
  assert.equal(ensureRouteLive(doc), region);
  assert.equal(routeAnnouncement({ overlay: "player", playerName: "Jahmyr Gibbs" }), "Jahmyr Gibbs");
  assert.equal(routeAnnouncement({ tab: "trades" }), "Trade");
  assert.equal(routeAnnouncement(
    { overlay: "rail", tab: "players", view: "ranks" },
    { tab: "players", view: "ranks", playerId: "" },
  ), "Menu");
  assert.equal(routeAnnouncement(
    { overlay: "rail", tab: "trades", view: "calculator" },
    { tab: "players", view: "ranks", playerId: "" },
  ), "Trade");
  assert.equal(routeAnnouncement({ overlay: "help", playerName: "Jahmyr Gibbs" }), "Help");
  assert.equal(routeAnnouncement({ tab: "league", view: "board" }, { tab: "league", view: "team" }), "League");
  assert.equal(routeAnnouncement({ tab: "league", view: "scores" }, { tab: "league", view: "board" }), "This week");
  assert.equal(routeAnnouncement({ tab: "league", view: "activity" }, { tab: "league", view: "scores" }), "Activity");
  assert.equal(routeAnnouncement({ tab: "league", view: "history" }, { tab: "league", view: "activity" }), "History");
  assert.equal(routeAnnouncement({ tab: "league", view: "team" }, { tab: "league", view: "history" }), "My League");
  assert.equal(routeAnnouncement(
    { tab: "league", view: "scores", overlay: "player", playerName: "Jahmyr Gibbs" },
    { tab: "league", view: "board" },
  ), "Jahmyr Gibbs");
});

test("the desk calls the accessibility hooks and leaves the router alone", () => {
  const app = read("../docs/app.js");
  const router = read("../docs/modules/history-route.js");
  const index = read("../docs/index.html");
  assert.match(app, /from "\.\/modules\/route-a11y\.js"/);
  assert.match(app, /syncRouteA11y\(\{ focus: appBooted \? "heading" : "none", before \}\)/);
  assert.match(app, /routeFocus\.pop\(next\)/);
  assert.match(app, /restoreTriggerFocus\(document/);
  assert.match(app, /routeDocumentTitle\(/);
  assert.match(app, /room: place\.view/);
  assert.match(app, /routeFocus\.remember\(target\)/);
  assert.match(app, /syncAriaCurrent\(/);
  assert.match(app, /function escapeRouteOverlay\(event\)/);
  assert.match(app, /applyEscape\(/);
  assert.match(app, /history\.back\(\)/);
  assert.match(app, /announceRoute\(document/);
  assert.match(app, /ensureRouteLive\(document\)/);
  assert.match(app, /focusHeadingWhenPresent\(document, selector, \{/);
  assert.match(app, /stillWanted: \(\) => Date\.now\(\) < followHeadingsUntil/);
  assert.match(app, /function focusLeagueRoomHeading\(room\)/);
  assert.match(app, /function focusClickedRoute\(before\)/);
  assert.match(app, /if \(pendingPopstateFocus\) return;/);
  assert.match(app, /void focusAfterPopstate\(\{ focus, trigger: step\.trigger, before, token \}\)/);
  assert.match(app, /await new Promise\(\(resolve\) => requestAnimationFrame\(resolve\)\)/);
  assert.match(app, /leagueRoomMove\(before, after\) \? "heading" : step\.focus/);
  assert.equal(index.split('id="route-announcer"').length - 1, 1);
  assert.match(index, /id="route-announcer"[^>]*aria-live="polite"/);
  assert.match(index, /id="players-tab"[^>]*aria-current="page"/);
  assert.match(index, /<h1 id="mobile-chrome-title">/);
  assert.match(index, /<h1 id="route-title" class="sr-only">Dynasty Ticker<\/h1>/);
  assert.match(app, /function guestRouteHeading\(\)/);
  assert.match(app, /function routeHeadingText\(\)/);
  assert.match(app, /team: "My team"/);
  assert.doesNotMatch(app, /bindInPageTab\(document\)/);
  const css = read("../docs/styles.css");
  assert.match(css, /body\.launch-open #route-title/);
  assert.doesNotMatch(css, /body\.league-loaded #route-title/);
  assert.match(css, /body\.cold-share #route-title[\s\S]*display:\s*block !important/);
  assert.match(css, /\[data-room-panel\] h2:focus-visible[\s\S]*box-shadow:\s*var\(--focus\)/);
  assert.match(css, /\[data-room-panel\] h2\[tabindex="-1"\]:focus\s*\{[^}]*outline:\s*none/s);
  assert.match(css, /\[data-room-panel\] h2\[tabindex="-1"\]:focus\s*\{[^}]*box-shadow:\s*none/s);
  const meta = app.slice(app.indexOf("function syncDocumentMeta"), app.indexOf("async function bootLandingRather"));
  assert.match(meta, /el\.routeTitle\.textContent = routeHeadingText\(\)/);
  const league = read("../docs/ui/league.html");
  assert.match(league, /<h2 id="power-heading" tabindex="-1">/);
  assert.match(league, /<h2 id="league-heading" tabindex="-1">How the league ranks<\/h2>/);
  assert.match(league, /<h2 id="scores-heading" class="sr-only" tabindex="-1">This week<\/h2>/);
  assert.match(league, /<h2 id="activity-heading" class="sr-only" tabindex="-1">Activity<\/h2>/);
  assert.match(league, /data-room-panel="history"[\s\S]*<h2 id="history-heading" tabindex="-1">Titles, records, and who stayed<\/h2>/);
  assert.doesNotMatch(index, /<(?:body|html)[^>]*\stabindex/);
  assert.match(index, /id="workspace"[^>]*tabindex="-1"/);
  const honors = app.slice(app.indexOf("function renderWeeklyHonors"), app.indexOf("function renderSeasonSuperlatives"));
  assert.match(honors, /<h2>Weekly honors<\/h2>/);
  assert.doesNotMatch(honors, /weekStatusChip/);
  assert.doesNotMatch(router, /focusViewHeading|route-announcer|aria-current/);
  assert.match(router, /export function decideHistoryWrite/);
});

const CHROME_BIN = "/usr/bin/google-chrome-stable";
const DEBUG_PORT_WAIT_MS = 30000;

function startChrome() {
  const userDataDir = mkdtempSync(join(tmpdir(), "route-a11y-chrome-"));
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME_BIN, [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--user-data-dir=${userDataDir}`,
      "--remote-debugging-port=0",
    ], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    let timer = null;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { process.kill(-child.pid, "SIGKILL"); }
      catch { child.kill("SIGKILL"); }
      try { rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 }); }
      catch { /* The launch error is the one that matters. */ }
      reject(err);
    };
    timer = setTimeout(() => fail(new Error("debug port did not open")), DEBUG_PORT_WAIT_MS);
    let text = "";
    const onData = (chunk) => {
      if (settled) return;
      text += String(chunk);
      const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!match) return;
      settled = true;
      clearTimeout(timer);
      resolve({ child, ws: match[1], userDataDir });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", fail);
    child.on("exit", (code) => fail(new Error(`Chrome exited ${code} before the debug port opened`)));
  });
}

async function launchChrome() {
  try {
    return await startChrome();
  } catch {
    return await startChrome();
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = httpGet(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
    req.on("error", reject);
  });
}

function openCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let next = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("debug socket failed")));
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || "cdp error"));
    else resolve(msg.result || {});
  });
  return {
    ready,
    async send(method, params = {}) {
      await ready;
      const id = ++next;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      ws.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      try { ws.close(); } catch { /* already closed */ }
    },
  };
}

function serveFixture(html, script) {
  const server = createServer((req, res) => {
    const path = String(req.url || "/").split("?")[0];
    if (path === "/modules/route-a11y.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(script);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitForTarget(port, targetId) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const list = await getJson(`http://127.0.0.1:${port}/json/list`);
      const hit = list.find((item) => item.id === targetId && item.webSocketDebuggerUrl);
      if (hit) return hit;
    } catch {
      // The debug port is up. The page target can lag the browser socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("page target did not appear");
}

async function pageEval(session, fn) {
  const result = await session.send("Runtime.evaluate", {
    expression: `(${fn.toString()})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(detail || "page eval failed");
  }
  return result.result?.value;
}

async function pageEvalSource(session, source) {
  const result = await session.send("Runtime.evaluate", {
    expression: `(${source})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(detail || "page eval failed");
  }
  return result.result?.value;
}

async function waitForPage(session, source, timeoutMs, label) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await pageEvalSource(session, source);
      if (last?.ok) return last;
    } catch (err) {
      last = { ok: false, error: String(err.message || err) };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: ${JSON.stringify(last)}`);
}

async function waitForStable(session, source, timeoutMs, stableMs, label, minMs = 0) {
  const started = Date.now();
  let since = 0;
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await pageEvalSource(session, source);
    } catch (err) {
      last = { ok: false, error: String(err.message || err) };
    }
    if (last?.ok) {
      if (!since) since = Date.now();
      if (Date.now() - since >= stableMs && Date.now() - started >= minMs) return last;
    } else {
      since = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: ${JSON.stringify(last)}`);
}

async function waitForA11y(session) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      if (await pageEval(session, () => Boolean(window.__a11y))) return;
    } catch {
      // Navigation can drop the execution context once.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("route module did not load");
}

test("chrome covers focus, restore, title, aria-current, escape, and the live region", { timeout: 90000 }, async (t) => {
  if (typeof WebSocket === "undefined") {
    t.skip("WebSocket unavailable");
    return;
  }
  let chromeProc = null;
  let chromeDataDir = "";
  let server = null;
  let browserSocket = null;
  let pageSocket = null;
  try {
    let started;
    try {
      started = await launchChrome();
    } catch (err) {
      t.skip(`Chrome launch failed: ${err.message}`);
      return;
    }
    chromeProc = started.child;
    chromeDataDir = started.userDataDir;
    const html = `<!doctype html>
      <html><head><title>Home</title></head>
      <body style="height:4000px;margin:0">
        <div id="route-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
        <button id="open-player" type="button">Jahmyr Gibbs</button>
        <main id="workspace" tabindex="-1">
          <button id="players-tab" type="button" data-page="players">Players</button>
          <button id="trades-tab" type="button" data-page="trades">Trade</button>
          <section id="trades-page"><h2 id="trade-heading">You give / You get</h2></section>
          <article class="ranks-card"><h2 id="player-heading">Jahmyr Gibbs</h2></article>
        </main>
        <script type="module">
          import * as a11y from "/modules/route-a11y.js";
          window.__a11y = a11y;
          window.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            const action = a11y.applyEscape({
              overlay: "player",
              pushed: true,
              back() { history.back(); },
              close() {},
            });
            if (action !== "none") event.preventDefault();
          });
        </script>
      </body></html>`;
    const script = read("../docs/modules/route-a11y.js");
    server = await serveFixture(html, script);
    const pageUrl = `http://127.0.0.1:${server.address().port}/`;
    browserSocket = openCdp(started.ws);
    const created = await browserSocket.send("Target.createTarget", { url: pageUrl });
    const target = await waitForTarget(new URL(started.ws).port, created.targetId);
    pageSocket = openCdp(target.webSocketDebuggerUrl);
    await pageSocket.send("Runtime.enable");
    await pageSocket.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await waitForA11y(pageSocket);

    const focus = await pageEval(pageSocket, () => {
      window.scrollTo(0, 900);
      const before = window.scrollY;
      const heading = document.querySelector("#trade-heading");
      const orig = heading.focus.bind(heading);
      let opts = null;
      heading.focus = (options) => {
        opts = options || {};
        return orig(options);
      };
      const focused = window.__a11y.focusViewHeading(document.querySelector("#trades-page"));
      return {
        before,
        after: window.scrollY,
        id: focused?.id || "",
        tabindex: focused?.getAttribute("tabindex"),
        preventScroll: Boolean(opts?.preventScroll),
        active: document.activeElement?.id || "",
      };
    });
    assert.equal(focus.id, "trade-heading");
    assert.equal(focus.tabindex, "-1");
    assert.equal(focus.preventScroll, true);
    assert.equal(focus.after, focus.before);
    assert.ok(focus.before > 0);
    assert.equal(focus.active, "trade-heading");

    const restored = await pageEval(pageSocket, () => {
      const button = document.getElementById("open-player");
      button.focus({ preventScroll: true });
      const memory = window.__a11y.createRouteFocusMemory();
      memory.push(button);
      const step = memory.pop(0);
      button.remove();
      const landed = window.__a11y.restoreTriggerFocus(document, step.trigger);
      return landed?.id || "";
    });
    assert.equal(restored, "workspace");

    const titled = await pageEval(pageSocket, () => ({
      player: window.__a11y.routeDocumentTitle({ playerName: "Jahmyr Gibbs" }),
      tab: window.__a11y.routeDocumentTitle({ tab: "trades" }),
    }));
    assert.equal(titled.player, "Jahmyr Gibbs · Dynasty Ticker");
    assert.equal(titled.tab, "Trade · Dynasty Ticker");

    const current = await pageEval(pageSocket, () => {
      window.__a11y.syncAriaCurrent(
        document.querySelectorAll("[data-page]"),
        (node) => node.dataset.page === "trades",
      );
      return {
        players: document.getElementById("players-tab").getAttribute("aria-current"),
        trades: document.getElementById("trades-tab").getAttribute("aria-current"),
      };
    });
    assert.equal(current.players, null);
    assert.equal(current.trades, "page");

    await pageEval(pageSocket, () => {
      history.pushState({ idx: 0 }, "", "/players");
      history.pushState({ idx: 1, overlay: "player", pushed: true }, "", "/player/9221");
    });
    await pageSocket.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await pageSocket.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    let path = "";
    const escapeStarted = Date.now();
    while (Date.now() - escapeStarted < 3000) {
      path = await pageEval(pageSocket, () => location.pathname);
      if (path === "/players") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(path, "/players");

    const live = await pageEval(pageSocket, () => {
      window.__a11y.announceRoute(document, "Jahmyr Gibbs");
      window.__a11y.announceRoute(document, "Trade");
      const nodes = document.querySelectorAll("#route-announcer");
      return {
        count: nodes.length,
        polite: nodes[0]?.getAttribute("aria-live"),
        text: nodes[0]?.textContent || "",
      };
    });
    assert.equal(live.count, 1);
    assert.equal(live.polite, "polite");
    assert.equal(live.text, "Trade");
  } finally {
    pageSocket?.close();
    browserSocket?.close();
    server?.close();
    if (chromeProc && chromeProc.exitCode == null) {
      try { process.kill(-chromeProc.pid, "SIGKILL"); }
      catch { chromeProc.kill("SIGKILL"); }
      await new Promise((resolve) => {
        if (chromeProc.exitCode != null || chromeProc.signalCode) resolve();
        else {
          chromeProc.once("exit", resolve);
          setTimeout(resolve, 1000);
        }
      });
    }
    if (chromeDataDir) {
      try { rmSync(chromeDataDir, { recursive: true, force: true, maxRetries: 3 }); }
      catch { /* A leftover profile must not fail the assertions. */ }
    }
  }
});

const PLAYER_FOCUS = `() => {
  const heading = document.querySelector(".ranks-card h2, .player-week-sheet h2");
  const active = document.activeElement;
  return {
    ok: Boolean(heading && active === heading && heading.tagName === "H2"),
    active: active ? active.tagName : "",
    text: String((active && active.textContent) || "").replace(/\\s+/g, " ").trim().slice(0, 80),
    title: document.title,
  };
}`;

function roomFocusSource(room) {
  const panel = `[data-room-panel="${room}"]`;
  return `() => {
    const panel = document.querySelector(${JSON.stringify(panel)});
    const active = document.activeElement;
    const ok = Boolean(active && active.tagName === "H2" && panel && panel.contains(active));
    return {
      ok,
      active: active ? active.tagName : "",
      text: String((active && active.textContent) || "").replace(/\\s+/g, " ").trim().slice(0, 80),
      title: document.title,
    };
  }`;
}

function clickRoomSource(room) {
  return `() => {
    const room = ${JSON.stringify(room)};
    const phone = window.matchMedia("(max-width: 700px)").matches;
    if (phone) {
      const toggle = document.querySelector("#mobile-rail-toggle");
      if (toggle && !document.body.classList.contains("rail-open")) toggle.click();
      const page = document.querySelector('[data-phone-page="league"]');
      if (page && page.getAttribute("aria-expanded") !== "true") page.click();
      const button = document.querySelector('[data-phone-room="' + room + '"]');
      if (!button) return { ok: false, mode: "phone" };
      button.click();
      return { ok: true, mode: "phone" };
    }
    const button = document.querySelector('#room-nav [data-room="' + room + '"]');
    if (!button) return { ok: false, mode: "desk" };
    button.click();
    return { ok: true, mode: "desk" };
  }`;
}

test("cold player and league rooms focus headings at 390 and 1280", { timeout: 420000 }, async (t) => {
  if (typeof WebSocket === "undefined") {
    t.skip("WebSocket unavailable");
    return;
  }
  let chromeProc = null;
  let chromeDataDir = "";
  let server = null;
  let browserSocket = null;
  let pageSocket = null;
  try {
    let started;
    try {
      started = await launchChrome();
    } catch (err) {
      t.skip(`Chrome launch failed: ${err.message}`);
      return;
    }
    chromeProc = started.child;
    chromeDataDir = started.userDataDir;
    server = createSiteServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browserSocket = openCdp(started.ws);
    const created = await browserSocket.send("Target.createTarget", { url: "about:blank" });
    const target = await waitForTarget(new URL(started.ws).port, created.targetId);
    pageSocket = openCdp(target.webSocketDebuggerUrl);
    await pageSocket.send("Runtime.enable");
    await pageSocket.send("Page.enable");

    for (const width of [390, 1280]) {
      await pageSocket.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: width <= 700 ? 844 : 900,
        deviceScaleFactor: 1,
        mobile: width <= 700,
      });
      await pageSocket.send("Page.navigate", { url: `${origin}/player/9221` });
      const layout = await waitForPage(pageSocket, `() => ({
        ok: window.innerWidth === ${width},
        width: window.innerWidth,
        phone: window.matchMedia("(max-width: 700px)").matches,
      })`, 15000, `viewport ${width}`);
      assert.equal(layout.width, width);
      assert.equal(layout.phone, width <= 700);
      const player = await waitForStable(pageSocket, PLAYER_FOCUS, 30000, 1500, `player ${width}`, 8000);
      assert.equal(player.active, "H2");
      assert.match(player.text, /Gibbs/i);

      await pageSocket.send("Page.navigate", { url: `${origin}/?sample=1` });
      await waitForPage(pageSocket, `() => ({
        ok: document.body.classList.contains("league-loaded") && window.innerWidth === ${width},
      })`, 90000, `sample league ${width}`);
      for (const room of ["board", "scores", "activity", "history"]) {
        const clicked = await pageEvalSource(pageSocket, clickRoomSource(room));
        assert.equal(clicked.ok, true, `${room} click at ${width}`);
        assert.equal(clicked.mode, width <= 700 ? "phone" : "desk");
        const focused = await waitForStable(pageSocket, roomFocusSource(room), 40000, 1500, `${room} ${width}`, 4000);
        assert.equal(focused.active, "H2");
        if (room === "scores") assert.match(focused.title, /This week/);
      }
    }
  } finally {
    pageSocket?.close();
    browserSocket?.close();
    server?.close();
    if (chromeProc && chromeProc.exitCode == null) {
      try { process.kill(-chromeProc.pid, "SIGKILL"); }
      catch { chromeProc.kill("SIGKILL"); }
      await new Promise((resolve) => {
        if (chromeProc.exitCode != null || chromeProc.signalCode) resolve();
        else {
          chromeProc.once("exit", resolve);
          setTimeout(resolve, 1000);
        }
      });
    }
    if (chromeDataDir) {
      try { rmSync(chromeDataDir, { recursive: true, force: true, maxRetries: 3 }); }
      catch { /* A leftover profile must not fail the assertions. */ }
    }
  }
});

test("trade tab order skips the body and the workspace", { timeout: 60000 }, async (t) => {
  if (typeof WebSocket === "undefined") {
    t.skip("WebSocket unavailable");
    return;
  }
  let chromeProc = null;
  let chromeDataDir = "";
  let server = null;
  let browserSocket = null;
  let pageSocket = null;
  try {
    let started;
    try {
      started = await launchChrome();
    } catch (err) {
      t.skip(`Chrome launch failed: ${err.message}`);
      return;
    }
    chromeProc = started.child;
    chromeDataDir = started.userDataDir;
    server = createSiteServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browserSocket = openCdp(started.ws);
    const created = await browserSocket.send("Target.createTarget", { url: `${origin}/trade` });
    const target = await waitForTarget(new URL(started.ws).port, created.targetId);
    pageSocket = openCdp(target.webSocketDebuggerUrl);
    await pageSocket.send("Runtime.enable");
    await pageSocket.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    try {
      await pageSocket.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    } catch {
      // Older Chrome still reports sequential focus without this.
    }
    await waitForPage(pageSocket, `() => ({
      ok: Boolean(document.querySelector("#trades-tab")),
    })`, 15000, "trade shell");
    await pageEval(pageSocket, () => {
      window.__stops = [];
      document.addEventListener("focusin", (event) => {
        const el = event.target;
        window.__stops.push(el === document.body ? "BODY" : (el.id || el.tagName));
      });
    });
    for (let i = 0; i < 14; i += 1) {
      await pageSocket.send("Input.dispatchKeyEvent", {
        type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
      });
      await pageSocket.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const stops = await pageEval(pageSocket, () => window.__stops);
    assert.ok(stops.includes("trades-tab"), JSON.stringify(stops));
    assert.equal(stops.includes("BODY"), false, JSON.stringify(stops));
    assert.equal(stops.includes("workspace"), false, JSON.stringify(stops));
    await pageEval(pageSocket, () => document.querySelector(".skip-link").focus());
    await pageSocket.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await pageSocket.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    const skipped = await waitForPage(pageSocket, `() => {
      const el = document.activeElement;
      return {
        ok: el?.id === "workspace" && location.pathname === "/trade",
        id: el?.id || el?.tagName || "",
        tab: el?.getAttribute?.("tabindex") || "",
        path: location.pathname,
      };
    }`, 3000, "skip link");
    assert.equal(skipped.id, "workspace");
    assert.equal(skipped.path, "/trade");
  } finally {
    pageSocket?.close();
    browserSocket?.close();
    server?.close();
    if (chromeProc && chromeProc.exitCode == null) {
      try { process.kill(-chromeProc.pid, "SIGKILL"); }
      catch { chromeProc.kill("SIGKILL"); }
      await new Promise((resolve) => {
        if (chromeProc.exitCode != null || chromeProc.signalCode) resolve();
        else {
          chromeProc.once("exit", resolve);
          setTimeout(resolve, 1000);
        }
      });
    }
    if (chromeDataDir) {
      try { rmSync(chromeDataDir, { recursive: true, force: true, maxRetries: 3 }); }
      catch { /* A leftover profile must not fail the assertions. */ }
    }
  }
});
