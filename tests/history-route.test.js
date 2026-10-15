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
  backTarget,
  buildHistoryPlace,
  decideHistoryWrite,
  historyPlaceKey,
  isPlayerRouteId,
  isSpaPath,
  matchRoute,
  pathForPlace,
  playerIdFromPathname,
  playerPathname,
  playerSlug,
  resolveLocation,
  routeIdFromAsset,
  safeNext,
  sameHistoryPlace,
  selectionFromLocation,
  topOverlay,
  tradeHref,
  urlPath,
} from "../docs/modules/history-route.js";

const root = dirname(fileURLToPath(import.meta.url));

test("player urls are /player/<id>/<slug> and reject junk", () => {
  assert.equal(routeIdFromAsset("player:9221"), "9221");
  assert.equal(playerSlug("Jahmyr Gibbs"), "jahmyr-gibbs");
  assert.equal(playerPathname("9221"), "/player/9221");
  assert.equal(playerPathname("9221", "Jahmyr Gibbs"), "/player/9221/jahmyr-gibbs");
  assert.equal(playerIdFromPathname("/player/9221"), "9221");
  assert.equal(playerIdFromPathname("/player/9221/"), "9221");
  assert.equal(playerIdFromPathname("/player/9221/jahmyr-gibbs"), "9221");
  assert.equal(playerIdFromPathname("/player/9221/wrong-name"), "9221");
  assert.equal(assetIdFromRoute("9221"), "player:9221");
  assert.equal(playerPathname("0"), "");
  assert.equal(playerPathname("pick:2027:r1:early"), "");
  assert.equal(playerIdFromPathname("/player/pick%3A2027%3Ar1%3Aearly"), "");
  for (const bad of ["", "../", "..", "a/b", "<script>", "javascript:alert(1)", "player:<img>"]) {
    assert.equal(playerPathname(bad), "");
    assert.equal(playerIdFromPathname(`/player/${bad}`), "");
  }
  assert.equal(playerIdFromPathname("/api/rather-vote"), "");
  assert.equal(playerIdFromPathname("/"), "");
  assert.equal(isPlayerRouteId("9221"), true);
});

