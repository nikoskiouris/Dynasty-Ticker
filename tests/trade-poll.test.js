import test from "node:test";
import assert from "node:assert/strict";
import {
  POLL_MIN_VOTES,
  orientCounts,
  pollKeyFromCode,
  pollSummary,
  stopLine,
} from "../docs/modules/trade-poll.js";
import { POLL_VOTERS_PER_IP, applyVote, createTradePollHandler } from "../netlify/lib/trade-poll.js";

const SALT = "test-salt-not-the-public-default";
const ORIGIN = "https://dynastyticker.com";
const CODE = "1s4866~9509.p27r1a"; // Team 1 gives 4866, gets 9509 + a 2027 1st
const MIRROR = "1sp27r1a.9509~4866"; // the same trade from the other chair
const VOTER_A = "aaaaaaaa-1111-2222-3333-444444444444";
const VOTER_B = "bbbbbbbb-1111-2222-3333-444444444444";

function memoryStore() {
  const rows = new Map();
  let n = 0;
  return {
    rows,
    async getWithMetadata(key) {
      const row = rows.get(key);
      return row ? { data: structuredClone(row.data), etag: row.etag } : null;
    },
    async setJSON(key, data, condition = {}) {
      const row = rows.get(key);
      if (condition.onlyIfNew && row) return { modified: false };
      if (condition.onlyIfMatch && row?.etag !== condition.onlyIfMatch) return { modified: false };
      n += 1;
      rows.set(key, { data: structuredClone(data), etag: `e${n}` });
      return { modified: true, etag: `e${n}` };
    },
  };
}

function handler(store, salt = SALT) {
  return createTradePollHandler({ getStore: () => store, salt });
}

function vote(code, stop, voter, { ip = "203.0.113.9", origin = ORIGIN, ua = "Mozilla/5.0" } = {}) {
  const req = new Request(`${ORIGIN}/api/trade-poll`, {
    method: "POST",
    headers: { origin, "user-agent": ua, "content-type": "application/json" },
    body: JSON.stringify({ code, stop, voter }),
  });
  return [req, { ip }];
}

async function read(fn, code, voter = "") {
  const res = await fn(new Request(`${ORIGIN}/api/trade-poll?code=${encodeURIComponent(code)}${voter ? `&voter=${voter}` : ""}`));
  return { status: res.status, body: await res.json() };
}

test("one poll per trade: order, price date and chair do not split the votes", () => {
  const a = pollKeyFromCode(CODE);
  const reordered = pollKeyFromCode("1s4866~p27r1a.9509");
  const dated = pollKeyFromCode("2s2026110912004866~9509.p27r1a");
  const mirror = pollKeyFromCode(MIRROR);
  assert.equal(a.key, reordered.key);
  assert.equal(a.key, dated.key);
  assert.equal(a.key, mirror.key);
  assert.notEqual(a.flip, mirror.flip);
  // 1QB is a different market, so a different poll.
  assert.notEqual(pollKeyFromCode("1q4866~9509.p27r1a").key, a.key);
  assert.equal(pollKeyFromCode("not a code"), null);
});

test("the slider reads outside in: Veto, Clear winner, Unfair but OK, Slight edge, Even", () => {
  const teams = { one: "You", two: "Them" };
  assert.equal(stopLine(-4, teams), "Veto · You");
  assert.equal(stopLine(-3, teams), "Clear winner · You");
  assert.equal(stopLine(-2, teams), "Unfair but OK · You");
  assert.equal(stopLine(-1, teams), "Slight edge · You");
  assert.equal(stopLine(0, teams), "Even");
  assert.equal(stopLine(3, teams), "Clear winner · Them");
  assert.equal(stopLine(5, teams), "");
});

test("the crowd makes no call until enough people vote, then reports the middle vote", () => {
  const few = pollSummary([0, 0, 0, 2, 0, 0, 0, 0, 0]);
  assert.equal(few.total, 2);
  assert.equal(few.ready, false);
  const counts = [0, 1, 0, 3, 1, 0, 0, 0, 1]; // 6 votes leaning Team 1
  const call = pollSummary(counts);
  assert.ok(call.total >= POLL_MIN_VOTES);
  assert.equal(call.ready, true);
  assert.equal(call.median, -1);
  assert.deepEqual(call.split, { one: 67, even: 17, two: 17 });
  // Two middle votes: the milder one. Middle votes on opposite sides: Even.
  assert.equal(pollSummary([0, 0, 0, 3, 0, 0, 0, 3, 0]).median, 0);
  assert.equal(pollSummary([0, 2, 2, 0, 0, 0, 0, 0, 0]).median, -2);
  assert.deepEqual(orientCounts(counts, true), [...counts].reverse());
});

