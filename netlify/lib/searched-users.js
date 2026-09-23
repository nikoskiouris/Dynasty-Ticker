import {
  DEFAULT_ORIGINS,
  isAllowedWrite,
  isBot,
  readVisitBody,
} from "./traffic.js";

export const SEARCHED_USERS_STORE = "desk-users";
export const SEARCHED_USERS_KEY = "searched-users.csv";
export const SEARCHED_USERS_COLUMNS = Object.freeze(["username", "user_id", "first_seen", "last_seen", "searches"]);
export const SEARCHED_USERS_HEADER = SEARCHED_USERS_COLUMNS.join(",");
export const SEARCHED_USERS_MAX_WRITE_RETRIES = 8;

// No commas, quotes, or spaces, and no leading = + - @, so a cell can never
// break the CSV or run as a spreadsheet formula.
const USERNAME_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]{0,39}$/u;
const USER_ID_RE = /^\d{1,32}$/;

export function cleanSleeperUsername(value) {
  const name = String(value ?? "").trim().toLowerCase();
  return USERNAME_RE.test(name) ? name : "";
}

export function cleanSleeperUserId(value) {
  const id = String(value ?? "").trim();
  return USER_ID_RE.test(id) ? id : "";
}

export function csvStamp(now = new Date()) {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function asCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function cell(value) {
  return String(value ?? "").replaceAll('"', "").trim();
}

export function parseSearchedUsers(text) {
  const rows = [];
  const names = new Set();
  for (const line of String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim() || line.trim().toLowerCase() === SEARCHED_USERS_HEADER) continue;
    const cells = line.split(",");
    const username = cell(cells[0]).toLowerCase();
    if (!username || names.has(username)) continue;
    names.add(username);
    rows.push({
      username,
      userId: cleanSleeperUserId(cell(cells[1])),
      firstSeen: cell(cells[2]),
      lastSeen: cell(cells[3]),
      searches: asCount(cell(cells[4])),
    });
  }
  return rows;
}

export function renderSearchedUsers(rows) {
  const lines = [SEARCHED_USERS_HEADER];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push([row.username, row.userId, row.firstSeen, row.lastSeen, row.searches].join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function applySearchedUser(text, { username, userId = "", now = new Date() } = {}) {
  const rows = parseSearchedUsers(text);
  const name = cleanSleeperUsername(username);
  if (!name) return renderSearchedUsers(rows);
  const id = cleanSleeperUserId(userId);
  const stamp = csvStamp(now);
  const row = rows.find((entry) => entry.username === name);
  if (row) {
    row.lastSeen = stamp;
    row.searches += 1;
    if (!row.firstSeen) row.firstSeen = stamp;
    if (id) row.userId = id;
  } else {
    rows.push({ username: name, userId: id, firstSeen: stamp, lastSeen: stamp, searches: 1 });
  }
  return renderSearchedUsers(rows);
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

async function readSearchedUsersSnapshot(store) {
  if (!store || typeof store.getWithMetadata !== "function") throw new Error("durable store unavailable");
  const snapshot = await store.getWithMetadata(SEARCHED_USERS_KEY, {
    type: "text",
    consistency: "strong",
  });
  if (!snapshot) return { text: "", etag: "", exists: false };
  return {
    text: typeof snapshot.data === "string" ? snapshot.data : "",
    etag: typeof snapshot.etag === "string" ? snapshot.etag : "",
    exists: true,
  };
}

async function writeSearchedUsersSnapshot(store, text, snapshot) {
  if (!store || typeof store.set !== "function") throw new Error("durable store unavailable");
  if (snapshot.exists && !snapshot.etag) throw new Error("missing etag for existing username list");
  const condition = snapshot.exists
    ? { onlyIfMatch: snapshot.etag }
    : { onlyIfNew: true };
  const result = await store.set(SEARCHED_USERS_KEY, text, condition);
  return result?.modified === true && typeof result?.etag === "string" && result.etag.length > 0;
}

export function createSearchedUserHandler({
  getStore,
  nowFn = () => new Date(),
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function searchedUserHandler(req) {
    // Write-only. The list is never served back over HTTP.
    if (req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405, headers: { allow: "POST" } });
    }

    if (!isAllowedWrite(req, allowedOrigins)) {
      return jsonResponse({ error: "forbidden" }, { status: 403 });
    }

    if (isBot(req.headers.get("user-agent") || "")) {
      return jsonResponse({ ok: true, skipped: "bot" });
    }

    const body = await readVisitBody(req);
    const username = cleanSleeperUsername(body.username);
    if (!username) return jsonResponse({ error: "username" }, { status: 400 });
    const userId = cleanSleeperUserId(body.userId);

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }

    const now = nowFn();
    for (let attempt = 0; attempt < SEARCHED_USERS_MAX_WRITE_RETRIES; attempt += 1) {
      let snapshot;
      try {
        snapshot = await readSearchedUsersSnapshot(store);
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
      const next = applySearchedUser(snapshot.text, { username, userId, now });
      try {
        if (await writeSearchedUsersSnapshot(store, next, snapshot)) return jsonResponse({ ok: true });
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}
