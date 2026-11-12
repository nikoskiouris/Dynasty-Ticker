import { createHash } from "node:crypto";
import {
  DEFAULT_ORIGINS,
  acceptSalt,
  clientIp,
  isAllowedWrite,
  isBot,
  readVisitBody,
} from "./traffic.js";
import {
  POLL_MAX_STOP,
  cleanVoterId,
  countsFromVotes,
  isPollStop,
  orientCounts,
  orientStop,
  pollKeyFromCode,
} from "../../docs/modules/trade-poll.js";

// One blob per trade (the canonical poll key), so votes on different trades
// never contend. Each blob: { v: 1, votes: { voterHash: stop }, ips: { ipHash: [voterHash] } }.
// A voter can change their vote. A network address can add at most
// POLL_VOTERS_PER_IP voters to one trade, so clearing storage does not
// stuff the box. Nothing stored names a person: both keys are salted hashes.
export const POLL_STORE = "trade-polls";
export const POLL_MAX_WRITE_RETRIES = 8;
export const POLL_VOTERS_PER_IP = 3;
export const POLL_MAX_VOTERS = 20000;

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function hash(salt, kind, value) {
  return createHash("sha256").update(`${salt}\npoll-${kind}\n${value}`).digest("hex").slice(0, 32);
}

function normalizePoll(data) {
  const votes = {};
  const ips = {};
  if (data && typeof data === "object") {
    for (const [voter, stop] of Object.entries(data.votes || {})) {
      if (/^[0-9a-f]{32}$/.test(voter) && isPollStop(stop)) votes[voter] = stop;
    }
    for (const [ip, list] of Object.entries(data.ips || {})) {
      if (/^[0-9a-f]{32}$/.test(ip) && Array.isArray(list)) ips[ip] = list.filter((v) => /^[0-9a-f]{32}$/.test(v)).slice(0, POLL_VOTERS_PER_IP);
    }
  }
  return { v: 1, votes, ips };
}

// Pure: the next poll, or a reason the vote is refused.
export function applyVote(poll, { voter, ip, stop }) {
  const next = normalizePoll(poll);
  if (!isPollStop(stop)) return { error: "stop" };
  const known = Object.hasOwn(next.votes, voter);
  if (!known) {
    if (Object.keys(next.votes).length >= POLL_MAX_VOTERS) return { error: "full" };
    const seen = ip ? next.ips[ip] || [] : [];
    if (ip && seen.length >= POLL_VOTERS_PER_IP) return { error: "limit" };
    if (ip) next.ips[ip] = [...seen, voter];
  }
  next.votes[voter] = stop;
  return { poll: next };
}

async function readPoll(store, key) {
  const snapshot = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
  if (!snapshot) return { poll: normalizePoll(null), etag: "", exists: false };
  return { poll: normalizePoll(snapshot.data), etag: typeof snapshot.etag === "string" ? snapshot.etag : "", exists: true };
}

async function writePoll(store, key, poll, snapshot) {
  if (snapshot.exists && !snapshot.etag) throw new Error("missing etag");
  const condition = snapshot.exists ? { onlyIfMatch: snapshot.etag } : { onlyIfNew: true };
  const result = await store.setJSON(key, poll, condition);
  return result?.modified === true;
}

// GET  /api/trade-poll?code=<share code>[&voter=<id>] -> { total, counts, mine }
// POST /api/trade-poll { code, stop, voter }           -> same, after the vote
// counts and stops come back in the caller's chair (Team 1 = their Give side).
export function createTradePollHandler({
  getStore,
  salt = () => process.env.VISIT_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function tradePollHandler(req, context = {}) {
    const secret = acceptSalt(typeof salt === "function" ? salt() : salt);
    if (!secret) return jsonResponse({ error: "off" }, { status: 503 });

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }

    const reply = (poll, flip, voterHash) => {
      const counts = orientCounts(countsFromVotes(poll.votes), flip);
      const mine = voterHash && Object.hasOwn(poll.votes, voterHash) ? orientStop(poll.votes[voterHash], flip) : null;
      return jsonResponse({ ok: true, total: counts.reduce((a, b) => a + b, 0), counts, mine });
    };

    if (req.method === "GET") {
      const url = new URL(req.url);
      const target = pollKeyFromCode(url.searchParams.get("code") || "");
      if (!target) return jsonResponse({ error: "code" }, { status: 400 });
      const voter = cleanVoterId(url.searchParams.get("voter"));
      try {
        const { poll } = await readPoll(store, target.key);
        return reply(poll, target.flip, voter ? hash(secret, "voter", voter) : "");
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405, headers: { allow: "GET, POST" } });
    }
    if (!isAllowedWrite(req, allowedOrigins)) return jsonResponse({ error: "forbidden" }, { status: 403 });
    if (isBot(req.headers.get("user-agent") || "")) return jsonResponse({ error: "bot" }, { status: 403 });

    const body = await readVisitBody(req);
    const target = pollKeyFromCode(body.code || "");
    if (!target) return jsonResponse({ error: "code" }, { status: 400 });
    const voter = cleanVoterId(body.voter);
    if (!voter) return jsonResponse({ error: "voter" }, { status: 400 });
    const stop = Number(body.stop);
    if (!isPollStop(stop) || Math.abs(stop) > POLL_MAX_STOP) return jsonResponse({ error: "stop" }, { status: 400 });

    const voterHash = hash(secret, "voter", voter);
    const ip = clientIp(req, context);
    const ipHash = ip ? hash(secret, "ip", ip) : "";
    const stored = orientStop(stop, target.flip);

    for (let attempt = 0; attempt < POLL_MAX_WRITE_RETRIES; attempt += 1) {
      try {
        const snapshot = await readPoll(store, target.key);
        const result = applyVote(snapshot.poll, { voter: voterHash, ip: ipHash, stop: stored });
        if (result.error === "limit") return jsonResponse({ error: "limit" }, { status: 429 });
        if (result.error) return jsonResponse({ error: result.error }, { status: 409 });
        if (await writePoll(store, target.key, result.poll, snapshot)) return reply(result.poll, target.flip, voterHash);
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }
    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}
