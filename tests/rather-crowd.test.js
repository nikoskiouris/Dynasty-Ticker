import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchRatherCrowdVotes,
  isLiveRatherHost,
  parseRatherCrowdVotes,
  ratherVoteUrl,
  submitRatherCrowdVote,
} from "../docs/modules/rather-crowd.js";
import {
  applyRatherVote,
  createRatherVoteHandler,
  normalizeRatherState,
  publicRatherVotes,
  RATHER_MAX_STORED_VOTES,
  RATHER_RATE_KEEP_MS,
  RATHER_VOTE_RETENTION_MS,
  sanitizeRatherVote,
  wrapLambdaHandler,
} from "../netlify/lib/rather-crowd.js";

const NOW = new Date("2026-09-17T02:00:00.000Z");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
      if (options.onlyIfNew === true && value != null) {
        return { modified: false, etag: currentEtag };
      }
      if (options.onlyIfMatch && options.onlyIfMatch !== currentEtag) {
        return { modified: false, etag: currentEtag };
      }
      value = structuredClone(next);
      version += 1;
      return { modified: true, etag: etag() };
    },
    snapshot() {
      return structuredClone(value);
    },
  };
}

function headers() {
  return {
    origin: "https://dynastyticker.com",
    "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
    "content-type": "application/json",
  };
}

function voteBody(overrides = {}) {
  return {
    eventId: "event-1",
    winnerId: "player:11566",
    loserId: "player:12504",
    format: "PPR 12-man Superflex",
    at: 1,
    ...overrides,
  };
}

function postRequest(body = voteBody()) {
  return new Request("https://dynastyticker.com/api/rather-vote", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
}

test("rather vote URLs stay first-party on the live host", () => {
  assert.equal(ratherVoteUrl({ hostname: "dynastyticker.com" }), "https://dynastyticker.com/api/rather-vote");
  assert.equal(isLiveRatherHost({ hostname: "dynastyticker.com" }), true);
  assert.equal(isLiveRatherHost({ hostname: "localhost" }), false);
});

test("localhost does not read or write public rather votes", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ votes: [] }) };
  };
  assert.equal(await fetchRatherCrowdVotes({ fetchFn, location: { hostname: "127.0.0.1" } }), null);
  assert.equal(await submitRatherCrowdVote({ winnerId: "player:1", loserId: "player:2" }, {
    fetchFn,
    location: { hostname: "localhost" },
  }), null);
  assert.equal(calls.length, 0);
});

test("live host posts a durable vote and reads the public list", async () => {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET", body: options.body });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        saved: true,
        votes: [{ eventId: "e1", winnerId: "player:11566", loserId: "player:12504", format: "sf", at: 1 }],
      }),
    };
  };
  const loaded = await fetchRatherCrowdVotes({ fetchFn, location: { hostname: "dynastyticker.com" } });
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].winnerId, "player:11566");
  const posted = await submitRatherCrowdVote({
    eventId: "stable-event",
    winnerId: "player:11566",
    loserId: "player:12504",
    format: "PPR 12-man Superflex",
  }, { fetchFn, location: { hostname: "www.dynastyticker.com" } });
  assert.equal(posted[0].winnerId, "player:11566");
  assert.equal(calls[1].method, "POST");
  assert.match(calls[1].body, /stable-event/);
});

test("client retries retryable failures with the same event id", async () => {
  const bodies = [];
  let count = 0;
  const fetchFn = async (_url, options = {}) => {
    bodies.push(options.body);
    count += 1;
    if (count === 1) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: "conflict", retryable: true }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ saved: true, votes: [voteBody({ eventId: "retry-event", at: NOW.getTime(), format: "sf" })] }),
    };
  };
  const result = await submitRatherCrowdVote(voteBody({ eventId: "retry-event" }), {
    fetchFn,
    location: { hostname: "dynastyticker.com" },
  });
  assert.equal(result.length, 1);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test("junk votes and unsupported formats are dropped", () => {
  assert.equal(sanitizeRatherVote({ winnerId: "player:1", loserId: "player:1", format: "sf" }), null);
  assert.equal(sanitizeRatherVote({ winnerId: "pick:2026:r1:any", loserId: "player:1", format: "sf" }), null);
  assert.equal(sanitizeRatherVote({ winnerId: "player:1", loserId: "player:2", format: "redraft" }), null);
  assert.deepEqual(parseRatherCrowdVotes({
    votes: [
      { eventId: "e1", winnerId: "player:a", loserId: "player:b", format: "sf", at: 9 },
      { winnerId: "player:a", loserId: "player:a" },
    ],
  }), [{ eventId: "e1", winnerId: "player:a", loserId: "player:b", format: "sf", at: 9 }]);
});

