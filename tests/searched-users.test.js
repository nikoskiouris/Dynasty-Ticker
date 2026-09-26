import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEARCHED_USERS_HEADER,
  SEARCHED_USERS_KEY,
  SEARCHED_USERS_STORE,
  applySearchedUser,
  cleanSleeperUserId,
  cleanSleeperUsername,
  createSearchedUserHandler,
  parseSearchedUsers,
} from "../netlify/lib/searched-users.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-09-23T21:05:09.123Z");
const LATER = new Date("2026-09-30T13:00:00.000Z");

function memoryTextStore(initial = null, { barrierReads = 0, failRead = false, failWrite = false } = {}) {
  let value = initial;
  let version = value == null ? 0 : 1;
  let remainingBarrierReads = barrierReads;
  let releaseBarrier = null;
  const barrier = barrierReads > 0
    ? new Promise((resolve) => { releaseBarrier = resolve; })
    : null;
  const keys = [];

  function etag() {
    return value == null ? "" : `v${version}`;
  }

  return {
    async getWithMetadata(key, options = {}) {
      keys.push(key);
      if (failRead) throw new Error("read failed");
      assert.equal(options.type, "text");
      if (remainingBarrierReads > 0) {
        remainingBarrierReads -= 1;
        if (remainingBarrierReads === 0) releaseBarrier?.();
        else await barrier;
      }
      if (value == null) return null;
      return { data: value, metadata: {}, etag: etag() };
    },
    async set(key, next, options = {}) {
      keys.push(key);
      if (failWrite) throw new Error("write failed");
      assert.equal(typeof next, "string");
      const currentEtag = etag();
      if (options.onlyIfNew === true && value != null) return { modified: false, etag: currentEtag };
      if (options.onlyIfMatch && options.onlyIfMatch !== currentEtag) return { modified: false, etag: currentEtag };
      value = next;
      version += 1;
      return { modified: true, etag: etag() };
    },
    text() {
      return value;
    },
    keys,
  };
}

