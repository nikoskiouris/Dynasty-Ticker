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
import { SAMPLE_LEAGUE_ID } from "../docs/modules/constants.js";

test("parseLeagueId reads snowflake, path, and embedded URL", () => {
  assert.equal(parseLeagueId(SAMPLE_LEAGUE_ID), SAMPLE_LEAGUE_ID);
  assert.equal(parseLeagueId(`https://sleeper.app/leagues/${SAMPLE_LEAGUE_ID}`), SAMPLE_LEAGUE_ID);
  assert.equal(parseLeagueId(`  https://sleeper.app/leagues/${SAMPLE_LEAGUE_ID}/matchup  `), SAMPLE_LEAGUE_ID);
  assert.equal(parseLeagueId(""), "");
  assert.equal(parseLeagueId("nikoskiouris"), "");
});

test("classifyLeagueInput prefers username unless the text is clearly a league", () => {
  assert.equal(classifyLeagueInput("").kind, "empty");
  assert.equal(classifyLeagueInput("NikoSkiouris").kind, "username");
  assert.equal(classifyLeagueInput("@niko").username, "niko");
  assert.equal(classifyLeagueInput("https://sleeper.app/u/NikoSkiouris").username, "NikoSkiouris");
  assert.equal(classifyLeagueInput(SAMPLE_LEAGUE_ID).kind, "league");
  assert.equal(classifyLeagueInput(`https://sleeper.app/leagues/${SAMPLE_LEAGUE_ID}`).kind, "league");
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
  assert.deepEqual(bootSearchFieldValues({ leagueFromUrl: `  ${SAMPLE_LEAGUE_ID}  ` }), {
    username: "",
    leagueId: SAMPLE_LEAGUE_ID,
  });
});

test("share params map old recap/home tabs onto league", () => {
  const url = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: SAMPLE_LEAGUE_ID,
    meRosterId: 3,
    tab: "recap",
    week: 2,
    tone: "roast",
  });
  assert.match(url, /tab=league/);
  assert.doesNotMatch(url, /view=/);
  assert.match(url, /week=2/);
  assert.match(url, /tone=roast/);
  const parsed = parseShareParams(url.split("?")[1]);
  assert.equal(parsed.tab, "league");
  assert.equal(parsed.view, "team");
  assert.equal(parsed.week, 2);
  assert.equal(parsed.tone, "roast");
  assert.equal(parsed.meRosterId, 3);
  const sampleUrl = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: "99",
    sample: true,
    tab: "league",
  });
  assert.match(sampleUrl, /sample=1/);
  assert.equal(parseShareParams(sampleUrl.split("?")[1]).sample, true);
  assert.equal(parseShareParams(sampleUrl.split("?")[1]).leagueId, "99");
  assert.equal(parseShareParams("sample=1").sample, true);
  assert.equal(parseShareParams("sample=1").leagueId, SAMPLE_LEAGUE_ID);
  assert.equal(parseShareParams("sample=yes").leagueId, SAMPLE_LEAGUE_ID);
  assert.equal(parseShareParams("sample=1&league=99").leagueId, "99");
  assert.equal(parseShareParams("sample=1&league=99").sample, true);
  assert.equal(parseShareParams("league=1").sample, false);
  assert.equal(parseShareParams("league=1").tab, "");
  assert.equal(parseShareParams("league=1").view, "calculator");
  assert.equal(parseShareParams("league=1&tab=recap").tab, "league");
  assert.equal(parseShareParams("league=1&tab=recap").view, "team");
  assert.equal(parseShareParams("league=1&tab=league&view=now").view, "team");
  assert.equal(parseShareParams("league=1&tab=home").tab, "league");
  assert.equal(parseShareParams("league=1&tab=home").view, "team");
  assert.equal(parseShareParams("league=1&tab=team").tab, "league");
  assert.equal(parseShareParams("league=1&tab=teams").view, "team");
  assert.equal(parseShareParams("league=1&tab=trader").tab, "trades");
  assert.equal(parseShareParams("league=1&tab=trader").view, "calculator");
  assert.equal(parseShareParams("league=1&view=start").view, "team");
});

