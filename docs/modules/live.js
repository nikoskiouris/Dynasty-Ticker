export function weekRowsFingerprint(weekRows) {
  let hash = 0;
  if (!weekRows || typeof weekRows.forEach !== "function") return 0;
  weekRows.forEach((rows, week) => {
    hash = (hash * 33 + Number(week || 0)) >>> 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      hash = (hash * 33 + Math.round((Number(row?.points) || 0) * 100) + Number(row?.roster_id || 0)) >>> 0;
    });
  });
  return hash;
}

export function footballWindowDay(date = new Date()) {
  const day = date.getUTCDay();
  return day === 0 || day === 1 || day === 4 || day === 5 || day === 6;
}

export function shouldPollLive(model, nflState = null, now = new Date()) {
  if (!model || model.seasonComplete) return false;
  if (model.currentWeekEntry?.isLive) return true;
  const seasonType = String(nflState?.season_type || "").toLowerCase();
  if (seasonType === "pre" || seasonType === "off") return false;
  const currentWeek = Number(model.currentWeek);
  if (!Number.isFinite(currentWeek) || currentWeek <= 0) return false;
  const finalThrough = Number(model.finalThroughWeek);
  if (Number.isFinite(finalThrough) && finalThrough >= currentWeek) return false;
  const date = now instanceof Date ? now : new Date(now);
  return footballWindowDay(date);
}

export function liveUpdateMatchesLeague(capturedLeagueId, currentLeagueId) {
  const captured = String(capturedLeagueId ?? "");
  const current = String(currentLeagueId ?? "");
  return captured !== "" && captured === current;
}

export function shouldRefreshSim({ previousFinalThroughWeek, nextFinalThroughWeek, previousRemaining, nextRemaining, forced = false }) {
  if (forced) return true;
  if (Number(previousFinalThroughWeek) !== Number(nextFinalThroughWeek)) return true;
  if (Number(previousRemaining) !== Number(nextRemaining)) return true;
  return false;
}

export function createLivePoller(options = {}) {
  const {
    intervalMs = 30000,
    simRefreshMs = 180000,
    isLive = () => false,
    fetchUpdate,
    onScores,
    onSimRefresh,
    shouldPause = () => false,
    now = () => Date.now(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = options;

  let timer = null;
  let stopped = true;
  let inFlight = false;
  let lastSimAt = 0;
  let ticks = 0;

  async function tick({ forceSim = false } = {}) {
    if (stopped || inFlight) return { polled: false, reason: stopped ? "stopped" : "in-flight" };
    if (shouldPause()) return { polled: false, reason: "paused" };
    if (!isLive()) return { polled: false, reason: "not-live" };
    inFlight = true;
    ticks += 1;
    try {
      const payload = await fetchUpdate();
      if (stopped) return { polled: false, reason: "stopped" };
      onScores?.(payload);
      const due = forceSim || (lastSimAt > 0 && now() - lastSimAt >= simRefreshMs);
      if (due) {
        lastSimAt = now();
        onSimRefresh?.(payload);
      }
      return { polled: true, simRefreshed: due, payload };
    } finally {
      inFlight = false;
    }
  }

  function start() {
    stop();
    stopped = false;
    lastSimAt = now();
    timer = setIntervalFn(() => {
      void tick();
    }, intervalMs);
    return tick({ forceSim: false });
  }

  function stop() {
    stopped = true;
    if (timer != null) {
      clearIntervalFn(timer);
      timer = null;
    }
  }

  function resume() {
    if (stopped) return;
    void tick();
  }

  return {
    start,
    stop,
    resume,
    tick,
    get running() {
      return !stopped && timer != null;
    },
    get ticks() {
      return ticks;
    },
  };
}
