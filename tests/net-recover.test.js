import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOOT_IMPORT_RETRY_KEY,
  watchBootImport,
} from "../docs/modules/boot-import.js";
import {
  SLEEPER_UNREACHABLE_MESSAGE,
  createLeagueLoadRecovery,
  leagueLoadErrorMessage,
  leagueLoadErrorVisibility,
  shouldRecoverLeagueLoad,
} from "../docs/modules/league-load-error.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readDocs(name) {
  return readFileSync(join(root, "docs", name), "utf8");
}

function memoryStorage(seed = []) {
  const map = new Map(seed);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function fakeHost() {
  const handlers = [];
  return {
    innerHTML: "",
    querySelector() {
      return {
        addEventListener(_type, fn) {
          handlers.push(fn);
        },
        focus() {},
      };
    },
    click() {
      handlers.forEach((fn) => fn());
    },
  };
}

test("a failed boot import shows Couldn't load and reloads once on online", async () => {
  const events = new EventTarget();
  const host = fakeHost();
  let reloads = 0;
  const result = await watchBootImport({
    importApp: () => Promise.reject(new Error("Failed to fetch dynamically imported module")),
    host,
    onlineTarget: events,
    reload: () => {
      reloads += 1;
    },
    storage: memoryStorage(),
  });

  assert.equal(result.ok, false);
  assert.match(host.innerHTML, /role="alert"/);
  assert.match(host.innerHTML, /Couldn't load/);
  assert.match(host.innerHTML, />Reload</);
  assert.equal(reloads, 0);

  events.dispatchEvent(new Event("online"));
  assert.equal(reloads, 1);
  events.dispatchEvent(new Event("online"));
  assert.equal(reloads, 1);
});

test("Reload still works after the automatic boot retry was spent", async () => {
  const storage = memoryStorage([[BOOT_IMPORT_RETRY_KEY, "1"]]);
  const host = fakeHost();
  let reloads = 0;
  await watchBootImport({
    importApp: () => Promise.reject(new Error("still offline")),
    host,
    onlineTarget: new EventTarget(),
    reload: () => {
      reloads += 1;
    },
    storage,
  });

  assert.equal(reloads, 0);
  assert.match(host.innerHTML, /Couldn't load/);
  host.click();
  assert.equal(reloads, 1);
});

test("online during a failed boot import reloads once, then the error stays", async () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const host = fakeHost();
  let reloads = 0;
  await watchBootImport({
    importApp: () => {
      events.dispatchEvent(new Event("online"));
      return Promise.reject(new Error("Failed to fetch dynamically imported module"));
    },
    host,
    onlineTarget: events,
    reload: () => {
      reloads += 1;
    },
    storage,
  });
  assert.equal(reloads, 1);
  assert.equal(storage.getItem(BOOT_IMPORT_RETRY_KEY), "1");
  assert.match(host.innerHTML, /Couldn't load/);

  const again = fakeHost();
  let second = 0;
  const later = new EventTarget();
  await watchBootImport({
    importApp: () => {
      later.dispatchEvent(new Event("online"));
      return Promise.reject(new Error("still broken"));
    },
    host: again,
    onlineTarget: later,
    reload: () => {
      second += 1;
    },
    storage,
  });
  assert.equal(second, 0);
  assert.match(again.innerHTML, /Couldn't load/);
});

test("a successful boot import ignores online and clears the retry flag", async () => {
  const events = new EventTarget();
  const storage = memoryStorage([[BOOT_IMPORT_RETRY_KEY, "1"]]);
  let reloads = 0;
  const loaded = await watchBootImport({
    importApp: () => Promise.resolve({ ready: true }),
    host: fakeHost(),
    onlineTarget: events,
    reload: () => {
      reloads += 1;
    },
    storage,
  });
  events.dispatchEvent(new Event("online"));
  assert.deepEqual(loaded, { ready: true });
  assert.equal(reloads, 0);
  assert.equal(storage.getItem(BOOT_IMPORT_RETRY_KEY), null);
});

test("a network league failure is one short sentence", () => {
  const repeated = [
    "league profile (Network/CORS error while contacting Sleeper API)",
    "league managers (Network/CORS error while contacting Sleeper API)",
    "league rosters (Network/CORS error while contacting Sleeper API)",
  ].join("; ");
  const message = leagueLoadErrorMessage(new Error(`Failed to load: ${repeated}`));
  assert.equal(message, SLEEPER_UNREACHABLE_MESSAGE);
  assert.equal(message.includes("Network/CORS"), false);
  assert.equal(leagueLoadErrorMessage(new Error("No Sleeper league found for 12.")), "Could not load league data. No Sleeper league found for 12.");
});

test("the desk shows that network sentence once and find-my-leagues reuses league recovery", () => {
  const app = readDocs("app.js");
  const css = readDocs("styles.css");
  const load = app.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.match(failed, /leagueLoadErrorMessage\(err\)/);
  assert.match(failed, /const unreachable = message === SLEEPER_UNREACHABLE_MESSAGE/);
  assert.match(failed, /setFieldError\(el\.leagueId, el\.leagueIdError, unreachable \? "" : message\)/);
  assert.match(failed, /setStatus\(unreachable \? "" : message, \{ error: true \}\)/);
  assert.match(failed, /paintLeagueLoadError\(message\)/);
  assert.match(app, /className = `status \$\{tone\}\$\{message \? "" : " hidden"\}`/);
  assert.match(css, /\.landing-league-error > span,\s*\.desk-load-alert > span \{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(app, /const userSearchRecovery = createLeagueLoadRecovery\(/);
  assert.match(app, /userSearchRecovery\.fail\(\{ leagueId: username, token \}\)/);
  assert.match(app, /if \(userSearchRecovery\.retry\(\)\) return;/);
  const search = app.match(/async function runUserLeagueSearch\(username\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(search, /describeUserSearchFailure\(err, username\)/);
  assert.match(search, /retry: failure\.retry/);
  assert.doesNotMatch(search, /Could not reach Sleeper for/);
  assert.match(readDocs("ui/landing.html"), /id="landing-search-retry"[^>]*>Retry</);
});

test("league load errors sit on the landing or the desk, not both", () => {
  assert.deepEqual(leagueLoadErrorVisibility({ message: "", leagueLoaded: false }), {
    landing: false,
    desk: false,
  });
  assert.deepEqual(leagueLoadErrorVisibility({
    message: "Could not load league data. Network/CORS error while contacting Sleeper API",
    leagueLoaded: false,
  }), { landing: true, desk: false });
  assert.deepEqual(leagueLoadErrorVisibility({
    message: "Could not load league data. Network/CORS error while contacting Sleeper API",
    leagueLoaded: true,
  }), { landing: false, desk: true });
});

test("online retries the failed league and a stale generation does not", () => {
  const events = new EventTarget();
  const loaded = [];
  let current = 1;
  const recovery = createLeagueLoadRecovery({
    isCurrent: (token) => token === current,
    load: (leagueId, job) => loaded.push({ leagueId, sample: job.sample }),
    onlineTarget: events,
  });

  assert.equal(shouldRecoverLeagueLoad({ leagueId: "", token: 1, isCurrent: () => true }), false);
  assert.equal(recovery.fail({ leagueId: "131", token: 1, sample: true }), true);
  current = 2;
  events.dispatchEvent(new Event("online"));
  assert.deepEqual(loaded, []);
  assert.equal(recovery.retry(), false);

  assert.equal(recovery.fail({ leagueId: "999", token: 2, sample: false }), true);
  events.dispatchEvent(new Event("online"));
  assert.deepEqual(loaded, [{ leagueId: "999", sample: false }]);
  events.dispatchEvent(new Event("online"));
  assert.deepEqual(loaded, [{ leagueId: "999", sample: false }]);
});

test("clearing a failed league load drops the online retry", () => {
  const events = new EventTarget();
  const loaded = [];
  const recovery = createLeagueLoadRecovery({
    isCurrent: () => true,
    load: (leagueId) => loaded.push(leagueId),
    onlineTarget: events,
  });
  recovery.fail({ leagueId: "131", token: 4 });
  recovery.clear();
  events.dispatchEvent(new Event("online"));
  assert.equal(recovery.retry(), false);
  assert.deepEqual(loaded, []);
});

test("Retry runs the current league load", () => {
  const loaded = [];
  const recovery = createLeagueLoadRecovery({
    isCurrent: (token) => token === 3,
    load: (leagueId) => loaded.push(leagueId),
    onlineTarget: new EventTarget(),
  });
  recovery.fail({ leagueId: "555", token: 3 });
  assert.equal(recovery.retry(), true);
  assert.deepEqual(loaded, ["555"]);
  assert.equal(recovery.pending(), null);
});

test("boot and the desk wire import and league recovery", () => {
  const boot = readDocs("boot.js");
  const app = readDocs("app.js");
  const landing = readDocs("ui/landing.html");
  const index = readDocs("index.html");

  assert.match(boot, /watchBootImport/);
  assert.match(boot, /import\("\.\/app\.js"\)/);
  assert.match(boot, /location\.reload\(\)/);
  assert.match(boot, /await import\("\.\/app\.js"\)/);
  assert.match(app, /createLeagueLoadRecovery/);
  assert.match(app, /leagueLoadRecovery\.fail\(\{ leagueId, token, sample: state\.viewingSample \}\)/);
  assert.match(app, /leagueLoader\.isCurrent\(token\)/);
  assert.match(app, /paintLeagueLoadError\(message\)/);
  assert.match(landing, /id="landing-league-error"/);
  assert.match(landing, /role="alert"/);
  assert.match(landing, /id="landing-league-retry"/);
  assert.match(landing, />Retry</);
  assert.match(index, /id="desk-load-alert"/);
  assert.match(index, /id="desk-load-retry"/);
});