test("a vote counts once per voter, can change, and is read back in each chair", async () => {
  const store = memoryStore();
  const fn = handler(store);
  let res = await fn(...vote(CODE, -3, VOTER_A));
  let body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.mine, -3);
  assert.equal(body.counts[1], 1);

  // Same voter changes their mind: still one vote.
  body = await (await fn(...vote(CODE, 1, VOTER_A))).json();
  assert.equal(body.total, 1);
  assert.equal(body.mine, 1);

  // A voter on the mirrored link lands in the same poll, flipped.
  body = await (await fn(...vote(MIRROR, -2, VOTER_B, { ip: "198.51.100.4" }))).json();
  assert.equal(body.total, 2);
  assert.equal(body.mine, -2);

  const mine = await read(fn, CODE, VOTER_A);
  assert.equal(mine.body.mine, 1);
  assert.equal(mine.body.counts[4 + 1], 1);
  assert.equal(mine.body.counts[4 + 2], 1, "B's -2 from the other chair is +2 here");
  assert.equal(store.rows.size, 1);
  // Nothing stored is a raw voter id or address.
  const raw = JSON.stringify([...store.rows.values()]);
  assert.equal(raw.includes(VOTER_A), false);
  assert.equal(raw.includes("203.0.113.9"), false);
});

test("one connection cannot stuff the box with fresh voter ids", async () => {
  const fn = handler(memoryStore());
  for (let i = 0; i < POLL_VOTERS_PER_IP; i += 1) {
    const res = await fn(...vote(CODE, -4, `voter-${i}-xxxxxxxxxxxxxxxx`));
    assert.equal(res.status, 200);
  }
  const blocked = await fn(...vote(CODE, -4, "voter-extra-xxxxxxxxxxxxxx"));
  assert.equal(blocked.status, 429);
  // An existing voter on that connection can still change their vote.
  assert.equal((await fn(...vote(CODE, 0, "voter-0-xxxxxxxxxxxxxxxx"))).status, 200);
  assert.equal(applyVote(null, { voter: "a".repeat(32), ip: "", stop: 9 }).error, "stop");
});

test("votes need the site origin, a real stop, a voter id, a real trade, and a salt", async () => {
  const store = memoryStore();
  const fn = handler(store);
  assert.equal((await fn(...vote(CODE, 1, VOTER_A, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await fn(...vote(CODE, 1, VOTER_A, { ua: "Googlebot/2.1" }))).status, 403);
  assert.equal((await fn(...vote(CODE, 7, VOTER_A))).status, 400);
  assert.equal((await fn(...vote(CODE, 1.5, VOTER_A))).status, 400);
  assert.equal((await fn(...vote(CODE, 1, "short"))).status, 400);
  assert.equal((await fn(...vote("1s4866~4866", 1, VOTER_A))).status, 400);
  assert.equal((await read(fn, "garbage")).status, 400);
  assert.equal(store.rows.size, 0);
  const off = handler(store, "");
  assert.equal((await off(...vote(CODE, 1, VOTER_A))).status, 503);
  assert.equal((await handler(store, "dynasty-ticker-traffic-v1")(...vote(CODE, 1, VOTER_A))).status, 503);
});

test("a write race retries on the fresh copy instead of losing a vote", async () => {
  const store = memoryStore();
  const fn = handler(store);
  await Promise.all([
    fn(...vote(CODE, -1, VOTER_A, { ip: "203.0.113.1" })),
    fn(...vote(CODE, 2, VOTER_B, { ip: "203.0.113.2" })),
  ]);
  const { body } = await read(fn, CODE);
  assert.equal(body.total, 2);
});

test("crowd votes stay out of the price: no price module imports the poll", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of ["docs/modules/values.js", "docs/modules/trade-draft.js", "docs/modules/package-value.js", "docs/modules/verdict-copy.js"]) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), /trade-poll/, file);
  }
});
