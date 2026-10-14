import { randomUUID } from "node:crypto";
import {
  DEFAULT_ORIGINS,
  acceptSalt,
  clientIp,
  isAllowedWrite,
  isBot,
  visitorHash,
  wrapLambdaHandler,
} from "./traffic.js";

export const RATHER_STATE_KEY = "state";
export const RATHER_MAX_PER_VISITOR_HOUR = 40;
export const RATHER_MIN_INTERVAL_MS = 400;
export const RATHER_MAX_WRITE_RETRIES = 8;
export const RATHER_RATE_KEEP_MS = 2 * 24 * 60 * 60 * 1000;
export const RATHER_VOTE_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
export const RATHER_MAX_STORED_VOTES = 2000;
export const RATHER_MAX_VISITORS = 5000;
export { wrapLambdaHandler };

export function emptyRatherState() {
  return { votes: [], visitors: {} };
}

export function normalizeRatherFormat(format) {
  const text = String(format || "").trim().toLowerCase();
  if (!text) return "";
  if (text === "oneqb" || text === "one_qb" || text === "1qb" || text.includes("one qb") || text.includes("1qb")) {
    return "oneQb";
  }
  if (text === "sf" || text === "superflex" || text.includes("superflex")) return "sf";
  return "";
}

function sanitizeEventId(eventId) {
  const value = String(eventId || "").trim();
  if (!value || value.length > 100 || !/^[a-zA-Z0-9:_-]+$/.test(value)) return "";
  return value;
}

function sanitizeVoterKey(voterKey) {
  const value = String(voterKey || "").trim();
  if (!value || value.length > 128) return "";
  return value;
}

export function sanitizeRatherVote(vote) {
  const winnerId = String(vote?.winnerId || "");
  const loserId = String(vote?.loserId || "");
  if (!/^player:[a-zA-Z0-9_-]{1,32}$/.test(winnerId) || !/^player:[a-zA-Z0-9_-]{1,32}$/.test(loserId)) return null;
  if (winnerId === loserId) return null;
  const format = normalizeRatherFormat(vote?.format);
  if (!format) return null;
  const at = Number(vote?.at);
  return {
    eventId: sanitizeEventId(vote?.eventId),
    winnerId,
    loserId,
    format,
    at: Number.isFinite(at) && at > 0 ? at : 0,
    voterKey: sanitizeVoterKey(vote?.voterKey),
  };
}

export function hourBucket(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}

function clockMs(now) {
  if (now instanceof Date) return now.getTime();
  const value = Number(now);
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

function votePairKey(vote) {
  return [vote.winnerId, vote.loserId].sort().join("|");
}

function pairMemoryKey(vote) {
  return `${vote.format}|${votePairKey(vote)}`;
}

function capNewest(rows, max, timeOf) {
  if (rows.length <= max) return rows;
  return rows
    .slice()
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, max);
}

