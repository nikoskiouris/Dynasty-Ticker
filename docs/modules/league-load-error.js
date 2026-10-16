export const SLEEPER_UNREACHABLE_MESSAGE = "Couldn't reach Sleeper. Check your connection.";
export const LEAGUE_NOT_FOUND_CODE = "league-not-found";

// Sleeper answers a bad league id with null or 404. A dropped connection has
// neither, so it stays a network failure.
export function sleeperLeagueMissing(result) {
  if (!result || typeof result !== "object") return false;
  if (result.status === "rejected") return result.reason?.status === 404;
  if (result.status === "fulfilled") return result.value?.payload == null;
  return false;
}

export function leagueNotFoundError(leagueId = "") {
  const error = new Error("We couldn't find that league");
  error.code = LEAGUE_NOT_FOUND_CODE;
  error.leagueId = String(leagueId || "");
  return error;
}

export function isLeagueNotFound(err) {
  return err?.code === LEAGUE_NOT_FOUND_CODE;
}

// A dropped connection and any non-OK Sleeper response are the same outage.
// A league 404 is league-not-found before this runs.
export function sleeperResponseFailed(err) {
  const status = Number(err?.status);
  if (Number.isInteger(status) && status >= 400) return true;
  const raw = String(err?.message || "");
  if (/Network\/CORS/.test(raw)) return true;
  return /Sleeper API returned\s+\d{3}/.test(raw);
}

// Three core reads fail together and used to paste Network/CORS three times.
export function leagueLoadErrorMessage(err) {
  const raw = String(err?.message || "");
  if (sleeperResponseFailed(err)) return SLEEPER_UNREACHABLE_MESSAGE;
  if (!raw) return "Could not load league data.";
  if (raw.startsWith("Could not load league data.")) return raw;
  return `Could not load league data. ${raw}`;
}

export function failedLeagueSwitch({ currentLeagueId = "", nextLeagueId = "" } = {}) {
  const current = String(currentLeagueId || "");
  const next = String(nextLeagueId || "");
  return Boolean(current) && Boolean(next) && current !== next;
}

export function leagueNameForId(leagues, leagueId) {
  const id = String(leagueId || "");
  const row = (Array.isArray(leagues) ? leagues : []).find((league) => String(league?.league_id || "") === id);
  return String(row?.name || "").trim();
}

export function leagueSwitchFailureCopy({ leagueId = "", leagueName = "" } = {}) {
  const label = String(leagueName || "").trim() || String(leagueId || "").trim() || "that league";
  return `Couldn't switch to ${label}`;
}

// Where a failed league load should speak. The rail is hidden on the landing,
// and the desk hides the rail status unless a retry control is already showing.

export function leagueLoadErrorVisibility({ message = "", leagueLoaded = false } = {}) {
  const show = Boolean(String(message || ""));
  return {
    landing: show && !leagueLoaded,
    desk: show && leagueLoaded,
  };
}

// A newer load bumps the generation. Only the current failure may retry.
export function shouldRecoverLeagueLoad({ leagueId = "", token, isCurrent } = {}) {
  if (!leagueId) return false;
  if (typeof isCurrent === "function" && !isCurrent(token)) return false;
  return true;
}

export function createLeagueLoadRecovery({ isCurrent, load, onlineTarget } = {}) {
  let pending = null;

  function recover() {
    const job = pending;
    if (!shouldRecoverLeagueLoad({
      leagueId: job?.leagueId || "",
      token: job?.token,
      isCurrent,
    })) return false;
    pending = null;
    load(job.leagueId, job);
    return true;
  }

  const onOnline = () => {
    recover();
  };
  onlineTarget?.addEventListener?.("online", onOnline);

  return {
    fail({ leagueId, token, sample = false } = {}) {
      const id = String(leagueId || "");
      if (!shouldRecoverLeagueLoad({ leagueId: id, token, isCurrent })) return false;
      pending = { leagueId: id, token, sample: Boolean(sample) };
      return true;
    },
    clear() {
      pending = null;
    },
    retry() {
      return recover();
    },
    pending() {
      return pending;
    },
    stop() {
      onlineTarget?.removeEventListener?.("online", onOnline);
    },
  };
}
