import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLiveDeskHost,
  recordSearchedUser,
  searchedUserPick,
  searchedUserUrl,
  shouldTrackVisit,
} from "../docs/modules/visits.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

test("only the live dynastyticker.com host records a searched username", () => {
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), false);
  assert.equal(isLiveDeskHost({ hostname: "dynastyticker.com" }), true);
  assert.equal(isLiveDeskHost({ hostname: "www.dynastyticker.com" }), true);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" } }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "dynastyticker.com" } }), true);
});

test("public pages do not show a visit tally or the secret numbers page", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /people have viewed this desk/);
  assert.doesNotMatch(index, /secret-numbers/);

  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /recordSearchedUser/);
  assert.doesNotMatch(app, /recordDeskVisit|recordDeskUse|noteDeskUse\(/);
  assert.doesNotMatch(app, /secret-numbers/);

  for (const name of ["privacy.html", "terms.html", "404.html"]) {
    const html = readFileSync(join(docs, name), "utf8");
    assert.doesNotMatch(html, /secret-numbers/);
    assert.doesNotMatch(html, /recordDeskVisit/);
    assert.doesNotMatch(html, /dynasty_ticker_visitor/);
  }
  assert.doesNotMatch(readFileSync(join(docs, "sitemap.xml"), "utf8"), /secret-numbers/);
  assert.doesNotMatch(readFileSync(join(docs, "robots.txt"), "utf8"), /secret-numbers/);
  assert.equal(existsSync(join(docs, "secret-numbers/index.html")), false);
  assert.equal(existsSync(join(root, "netlify/functions/visit.js")), false);
  assert.equal(existsSync(join(root, "scripts/desk_visits.py")), false);
});

test("a searched username counts only when the loaded league came from that user's results", () => {
  const sleeperUser = { username: "NikoSkiouris", user_id: "457505734542774272", display_name: "Niko" };
  const userLeagues = [{ league_id: "1315" }, { league_id: "2000" }];
  assert.deepEqual(searchedUserPick({ sleeperUser, userLeagues, leagueId: "1315" }), {
    username: "NikoSkiouris",
    userId: "457505734542774272",
  });
  assert.equal(searchedUserPick({ sleeperUser, userLeagues, leagueId: "9999" }), null);
  assert.equal(searchedUserPick({ sleeperUser, userLeagues, leagueId: "" }), null);
  assert.equal(searchedUserPick({ sleeperUser, userLeagues: [], leagueId: "1315" }), null);
  assert.equal(searchedUserPick({ sleeperUser: null, userLeagues, leagueId: "1315" }), null);
  assert.equal(searchedUserPick({ sleeperUser: { username: "  ", user_id: "1" }, userLeagues, leagueId: "1315" }), null);
});

test("recordSearchedUser posts the Sleeper username on the live host only", async () => {
  const calls = [];
  const ok = await recordSearchedUser({
    username: "NikoSkiouris",
    userId: "457505734542774272",
    retryDelayMs: 0,
    location: { hostname: "dynastyticker.com", pathname: "/" },
    fetchFn: async (url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body) });
      return calls.length === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 };
    },
  });
  assert.equal(ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://dynastyticker.com/api/searched-user");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { username: "NikoSkiouris", userId: "457505734542774272" });
  assert.deepEqual(calls[1].body, calls[0].body);
  assert.equal(searchedUserUrl({ hostname: "www.dynastyticker.com", protocol: "https:" }), "https://www.dynastyticker.com/api/searched-user");

  const skipped = [];
  const fetchFn = async (url) => {
    skipped.push(url);
    return { ok: true };
  };
  assert.equal(await recordSearchedUser({ username: "niko", fetchFn, location: { hostname: "localhost", pathname: "/" } }), false);
  assert.equal(await recordSearchedUser({ username: "niko", fetchFn, location: { hostname: "nikoskiouris.github.io", pathname: "/Dynasty-Ticker/" } }), false);
  assert.equal(await recordSearchedUser({ username: " ", fetchFn, location: { hostname: "dynastyticker.com", pathname: "/" } }), false);
  assert.equal(skipped.length, 0);
});

test("the desk saves a searched username only after that user's league loads", () => {
  const app = readFileSync(join(docs, "app.js"), "utf8");
  const pickClick = app.match(/function handleLeaguePickClick\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(pickClick, /noteSearchedUser/);
  const search = app.match(/async function runUserLeagueSearch\(username\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(search, /state\.sleeperUser = user;\s*searchedUserNoted = false;/);
  assert.doesNotMatch(search, /noteSearchedUser|recordSearchedUser/);
  const load = app.match(/async function runLeagueLoad\(leagueId, token\) \{[\s\S]*?\n\}/)?.[0] || "";
  const opened = load.slice(0, load.indexOf("} catch (err)"));
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.match(opened, /showAppPages\(\);\s*noteSearchedUser\(leagueId\);/);
  assert.doesNotMatch(failed, /noteSearchedUser/);
  assert.match(app, /searchedUserPick\(\{ sleeperUser: state\.sleeperUser, userLeagues: state\.userLeagues, leagueId \}\)/);
});
