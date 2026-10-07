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

  function enqueue(run) {
    return new Promise((resolve, reject) => {
      queue.push({ run, resolve, reject });
      void drain();
    });
  }

  async function fetchJson(path, { timeoutMs = 25000 } = {}) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const abortTimeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await withTimeout(
        fetchImpl(`${baseUrl}${path}`, {
          signal: controller?.signal,
          cache: "no-store",
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
      if (err?.name === "AbortError") {
        throw new Error(`Sleeper API timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      if (err instanceof TypeError) {
        throw new Error("Network/CORS error while contacting Sleeper API");
      }
      throw err;
    } finally {
      if (abortTimeoutId) clearTimeout(abortTimeoutId);
    }
  }

  async function apiGet(path, { timeoutMs = 25000 } = {}) {
    return enqueue(() => fetchJson(path, { timeoutMs }));
  }

  async function apiGetWithRetry(path, { timeoutMs = 25000, retries = 1 } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await apiGet(path, { timeoutMs });
      } catch (err) {
        lastError = err;
        if (attempt >= retries) break;
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
      try {
        const rows = await client.apiGetWithRetry(
          `/user/${user.user_id}/leagues/nfl/${season}`,
          { timeoutMs: 12000, retries: 1 }
        );
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    })
  );
  return {
    user,
    leagues: preferLatestLeagues(dedupeLeagues(batches.flat())),
  };
}

const AVATAR_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const AVATAR_URL_RE = /^https:\/\/sleepercdn\.com\/avatars\/(?:thumbs\/)?[A-Za-z0-9_-]{1,80}(?:\.[A-Za-z0-9]{1,5})?$/;

export function sleeperAvatarUrl(avatar) {
  const raw = String(avatar ?? "").trim();
  if (!raw || /[\s"'<>\\]/.test(raw)) return "";
  if (AVATAR_URL_RE.test(raw)) return raw;
  if (AVATAR_ID_RE.test(raw)) return `${SLEEPER_AVATAR_BASE}${raw}`;
  return "";
}

const defaultClient = createSleeperClient();

export const apiGet = (...args) => defaultClient.apiGet(...args);
export const apiGetWithRetry = (...args) => defaultClient.apiGetWithRetry(...args);
export { defaultClient as sleeperClient };
