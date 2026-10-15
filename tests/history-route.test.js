import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE,
  HOME_PLACE,
  ROUTES,
  assetIdFromRoute,
  buildHistoryPlace,
  decideHistoryWrite,
  historyPlaceKey,
  isPlayerRouteId,
  matchRoute,
  pathForPlace,
  playerIdFromPathname,
  playerPathname,
  routeIdFromAsset,
  sameHistoryPlace,
  selectionFromLocation,
  urlPath,
} from "../docs/modules/history-route.js";

const root = dirname(fileURLToPath(import.meta.url));

test("player urls are /player/<id> and reject junk", () => {
  assert.equal(routeIdFromAsset("player:9221"), "9221");
  assert.equal(playerPathname("9221"), "/player/9221");
  assert.equal(playerIdFromPathname("/player/9221"), "9221");
  assert.equal(playerIdFromPathname("/player/9221/"), "9221");
  assert.equal(assetIdFromRoute("9221"), "player:9221");
  assert.equal(playerPathname("pick:2027:r1:early"), "/player/pick%3A2027%3Ar1%3Aearly");
  assert.equal(playerIdFromPathname("/player/pick%3A2027%3Ar1%3Aearly"), "pick:2027:r1:early");
  assert.equal(assetIdFromRoute("pick:2027:r1:early"), "pick:2027:r1:early");
  for (const bad of ["", "../", "..", "a/b", "<script>", "javascript:alert(1)", "player:<img>", "9221/extra"]) {
    assert.equal(isPlayerRouteId(bad), false, bad);
    assert.equal(playerPathname(bad), "");
    assert.equal(playerIdFromPathname(`/player/${bad}`), "");
  }
  assert.equal(playerIdFromPathname("/api/rather-vote"), "");
  assert.equal(playerIdFromPathname("/"), "");
});

test("same view does not push a second history entry", () => {
  const list = buildHistoryPlace({ tab: "players", view: "ranks", scrollY: 10 });
  const scrolled = buildHistoryPlace({ tab: "players", view: "ranks", scrollY: 400 });
  const gibbs = buildHistoryPlace({ tab: "players", view: "ranks", playerId: "9221", overlay: "player" });
  const trades = buildHistoryPlace({ tab: "trades", view: "calculator" });
  const help = buildHistoryPlace({ tab: "league", view: "team", playerId: "9221", overlay: "help" });
  assert.equal(sameHistoryPlace(list, scrolled), true);
  assert.equal(historyPlaceKey(list), "players|ranks||||");
  assert.equal(decideHistoryWrite({ current: list, next: scrolled, mode: "push" }), "replace");
  assert.equal(decideHistoryWrite({ current: list, next: gibbs, mode: "push" }), "push");
  assert.equal(decideHistoryWrite({ current: gibbs, next: trades, mode: "push" }), "push");
  assert.equal(decideHistoryWrite({ current: gibbs, next: help, mode: "push" }), "push");
  assert.equal(decideHistoryWrite({ current: list, next: trades, mode: "silent" }), "silent");
  assert.equal(decideHistoryWrite({ current: list, next: trades, mode: "replace" }), "replace");
});

test("popstate restores the player or the previous view", () => {
  const open = selectionFromLocation({
    pathname: "/player/9221",
    historyState: { tab: "players", view: "ranks", overlay: "player", playerId: "9221" },
  });
  assert.equal(open.rankAssetId, "player:9221");
  assert.equal(open.sheetPlayerId, "");
  assert.equal(open.helpOpen, false);

  const back = selectionFromLocation({
    pathname: "/",
    historyState: { tab: "players", view: "ranks", overlay: "", playerId: "" },
  });
  assert.equal(back.rankAssetId, "");
  assert.equal(back.playerOpen, false);

  const cold = selectionFromLocation({ pathname: "/player/9221", historyState: null });
  assert.equal(cold.rankAssetId, "player:9221");

  const sheet = selectionFromLocation({
    pathname: "/player/9221",
    historyState: { tab: "league", view: "team", overlay: "help", playerId: "9221" },
  });
  assert.equal(sheet.sheetPlayerId, "9221");
  assert.equal(sheet.helpOpen, true);
  assert.equal(sheet.rankAssetId, "");

  const legacy = selectionFromLocation({
    pathname: "/",
    historyState: null,
    parsedAsset: "player:7",
  });
  assert.equal(legacy.rankAssetId, "player:7");
});