test("share params move old trade rooms to their new pages", () => {
  assert.equal(parseShareParams("league=1&tab=trader&view=passport").tab, "trades");
  assert.equal(parseShareParams("league=1&tab=trader&view=passport").view, "calculator");

  const logUrl = buildShareUrl({
    origin: "https://dynastyticker.com",
    pathname: "/",
    leagueId: "1",
    tab: "trader",
    view: "history",
  });
  assert.match(logUrl, /tab=league/);
  assert.doesNotMatch(logUrl, /view=/);

  assert.equal(parseShareParams("league=1&tab=calculator").tab, "trades");
  assert.equal(parseShareParams("league=1&tab=calculator").view, "calculator");
  assert.equal(parseShareParams("league=1&tab=generator").view, "find");
  assert.equal(parseShareParams("league=1&tab=trades&view=shop").view, "find");
  assert.equal(parseShareParams("league=1&tab=trades&view=match").view, "find");
  assert.equal(parseShareParams("league=1&view=tradematch").view, "find");
  assert.equal(parseShareParams("league=1&tab=awards").view, "team");
  assert.equal(parseShareParams("league=1&view=mock").view, "team");
});

test("old history, week, board, and activity links open My team", () => {
  for (const place of [
    { tab: "history" },
    { tab: "analytics" },
    { tab: "league", view: "hall" },
    { view: "league-hall" },
    { tab: "history", view: "history" },
    { tab: "trades", view: "history" },
    { view: "records" },
    { view: "archive" },
    { view: "titles" },
    { tab: "teams", view: "hall" },
    { tab: "league", view: "scores" },
    { tab: "league", view: "board" },
    { tab: "league", view: "activity" },
  ]) {
    assert.deepEqual(resolveDeskPlace(place), { page: "league", room: "team" }, JSON.stringify(place));
  }
  assert.deepEqual(resolveDeskPlace({ tab: "nonsense", view: "nonsense" }), { page: "trades", room: "calculator" });
  assert.equal(parseShareParams("league=1&tab=history").tab, "league");
  assert.equal(parseShareParams("league=1&tab=history").view, "team");
  assert.equal(parseShareParams("league=1&view=hall").tab, "league");
  assert.equal(parseShareParams("league=1&view=hall").view, "team");
  assert.equal(buildShareUrl({ origin: "", pathname: "/", leagueId: "1", tab: "history", view: "records" }), "/?league=1&tab=league");
});

test("desk place helpers know pages and rooms", () => {
  assert.equal(normalizeDeskTab("#trader"), "trades");
  assert.equal(normalizeDeskTab("Passport"), "trades");
  assert.equal(normalizeDeskTab("players"), "trades");
  assert.equal(normalizeDeskTab("garbage"), "");
  assert.equal(normalizeRoom("trades", "calc"), "calculator");
  assert.equal(normalizeRoom("trades", "tradematch"), "find");
  assert.equal(normalizeRoom("trades", "hall"), "");
  assert.equal(normalizeRoom("league", "home"), "team");
  assert.equal(defaultRoomFor("trades"), "calculator");
  assert.equal(defaultRoomFor("league"), "team");
  assert.equal(defaultRoomFor("nope"), "calculator");
  assert.equal(isRoomOf("league", "history"), false);
  assert.equal(isRoomOf("league", "team"), true);
  assert.equal(isRoomOf("players", "ranks"), false);
  assert.equal(isRoomOf("trades", "log"), false);
  assert.deepEqual(resolveDeskPlace({ view: "tank" }), { page: "league", room: "team" });
  assert.deepEqual(resolveDeskPlace({ view: "rookies" }), { page: "league", room: "team" });
  assert.equal(normalizeRoom("league", "roster"), "team");
  assert.equal(normalizeRoom("trades", "partners"), "find");
  assert.deepEqual(resolveDeskPlace({ view: "start" }), { page: "league", room: "team" });
  assert.deepEqual(resolveDeskPlace({ tab: "trades" }), { page: "trades", room: "calculator" });
  assert.equal(isRoomOf("trades", "find"), true);
  assert.deepEqual(resolveDeskPlace({ tab: "trades", view: "calculator" }), { page: "trades", room: "calculator" });
  assert.deepEqual(resolveDeskPlace({ view: "ktc" }), { page: "trades", room: "calculator" });
  assert.equal(isRoomOf("league", "team"), true);
  assert.equal(isRoomOf("trades", "calculator"), true);
  assert.deepEqual(resolveDeskPlace({ view: "ranks" }), { page: "trades", room: "calculator" });
  const ranksUrl = buildShareUrl({ origin: "", pathname: "/", leagueId: "1", tab: "trades", view: "ranks", asset: "player:9221" });
  assert.doesNotMatch(ranksUrl, /tab=/);
  // Old ?view=ranks&asset= links open the player through the router (history-route).
  assert.equal(parseShareParams("view=ranks&asset=player:9221").tab, "trades");
  assert.equal(parseShareParams("view=ranks&asset=player:9221").view, "calculator");
});
