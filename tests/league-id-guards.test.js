import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyLeagueField,
  classifyLeagueInput,
  classifyUsernameField,
  INVALID_LEAGUE_LINK_MESSAGE,
  parseShareParams,
  stampPickedLeagueSearch,
} from "../docs/modules/parse.js";
import { SAMPLE_LEAGUE_ID } from "../docs/modules/constants.js";
import {
  noTeamInLeagueCopy,
  renderMeSelectOptions,
  resolveDefaultMeRoster,
} from "../docs/modules/league-search.js";
import {
  createSleeperClient,
  preferLatestLeagues,
  previousLeagueId,
  retryAfterDelayMs,
  sleeperLeaguePath,
} from "../docs/modules/sleeper.js";

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function jsonResponse(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      },
    },
    async json() {
      return payload;
    },
  };
}

test("previousLeagueId treats blank, zero, and null as no prior league", () => {
  assert.equal(previousLeagueId(""), "");
  assert.equal(previousLeagueId(0), "");
  assert.equal(previousLeagueId("0"), "");
  assert.equal(previousLeagueId(null), "");
  assert.equal(previousLeagueId(undefined), "");
  assert.equal(previousLeagueId("  0  "), "");
  assert.equal(previousLeagueId("2025-a"), "2025-a");
});

test("preferLatestLeagues does not treat previous_league_id 0 as a real league", () => {
  const latest = preferLatestLeagues([
    { league_id: "now", previous_league_id: "0" },
    { league_id: "0", previous_league_id: 0 },
    { league_id: "blank", previous_league_id: "" },
    { league_id: "none", previous_league_id: null },
    { league_id: "older", previous_league_id: "ancient" },
    { league_id: "ancient", previous_league_id: "0" },
  ]);
  assert.deepEqual(latest.map((league) => league.league_id), ["now", "0", "blank", "none", "older"]);
});