test("route table is one line per section and every url uses BASE", () => {
  assert.equal(typeof BASE, "string");
  assert.deepEqual(HOME_PLACE, { page: "players", room: "ranks" });
  assert.deepEqual(ROUTES.map((row) => row.path), ["trade", "team", "history", "plan"]);
  for (const row of ROUTES) {
    assert.deepEqual(Object.keys(row), ["path", "page", "room"]);
    const hit = matchRoute(urlPath(row.path));
    assert.equal(hit.path, row.path);
    assert.equal(playerIdFromPathname(urlPath(row.path)), "");
    if (row.page) {
      assert.equal(hit.home, false);
      assert.equal(hit.page, row.page);
      assert.equal(hit.room, row.room);
      assert.equal(pathForPlace({ page: row.page, room: row.room }), urlPath(row.path));
    } else {
      assert.equal(hit.home, true);
      assert.equal(hit.page, HOME_PLACE.page);
      assert.equal(hit.room, HOME_PLACE.room);
      assert.equal(pathForPlace(HOME_PLACE), urlPath());
    }
  }
  assert.deepEqual(matchRoute("/trade/"), { path: "trade", page: "trades", room: "calculator", playerId: "", home: false });
  assert.deepEqual(matchRoute("/team"), { path: "team", page: "league", room: "team", playerId: "", home: false });
  assert.deepEqual(matchRoute("/history"), { path: "history", page: "league", room: "history", playerId: "", home: false });
  assert.equal(matchRoute("/plan").home, true);
  assert.equal(pathForPlace({ page: "trades", room: "find" }), urlPath());
  assert.equal(pathForPlace({ page: "league", room: "scores" }), urlPath());
  assert.equal(pathForPlace({ page: "players", room: "ranks", playerId: "9221" }), urlPath("player", "9221"));
  assert.equal(playerPathname("9221"), urlPath("player", "9221"));
  assert.equal(matchRoute("/player/9221").playerId, "9221");
  assert.equal(matchRoute("/player/9221").page, "players");
  for (const skipped of ["/api/rather-vote", "/api/searched-user", "/styles.css", "/data/player_values.json", "/ui/landing.html", "/players", "/trade/extra", "/player", "/"]) {
    assert.equal(matchRoute(skipped), null, skipped);
  }
});

test("the desk pushes player routes and restores them on popstate", () => {
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  assert.match(app, /addEventListener\("popstate"/);
  assert.match(app, /pathForPlace/);
  assert.match(app, /matchRoute/);
  assert.match(app, /closeHistoryOverlay\("player"\)/);
  assert.match(app, /closeHistoryOverlay\("help"\)/);
  assert.match(app, /closeHistoryOverlay\("rail"\)/);
  assert.doesNotMatch(app, /onclick=/);
});

test("section rewrites sit behind /api and do not shadow files", () => {
  const toml = readFileSync(join(root, "../netlify.toml"), "utf8");
  const rather = toml.indexOf('from = "/api/rather-vote"');
  const searched = toml.indexOf('from = "/api/searched-user"');
  const player = toml.indexOf('from = "/player/*"');
  const catchAll = toml.indexOf('from = "/*"');
  assert.ok(rather >= 0 && searched >= 0 && player >= 0 && catchAll >= 0);
  assert.ok(rather < player);
  assert.ok(searched < player);
  assert.ok(player < catchAll);
  const rule = toml.slice(player, catchAll);
  assert.match(rule, /to = "\/index\.html"/);
  assert.match(rule, /status = 200/);
  assert.match(toml, /script-src 'self'/);
  assert.doesNotMatch(toml, /script-src 'unsafe-inline'/);
  const redirects = readFileSync(join(root, "../docs/_redirects"), "utf8");
  const apiAt = redirects.indexOf("/api/searched-user");
  const playerAt = redirects.indexOf("/player/*");
  assert.ok(apiAt >= 0 && playerAt > apiAt);
  assert.match(redirects, /\/player\/\*\s+\/index\.html\s+200/);
  for (const section of ROUTES.map((row) => row.path)) {
    const from = toml.indexOf(`from = "/${section}"`);
    assert.ok(from > searched, section);
    assert.ok(from < player, section);
    const block = toml.slice(from, from + 80);
    assert.match(block, /to = "\/index\.html"/);
    assert.match(block, /status = 200/);
    assert.doesNotMatch(toml, new RegExp(`from = "/${section}/\\*"`));
    const lineAt = redirects.indexOf(`\n/${section}  /index.html  200`);
    assert.ok(lineAt > apiAt && lineAt < playerAt, section);
  }
  assert.doesNotMatch(toml, /from = "\/data\/\*"/);
  assert.doesNotMatch(toml, /from = "\/styles\.css"/);
});
