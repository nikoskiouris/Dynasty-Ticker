import { mapInChunks, previousLeagueId, sleeperClient, sleeperLeaguePath } from "./sleeper.js";
import { buildFranchiseIndex } from "./franchise.js";
import { safeStorage } from "./safe-storage.js";

export const ARCHIVE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_VERSION = "dt-league-archive-v1";
const memory = new Map();
let databasePromise;

function abortError() {
  const error = new Error("League archive load cancelled");
  error.name = "AbortError";
  return error;
}

function checkSignal(signal) {
  if (signal?.aborted) throw abortError();
}

// Large weekly player-point maps belong in IndexedDB, not one localStorage blob.
function database() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    if (!globalThis.indexedDB) return resolve(null);
    let request;
    try { request = globalThis.indexedDB.open(CACHE_VERSION, 1); } catch { return resolve(null); }
    request.onupgradeneeded = () => request.result.createObjectStore("resources");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

async function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const db = await database();
    if (db) {
      const row = await new Promise((resolve) => {
        const request = db.transaction("resources").objectStore("resources").get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      if (row) { memory.set(key, row); return row; }
    }
    const raw = safeStorage("localStorage")?.getItem(`${CACHE_VERSION}:${key}`);
    const row = raw ? JSON.parse(raw) : null;
    if (row) memory.set(key, row);
    return row;
  } catch { return null; }
}

async function writeCache(key, row) {
  memory.set(key, row);
  try {
    const db = await database();
    if (db) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("resources", "readwrite");
        transaction.objectStore("resources").put(row, key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      return true;
    }
  } catch { /* Try local storage when browser persistence is unavailable. */ }
  try {
    const storage = safeStorage("localStorage");
    if (!storage) return false;
    storage.setItem(`${CACHE_VERSION}:${key}`, JSON.stringify(row));
    return true;
  } catch { return false; }
}

function closedSeason(league, nflState) {
  if (league?.status === "complete") return true;
  const current = Number(nflState?.season || new Date().getUTCFullYear());
  return Number(league?.season) > 0 && Number(league.season) < current;
}

function seasonEntry(core, current) {
  return { ...core, leagueId: String(core.league.league_id), season: String(core.league.season), isCurrent: current };
}

export function archiveWeeks(league, nflState, { transactions = false } = {}) {
  const finished = closedSeason(league, nflState);
  const sameSeason = String(nflState?.season) === String(league?.season);
  // NFL week is the week in progress. Do not count partially played matchups.
  const through = finished ? 18 : sameSeason && nflState?.season_type === "regular"
    ? Math.max(0, Math.min(18, Number(nflState.week) - (transactions ? 0 : 1)))
    : sameSeason && nflState?.season_type === "post" ? 18 : 0;
  const first = transactions ? 0 : 1;
  return Array.from({ length: Math.max(0, through - first + 1) }, (_, index) => first + index);
}

export function dedupeArchiveTransactions(rows) {
  const found = new Map();
  for (const row of rows || []) {
    if (row?.status !== "complete" || !row.transaction_id) continue;
    found.set(String(row.transaction_id), row);
  }
  return [...found.values()].sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
}

/**
 * Shared lazy archive. Scopes: core (hub), standings (current matchups),
 * recent (current + previous transactions), all (all matchups, moves and drafts).
 * A result is published only for the latest load; cancel aborts queued requests.
 */
