import test from "node:test";
import assert from "node:assert/strict";
import {
  applyVisit,
  cleanSourceHost,
  clientIp,
  createVisitHandler,
  flattenTrafficCounts,
  isAllowedWrite,
  isBot,
  landingFromReferer,
  summarize,
  visitPeriodKeys,
  visitorHash,
  wrapLambdaHandler,
} from "../netlify/lib/traffic.js";

const NOW = new Date("2026-09-16T18:00:00.000Z");

function memoryStore(initial = null, { barrierReads = 0, failRead = false, failWrite = false } = {}) {
  let value = initial == null ? null : structuredClone(initial);
  let version = value == null ? 0 : 1;
  let remainingBarrierReads = barrierReads;
  let releaseBarrier = null;
  const barrier = barrierReads > 0
    ? new Promise((resolve) => { releaseBarrier = resolve; })
    : null;

  function etag() {
    return value == null ? "" : `v${version}`;
  }

  return {
    async getWithMetadata() {
      if (failRead) throw new Error("read failed");
      if (remainingBarrierReads > 0) {
        remainingBarrierReads -= 1;
        if (remainingBarrierReads === 0) releaseBarrier?.();
        else await barrier;
      }
      if (value == null) return null;
      return { data: structuredClone(value), metadata: {}, etag: etag() };
    },
    async setJSON(_key, next, options = {}) {
      if (failWrite) throw new Error("write failed");
      const currentEtag = etag();
      if (options.onlyIfNew === true && value != null) return { modified: false, etag: currentEtag };
      if (options.onlyIfMatch && options.onlyIfMatch !== currentEtag) return { modified: false, etag: currentEtag };
      value = structuredClone(next);
      version += 1;
      return { modified: true, etag: etag() };
    },
    snapshot() {
      return structuredClone(value);
    },
  };
}

function request(url, { method = "GET", headers = {} } = {}) {
  return new Request(url, { method, headers });
}

function liveHeaders() {
  return {
    origin: "https://dynastyticker.com",
    "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
  };
}

function core(bucket) {
  return { views: bucket.views, people: bucket.people, active: bucket.active };
}

test("period keys use the US Eastern day, ISO week, and calendar year", () => {
  const periods = visitPeriodKeys(NOW);
  assert.equal(periods.day, "2026-09-16");
  assert.equal(periods.week, "2026-W38");
  assert.equal(periods.year, "2026");
  const sundayNight = new Date("2026-09-21T01:30:00.000Z");
  assert.equal(visitPeriodKeys(sundayNight).day, "2026-09-20");
  assert.equal(visitPeriodKeys(sundayNight).week, "2026-W38");
  const mondayMorning = new Date("2026-09-21T05:30:00.000Z");
  assert.equal(visitPeriodKeys(mondayMorning).day, "2026-09-21");
  assert.equal(visitPeriodKeys(mondayMorning).week, "2026-W39");
});

test("visitor hashes stay stable for the same IP and browser", () => {
  const first = visitorHash("1.2.3.4", "Mozilla/5.0 Desk");
  const second = visitorHash("1.2.3.4", "Mozilla/5.0 Desk");
  const other = visitorHash("5.6.7.8", "Mozilla/5.0 Desk");
  assert.equal(first, second);
  assert.equal(first.length, 32);
  assert.notEqual(first, other);
});

test("bot user-agents are skipped, browsers are not", () => {
  assert.equal(isBot("Mozilla/5.0 Chrome/129.0.0.0"), false);
  assert.equal(isBot("Googlebot/2.1"), true);
  assert.equal(isBot("Slackbot-LinkExpanding 1.0"), true);
  assert.equal(isBot("python-urllib/3.12"), true);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 WhatsApp/23.20.0"), false);
  assert.equal(isBot("Mozilla/5.0 (compatible; bingpreview/1.0)"), true);
});

test("one person reloading adds views but not people", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  state = applyVisit(state, { hash: "aaa", now: NOW });
  const summary = summarize(state, NOW);
  assert.deepEqual(core(summary.today), { views: 2, people: 1, active: 0 });
  assert.deepEqual(core(summary.week), { views: 2, people: 1, active: 0 });
  assert.deepEqual(core(summary.all), { views: 2, people: 1, active: 0 });
});

test("two people on the same day count as two people", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  state = applyVisit(state, { hash: "bbb", now: NOW });
  const summary = summarize(state, NOW);
  assert.deepEqual(core(summary.today), { views: 2, people: 2, active: 0 });
  assert.equal(flattenTrafficCounts(summary).length, 8);
  assert.deepEqual(flattenTrafficCounts(summary), [2, 2, 2, 2, 2, 2, 2, 2]);
});