function post(body, headers = {}) {
  return new Request("https://dynastyticker.com/api/searched-user", {
    method: "POST",
    headers: {
      origin: "https://dynastyticker.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("usernames are lowercased and anything that could break a CSV cell is refused", () => {
  assert.equal(cleanSleeperUsername("  NikoSkiouris "), "nikoskiouris");
  assert.equal(cleanSleeperUsername("dyn_asty.guy-22"), "dyn_asty.guy-22");
  assert.equal(cleanSleeperUsername("José"), "josé");
  for (const bad of ["", "   ", "=HYPERLINK(1)", "-niko", "+niko", "@niko", "a,b", 'a"b', "a b", "a\nb", "x".repeat(41), null, undefined]) {
    assert.equal(cleanSleeperUsername(bad), "", String(bad));
  }
  assert.equal(cleanSleeperUserId("457505734542774272"), "457505734542774272");
  assert.equal(cleanSleeperUserId("u-niko"), "");
  assert.equal(cleanSleeperUserId(""), "");
});

test("a new username is added and every username already in the file stays", () => {
  const existing = [
    "username,user_id,first_seen,last_seen,searches",
    "alpha,1,2026-09-01T00:00:00Z,2026-09-01T00:00:00Z,4",
    "beta,2,2026-09-02T00:00:00Z,2026-09-02T00:00:00Z,1",
    "gamma,3,2026-09-03T00:00:00Z,2026-09-03T00:00:00Z,2",
  ].join("\n") + "\n";
  const csv = applySearchedUser(existing, { username: "delta", userId: "4", now: NOW });
  assert.deepEqual(parseSearchedUsers(csv).map((row) => [row.username, row.searches]), [
    ["alpha", 4],
    ["beta", 1],
    ["gamma", 2],
    ["delta", 1],
  ]);
  const again = applySearchedUser(csv, { username: "beta", userId: "2", now: LATER });
  assert.deepEqual(parseSearchedUsers(again).map((row) => [row.username, row.searches, row.firstSeen]), [
    ["alpha", 4, "2026-09-01T00:00:00Z"],
    ["beta", 2, "2026-09-02T00:00:00Z"],
    ["gamma", 2, "2026-09-03T00:00:00Z"],
    ["delta", 1, "2026-09-23T21:05:09Z"],
  ]);
  assert.equal(parseSearchedUsers(again).find((row) => row.username === "beta").lastSeen, "2026-09-30T13:00:00Z");
});

test("a new username adds one row; the same name later bumps it instead of repeating it", () => {
  let csv = applySearchedUser("", { username: "NikoSkiouris", userId: "457505734542774272", now: NOW });
  assert.equal(csv, `${SEARCHED_USERS_HEADER}\nnikoskiouris,457505734542774272,2026-09-23T21:05:09Z,2026-09-23T21:05:09Z,1\n`);

  csv = applySearchedUser(csv, { username: "demetri", userId: "11", now: NOW });
  csv = applySearchedUser(csv, { username: "nikoskiouris", userId: "457505734542774272", now: LATER });
  assert.deepEqual(csv.trim().split("\n"), [
    "username,user_id,first_seen,last_seen,searches",
    "nikoskiouris,457505734542774272,2026-09-23T21:05:09Z,2026-09-30T13:00:00Z,2",
    "demetri,11,2026-09-23T21:05:09Z,2026-09-23T21:05:09Z,1",
  ]);

  assert.equal(applySearchedUser(csv, { username: "=bad", now: LATER }), csv);
});

test("parsing survives a round trip through a spreadsheet", () => {
  const edited = "\uFEFFusername,user_id,first_seen,last_seen,searches\r\n"
    + "\"nikoskiouris\",457505734542774272,2026-09-23T21:05:09Z,2026-09-30T13:00:00Z,2\r\n"
    + "\r\n"
    + "username,9,2026-09-23T21:05:09Z,2026-09-23T21:05:09Z,1\r\n";
  assert.deepEqual(parseSearchedUsers(edited), [
    {
      username: "nikoskiouris",
      userId: "457505734542774272",
      firstSeen: "2026-09-23T21:05:09Z",
      lastSeen: "2026-09-30T13:00:00Z",
      searches: 2,
    },
    {
      username: "username",
      userId: "9",
      firstSeen: "2026-09-23T21:05:09Z",
      lastSeen: "2026-09-23T21:05:09Z",
      searches: 1,
    },
  ]);
});

test("the handler saves a live league pick to the CSV blob", async () => {
  const store = memoryTextStore();
  const handler = createSearchedUserHandler({ getStore: () => store, nowFn: () => NOW });

  const saved = await handler(post({ username: "NikoSkiouris", userId: "457505734542774272" }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).ok, true);
  const again = await handler(post({ username: "nikoskiouris", userId: "457505734542774272" }));
  assert.equal(again.status, 200);

  assert.deepEqual(parseSearchedUsers(store.text()).map((row) => [row.username, row.searches]), [["nikoskiouris", 2]]);
  assert.ok(store.keys.every((key) => key === SEARCHED_USERS_KEY));
});

test("the handler adds to the stored list and leaves the rows already there", async () => {
  const existing = [
    "username,user_id,first_seen,last_seen,searches",
    "alpha,1,2026-09-01T00:00:00Z,2026-09-01T00:00:00Z,4",
    "beta,2,2026-09-02T00:00:00Z,2026-09-02T00:00:00Z,1",
  ].join("\n") + "\n";
  const store = memoryTextStore(existing);
  const handler = createSearchedUserHandler({ getStore: () => store, nowFn: () => NOW });
  const saved = await handler(post({ username: "gamma", userId: "3" }));
  assert.equal(saved.status, 200);
  assert.deepEqual(parseSearchedUsers(store.text()).map((row) => [row.username, row.userId, row.searches]), [
    ["alpha", "1", 4],
    ["beta", "2", 1],
    ["gamma", "3", 1],
  ]);
});

test("the list is write-only and only the live site can write", async () => {
  const store = memoryTextStore(`${SEARCHED_USERS_HEADER}\nnikoskiouris,1,2026-09-23T21:05:09Z,2026-09-23T21:05:09Z,1\n`);
  const handler = createSearchedUserHandler({ getStore: () => store, nowFn: () => NOW });

  const read = await handler(new Request("https://dynastyticker.com/api/searched-user"));
  assert.equal(read.status, 405);
  assert.equal(read.headers.get("allow"), "POST");
  assert.doesNotMatch(await read.text(), /nikoskiouris/);

  const forged = await handler(post({ username: "spam" }, { origin: "https://evil.example" }));
  assert.equal(forged.status, 403);

  const bot = await handler(post({ username: "crawler" }, { "user-agent": "Googlebot/2.1" }));
  assert.equal(bot.status, 200);
  assert.equal((await bot.json()).skipped, "bot");

  const junk = await handler(post({ username: "=cmd|' /C calc'!A0" }));
  assert.equal(junk.status, 400);
  const blank = await handler(post({}));
  assert.equal(blank.status, 400);

  assert.deepEqual(parseSearchedUsers(store.text()).map((row) => row.username), ["nikoskiouris"]);
});

test("two picks at once both land after a conditional-write conflict", async () => {
  const store = memoryTextStore(null, { barrierReads: 2 });
  const handler = createSearchedUserHandler({ getStore: () => store, nowFn: () => NOW });
  const [first, second] = await Promise.all([
    handler(post({ username: "niko", userId: "1" })),
    handler(post({ username: "demetri", userId: "2" })),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(parseSearchedUsers(store.text()).map((row) => row.username).sort(), ["demetri", "niko"]);
});

test("storage failures return retryable errors instead of false success", async () => {
  for (const getStore of [
    () => null,
    () => memoryTextStore(null, { failRead: true }),
    () => memoryTextStore(null, { failWrite: true }),
  ]) {
    const handler = createSearchedUserHandler({ getStore, nowFn: () => NOW });
    const response = await handler(post({ username: "niko" }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).retryable, true);
  }
});

test("Netlify routes /api/searched-user to the function ahead of the 404 catch-all", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  const routeAt = toml.indexOf('from = "/api/searched-user"');
  assert.ok(routeAt > 0);
  assert.ok(toml.indexOf('from = "/*"') > routeAt);
  assert.match(toml, /to = "\/\.netlify\/functions\/searched-user"/);
  assert.match(readFileSync(join(root, "docs/_redirects"), "utf8"), /\/api\/searched-user\s+\/\.netlify\/functions\/searched-user\s+200!/);

  const fn = readFileSync(join(root, "netlify/functions/searched-user.js"), "utf8");
  assert.match(fn, /SEARCHED_USERS_STORE/);
  assert.match(fn, /export default/);
  assert.equal(SEARCHED_USERS_STORE, "desk-users");
  assert.equal(SEARCHED_USERS_KEY, "searched-users.csv");
});

test("the download script needs Netlify credentials and its output stays out of git", () => {
  const missing = spawnSync(process.execPath, [join(root, "scripts/searched_users.mjs")], {
    encoding: "utf8",
    env: { ...process.env, NETLIFY_AUTH_TOKEN: "", NETLIFY_SITE_ID: "" },
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /NETLIFY_AUTH_TOKEN/);
  assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^searched-users\.csv$/m);
});

test("the privacy policy says usernames are saved only after a league opens", () => {
  const privacy = readFileSync(join(root, "docs/privacy.html"), "utf8");
  assert.match(privacy, /<h2>Searched usernames<\/h2>/);
  assert.match(privacy, /adds that username to a list/);
  assert.match(privacy, /Every other username already on the list stays/);
  assert.match(privacy, /leagues actually opens/);
  assert.match(privacy, /typo/i);
  assert.match(privacy, /misspelling stays the same person/);
  assert.doesNotMatch(privacy, /It does not store your Sleeper username/);
});
