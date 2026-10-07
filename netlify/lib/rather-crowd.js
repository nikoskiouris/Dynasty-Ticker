import { randomUUID } from "node:crypto";
import {
  DEFAULT_ORIGINS,
  clientIp,
  isAllowedWrite,
  isBot,
  resolveSecretSalt,
  saltFromEnv,
  visitorHash,
  wrapLambdaHandler,
} from "./traffic.js";

export const RATHER_STATE_KEY = "state";
export const RATHER_MAX_PER_VISITOR_HOUR = 40;
export const RATHER_MIN_INTERVAL_MS = 400;
export const RATHER_MAX_WRITE_RETRIES = 8;
export const RATHER_MAX_STORED_VOTES = 8000;
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

export function normalizeRatherState(raw) {
  if (!raw || typeof raw !== "object") return emptyRatherState();
  const votes = Array.isArray(raw.votes)
    ? raw.votes.map(sanitizeRatherVote).filter(Boolean).slice(0, RATHER_MAX_STORED_VOTES)
    : [];
  const visitors = raw.visitors && typeof raw.visitors === "object" ? raw.visitors : {};
  return { votes, visitors };
}

export function publicRatherVotes(state) {
  const votes = (Array.isArray(state?.votes) ? state.votes : []).slice(0, RATHER_MAX_STORED_VOTES);
  return {
    votes: votes.map((vote) => ({
      ...(vote.eventId ? { eventId: vote.eventId } : {}),
      winnerId: vote.winnerId,
      loserId: vote.loserId,
      format: vote.format,
      at: vote.at,
    })),
    voteCount: votes.length,
  };
}

function pruneVisitors(visitors, nowMs) {
  const keepAfter = nowMs - 2 * 24 * 60 * 60 * 1000;
  const next = {};
  for (const [hash, row] of Object.entries(visitors || {})) {
    const lastAt = Number(row?.lastAt);
    if (Number.isFinite(lastAt) && lastAt >= keepAfter) next[hash] = row;
  }
  return next;
}

function votePairKey(vote) {
  return [vote.winnerId, vote.loserId].sort().join("|");
}

export function applyRatherVote(state, { vote, visitorHash: hash, now = new Date() } = {}) {
  const cleaned = sanitizeRatherVote(vote);
  if (!cleaned) return { ok: false, error: "vote", state: normalizeRatherState(state) };

  const current = normalizeRatherState(state);
  const clock = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  cleaned.at = clock;
  cleaned.voterKey = sanitizeVoterKey(hash);

  if (cleaned.eventId) {
    const existingEvent = current.votes.find((row) => row.eventId && row.eventId === cleaned.eventId);
    if (existingEvent) {
      return { ok: true, duplicate: true, changed: false, state: current };
    }
  }

  const pair = votePairKey(cleaned);
  const repeatedIndex = cleaned.voterKey
    ? current.votes.findIndex((row) => row.voterKey === cleaned.voterKey && row.format === cleaned.format && votePairKey(row) === pair)
    : -1;
  if (repeatedIndex >= 0 && current.votes[repeatedIndex].winnerId === cleaned.winnerId) {
    return { ok: true, duplicate: true, changed: false, state: current };
  }

  const visitors = { ...current.visitors };
  const visitor = visitors[cleaned.voterKey] || { lastAt: 0, hourKey: "", hourCount: 0 };
  if (clock - Number(visitor.lastAt || 0) < RATHER_MIN_INTERVAL_MS) {
    return { ok: false, error: "slow", state: current };
  }
  const key = hourBucket(now instanceof Date ? now : new Date(clock));
  const hourCount = visitor.hourKey === key ? Number(visitor.hourCount || 0) + 1 : 1;
  if (hourCount > RATHER_MAX_PER_VISITOR_HOUR) {
    return { ok: false, error: "limit", state: current };
  }

  visitors[cleaned.voterKey] = { lastAt: clock, hourKey: key, hourCount };
  const votes = [...current.votes];
  if (repeatedIndex >= 0) votes.splice(repeatedIndex, 1);
  votes.unshift(cleaned);
  const storedVotes = votes.slice(0, RATHER_MAX_STORED_VOTES);
  return {
    ok: true,
    changed: true,
    replaced: repeatedIndex >= 0,
    state: {
      votes: storedVotes,
      visitors: pruneVisitors(visitors, clock),
    },
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    },
  });
}

async function readRatherSnapshot(store) {
  if (!store || typeof store.getWithMetadata !== "function") {
    throw new Error("durable store unavailable");
  }
  const snapshot = await store.getWithMetadata(RATHER_STATE_KEY, {
    type: "json",
    consistency: "strong",
  });
  if (!snapshot) return { state: emptyRatherState(), etag: "", exists: false };
  return {
    state: normalizeRatherState(snapshot.data),
    etag: typeof snapshot.etag === "string" ? snapshot.etag : "",
    exists: true,
  };
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
  salt = saltFromEnv(process.env.RATHER_SALT),
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function ratherVoteHandler(req, context = {}) {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }

    if (req.method === "GET") {
      try {
        const snapshot = await readRatherSnapshot(store);
        return jsonResponse(publicRatherVotes(snapshot.state));
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

    if (!resolveSecretSalt(salt)) {
      return jsonResponse({ error: "salt" }, { status: 503 });
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

    const now = nowFn();
    const eventId = sanitizeEventId(payload?.eventId) || randomUUID();
    const voter = visitorHash(clientIp(req, context), userAgent, salt);

    for (let attempt = 0; attempt < RATHER_MAX_WRITE_RETRIES; attempt += 1) {
      let snapshot;
      try {
        snapshot = await readRatherSnapshot(store);
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
        return jsonResponse({ error: result.error, ...publicRatherVotes(result.state) }, { status });
      }

      if (!result.changed) {
        return jsonResponse({
          ok: true,
          saved: true,
          duplicate: true,
          eventId,
          ...publicRatherVotes(result.state),
        });
      }

      try {
        if (await writeRatherSnapshot(store, result.state, snapshot)) {
          return jsonResponse({
            ok: true,
            saved: true,
            eventId,
            replaced: Boolean(result.replaced),
            ...publicRatherVotes(result.state),
          });
        }
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}
