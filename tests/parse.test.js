import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLeagueId,
  normalizeUsername,
  classifyLeagueInput,
  uniqueSeasons,
  sortUserLeagues,
  parseShareParams,
  buildShareUrl,
  bootSearchFieldValues,
  resolveDeskPlace,
  normalizeDeskTab,
  normalizeRoom,
  defaultRoomFor,
  isRoomOf,
} from "../docs/modules/parse.js";

test("parseLeagueId reads snowflake, path, and embedded URL", () => {
  assert.equal(parseLeagueId("1315165104303513600"), "1315165104303513600");
  assert.equal(parseLeagueId("https://sleeper.app/leagues/1315165104303513600"), "1315165104303513600");
  assert.equal(parseLeagueId("  https://sleeper.app/leagues/1315165104303513600/matchup  "), "1315165104303513600");
  assert.equal(parseLeagueId(""), "");
  assert.equal(parseLeagueId("nikoskiouris"), "");
});

test("classifyLeagueInput prefers username unless the text is clearly a league", () => {
  assert.equal(classifyLeagueInput("").kind, "empty");
  assert.equal(classifyLeagueInput("NikoSkiouris").kind, "username");
  assert.equal(classifyLeagueInput("@niko").username, "niko");
  assert.equal(classifyLeagueInput("https://sleeper.app/u/NikoSkiouris").username, "NikoSkiouris");
  assert.equal(classifyLeagueInput("1315165104303513600").kind, "league");
  assert.equal(classifyLeagueInput("https://sleeper.app/leagues/1315165104303513600").kind, "league");
});

test("uniqueSeasons walks backward from the NFL season", () => {
  assert.deepEqual(uniqueSeasons(2026, 1), ["2026", "2025"]);
});

test("sortUserLeagues puts the current in-season league first", () => {
  const sorted = sortUserLeagues([
    { name: "Old", season: "2025", status: "complete", total_rosters: 12 },
    { name: "Zeta", season: "2026", status: "in_season", total_rosters: 8 },
    { name: "Alpha", season: "2026", status: "in_season", total_rosters: 12 },
  ], "2026");
  assert.equal(sorted[0].name, "Alpha");
  assert.equal(sorted[1].name, "Zeta");
  assert.equal(sorted[2].name, "Old");
});

test("boot search fields stay blank unless the URL has a league", () => {
  assert.deepEqual(bootSearchFieldValues(), { username: "", leagueId: "" });
  assert.deepEqual(bootSearchFieldValues({ leagueFromUrl: "" }), { username: "", leagueId: "" });
  assert.deepEqual(bootSearchFieldValues({ leagueFromUrl: "  1315165104303513600  " }), {
    username: "",
    leagueId: "1315165104303513600",
  });
});

test("share params map old recap/home tabs onto league", () => {
  const url = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: "1315165104303513600",
    meRosterId: 3,
    tab: "recap",
    week: 2,
    tone: "roast",
  });
  assert.doesNotMatch(url, /tab=/);
  assert.match(url, /view=scores/);
  assert.match(url, /week=2/);
  assert.match(url, /tone=roast/);
  const parsed = parseShareParams(url.split("?")[1]);
  assert.equal(parsed.tab, "league");
  assert.equal(parsed.view, "scores");
  assert.equal(parsed.week, 2);
  assert.equal(parsed.tone, "roast");
  assert.equal(parsed.meRosterId, 3);
  assert.equal(parseShareParams("league=1").tab, "");
  assert.equal(parseShareParams("league=1").view, "start");
  assert.equal(parseShareParams("league=1&tab=recap").tab, "league");
  assert.equal(parseShareParams("league=1&tab=recap").view, "scores");
  assert.equal(parseShareParams("league=1&tab=league&view=now").view, "scores");
  assert.equal(parseShareParams("league=1&tab=home").tab, "league");
  assert.equal(parseShareParams("league=1&tab=home").view, "start");
  assert.equal(parseShareParams("league=1&tab=team").tab, "teams");
  assert.equal(parseShareParams("league=1&tab=teams").view, "roster");
  assert.equal(parseShareParams("league=1&tab=trader").tab, "trades");
  assert.equal(parseShareParams("league=1&tab=trader").view, "value");
  assert.equal(parseShareParams("league=1&view=start").view, "start");
});