export function createLeagueArchive({ client = sleeperClient, maxSeasons = 6 } = {}) {
  let epoch = 0;
  let controller = null;
  let snapshot = null;

  async function resource(path, { season = "", completed = false, refresh = false, signal, report, validate } = {}) {
    checkSignal(signal);
    const key = `${path}|${season}`;
    const cached = await readCache(key);
    if (!refresh && cached && (completed || cached.completed || Date.now() - cached.savedAt < ARCHIVE_TTL_MS)) {
      report?.({ cached: true, path });
      return cached.data;
    }
    try {
      const data = await client.apiGetWithRetry(path, { timeoutMs: 12000, retries: 1, signal });
      checkSignal(signal);
      if (validate && !validate(data)) throw new Error("Sleeper returned no usable data");
      const durable = await writeCache(key, { data, savedAt: Date.now(), completed, season });
      report?.({ path, durable });
      return data;
    } catch (error) {
      checkSignal(signal);
      if (cached) {
        report?.({ path, cached: true, stale: true, error: error.message });
        return cached.data;
      }
      throw error;
    }
  }

  async function core(leagueId, options = {}) {
    const league = await resource(sleeperLeaguePath(leagueId), {
      ...options, validate: (row) => Boolean(row?.league_id && row?.season),
    });
    const completed = closedSeason(league, options.nflState);
    const keys = { users: "users", rosters: "rosters", tradedPicks: "traded_picks", drafts: "drafts", winnersBracket: "winners_bracket", losersBracket: "losers_bracket" };
    const result = { league };
    await mapInChunks(Object.entries(keys), 6, async ([key, suffix]) => {
      try {
        result[key] = await resource(sleeperLeaguePath(leagueId, suffix), {
          ...options, season: String(league.season), completed, validate: Array.isArray,
        });
      } catch (error) {
        checkSignal(options.signal);
        options.issue?.({ season: String(league.season), leagueId: String(leagueId), resource: key, message: `${league.season} ${key} unavailable from Sleeper` });
        if (key === "users" || key === "rosters") throw error;
        result[key] = [];
      }
    }).then((settled) => {
      const failed = settled.find((row) => row.status === "rejected");
      if (failed) throw failed.reason;
    });
    checkSignal(options.signal);
    // Make the league lookup immutable too once its season is known complete.
    if (completed) await writeCache(`${sleeperLeaguePath(leagueId)}|`, { data: league, savedAt: Date.now(), completed: true });
    return result;
  }

  async function load(leagueId, { scope = "core", currentCore = null, preloadedSeasons = [], nflState = null, refresh = false, onProgress, signal } = {}) {
    const ownEpoch = ++epoch;
    controller?.abort();
    controller = new AbortController();
    const ownController = controller;
    const abort = () => ownController.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const result = { leagueId: String(leagueId), scope, seasons: [], matchups: {}, transactions: {}, drafts: {}, issues: [], savedData: false, stale: false, loadedAt: null };
    const issue = (row) => {
      if (!result.issues.some((previous) => previous.season === row.season && previous.resource === row.resource && previous.leagueId === row.leagueId)) result.issues.push(row);
    };
    const report = (row) => {
      checkSignal(ownController.signal);
      if (row.cached) result.savedData = true;
      if (row.stale) { result.stale = true; issue({ season: "", resource: row.path, message: "Sleeper unavailable: showing saved data", stale: true }); }
      if (row.durable === false) issue({ season: "", resource: "cache", message: "Browser storage unavailable: data is saved only for this visit" });
    };
    const options = { refresh, nflState, signal: ownController.signal, issue, report };
    try {
      if (!nflState && scope !== "core") {
        try { nflState = await resource("/state/nfl", { ...options, validate: (row) => Boolean(row?.season) }); }
        catch { issue({ season: "", resource: "nflState", message: "Current NFL week unavailable; current matchups have not been loaded" }); }
        options.nflState = nflState;
      }
      let id = String(leagueId);
      const visited = new Set();
      while (id && result.seasons.length < maxSeasons && !visited.has(id)) {
        visited.add(id);
        try {
          // The desk has already loaded the historical league chain. Reuse its
          // immutable core rows rather than requesting every season a second time.
          const existing = preloadedSeasons.find((entry) =>
            String(entry?.leagueId || entry?.league?.league_id) === id && entry?.league
          );
          const data = existing || (result.seasons.length === 0 && currentCore
            ? currentCore : await core(id, options));
          checkSignal(ownController.signal);
          const entry = seasonEntry(data, result.seasons.length === 0);
          result.seasons.push(entry);
          onProgress?.({ season: entry.season, loaded: result.seasons.length, total: maxSeasons, message: `Loading ${entry.season} season… ${result.seasons.length} of up to ${maxSeasons}` });
          id = previousLeagueId(data.league.previous_league_id);
        } catch (error) {
          checkSignal(ownController.signal);
          if (!result.seasons.length) throw error;
          issue({ season: "unknown", leagueId: id, resource: "season", message: `Older league ${id} unavailable from Sleeper; earlier seasons could not be reached` });
          break;
        }
      }
      if (id && !visited.has(id)) issue({ season: "", resource: "historyLimit", message: `Showing the most recent ${maxSeasons} seasons` });
      result.franchiseIndex = buildFranchiseIndex({ currentLeagueId: String(leagueId), currentRosters: result.seasons[0]?.rosters || [], historyEntries: result.seasons, users: result.seasons.flatMap((entry) => entry.users) });
      for (const [index, entry] of result.seasons.entries()) {
        checkSignal(ownController.signal);
        if (scope === "core") continue;
        onProgress?.({ season: entry.season, loaded: index + 1, total: result.seasons.length, message: `Loading ${entry.season} season… ${index + 1} of ${result.seasons.length}` });
        const common = { ...options, season: entry.season, completed: closedSeason(entry.league, nflState), validate: Array.isArray };
        if (scope === "all" || scope === "standings" && entry.isCurrent) {
          const rows = {};
          await mapInChunks(archiveWeeks(entry.league, nflState), 6, async (week) => {
            try { rows[week] = await resource(sleeperLeaguePath(entry.leagueId, `matchups/${week}`), common); }
            catch { checkSignal(ownController.signal); issue({ season: entry.season, resource: `matchups/${week}`, message: `${entry.season} week ${week} matchups unavailable from Sleeper` }); }
          });
          result.matchups[entry.season] = rows;
        }
        if (scope === "all" || scope === "recent" && index < 2) {
          const moves = [];
          await mapInChunks(archiveWeeks(entry.league, nflState, { transactions: true }), 6, async (week) => {
            try { moves.push(...await resource(sleeperLeaguePath(entry.leagueId, `transactions/${week}`), common)); }
            catch { checkSignal(ownController.signal); issue({ season: entry.season, resource: `transactions/${week}`, message: `${entry.season} week ${week} trades and waiver moves unavailable from Sleeper` }); }
          });
          result.transactions[entry.season] = dedupeArchiveTransactions(moves);
        }
        if (scope === "all") {
          const drafts = [];
          await mapInChunks(entry.drafts, 6, async (draft) => {
            const draftId = String(draft.draft_id || "");
            if (!draftId) return;
            try { drafts.push({ ...draft, picks: await resource(`/draft/${encodeURIComponent(draftId)}/picks`, { ...common, completed: common.completed || draft.status === "complete" }) }); }
            catch { checkSignal(ownController.signal); issue({ season: entry.season, resource: `draft/${draftId}`, message: `${entry.season} draft ${draftId} picks unavailable from Sleeper` }); }
          });
          result.drafts[entry.season] = drafts;
        }
      }
      checkSignal(ownController.signal);
      if (ownEpoch !== epoch) throw abortError();
      result.loadedAt = new Date().toISOString();
      snapshot = result;
      onProgress?.({ loaded: result.seasons.length, total: result.seasons.length, done: true, message: result.stale ? "Showing saved league data" : result.savedData ? "League archive ready · includes saved data" : "League archive ready" });
      return result;
    } finally { signal?.removeEventListener("abort", abort); }
  }

  return { load, loadCore: core, cancel() { epoch += 1; controller?.abort(); snapshot = null; }, get snapshot() { return snapshot; } };
}

export const leagueArchive = createLeagueArchive();
