import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLiveDeskHost,
  isSecretNumbersPath,
  loadSecretNumbers,
  parseTrafficCounts,
  readOrCreateVisitorId,
  recordDeskUse,
  recordDeskVisit,
  recordSearchedUser,
  renderSecretNumbers,
  renderTrafficReport,
  searchedUserPick,
  searchedUserUrl,
  shouldTrackVisit,
  sourceHost,
  visitCountUrl,
  visitTrackUrl,
  VISITOR_STORAGE_KEY,
} from "../docs/modules/visits.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

test("visit URLs stay first-party on the live host", () => {
  const live = { hostname: "dynastyticker.com" };
  assert.equal(visitTrackUrl(live), "https://dynastyticker.com/api/visit");
  assert.equal(visitCountUrl(live), "https://dynastyticker.com/api/views");
  assert.doesNotMatch(visitTrackUrl(live), /page-views-api|ratneshc|github\.io/);
  assert.equal(visitTrackUrl({ hostname: "127.0.0.1" }), "http://127.0.0.1/api/visit");
});

test("only the live dynastyticker.com host records a desk open", () => {
  assert.equal(isLiveDeskHost({ hostname: "127.0.0.1" }), false);
  assert.equal(isLiveDeskHost({ hostname: "nikoskiouris.github.io" }), false);
  assert.equal(isLiveDeskHost({ hostname: "dynastyticker.com" }), true);
  assert.equal(isLiveDeskHost({ hostname: "www.dynastyticker.com" }), true);
  assert.equal(shouldTrackVisit({ location: { hostname: "localhost" } }), false);
  assert.equal(shouldTrackVisit({ location: { hostname: "dynastyticker.com" } }), true);
  assert.equal(isSecretNumbersPath({ pathname: "/secret-numbers/" }), true);
  assert.equal(shouldTrackVisit({
    location: { hostname: "dynastyticker.com", pathname: "/secret-numbers/" },
  }), false);
});

test("recordDeskVisit POSTs every live load and never hits views", async () => {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    return { ok: true };
  };

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com" },
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/api\/visit$/);

  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com" },
  }), true);
  assert.equal(calls.length, 2);
});

test("localhost and the numbers page do not ping the counter", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true };
  };
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "127.0.0.1" },
  }), false);
  assert.equal(await recordDeskVisit({
    fetchFn,
    location: { hostname: "dynastyticker.com", pathname: "/secret-numbers" },
  }), false);
  assert.equal(calls.length, 0);
});

test("a failed ping stays uncounted so the next load can retry", async () => {
  const recorded = await recordDeskVisit({
    fetchFn: async () => {
      throw new Error("offline");
    },
    location: { hostname: "dynastyticker.com" },
  });
  assert.equal(recorded, false);
});

test("secret numbers are eight unlabeled lines", () => {
  assert.equal(renderSecretNumbers([12, 3, 40, 8, 200, 50, 500, 80]), "12\n3\n40\n8\n200\n50\n500\n80");
  assert.equal(renderSecretNumbers(null), "0\n0\n0\n0\n0\n0\n0\n0");
});

test("loadSecretNumbers reads the desk report and never tracks", async () => {
  const calls = [];
  const payload = {
    today: { views: 1, people: 2, active: 9 },
    week: { views: 3, people: 4 },
    year: { views: 5, people: 6 },
    all: { views: 7, people: 8 },
  };
  const report = await loadSecretNumbers({
    fetchFn: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => payload };
    },
  });
  assert.deepEqual(parseTrafficCounts(report), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(renderTrafficReport(report), /today views 1\s+people 2\s+active 9/);
  assert.match(renderTrafficReport(null), /today views 0/);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/api\/views$/);
});

test("loadSecretNumbers treats hung views as an empty report", async () => {
  const report = await loadSecretNumbers({
    timeoutMs: 20,
    fetchFn: () => new Promise(() => {}),
  });
  assert.equal(report, null);
  assert.match(renderTrafficReport(report), /days\nnone/);
});

test("the desk stores visits but never prints the total on public pages", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /people have viewed this desk/);
  assert.doesNotMatch(index, /anonymous visit ping/);
  assert.doesNotMatch(index, /secret-numbers/);
  assert.doesNotMatch(index, /privacy\.html/);
  assert.doesNotMatch(index, /terms\.html/);
  assert.doesNotMatch(index, /id="storage-notice"/);

  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /recordDeskVisit/);
  assert.match(app, /recordDeskUse/);
  assert.match(app, /noteDeskUse\(\)/);
  assert.doesNotMatch(app, /applyVisitCount/);
  assert.doesNotMatch(app, /secret-numbers/);

  const privacy = readFileSync(join(docs, "privacy.html"), "utf8");
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /secret-numbers/);
  assert.match(privacy, /recordDeskVisit/);

  const sitemap = readFileSync(join(docs, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /secret-numbers/);

  const robots = readFileSync(join(docs, "robots.txt"), "utf8");
  assert.doesNotMatch(robots, /secret-numbers/);

  for (const name of ["terms.html", "404.html"]) {
    assert.doesNotMatch(readFileSync(join(docs, name), "utf8"), /secret-numbers/);
  }
  assert.match(readFileSync(join(docs, "terms.html"), "utf8"), /recordDeskVisit/);
});