test("Sunday night Eastern stays on Sunday, and the next morning starts a fresh day", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW });
  const evening = new Date("2026-09-17T01:00:00.000Z");
  state = applyVisit(state, { hash: "aaa", now: evening });
  assert.deepEqual(core(summarize(state, evening).today), { views: 2, people: 1, active: 0 });
  const nextDay = new Date("2026-09-17T14:00:00.000Z");
  state = applyVisit(state, { hash: "aaa", now: nextDay });
  const summary = summarize(state, nextDay);
  assert.deepEqual(core(summary.today), { views: 1, people: 1, active: 0 });
  assert.deepEqual(core(summary.week), { views: 3, people: 1, active: 0 });
  assert.deepEqual(core(summary.all), { views: 3, people: 1, active: 0 });
  assert.equal(summarize(state, NOW).today.views, 2);
  assert.equal(summary.days.at(-1).day, "2026-09-17");
  assert.equal(summary.days.length, 14);
});

test("write access needs the live origin or referer", () => {
  const live = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { origin: "https://dynastyticker.com" },
  });
  const www = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { referer: "https://www.dynastyticker.com/privacy.html" },
  });
  const other = request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  assert.equal(isAllowedWrite(live), true);
  assert.equal(isAllowedWrite(www), true);
  assert.equal(isAllowedWrite(other), false);
});

test("the visit handler counts people from hashed IP plus user-agent", async () => {
  const store = memoryStore();
  const handler = createVisitHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
  });
  const headers = liveHeaders();

  const first = await handler(request("https://dynastyticker.com/api/visit", { method: "POST", headers }), { ip: "1.2.3.4" });
  assert.equal(first.status, 200);
  const reload = await handler(request("https://dynastyticker.com/api/visit", { method: "POST", headers }), { ip: "1.2.3.4" });
  assert.equal(reload.status, 200);
  const other = await handler(request("https://dynastyticker.com/api/visit", { method: "POST", headers }), { ip: "9.9.9.9" });
  assert.equal(other.status, 200);

  const bot = await handler(
    request("https://dynastyticker.com/api/visit", {
      method: "POST",
      headers: { ...headers, "user-agent": "Googlebot/2.1" },
    }),
    { ip: "8.8.8.8" },
  );
  assert.equal(bot.status, 200);
  assert.equal((await bot.json()).skipped, "bot");

  const forbidden = await handler(
    request("https://dynastyticker.com/api/visit", {
      method: "POST",
      headers: { origin: "https://evil.example", "user-agent": headers["user-agent"] },
    }),
    { ip: "2.2.2.2" },
  );
  assert.equal(forbidden.status, 403);

  const read = await handler(request("https://dynastyticker.com/api/views"));
  assert.equal(read.status, 200);
  const payload = await read.json();
  assert.deepEqual(core(payload.today), { views: 3, people: 2, active: 0 });
  assert.deepEqual(core(payload.all), { views: 3, people: 2, active: 0 });
  assert.equal(payload.today.landings.home, 3);
  assert.equal(JSON.stringify(payload).includes("seen"), false);
});

test("concurrent page views are retained after conditional-write conflicts", async () => {
  const store = memoryStore(null, { barrierReads: 2 });
  const handler = createVisitHandler({ getStore: () => store, nowFn: () => NOW, salt: "test-salt" });
  const [first, second] = await Promise.all([
    handler(request("https://dynastyticker.com/api/visit", { method: "POST", headers: liveHeaders() }), { ip: "1.1.1.1" }),
    handler(request("https://dynastyticker.com/api/visit", { method: "POST", headers: liveHeaders() }), { ip: "2.2.2.2" }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(core(summarize(store.snapshot(), NOW).today), { views: 2, people: 2, active: 0 });
});

test("storage failures return retryable errors instead of false success", async () => {
  const unavailable = createVisitHandler({ getStore: () => null, nowFn: () => NOW });
  const missing = await unavailable(request("https://dynastyticker.com/api/visit", { method: "POST", headers: liveHeaders() }), { ip: "1.1.1.1" });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).retryable, true);

  const readFailure = createVisitHandler({ getStore: () => memoryStore(null, { failRead: true }), nowFn: () => NOW });
  const failedRead = await readFailure(request("https://dynastyticker.com/api/visit", { method: "POST", headers: liveHeaders() }), { ip: "1.1.1.1" });
  assert.equal(failedRead.status, 503);

  const writeFailure = createVisitHandler({ getStore: () => memoryStore(null, { failWrite: true }), nowFn: () => NOW });
  const failedWrite = await writeFailure(request("https://dynastyticker.com/api/visit", { method: "POST", headers: liveHeaders() }), { ip: "1.1.1.1" });
  assert.equal(failedWrite.status, 503);
});

test("client IP prefers Netlify context then forwarded headers", () => {
  const req = request("https://dynastyticker.com/api/visit", {
    headers: {
      "x-forwarded-for": "9.9.9.9, 1.1.1.1",
      "x-nf-client-connection-ip": "8.8.4.4",
    },
  });
  assert.equal(clientIp(req, { ip: "1.2.3.4" }), "1.2.3.4");
  assert.equal(clientIp(req, {}), "8.8.4.4");
});

test("classic wrapper remains testable for request conversion", async () => {
  const store = memoryStore();
  const handler = wrapLambdaHandler(createVisitHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
  }));
  const posted = await handler({
    httpMethod: "POST",
    path: "/.netlify/functions/visit",
    headers: {
      host: "dynastyticker.com",
      origin: "https://dynastyticker.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
    },
  }, { ip: "1.2.3.4" });
  assert.equal(posted.statusCode, 200);
  assert.equal(JSON.parse(posted.body).ok, true);

  const read = await handler({
    httpMethod: "GET",
    path: "/.netlify/functions/visit",
    headers: { host: "dynastyticker.com" },
  });
  assert.equal(read.statusCode, 200);
  assert.deepEqual(core(JSON.parse(read.body).today), { views: 1, people: 1, active: 0 });
});

