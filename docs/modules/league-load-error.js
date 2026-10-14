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