test("share params move old trade rooms to their new pages", () => {
  const passportUrl = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: "1315165104303513600",
    tab: "trader",
    view: "passport",
  });
  assert.match(passportUrl, /tab=teams/);
  assert.match(passportUrl, /view=passports/);
  assert.equal(parseShareParams(passportUrl.split("?")[1]).view, "passports");

  const logUrl = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: "1",
    tab: "trader",
    view: "history",
  });
  assert.match(logUrl, /tab=trades/);
  assert.match(logUrl, /view=log/);

  assert.equal(parseShareParams("league=1&tab=calculator").tab, "trades");
  assert.equal(parseShareParams("league=1&tab=calculator").view, "calculator");
  assert.equal(parseShareParams("league=1&tab=generator").view, "lab");
  assert.equal(parseShareParams("league=1&tab=trades&view=shop").view, "lab");
  assert.equal(parseShareParams("league=1&tab=trades&view=match").view, "match");
  assert.equal(parseShareParams("league=1&view=tradematch").view, "match");
  assert.equal(parseShareParams("league=1&tab=awards").view, "awards");
});

test("share params move hall, analytics, and records to league history", () => {
  assert.deepEqual(resolveDeskPlace({ tab: "history" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ tab: "analytics" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ tab: "league", view: "hall" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ view: "league-hall" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ tab: "history", view: "history" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ tab: "trades", view: "history" }), { page: "trades", room: "log" });
  assert.deepEqual(resolveDeskPlace({ view: "records" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ view: "archive" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ view: "titles" }), { page: "league", room: "history" });
  assert.deepEqual(resolveDeskPlace({ tab: "nonsense", view: "nonsense" }), { page: "league", room: "start" });
  assert.deepEqual(resolveDeskPlace({ tab: "teams", view: "hall" }), { page: "league", room: "history" });
  assert.equal(parseShareParams("league=1&tab=history").tab, "league");
  assert.equal(parseShareParams("league=1&tab=history").view, "history");
  assert.equal(parseShareParams("league=1&view=hall").tab, "league");
  assert.equal(parseShareParams("league=1&view=hall").view, "history");

  const url = buildShareUrl({ origin: "", pathname: "/", leagueId: "1", tab: "history", view: "records" });
  assert.equal(url, "/?league=1&view=history");
  assert.equal(buildShareUrl({ origin: "", pathname: "/", leagueId: "1", tab: "history", view: "hall" }), "/?league=1&view=history");
});

test("desk place helpers know pages and rooms", () => {
  assert.equal(normalizeDeskTab("#trader"), "trades");
  assert.equal(normalizeDeskTab("Passport"), "teams");
  assert.equal(normalizeDeskTab("garbage"), "");
  assert.equal(normalizeRoom("trades", "calc"), "calculator");
  assert.equal(normalizeRoom("trades", "tradematch"), "match");
  assert.equal(normalizeRoom("trades", "hall"), "");
  assert.equal(normalizeRoom("league", "home"), "start");
  assert.equal(defaultRoomFor("trades"), "value");
  assert.equal(defaultRoomFor("league"), "start");
  assert.equal(defaultRoomFor("nope"), "start");
  assert.equal(isRoomOf("teams", "loyalty"), true);
  assert.equal(isRoomOf("teams", "mock"), true);
  assert.equal(isRoomOf("teams", "call"), true);
  assert.equal(isRoomOf("teams", "log"), false);
  assert.deepEqual(resolveDeskPlace({ view: "tank" }), { page: "teams", room: "call" });
  assert.deepEqual(resolveDeskPlace({ view: "rookies" }), { page: "teams", room: "mock" });
  assert.equal(normalizeRoom("teams", "window"), "call");
  assert.equal(normalizeRoom("trades", "partners"), "match");
  assert.deepEqual(resolveDeskPlace({ view: "start" }), { page: "league", room: "start" });
  assert.deepEqual(resolveDeskPlace({ tab: "trades" }), { page: "trades", room: "value" });
  assert.deepEqual(resolveDeskPlace({ tab: "trades", view: "calculator" }), { page: "trades", room: "calculator" });
  assert.deepEqual(resolveDeskPlace({ view: "ktc" }), { page: "trades", room: "value" });
  assert.equal(isRoomOf("league", "start"), true);
  assert.equal(isRoomOf("trades", "value"), true);
});