test("a browser id stays one person when the IP changes", () => {
  const id = "ab".repeat(16);
  const first = visitorHash("1.2.3.4", "Mozilla/5.0", "test-salt", id);
  const moved = visitorHash("9.9.9.9", "Mozilla/5.0", "test-salt", id);
  const other = visitorHash("1.2.3.4", "Mozilla/5.0", "test-salt", "cd".repeat(16));
  assert.equal(first, moved);
  assert.notEqual(first, other);
  assert.notEqual(first, visitorHash("1.2.3.4", "Mozilla/5.0", "test-salt"));
});

test("loading a league counts active use without a second view", () => {
  let state = applyVisit(null, { hash: "aaa", now: NOW, eventId: "open-1", source: "t.co", landing: "shared" });
  state = applyVisit(state, { hash: "aaa", now: NOW, eventId: "open-1", source: "t.co", landing: "shared" });
  state = applyVisit(state, { hash: "aaa", now: NOW, eventId: "use-1", kind: "active" });
  const summary = summarize(state, NOW);
  assert.deepEqual(core(summary.today), { views: 1, people: 1, active: 1 });
  assert.equal(summary.today.sources["t.co"], 1);
  assert.equal(summary.today.landings.shared, 1);
  assert.equal(summary.all.active, 1);
});

test("shared links keep the landing and drop the league id", () => {
  assert.equal(landingFromReferer("https://dynastyticker.com/?league=999&tab=trades"), "shared");
  assert.equal(landingFromReferer("https://www.dynastyticker.com/privacy.html"), "legal");
  assert.equal(landingFromReferer("https://dynastyticker.com/"), "home");
  assert.equal(cleanSourceHost("https://evil.example/league/999"), "direct");
  assert.equal(cleanSourceHost("www.instagram.com"), "instagram.com");
});

test("the visit handler keeps one person across a retried browser id", async () => {
  const store = memoryStore();
  const handler = createVisitHandler({ getStore: () => store, nowFn: () => NOW, salt: "test-salt" });
  const body = JSON.stringify({
    eventId: "evt-retry",
    visitorId: "a".repeat(32),
    kind: "open",
    source: "instagram.com",
  });
  const headers = {
    ...liveHeaders(),
    "content-type": "application/json",
    referer: "https://dynastyticker.com/?league=1315",
  };
  const first = await handler(new Request("https://dynastyticker.com/api/visit", { method: "POST", headers, body }), { ip: "1.1.1.1" });
  const retry = await handler(new Request("https://dynastyticker.com/api/visit", { method: "POST", headers, body }), { ip: "8.8.8.8" });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  const used = await handler(new Request("https://dynastyticker.com/api/visit", {
    method: "POST",
    headers,
    body: JSON.stringify({ eventId: "evt-use", visitorId: "a".repeat(32), kind: "active" }),
  }), { ip: "8.8.8.8" });
  assert.equal(used.status, 200);
  const payload = await (await handler(request("https://dynastyticker.com/api/views"))).json();
  assert.deepEqual(core(payload.today), { views: 1, people: 1, active: 1 });
  assert.equal(payload.today.sources["instagram.com"], 1);
  assert.equal(payload.today.landings.shared, 1);
  assert.equal(JSON.stringify(payload).includes("1315"), false);
  assert.equal(JSON.stringify(payload).includes("seen"), false);
});