test("a successful vote is durably readable and uses server time", async () => {
  const store = memoryStore();
  const handler = createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  });

  const posted = await handler(postRequest(), { ip: "1.2.3.4" });
  assert.equal(posted.status, 200);
  const body = await posted.json();
  assert.equal(body.ok, true);
  assert.equal(body.saved, true);
  assert.equal(body.voteCount, 1);
  assert.equal(body.votes[0].winnerId, "player:11566");
  assert.equal(body.votes[0].at, NOW.getTime());
  assert.equal(posted.headers.get("access-control-allow-origin"), null);
  assert.equal(JSON.stringify(body).includes("voterKey"), false);
  assert.equal(JSON.stringify(store.snapshot()).includes("voterKey"), false);

  const read = await handler(new Request("https://dynastyticker.com/api/rather-vote"));
  assert.equal(read.status, 200);
  assert.equal((await read.json()).voteCount, 1);
});

test("two concurrent distinct votes survive compare-and-swap conflicts", async () => {
  const store = memoryStore(null, { barrierReads: 2 });
  const handler = createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  });

  const [first, second] = await Promise.all([
    handler(postRequest(voteBody({ eventId: "concurrent-a" })), { ip: "1.1.1.1" }),
    handler(postRequest(voteBody({ eventId: "concurrent-b", winnerId: "player:12504", loserId: "player:11566" })), { ip: "2.2.2.2" }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(normalizeRatherState(store.snapshot()).votes.length, 2);
});

test("replaying the same event id is idempotent", async () => {
  const store = memoryStore();
  const handler = createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  });
  const first = await handler(postRequest(voteBody({ eventId: "same-event" })), { ip: "1.2.3.4" });
  assert.equal(first.status, 200);
  const second = await handler(postRequest(voteBody({ eventId: "same-event" })), { ip: "9.9.9.9" });
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.duplicate, true);
  assert.equal(body.voteCount, 1);
});

test("one voter cannot stack repeated influence on the same pair", () => {
  const first = applyRatherVote(null, {
    vote: voteBody({ eventId: "one", format: "sf" }),
    visitorHash: "visitor",
    now: NOW,
  });
  assert.equal(first.ok, true);
  const repeated = applyRatherVote(first.state, {
    vote: voteBody({ eventId: "two", format: "sf" }),
    visitorHash: "visitor",
    now: new Date(NOW.getTime() + 500),
  });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.state.votes.length, 1);
  assert.equal(repeated.state.votes[0].voterKey, undefined);
});

test("a voter can change their mind on the same pair inside the rate window", () => {
  const first = applyRatherVote(null, {
    vote: voteBody({ eventId: "one", format: "sf" }),
    visitorHash: "visitor",
    now: NOW,
  });
  const flipped = applyRatherVote(first.state, {
    vote: voteBody({
      eventId: "two",
      format: "sf",
      winnerId: "player:12504",
      loserId: "player:11566",
    }),
    visitorHash: "visitor",
    now: new Date(NOW.getTime() + 500),
  });
  assert.equal(flipped.ok, true);
  assert.equal(flipped.replaced, true);
  assert.equal(flipped.state.votes.length, 1);
  assert.equal(flipped.state.votes[0].winnerId, "player:12504");
  assert.equal(flipped.state.votes[0].voterKey, undefined);
});

test("a public read drops a legacy voter key from the stored blob", async () => {
  const store = memoryStore({
    votes: [{
      eventId: "e1",
      winnerId: "player:11566",
      loserId: "player:12504",
      format: "sf",
      at: NOW.getTime(),
      voterKey: "legacy-voter",
    }],
    visitors: {},
  });
  const handler = createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  });
  const read = await handler(new Request("https://dynastyticker.com/api/rather-vote"));
  assert.equal(read.status, 200);
  const body = await read.json();
  assert.equal(body.voteCount, 1);
  assert.equal(JSON.stringify(body).includes("voterKey"), false);
  assert.equal(JSON.stringify(store.snapshot()).includes("voterKey"), false);
  assert.equal(store.snapshot().visitors["legacy-voter"].pairs["sf|player:11566|player:12504"].winnerId, "player:11566");
});

test("voter hash leaves with the rate-limit record", () => {
  const first = applyRatherVote(null, {
    vote: voteBody({ eventId: "one", format: "sf" }),
    visitorHash: "visitor",
    now: NOW,
  });
  assert.equal(first.state.votes[0].voterKey, undefined);
  assert.equal(first.state.visitors.visitor.pairs["sf|player:11566|player:12504"].winnerId, "player:11566");
  const later = new Date(NOW.getTime() + RATHER_RATE_KEEP_MS + 1000);
  const again = applyRatherVote(first.state, {
    vote: voteBody({ eventId: "later", format: "sf" }),
    visitorHash: "visitor",
    now: later,
  });
  assert.equal(again.ok, true);
  assert.equal(again.changed, true);
  assert.equal(again.state.votes.length, 2);
  assert.equal(again.state.votes.some((vote) => vote.voterKey), false);
});

