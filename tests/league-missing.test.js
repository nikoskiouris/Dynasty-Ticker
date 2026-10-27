import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSpaPath, resolveLocation } from "../docs/modules/history-route.js";
import {
  SLEEPER_UNREACHABLE_MESSAGE,
  isLeagueNotFound,
  leagueLoadErrorMessage,
  leagueNotFoundError,
  sleeperLeagueMissing,
  sleeperResponseFailed,
} from "../docs/modules/league-load-error.js";
import { holdDocumentTitle } from "../docs/modules/site.js";
import { createSleeperClient } from "../docs/modules/sleeper.js";

const root = dirname(fileURLToPath(import.meta.url));

function readDocs(name) {
  return readFileSync(join(root, "../docs", name), "utf8");
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get() { return null; } },
    async json() {
      return payload;
    },
  };
}

function quietClient(fetchImpl) {
  return createSleeperClient({
    fetchImpl,
    minIntervalMs: 0,
    sleep: async () => {},
  });
}

test("an invalid league id stays on /l and is not the landing", () => {
  for (const path of [
    "/l/x",
    "/l/not-a-league",
    "/l/4.2/team",
    "/l/x/week",
    "/l/x/team",
    "/l/x/ideas",
    "/l/x/league",
    "/l/x/activity",
    "/l/x/history",
    "/l/4.2/week",
    "/l/x/week/",
  ]) {
    const route = resolveLocation(path);
    assert.equal(isSpaPath(path), true, path);
    assert.equal(route.unknown, false, path);
    assert.equal(route.badLeague, true, path);
    assert.equal(route.name, "league", path);
    assert.equal(route.leagueId, "", path);
    assert.ok(route.badLeagueId, path);
  }
  const unknownRoom = resolveLocation("/l/abc/not-a-room");
  assert.equal(unknownRoom.unknown, true);
  assert.equal(unknownRoom.badLeague, false);
  const numeric = resolveLocation("/l/999001");
  assert.equal(numeric.badLeague, false);
  assert.equal(numeric.unknown, false);
  assert.equal(numeric.leagueId, "999001");
  const home = resolveLocation("/nope");
  assert.equal(home.unknown, true);
  assert.equal(home.badLeague, false);
  for (const path of ["/l", "/l/"]) {
    const empty = resolveLocation(path);
    assert.equal(isSpaPath(path), true, path);
    assert.equal(empty.badLeague, true, path);
    assert.equal(empty.badLeagueId, "", path);
    assert.equal(empty.unknown, false, path);
  }
  assert.equal(isSpaPath("/l/x.json"), false);

  const app = readDocs("app.js");
  assert.match(app, /if \(bootRoute\?\.badLeague\) \{\s*showLeagueNotFound\(\);/);
  assert.match(app, /if \(route\.badLeague\) \{\s*\/\/ Stay on \/l\//);
  assert.doesNotMatch(
    app.slice(app.indexOf("function bootFromUrl"), app.indexOf("function activePlayerRouteId")),
    /badLeagueId/,
  );
});

test("a nonexistent numeric league is a Sleeper null or 404", async () => {
  const missing = "999001";
  const notFound = quietClient(async () => jsonResponse({ error: "not found" }, 404));
  await assert.rejects(
    () => notFound.apiGetWithRetry(`/league/${missing}`, { retries: 0, timeoutMs: 1000 }),
    (err) => err?.status === 404,
  );
  const settled404 = await Promise.allSettled([
    notFound.apiGet(`/league/${missing}`).then((payload) => ({ payload })),
  ]);
  assert.equal(sleeperLeagueMissing(settled404[0]), true);

  const empty = quietClient(async () => jsonResponse(null, 200));
  const payload = await empty.apiGet(`/league/${missing}`);
  assert.equal(payload, null);
  assert.equal(sleeperLeagueMissing({ status: "fulfilled", value: { payload } }), true);
  assert.equal(sleeperLeagueMissing({
    status: "fulfilled",
    value: { payload: { league_id: missing, name: "Real" } },
  }), false);
  assert.equal(sleeperLeagueMissing({ status: "rejected", reason: { status: 404 } }), true);
  assert.equal(sleeperLeagueMissing({ status: "rejected", reason: { status: 500 } }), false);

  const err = leagueNotFoundError(missing);
  assert.equal(isLeagueNotFound(err), true);
  assert.equal(err.leagueId, missing);
  assert.equal(isLeagueNotFound(new Error("Network/CORS error while contacting Sleeper API")), false);

  const app = readDocs("app.js");
  const core = app.match(/async function loadLeagueCoreData\(leagueId\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(core, /if \(sleeperLeagueMissing\(settled\[0\]\)\) throw leagueNotFoundError\(leagueId\)/);
  assert.doesNotMatch(core, /No Sleeper league found/);
  const load = app.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.match(failed, /if \(isLeagueNotFound\(err\) && !failedSwitch\) \{\s*showLeagueNotFound\(\);\s*return;\s*\}/);
  assert.ok(failed.indexOf("isLeagueNotFound(err)") < failed.indexOf("leagueLoadRecovery.fail"));
  assert.ok(failed.indexOf("showLeagueNotFound()") < failed.indexOf("paintLeagueLoadError(message)"));
});

test("a network failure keeps the retry sentence", async () => {
  const offline = quietClient(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    () => offline.apiGetWithRetry("/league/999001", { retries: 0, timeoutMs: 1000 }),
    (err) => {
      assert.equal(err.status, undefined);
      assert.match(err.message, /Network\/CORS/);
      return true;
    },
  );
  const settled = await Promise.allSettled([
    offline.apiGet("/league/999001").then((payload) => ({ payload })),
  ]);
  assert.equal(sleeperLeagueMissing(settled[0]), false);
  assert.equal(leagueLoadErrorMessage(settled[0].reason), SLEEPER_UNREACHABLE_MESSAGE);
  assert.equal(isLeagueNotFound(settled[0].reason), false);

  const app = readDocs("app.js");
  const load = app.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.match(failed, /leagueLoadErrorMessage\(err\)/);
  assert.match(failed, /paintLeagueLoadError\(message\)/);
  assert.match(failed, /leagueLoadRecovery\.fail\(\{ leagueId, token, sample: state\.viewingSample \}\)/);
  assert.match(failed, /leagueSwitchFailureCopy\(\{/);
});

test("the missing-league state has a heading, connect, and the sample league", () => {
  const landing = readDocs("ui/landing.html");
  const panel = landing.slice(landing.indexOf('id="league-missing"'), landing.indexOf('id="public-ranks"'));
  assert.match(panel, /<h1 id="league-missing-title" tabindex="-1">We couldn't find that league<\/h1>/);
  assert.match(panel, /The link may be wrong, or the league was deleted\./);
  assert.match(panel, /data-action="find-my-leagues"/);
  assert.match(panel, /data-idle-label="Find my leagues"/);
  assert.match(panel, /class="sample-league-link" href="\/\?sample=1">See the sample league<\/a>/);
  const app = readDocs("app.js");
  assert.match(app, /getElementById\("league-missing-title"\)\?\.focus\(\)/);
  assert.match(app, /title: "We couldn't find that league · Dynasty Ticker"/);
  assert.match(app, /leagueMissing \|\| sleeperUnreachable/);
  assert.match(panel, /class="league-missing-primary"/);
  const css = readDocs("styles.css");
  const product = readDocs("product.css");
  assert.match(css, /#league-missing-title:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none;\s*\}/);
  assert.match(css, /#league-missing-title:focus,\s*#sleeper-down-title:focus\s*\{\s*outline:\s*none;\s*\}/);
  assert.match(product, /\.league-missing-primary::before/);

  const leave = app.slice(app.indexOf("function openLandingFromMissingLeague("), app.indexOf("function hideLeagueNotFound("));
  assert.match(leave, /hideLeagueNotFound\(\)/);
  assert.match(leave, /prepareDeskPush\(\)/);
  assert.match(leave, /history\.pushState\(/);
  assert.match(leave, /"", "\/"\)/);
  assert.match(leave, /connectAsked: true/);
  assert.match(leave, /getElementById\("landing-username"\)\?\.focus\(\)/);
  assert.match(app, /if \(leagueMissing \|\| sleeperUnreachable\) \{\s*openLandingFromMissingLeague\(\);\s*break;\s*\}/);
  assert.match(app, /connectAsked = route\.name === "connect" \|\| Boolean\(historyState\?\.connectAsked\)/);
});

test("a Sleeper outage has a heading and its own title", () => {
  const landing = readDocs("ui/landing.html");
  const panel = landing.slice(landing.indexOf('id="sleeper-down"'), landing.indexOf('id="public-ranks"'));
  assert.doesNotMatch(panel, /role="alert"/);
  assert.match(panel, /<h1 id="sleeper-down-title" tabindex="-1">Couldn't reach Sleeper<\/h1>/);
  assert.match(panel, /Sleeper didn't answer\. Your league is safe, so try again in a moment\./);
  assert.doesNotMatch(panel, /Check your connection\./);
  assert.match(panel, /id="sleeper-down-retry" class="league-missing-primary">Retry<\/button>/);
  assert.match(panel, /id="sleeper-down-find" class="ghost-btn"/);
  assert.doesNotMatch(panel, /sleeper-down-find"[^>]*league-missing-primary/);
  assert.match(panel, /data-action="find-my-leagues"/);
  assert.match(panel, /data-idle-label="Find my leagues"/);
  assert.match(panel, /class="sample-league-link" href="\/\?sample=1">See the sample league<\/a>/);
  const css = readDocs("styles.css");
  assert.match(css, /#sleeper-down-retry\s*\{[^}]*background:\s*var\(--gradient\)/);
  assert.match(css, /#sleeper-down-find,\s*#sleeper-down-find:hover\s*\{[^}]*background:\s*transparent/);
  const app = readDocs("app.js");
  assert.match(app, /title: "Couldn't reach Sleeper · Dynasty Ticker"/);
  assert.match(app, /description: "Sleeper didn't answer\. Your league is safe, so try again in a moment\."/);
  assert.match(app, /title: "Loading league · Dynasty Ticker"/);
  assert.match(app, /getElementById\("sleeper-down-title"\)\?\.focus\(\)/);
  assert.doesNotMatch(app, /announceRoute\(document, "Couldn't reach Sleeper"\)/);
  assert.match(app, /function dropFailedLeagueQuery\(/);
  assert.match(app, /pageshow/);
  assert.match(app, /if \(text === SLEEPER_UNREACHABLE_MESSAGE && !loaded\) \{\s*showSleeperUnreachable\(\);\s*return;\s*\}/);
});

test("any non-OK Sleeper response is the outage sentence, not the landing fallback", () => {
  const http = new Error("Sleeper API returned 500");
  http.status = 500;
  assert.equal(sleeperResponseFailed(http), true);
  assert.equal(leagueLoadErrorMessage(http), SLEEPER_UNREACHABLE_MESSAGE);
  assert.equal(
    leagueLoadErrorMessage(new Error("Failed to load: league profile (Sleeper API returned 500)")),
    SLEEPER_UNREACHABLE_MESSAGE,
  );
  assert.equal(sleeperResponseFailed({ status: 502, message: "Sleeper API returned 502" }), true);
  assert.equal(leagueLoadErrorMessage(new Error("No Sleeper league found for 12.")), "Could not load league data. No Sleeper league found for 12.");
  const app = readDocs("app.js");
  const load = app.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.ok(failed.indexOf("isLeagueNotFound(err)") < failed.indexOf("leagueLoadErrorMessage(err)"));
  assert.match(failed, /showSleeperUnreachable\(\)|paintLeagueLoadError\(message\)/);
  assert.match(failed, /if \(!unreachable && !state\.leagueId && String\(window\.location\.pathname \|\| ""\)\.startsWith\("\/l\/"\)/);
});

test("the document title follows the rendered page when history restores another title", async () => {
  const doc = { title: "Loading" };
  holdDocumentTitle(doc, "This week · Sample League — Dynasty Ticker");
  doc.title = "Couldn't reach Sleeper · Dynasty Ticker";
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(doc.title, "This week · Sample League — Dynasty Ticker");
  const app = readDocs("app.js");
  const write = app.slice(app.indexOf("function updateUrlState"), app.indexOf("function closeHistoryOverlay"));
  const titleAt = write.indexOf("syncDocumentMeta()");
  assert.ok(titleAt >= 0);
  assert.ok(titleAt < write.indexOf("history.pushState"));
  assert.ok(titleAt < write.indexOf("history.replaceState"));
});