function asRatherVisitors(value, nowMs) {
  const out = Object.create(null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const keepAfter = nowMs - RATHER_RATE_KEEP_MS;
  for (const [key, row] of Object.entries(value)) {
    const id = sanitizeVoterKey(key);
    if (!id || id === "__proto__" || id === "prototype" || id === "constructor") continue;
    const lastAt = Number(row?.lastAt);
    if (!Number.isFinite(lastAt) || lastAt < keepAfter) continue;
    const pairs = Object.create(null);
    if (row?.pairs && typeof row.pairs === "object" && !Array.isArray(row.pairs)) {
      for (const [pair, memory] of Object.entries(row.pairs)) {
        const winnerId = String(memory?.winnerId || "");
        if (!/^player:[a-zA-Z0-9_-]{1,32}$/.test(winnerId)) continue;
        const at = Number(memory?.at);
        const stamp = Number.isFinite(at) && at > 0 ? at : lastAt;
        if (nowMs - stamp > RATHER_RATE_KEEP_MS) continue;
        pairs[pair] = {
          winnerId,
          eventId: sanitizeEventId(memory?.eventId),
          at: stamp,
        };
      }
    }
    out[id] = {
      lastAt,
      hourKey: String(row?.hourKey || "").slice(0, 16),
      hourCount: Math.max(0, Math.floor(Number(row?.hourCount) || 0)),
      pairs,
    };
  }
  const ids = Object.keys(out);
  if (ids.length > RATHER_MAX_VISITORS) {
    ids.sort((a, b) => out[a].lastAt - out[b].lastAt || a.localeCompare(b));
    for (const id of ids.slice(0, ids.length - RATHER_MAX_VISITORS)) delete out[id];
  }
  return out;
}

function storedVote(vote) {
  return {
    ...(vote.eventId ? { eventId: vote.eventId } : {}),
    winnerId: vote.winnerId,
    loserId: vote.loserId,
    format: vote.format,
    at: vote.at,
  };
}

function rememberPair(visitors, voterKey, vote) {
  const id = sanitizeVoterKey(voterKey);
  if (!id || !vote?.format) return;
  const row = visitors[id] || { lastAt: 0, hourKey: "", hourCount: 0, pairs: Object.create(null) };
  const pairs = { ...row.pairs };
  pairs[pairMemoryKey(vote)] = {
    winnerId: vote.winnerId,
    eventId: vote.eventId || "",
    at: vote.at,
  };
  const pairIds = Object.keys(pairs);
  if (pairIds.length > RATHER_MAX_PER_VISITOR_HOUR) {
    pairIds.sort((a, b) => (pairs[a].at || 0) - (pairs[b].at || 0));
    for (const pairId of pairIds.slice(0, pairIds.length - RATHER_MAX_PER_VISITOR_HOUR)) delete pairs[pairId];
  }
  visitors[id] = {
    ...row,
    lastAt: Math.max(Number(row.lastAt) || 0, Number(vote.at) || 0),
    pairs,
  };
}

export function normalizeRatherState(raw, now = new Date()) {
  const clock = clockMs(now);
  if (!raw || typeof raw !== "object") return emptyRatherState();
  const visitors = asRatherVisitors(raw.visitors, clock);
  const votes = [];
  for (const vote of Array.isArray(raw.votes) ? raw.votes : []) {
    const cleaned = sanitizeRatherVote(vote);
    if (!cleaned || !cleaned.at) continue;
    if (clock - cleaned.at > RATHER_VOTE_RETENTION_MS) continue;
    if (cleaned.voterKey && clock - cleaned.at <= RATHER_RATE_KEEP_MS) {
      rememberPair(visitors, cleaned.voterKey, cleaned);
    }
    votes.push(storedVote(cleaned));
  }
  votes.sort((a, b) => b.at - a.at || String(a.eventId || "").localeCompare(String(b.eventId || "")));
  return {
    votes: votes.slice(0, RATHER_MAX_STORED_VOTES),
    visitors,
  };
}

export function publicRatherVotes(state, now = new Date()) {
  const clock = clockMs(now);
  const source = Array.isArray(state?.votes) ? state.votes : [];
  const fresh = [];
  for (const vote of source) {
    const at = Number(vote?.at);
    if (Number.isFinite(at) && at > 0 && clock - at > RATHER_VOTE_RETENTION_MS) continue;
    fresh.push(vote);
  }
  fresh.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  const capped = fresh.slice(0, RATHER_MAX_STORED_VOTES);
  return {
    votes: capped.map((vote) => ({
      ...(vote.eventId ? { eventId: vote.eventId } : {}),
      winnerId: vote.winnerId,
      loserId: vote.loserId,
      format: vote.format,
      at: vote.at,
    })),
    voteCount: capped.length,
    truncated: fresh.length > capped.length,
  };
}

export function applyRatherVote(state, { vote, visitorHash: hash, now = new Date() } = {}) {
  const clock = clockMs(now);
  const when = now instanceof Date ? now : new Date(clock);
  const cleaned = sanitizeRatherVote(vote);
  const current = normalizeRatherState(state, when);
  if (!cleaned) return { ok: false, error: "vote", state: current };

  cleaned.at = clock;
  const voter = sanitizeVoterKey(hash);
  if (!voter) return { ok: false, error: "vote", state: current };

  if (cleaned.eventId) {
    const existingEvent = current.votes.find((row) => row.eventId && row.eventId === cleaned.eventId);
    if (existingEvent) {
      return { ok: true, duplicate: true, changed: false, state: current };
    }
  }

  const visitors = { ...current.visitors };
  const visitor = visitors[voter] || { lastAt: 0, hourKey: "", hourCount: 0, pairs: {} };
  const pairs = { ...(visitor.pairs || {}) };
  const pairId = pairMemoryKey(cleaned);
  const prior = pairs[pairId];
  if (prior && prior.winnerId === cleaned.winnerId) {
    return { ok: true, duplicate: true, changed: false, state: current };
  }

  if (clock - Number(visitor.lastAt || 0) < RATHER_MIN_INTERVAL_MS) {
    return { ok: false, error: "slow", state: current };
  }
  const key = hourBucket(when);
  const hourCount = visitor.hourKey === key ? Number(visitor.hourCount || 0) + 1 : 1;
  if (hourCount > RATHER_MAX_PER_VISITOR_HOUR) {
    return { ok: false, error: "limit", state: current };
  }

  pairs[pairId] = { winnerId: cleaned.winnerId, eventId: cleaned.eventId || "", at: clock };
  visitors[voter] = { lastAt: clock, hourKey: key, hourCount, pairs };
  let votes = current.votes.filter((row) => !prior?.eventId || row.eventId !== prior.eventId);
  votes.unshift(storedVote(cleaned));
  votes = capNewest(votes, RATHER_MAX_STORED_VOTES, (row) => row.at || 0);
  return {
    ok: true,
    changed: true,
    replaced: Boolean(prior),
    state: normalizeRatherState({ votes, visitors }, when),
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function ratherBlobNeedsRewrite(raw, normalized) {
  const rawVotes = Array.isArray(raw?.votes) ? raw.votes : [];
  if (rawVotes.length !== normalized.votes.length) return true;
  if (rawVotes.some((vote) => vote && vote.voterKey)) return true;
  const rawVisitors = raw?.visitors && typeof raw.visitors === "object" && !Array.isArray(raw.visitors)
    ? Object.keys(raw.visitors).length
    : 0;
  return rawVisitors !== Object.keys(normalized.visitors).length;
}

async function readRatherSnapshot(store, now) {
  if (!store || typeof store.getWithMetadata !== "function") {
    throw new Error("durable store unavailable");
  }
  const snapshot = await store.getWithMetadata(RATHER_STATE_KEY, {
    type: "json",
    consistency: "strong",
  });
  if (!snapshot) return { state: emptyRatherState(), raw: null, etag: "", exists: false };
  return {
    state: normalizeRatherState(snapshot.data, now),
    raw: snapshot.data,
    etag: typeof snapshot.etag === "string" ? snapshot.etag : "",
    exists: true,
  };
}

async function healRatherSnapshot(store, snapshot) {
  if (!snapshot.exists || !ratherBlobNeedsRewrite(snapshot.raw, snapshot.state)) return;
  try {
    await writeRatherSnapshot(store, snapshot.state, snapshot);
  } catch {
    // The public payload is already capped. A later read can finish the prune.
  }
}

async function writeRatherSnapshot(store, state, snapshot) {
  if (!store || typeof store.setJSON !== "function") throw new Error("durable store unavailable");
  if (snapshot.exists && !snapshot.etag) throw new Error("missing etag for existing vote state");
  const condition = snapshot.exists
    ? { onlyIfMatch: snapshot.etag }
    : { onlyIfNew: true };
  const result = await store.setJSON(RATHER_STATE_KEY, state, condition);
  return result?.modified === true && typeof result?.etag === "string" && result.etag.length > 0;
}

export function createRatherVoteHandler({
  getStore,
  nowFn = () => new Date(),
  salt = process.env.RATHER_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function ratherVoteHandler(req, context = {}) {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          allow: "GET, POST, OPTIONS",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    const secret = acceptSalt(salt);
    if (!secret) return jsonResponse({ error: "config" }, { status: 503 });

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }

    const now = nowFn();

    if (req.method === "GET") {
      try {
        const snapshot = await readRatherSnapshot(store, now);
        await healRatherSnapshot(store, snapshot);
        return jsonResponse(publicRatherVotes(snapshot.state, now));
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405 });
    }

    if (!isAllowedWrite(req, allowedOrigins)) {
      return jsonResponse({ error: "forbidden" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return jsonResponse({ ok: true, saved: false, skipped: "bot" });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const eventId = sanitizeEventId(payload?.eventId) || randomUUID();
    const voter = visitorHash(clientIp(req, context), userAgent, secret);
    if (!voter) return jsonResponse({ error: "config" }, { status: 503 });

    for (let attempt = 0; attempt < RATHER_MAX_WRITE_RETRIES; attempt += 1) {
      let snapshot;
      try {
        snapshot = await readRatherSnapshot(store, now);
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }

      const result = applyRatherVote(snapshot.state, {
        vote: { ...payload, eventId },
        visitorHash: voter,
        now,
      });

      if (!result.ok) {
        const status = result.error === "limit" || result.error === "slow" ? 429 : 400;
        return jsonResponse({ error: result.error, ...publicRatherVotes(result.state, now) }, { status });
      }

      if (!result.changed) {
        if (ratherBlobNeedsRewrite(snapshot.raw, result.state)) {
          try {
            await writeRatherSnapshot(store, result.state, snapshot);
          } catch {
            // Public response omits voter keys either way.
          }
        }
        return jsonResponse({
          ok: true,
          saved: true,
          duplicate: true,
          eventId,
          ...publicRatherVotes(result.state, now),
        });
      }

      try {
        if (await writeRatherSnapshot(store, result.state, snapshot)) {
          return jsonResponse({
            ok: true,
            saved: true,
            eventId,
            replaced: Boolean(result.replaced),
            ...publicRatherVotes(result.state, now),
          });
        }
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}