test("same view does not push a second history entry", () => {
  const list = buildHistoryPlace({ tab: "players", view: "ranks", scrollY: 10 });
  const scrolled = buildHistoryPlace({ tab: "players", view: "ranks", scrollY: 400 });
  const gibbs = buildHistoryPlace({ tab: "players", view: "ranks", playerId: "9221", overlay: "player" });
  const trades = buildHistoryPlace({ tab: "trades", view: "calculator" });
  const help = buildHistoryPlace({ tab: "league", view: "team", playerId: "9221", overlay: "help" });
  const home = buildHistoryPlace({ tab: "players", view: "ranks", landing: true });
  assert.equal(sameHistoryPlace(list, scrolled), true);
  assert.equal(historyPlaceKey(list), "players|ranks|||||");
  assert.equal(decideHistoryWrite({ current: home, next: list, mode: "push" }), "push");
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

test("route table maps the approved paths and unknown routes go home", () => {
  assert.equal(typeof BASE, "string");
  assert.deepEqual(HOME_PLACE, { page: "players", room: "ranks" });
  assert.deepEqual(ROUTES.map((row) => row.pattern), [
    "/",
    "/players",
    "/trade",
    "/connect",
    "/l/:leagueId",
    "/l/:leagueId/team",
    "/l/:leagueId/ideas",
    "/l/:leagueId/league",
    "/player/:sleeperId/:slug?",
  ]);
  const home = matchRoute("/");
  assert.equal(home.name, "home");
  assert.equal(home.page, "players");
  const players = matchRoute("/players");
  assert.equal(players.name, "players");
  assert.equal(players.page, "players");
  assert.equal(players.room, "ranks");
  const trade = matchRoute("/trade", "?give=player:9221&get=pick:2027:r1:early");
  assert.equal(trade.name, "trade");
  assert.equal(trade.page, "trades");
  assert.equal(trade.room, "calculator");
  assert.deepEqual(trade.give, ["player:9221"]);
  assert.deepEqual(trade.get, ["pick:2027:r1:early"]);
  assert.equal(tradeHref(["player:9221"], ["pick:2027:r1:early"], "1360686137898700800"), "/trade?give=player%3A9221&get=pick%3A2027%3Ar1%3Aearly&league=1360686137898700800");
  const league = matchRoute("/l/1360686137898700800");
  assert.equal(league.name, "league");
  assert.equal(league.page, "league");
  assert.equal(league.room, "team");
  assert.equal(matchRoute("/l/1360686137898700800/team").name, "team");
  assert.equal(matchRoute("/l/1360686137898700800/ideas").room, "find");
  assert.equal(matchRoute("/l/1360686137898700800/ideas").page, "trades");
  assert.equal(matchRoute("/l/1360686137898700800/league").room, "board");
  const player = matchRoute("/player/9221/jahmyr-gibbs");
  assert.equal(player.name, "player");
  assert.equal(player.playerId, "9221");
  assert.equal(player.slug, "jahmyr-gibbs");
  const connect = matchRoute("/connect", "?next=/players");
  assert.equal(connect.name, "connect");
  assert.equal(connect.next, "/players");
  assert.equal(safeNext("https://evil.example/players"), "");
  assert.equal(safeNext("//evil.example/players"), "");
  assert.equal(resolveLocation("/nope").unknown, true);
  assert.equal(resolveLocation("/nope").name, "home");
  assert.equal(resolveLocation("/l/not-a-league").unknown, true);
  assert.equal(resolveLocation("/?ranks=1").name, "players");
  assert.equal(resolveLocation("/?ranks=1").legacy, "ranks");
  assert.equal(resolveLocation("/", "?asset=player:9221").name, "player");
  assert.equal(resolveLocation("/", "?asset=player:9221").playerId, "9221");
  assert.equal(resolveLocation("/", "?asset=player:9221").legacy, "asset");
  assert.equal(resolveLocation("/?asset=9221").playerId, "9221");
  assert.equal(resolveLocation("/players", "?asset=player:4984").name, "player");
  assert.equal(resolveLocation("/l/1312284338377383936/team", "?asset=player:9221").name, "team");
  assert.equal(resolveLocation("/", "?asset=nope").name, "home");
  assert.equal(resolveLocation("/player/0").unknown, true);
  assert.equal(resolveLocation("/player/0").playerId, "");
  assert.equal(playerIdFromPathname("/player/0"), "");
  assert.equal(pathForPlace({ page: "players", room: "ranks", landing: true }), urlPath());
  assert.equal(pathForPlace({ page: "players", room: "ranks", landing: false }), urlPath("players"));
  assert.equal(pathForPlace({ page: "trades", room: "calculator" }), urlPath("trade"));
  assert.equal(pathForPlace({ page: "trades", room: "find", leagueId: "42" }), urlPath("l", "42", "ideas"));
  assert.equal(pathForPlace({ page: "league", room: "team", leagueId: "42" }), urlPath("l", "42", "team"));
  assert.equal(pathForPlace({ page: "league", room: "board", leagueId: "42" }), urlPath("l", "42", "league"));
  assert.equal(pathForPlace({ page: "league", room: "history", leagueId: "42" }), "");
  assert.equal(pathForPlace({ page: "players", room: "ranks", playerId: "9221", playerName: "Jahmyr Gibbs" }), "/player/9221/jahmyr-gibbs");
  assert.equal(pathForPlace({ page: "players", room: "ranks", playerId: "9221", playerName: "Jahmyr Gibbs", leagueId: "424242" }), "/player/9221/jahmyr-gibbs?league=424242");
  assert.equal(pathForPlace({ page: "players", room: "ranks", landing: false, leagueId: "424242" }), "/players?league=424242");
  assert.equal(pathForPlace({ page: "players", room: "ranks", landing: true, leagueId: "424242" }), "/");
  assert.equal(pathForPlace({ page: "league", room: "team", leagueId: "424242" }), "/l/424242/team");
  assert.equal(topOverlay({ rail: true, player: true }), "rail");
  assert.equal(topOverlay({ help: true, player: true }), "help");
  assert.equal(topOverlay({ player: true }), "player");
  assert.equal(backTarget({ pushed: false }), "home");
  assert.equal(backTarget({ pushed: true }), "history");
  for (const skipped of ["/api/rather-vote", "/styles.css", "/data/player_values.json", "/ui/landing.html"]) {
    assert.equal(isSpaPath(skipped), false, skipped);
    assert.equal(resolveLocation(skipped).unknown, true, skipped);
  }
  assert.equal(isSpaPath("/player/9221/jahmyr-gibbs"), true);
  assert.equal(isSpaPath("/l/42/team"), true);
  assert.equal(isSpaPath("/trade"), true);
  assert.equal(isSpaPath("/players"), true);
  assert.equal(isSpaPath("/connect"), true);
  assert.equal(isSpaPath("/nope"), false);
});

test("the desk pushes player routes and restores them on popstate", () => {
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  const ranks = readFileSync(join(root, "../docs/modules/ranks.js"), "utf8");
  assert.match(app, /addEventListener\("popstate"/);
  assert.match(app, /pathForPlace/);
  assert.match(app, /resolveLocation/);
  assert.match(app, /backTarget/);
  assert.match(app, /goSiteHome/);
  assert.match(app, /restoreHistoryScroll/);
  assert.match(app, /closeHistoryOverlay\("player"\)/);
  assert.match(app, /closeHistoryOverlay\("help"\)/);
  assert.match(app, /closeHistoryOverlay\("rail"\)/);
  assert.match(app, /topOverlay/);
  assert.match(app, /leagueLoadBlocksPlayer/);
  assert.match(app, /updateUrlState\(\{ mode: "replace" \}\)/);
  assert.match(ranks, /data-action="player-back"/);
  assert.doesNotMatch(app, /onclick=/);
});

test("spa fallback lists desk routes then a 404 catch-all, after the api rules", () => {
  const toml = readFileSync(join(root, "../netlify.toml"), "utf8");
  const rather = toml.indexOf('from = "/api/rather-vote"');
  const searched = toml.indexOf('from = "/api/searched-user"');
  const players = toml.indexOf('from = "/players"');
  const trade = toml.indexOf('from = "/trade"');
  const connect = toml.indexOf('from = "/connect"');
  const league = toml.indexOf('from = "/l/*"');
  const player = toml.indexOf('from = "/player/*"');
  const catchAll = toml.indexOf('from = "/*"');
  assert.ok(rather >= 0 && searched > rather);
  assert.ok(players > searched && trade > players && connect > trade);
  assert.ok(league > connect && player > league && catchAll > player);
  for (const from of ['"/players"', '"/trade"', '"/connect"', '"/l/*"', '"/player/*"']) {
    const at = toml.indexOf(`from = ${from}`);
    const rule = toml.slice(at, at + 90);
    assert.match(rule, /to = "\/index\.html"/);
    assert.match(rule, /status = 200/);
    assert.doesNotMatch(rule, /force/);
  }
  const fallback = toml.slice(catchAll, catchAll + 80);
  assert.match(fallback, /to = "\/404\.html"/);
  assert.match(fallback, /status = 404/);
  assert.doesNotMatch(fallback, /force/);
  assert.doesNotMatch(toml, /to = "\/index\.html"\s*\n\s*status = 200\s*\n\s*force = true/);
  assert.equal(toml.split("\n").filter((line) => line.trim() === 'from = "/*"').length, 1);
  assert.match(toml, /script-src 'self'/);
  assert.doesNotMatch(toml, /script-src 'unsafe-inline'/);
  const redirects = readFileSync(join(root, "../docs/_redirects"), "utf8");
  assert.match(redirects, /\/api\/searched-user\s+\/\.netlify\/functions\/searched-user\s+200!/);
  assert.match(redirects, /\/api\/rather-vote\s+\/\.netlify\/functions\/rather-vote\s+200!/);
  assert.doesNotMatch(redirects, /index\.html/);
  assert.doesNotMatch(redirects, /\/player/);
  assert.doesNotMatch(redirects, /\/l\//);
});