test("the unlisted numbers page is bare and unlabeled", () => {
  const page = join(docs, "secret-numbers/index.html");
  assert.equal(existsSync(page), true);
  const html = readFileSync(page, "utf8");
  assert.match(html, /noindex/);
  assert.match(html, /loadSecretNumbers/);
  assert.match(html, /renderTrafficReport/);
  assert.match(html, /innerText/);
  assert.match(html, /0<br>0<br>0<br>0<br>0<br>0<br>0<br>0/);
  assert.doesNotMatch(html, /stylesheet/);
  assert.doesNotMatch(html, /Dynasty/);
  assert.doesNotMatch(html, /today|week|year|all.time|users/i);
  assert.doesNotMatch(html, /<nav|<footer|<a /);
});

test("Netlify serves the first-party counter ahead of the 404 catch-all", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  const visitAt = toml.indexOf('from = "/api/visit"');
  const viewsAt = toml.indexOf('from = "/api/views"');
  const notFoundAt = toml.indexOf('from = "/*"');
  assert.ok(visitAt > 0);
  assert.ok(viewsAt > visitAt);
  assert.ok(notFoundAt > viewsAt);
  assert.match(toml, /\.netlify\/functions\/visit/);

  const fn = readFileSync(join(root, "netlify/functions/visit.js"), "utf8");
  assert.match(fn, /desk-traffic/);
  assert.match(fn, /export default/);
  assert.doesNotMatch(fn, /wrapLambdaHandler/);

  const redirects = readFileSync(join(docs, "_redirects"), "utf8");
  assert.match(redirects, /\/api\/visit\s+\/\.netlify\/functions\/visit\s+200!/);
  assert.match(redirects, /\/api\/views\s+\/\.netlify\/functions\/visit\s+200!/);

  const script = readFileSync(join(root, "scripts/desk_visits.py"), "utf8");
  assert.match(script, /dynastyticker\.com\/api\/views/);
  assert.doesNotMatch(script, /page-views-api|ratneshc/);
});

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

test("the same browser keeps one visitor id and a failed save retries that id", async () => {
  const storage = memoryStorage();
  const first = readOrCreateVisitorId(storage);
  assert.equal(readOrCreateVisitorId(storage), first);
  assert.match(first, /^[a-f0-9]{32}$/);
  assert.equal(storage.getItem(VISITOR_STORAGE_KEY), first);

  const bodies = [];
  let tries = 0;
  const ok = await recordDeskVisit({
    retryDelayMs: 0,
    storage,
    referrer: "https://www.instagram.com/reel/1",
    location: { hostname: "dynastyticker.com", pathname: "/" },
    fetchFn: async (_url, options) => {
      tries += 1;
      bodies.push(JSON.parse(options.body));
      if (tries === 1) return { ok: false, status: 503 };
      return { ok: true, status: 200 };
    },
  });
  assert.equal(ok, true);
  assert.equal(tries, 2);
  assert.equal(bodies[0].eventId, bodies[1].eventId);
  assert.equal(bodies[0].visitorId, first);
  assert.equal(bodies[0].kind, "open");
  assert.equal(bodies[0].source, "instagram.com");
  assert.equal(sourceHost("https://dynastyticker.com/privacy.html"), "direct");
});

test("desk use posts an active event and skips localhost", async () => {
  const storage = memoryStorage({ [VISITOR_STORAGE_KEY]: "ab".repeat(16) });
  const calls = [];
  const ok = await recordDeskUse({
    retryDelayMs: 0,
    storage,
    location: { hostname: "dynastyticker.com", pathname: "/" },
    fetchFn: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true };
    },
  });
  assert.equal(ok, true);
  assert.equal(calls[0].kind, "active");
  assert.equal(calls[0].visitorId, "ab".repeat(16));
  assert.equal(await recordDeskUse({
    fetchFn: async () => ({ ok: true }),
    location: { hostname: "localhost", pathname: "/" },
  }), false);
});

test("a searched username counts only when the clicked league came from that user's results", () => {
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

test("the desk saves a searched username on a league click, not on a lone-league auto-open", () => {
  const app = readFileSync(join(docs, "app.js"), "utf8");
  const pickClick = app.match(/function handleLeaguePickClick\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(pickClick, /noteSearchedUser\(leagueId\)/);
  const search = app.match(/async function runUserLeagueSearch\(username\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(search, /state\.sleeperUser = user;\s*searchedUserNoted = false;/);
  assert.doesNotMatch(search, /noteSearchedUser|recordSearchedUser/);
  assert.match(app, /searchedUserPick\(\{ sleeperUser: state\.sleeperUser, userLeagues: state\.userLeagues, leagueId \}\)/);
});