test("league history walks a real previous id and skips 0", () => {
  const history = appSource.match(/async function loadLeagueHistoryContext\(currentLeagueId, currentCoreData\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(history, /previousLeagueId\(currentCoreData\?\.league\?\.previous_league_id\)/);
  assert.match(history, /previousLeagueId\(historicalCore\?\.league\?\.previous_league_id\)/);
  assert.doesNotMatch(history, /loadLeagueCoreData\(currentCoreData/);
});

test("a non-numeric share league is ignored", () => {
  const bad = parseShareParams("league=not-a-league");
  assert.equal(bad.leagueId, "");
  assert.equal(bad.invalidLeague, true);
  assert.equal(INVALID_LEAGUE_LINK_MESSAGE, "That league link isn't valid");
  assert.equal(parseShareParams("league=12").leagueId, "12");
  assert.equal(parseShareParams("league=12").invalidLeague, false);
  assert.equal(parseShareParams("league=").invalidLeague, false);
  assert.equal(parseShareParams("sample=1&league=nope").leagueId, SAMPLE_LEAGUE_ID);
  assert.equal(parseShareParams("sample=1&league=nope").invalidLeague, false);
  assert.match(appSource, /if \(parsed\.invalidLeague\) showInvalidLeagueLink\(\)/);
  assert.match(appSource, /INVALID_LEAGUE_LINK_MESSAGE/);
});

test("league path segments are encoded", () => {
  assert.equal(sleeperLeaguePath("4242424242424242"), "/league/4242424242424242");
  assert.equal(sleeperLeaguePath("12/34", "users"), "/league/12%2F34/users");
  assert.equal(sleeperLeaguePath("a b", "matchups/1"), "/league/a%20b/matchups/1");
  assert.equal(appSource.includes("`/league/${"), false);
  assert.match(appSource, /sleeperLeaguePath\(leagueId\)/);
  assert.match(appSource, /sleeperLeaguePath\(leagueId, "rosters"\)/);
});

test("picking a league stamps ?league= without pushing over an open league", () => {
  assert.equal(stampPickedLeagueSearch("", "42"), "?league=42");
  assert.equal(stampPickedLeagueSearch("?tab=trades", "42"), "?tab=trades&league=42");
  assert.equal(stampPickedLeagueSearch("?league=7", "42"), "");
  assert.equal(stampPickedLeagueSearch("?league=bogus", "42"), "?league=42");
  assert.equal(stampPickedLeagueSearch("", "nope"), "");
  assert.match(appSource, /function rememberPickedLeague\(leagueId\)/);
  assert.match(appSource, /stampPickedLeagueSearch\(window\.location\.search, leagueId\)/);
  assert.match(appSource, /history\.replaceState\(history\.state, "", `\$\{window\.location\.pathname\}\$\{nextSearch\}`\)/);
  assert.match(appSource, /if \(!fromHistory\) rememberPickedLeague\(leagueId\)/);
  assert.match(appSource, /switchingLeagues && typeof history\?\.pushState === "function"/);
  const picked = appSource.slice(appSource.indexOf("function rememberPickedLeague"), appSource.indexOf("async function loadLeagueById"));
  const hold = picked.indexOf("String(state.leagueId) !== String(leagueId)");
  assert.ok(hold >= 0);
  assert.ok(hold < picked.indexOf("history.pushState"));
  const load = appSource.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const opened = load.slice(0, load.indexOf("} catch (err)"));
  assert.match(opened, /if \(switchingLeagues && typeof history\?\.pushState === "function"\) \{/);
  assert.doesNotMatch(opened, /switchingLeagues && typeof history\?\.pushState === "function" && !leagueOpenedInApp/);
});

test("a searched user with no roster is not the first manager", () => {
  const rosters = [
    { rosterId: 1, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 2, manager: { userId: "u-beta", displayName: "Beta" } },
  ];
  assert.equal(resolveDefaultMeRoster({
    rosters,
    sleeperUser: { user_id: "u-missing", username: "ghost", display_name: "Ghost" },
  }), null);
  assert.equal(resolveDefaultMeRoster({ rosters }).rosterId, 1);
  assert.equal(noTeamInLeagueCopy({ display_name: "Ghost", username: "ghost" }), "Ghost has no team in this league.");
  assert.equal(noTeamInLeagueCopy({ username: "ghost" }), "ghost has no team in this league.");
  assert.equal(noTeamInLeagueCopy({}), "This user has no team in this league.");
  assert.equal(noTeamInLeagueCopy(null), "");
  const html = renderMeSelectOptions(rosters, "");
  assert.match(html, /<option value="" selected>No team<\/option>/);
  assert.doesNotMatch(html, /value="1" selected/);
  assert.match(appSource, /noTeamInLeagueCopy\(state\.sleeperUser\)/);
});

test("digits in the username field stay a user lookup", () => {
  assert.equal(classifyLeagueInput("12345").kind, "league");
  assert.equal(classifyLeagueInput("12345").leagueId, "12345");
  assert.equal(classifyUsernameField("12345").kind, "username");
  assert.equal(classifyUsernameField("12345").username, "12345");
  assert.equal(classifyUsernameField("https://sleeper.app/leagues/99").kind, "league");
  assert.equal(classifyLeagueField("", "12345").kind, "username");
  assert.equal(classifyLeagueField("99", "12345").leagueId, "99");
  assert.equal(classifyLeagueField("  ", "12345").kind, "username");
  const find = appSource.match(/function requestFindLeagues\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(find, /classifyUsernameField\(el\.sleeperUsername\?\.value \|\| el\.landingUsername\?\.value\)/);
  assert.doesNotMatch(find, /classifyLeagueInput\(/);
  const load = appSource.match(/function requestLoadLeague\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(load, /classifyLeagueField\(el\.leagueId\?\.value, el\.sleeperUsername\?\.value\)/);
});

test("Retry-After waits at most 10s and 1s when the header is missing", async () => {
  assert.equal(retryAfterDelayMs(undefined), 1000);
  assert.equal(retryAfterDelayMs(null), 1000);
  assert.equal(retryAfterDelayMs(""), 1000);
  assert.equal(retryAfterDelayMs("0"), 1000);
  assert.equal(retryAfterDelayMs("nope"), 1000);
  assert.equal(retryAfterDelayMs("2"), 2000);
  assert.equal(retryAfterDelayMs("30"), 10000);
  assert.equal(retryAfterDelayMs("10"), 10000);

  async function delaysFor(headers) {
    const delays = [];
    let calls = 0;
    const client = createSleeperClient({
      minIntervalMs: 0,
      sleep: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({}, 429, headers);
        return jsonResponse({ ok: true });
      },
    });
    const payload = await client.apiGetWithRetry("/x", { retries: 1 });
    assert.equal(payload.ok, true);
    return delays;
  }

  assert.deepEqual(await delaysFor({ "retry-after": "30" }), [10000]);
  assert.deepEqual(await delaysFor({}), [1000]);
  assert.deepEqual(await delaysFor({ "retry-after": "0" }), [1000]);
});
