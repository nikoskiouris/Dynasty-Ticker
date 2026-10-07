export const SLEEPER_API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}

export function createSleeperClient(options = {}) {
  const {
    baseUrl = SLEEPER_API_BASE,
    fetchImpl = (...args) => globalThis.fetch(...args),
    maxConcurrent = 3,
    minIntervalMs = 110,
    now = () => Date.now(),
    sleep = defaultSleep,
  } = options;

  let active = 0;
  let lastStart = 0;
  let draining = false;
  const queue = [];

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        if (active >= maxConcurrent) break;
        const wait = Math.max(0, minIntervalMs - (now() - lastStart));
        if (wait > 0) await sleep(wait);
        if (queue.length === 0) break;
        if (active >= maxConcurrent) break;
        const job = queue.shift();
        active += 1;
        lastStart = now();
        Promise.resolve()
          .then(job.run)
          .then(job.resolve, job.reject)
          .finally(() => {
            active -= 1;
            void drain();
          });
      }
    } finally {
      draining = false;
      if (queue.length > 0 && active < maxConcurrent) void drain();
    }
  }

  async function fetchJson(path, { timeoutMs = 25000, cache = "no-store", signal = null } = {}) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const abortTimeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const onCallerAbort = () => controller?.abort();
    if (signal) {
      if (signal.aborted) controller?.abort();
      else signal.addEventListener?.("abort", onCallerAbort, { once: true });
    }
    try {
      const response = await withTimeout(
        fetchImpl(`${baseUrl}${path}`, {
          signal: controller?.signal || signal || undefined,
          cache,
          credentials: "omit",
          mode: "cors",
        }),
        timeoutMs + 1500,
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`
      );
      if (response.status === 429) {
        const error = new Error("Sleeper API returned 429");
        error.status = 429;
        error.retryAfterMs = Number(response.headers?.get?.("Retry-After")) * 1000;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Sleeper API returned ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return await withTimeout(response.json(), timeoutMs + 1500, "Sleeper API response parse timed out");
    } catch (err) {
      if (signal?.aborted || err?.name === "AbortError" && signal?.aborted) {
        const cancel = new Error("Request cancelled");
        cancel.name = "AbortError";
        throw cancel;
      }
      if (err?.name === "AbortError") {
        throw new Error(`Sleeper API timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      if (err instanceof TypeError) {
        throw new Error("Network/CORS error while contacting Sleeper API");
      }
      throw err;
    } finally {
      if (abortTimeoutId) clearTimeout(abortTimeoutId);
      signal?.removeEventListener?.("abort", onCallerAbort);
    }
  }

  function enqueue(run, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const cancel = new Error("Request cancelled");
        cancel.name = "AbortError";
        reject(cancel);
        return;
      }
      const job = { run, resolve, reject, signal };
      const onAbort = () => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        const cancel = new Error("Request cancelled");
        cancel.name = "AbortError";
        reject(cancel);
      };
      signal?.addEventListener?.("abort", onAbort, { once: true });
      queue.push(job);
      void drain();
    });
  }

  async function apiGet(path, { timeoutMs = 25000, cache = "no-store", signal = null } = {}) {
    return enqueue(() => fetchJson(path, { timeoutMs, cache, signal }), signal);
  }

  async function apiGetWithRetry(path, { timeoutMs = 25000, retries = 1, cache = "no-store", signal = null } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await apiGet(path, { timeoutMs, cache, signal });
      } catch (err) {
        lastError = err;
        if (attempt >= retries) break;
        // A missing resource will not appear on a second try. Cancellation either.
        if (err?.name === "AbortError" || err?.status === 404) break;
        const retryAfter = Number(err?.retryAfterMs);
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : 250 * (attempt + 1) * (err?.status === 429 ? 4 : 1);
        await sleep(delay);
      }
    }
    throw lastError;
  }

  return {
    apiGet,
    apiGetWithRetry,
    enqueue,
    get pending() {
      return queue.length;
    },
    get active() {
      return active;
    },
  };
}

export async function mapInChunks(items, chunkSize, mapper) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(chunkSize) || 1);
  const results = [];
  for (let index = 0; index < list.length; index += size) {
    const chunk = list.slice(index, index + size);
    const settled = await Promise.allSettled(chunk.map((item, offset) => mapper(item, index + offset)));
    results.push(...settled);
  }
  return results;
}

export function dedupeLeagues(leagues) {
  const byId = new Map();
  (leagues || []).forEach((league) => {
    const id = String(league?.league_id || "");
    if (!id || byId.has(id)) return;
    byId.set(id, league);
  });
  return [...byId.values()];
}

export function preferLatestLeagues(leagues) {
  const rows = Array.isArray(leagues) ? leagues : [];
  const ids = new Set(rows.map((league) => String(league?.league_id || "")).filter(Boolean));
  const superseded = new Set();
  rows.forEach((league) => {
    const previousId = String(league?.previous_league_id || "");
    if (previousId && ids.has(previousId)) superseded.add(previousId);
  });
  if (!superseded.size) return rows;
  return rows.filter((league) => !superseded.has(String(league?.league_id || "")));
}