test("read, write, and initialization failures never report a saved vote", async () => {
  const missingSalt = createRatherVoteHandler({ getStore: () => memoryStore(), nowFn: () => NOW, salt: "dynasty-ticker-rather-v1" });
  const refused = await missingSalt(postRequest(), { ip: "1.2.3.4" });
  assert.equal(refused.status, 503);
  assert.equal((await refused.json()).error, "config");

  const missingHandler = createRatherVoteHandler({ getStore: () => null, nowFn: () => NOW, salt: "test-salt" });
  const missing = await missingHandler(postRequest(), { ip: "1.2.3.4" });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).retryable, true);

  const readHandler = createRatherVoteHandler({ getStore: () => memoryStore(null, { failRead: true }), nowFn: () => NOW, salt: "test-salt" });
  const readFailure = await readHandler(postRequest(), { ip: "1.2.3.4" });
  assert.equal(readFailure.status, 503);
  assert.equal((await readFailure.json()).saved, undefined);

  const writeHandler = createRatherVoteHandler({ getStore: () => memoryStore(null, { failWrite: true }), nowFn: () => NOW, salt: "test-salt" });
  const writeFailure = await writeHandler(postRequest(), { ip: "1.2.3.4" });
  assert.equal(writeFailure.status, 503);
  assert.equal((await writeFailure.json()).saved, undefined);
});

test("stored rather votes are capped and public reads hide voter keys", () => {
  const votes = Array.from({ length: 5001 }, (_, index) => ({
    eventId: `e${index}`,
    winnerId: "player:a",
    loserId: "player:b",
    format: "sf",
    at: NOW.getTime() - index * 1000,
    voterKey: "visitor",
  }));
  const state = normalizeRatherState({ votes, visitors: {} }, NOW);
  assert.equal(state.votes.length, RATHER_MAX_STORED_VOTES);
  assert.equal(state.votes.some((vote) => Object.hasOwn(vote, "voterKey")), false);
  const pub = publicRatherVotes({ votes }, NOW);
  assert.equal(pub.votes.length, RATHER_MAX_STORED_VOTES);
  assert.equal(pub.truncated, true);
  assert.equal(pub.voteCount, RATHER_MAX_STORED_VOTES);
  assert.equal(JSON.stringify(pub).includes("voterKey"), false);
  const expired = normalizeRatherState({
    votes: [{
      eventId: "old",
      winnerId: "player:a",
      loserId: "player:b",
      format: "sf",
      at: NOW.getTime() - RATHER_VOTE_RETENTION_MS - 1,
      voterKey: "visitor",
    }],
    visitors: {
      visitor: { lastAt: NOW.getTime() - RATHER_RATE_KEEP_MS - 1, hourKey: "old", hourCount: 1 },
    },
  }, NOW);
  assert.equal(expired.votes.length, 0);
  assert.equal(expired.visitors.visitor, undefined);
});

test("classic wrapper remains testable for shared request conversion", async () => {
  const store = memoryStore();
  const handler = wrapLambdaHandler(createRatherVoteHandler({
    getStore: () => store,
    nowFn: () => NOW,
    salt: "test-salt",
    allowedOrigins: ["https://dynastyticker.com"],
  }));
  const posted = await handler({
    httpMethod: "POST",
    path: "/.netlify/functions/rather-vote",
    headers: {
      host: "dynastyticker.com",
      origin: "https://dynastyticker.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0.0.0",
      "content-type": "application/json",
    },
    body: JSON.stringify(voteBody({ eventId: "lambda-event" })),
  }, { ip: "8.8.8.8" });
  assert.equal(posted.statusCode, 200);
  assert.equal(JSON.parse(posted.body).votes[0].loserId, "player:12504");
});

test("site wiring uses the modern Netlify rather vote function", () => {
  const netlify = readFileSync(join(root, "netlify.toml"), "utf8");
  const fn = readFileSync(join(root, "netlify/functions/rather-vote.js"), "utf8");
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(netlify, /rather-vote/);
  assert.match(fn, /desk-rather/);
  assert.match(fn, /export default/);
  assert.doesNotMatch(fn, /wrapLambdaHandler/);
  assert.match(app, /hydrateCrowdVotes/);
  assert.match(app, /submitRatherCrowdVote/);
  assert.equal(publicRatherVotes({ votes: [{ winnerId: "player:a", loserId: "player:b" }] }).voteCount, 1);
});