export async function fetchUserLeagues(client, username, seasons) {
  const handle = String(username || "").trim();
  if (!handle) throw new Error("Type a Sleeper username.");
  const user = await client.apiGetWithRetry(`/user/${encodeURIComponent(handle)}`, { timeoutMs: 10000, retries: 1 });
  if (!user || typeof user !== "object" || !user.user_id) {
    throw new Error(`No Sleeper user named "${handle}".`);
  }
  const seasonList = Array.isArray(seasons) && seasons.length ? seasons : [String(new Date().getUTCFullYear())];
  const batches = await Promise.all(
    seasonList.map(async (season) => {
      const label = String(season);
      try {
        const rows = await client.apiGetWithRetry(
          `/user/${user.user_id}/leagues/nfl/${label}`,
          { timeoutMs: 12000, retries: 1 }
        );
        if (!Array.isArray(rows)) return { season: label, leagues: [], failed: true };
        return { season: label, leagues: rows, failed: false };
      } catch {
        return { season: label, leagues: [], failed: true };
      }
    })
  );
  return {
    user,
    leagues: preferLatestLeagues(dedupeLeagues(batches.flatMap((batch) => batch.leagues))),
    failedSeasons: batches.filter((batch) => batch.failed).map((batch) => batch.season),
  };
}

const SLIM_PLAYER_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "position",
  "team",
  "age",
  "injury_status",
  "status",
  "years_exp",
  "active",
  "depth_chart_order",
  "depth_chart_position",
];

export function slimPlayerRecord(player, id = "") {
  if (!player || typeof player !== "object") return null;
  const record = {};
  const playerId = String(player.player_id || id || "");
  if (playerId) record.player_id = playerId;
  SLIM_PLAYER_FIELDS.forEach((field) => {
    const value = player[field];
    if (value == null || value === "") return;
    record[field] = value;
  });
  const positions = Array.isArray(player.fantasy_positions)
    ? player.fantasy_positions.map((position) => String(position || "")).filter(Boolean).slice(0, 4)
    : [];
  if (positions.length) record.fantasy_positions = positions;
  else if (record.position) record.fantasy_positions = [String(record.position)];
  const rookieYear = Number(player?.metadata?.rookie_year);
  if (Number.isFinite(rookieYear) && rookieYear > 0) record.metadata = { rookie_year: rookieYear };
  if (!record.full_name) {
    const name = `${record.first_name || ""} ${record.last_name || ""}`.trim();
    if (name) record.full_name = name;
  }
  return record;
}

export function slimPlayersMap(players) {
  const out = {};
  if (!players || typeof players !== "object") return out;
  Object.entries(players).forEach(([id, player]) => {
    const slim = slimPlayerRecord(player, id);
    if (slim) out[String(id)] = slim;
  });
  return out;
}

export function playersCacheIsFresh(entry, now, { stateKey = "", ttlMs = 0 } = {}) {
  if (!entry?.players || typeof entry.players !== "object") return false;
  const savedAt = Number(entry.savedAt);
  if (!Number.isFinite(savedAt)) return false;
  if (Number(ttlMs) > 0 && Number(now) - savedAt >= Number(ttlMs)) return false;
  if (stateKey && entry.stateKey && String(entry.stateKey) !== String(stateKey)) return false;
  return true;
}

export async function loadPlayersCacheEntry({ localStorage, idb, key }) {
  let localError = null;
  try {
    const raw = localStorage?.getItem?.(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.players && parsed.savedAt) return parsed;
    }
  } catch (err) {
    localError = err;
  }
  if (idb?.get) {
    const fromIdb = await idb.get(key);
    if (fromIdb?.players && fromIdb.savedAt) return fromIdb;
    return null;
  }
  if (localError) throw localError;
  return null;
}

export async function savePlayersCacheEntry(entry, { localStorage, idb, key }) {
  const payload = {
    savedAt: entry?.savedAt,
    stateKey: entry?.stateKey || null,
    slim: true,
    players: slimPlayersMap(entry?.players),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    return { stored: "local", players: payload.players };
  } catch (localError) {
    if (!idb?.set) {
      const error = new Error("Players cache did not fit in localStorage and IndexedDB is unavailable");
      error.cause = localError;
      throw error;
    }
    try {
      await idb.set(key, payload);
    } catch (idbError) {
      const error = new Error("Players cache failed in localStorage and IndexedDB");
      error.cause = idbError;
      error.localError = localError;
      throw error;
    }
    try { localStorage.removeItem(key); } catch { /* IndexedDB holds the slim copy. */ }
    return { stored: "idb", players: payload.players };
  }
}

export function sleeperAvatarUrl(avatar) {
  if (!avatar) return "";
  if (String(avatar).startsWith("http")) return String(avatar);
  return `${SLEEPER_AVATAR_BASE}${avatar}`;
}

const defaultClient = createSleeperClient();

export const apiGet = (...args) => defaultClient.apiGet(...args);
export const apiGetWithRetry = (...args) => defaultClient.apiGetWithRetry(...args);
export { defaultClient as sleeperClient };
