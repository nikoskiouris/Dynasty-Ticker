import { apiGetWithRetry, sleeperLeaguePath } from "./sleeper.js";
import { loadWeeklySlate, WEEKLY_SLATE_TTL_MS } from "./weekly-slate.js";
import { buildStartSitModel } from "./start-sit.js";
import { renderStartSit } from "./start-sit-view.js";

const defaultView = () => ({ tab: "decisions", seat: null, benchId: null });

// Matchups own submitted starters, including players who have already played
// and then changed rosters. A new starter must still be on the roster and matchup.
function weeklyRosters(rows, matchups) {
  const weekByRoster = new Map(matchups.map(row => [String(row.roster_id), row]));
  return rows.map(row => {
    const matchup = weekByRoster.get(String(row.roster_id));
    const eligible = new Set((matchup?.players || []).map(String));
    return {
      ...row, starters: matchup?.starters,
      players: Array.isArray(row.players) && Array.isArray(matchup?.players)
        ? row.players.filter(id => eligible.has(String(id))) : null,
    };
  });
}

export function createStartSitPanel(panel, { canFill, slotLabel }) {
  const host = panel?.querySelector("#team-start-sit-content");
  if (!host) return () => {};
  let context = null;
  let controller = null;
  let timer = null;
  let slate = null;
  let rosters = [];
  let model = null;
  let view = defaultView();
  let nextRefresh = 0;

  function paint(focusTarget) {
    if (!context || !model) return;
    const previousFocus = host.contains(document.activeElement) ? document.activeElement.id : null;
    const openBench = host.querySelector(".ss-bench")?.open;
    host.innerHTML = renderStartSit({ model, view, slate, league: context.league, slotLabel });
    const benchDetails = host.querySelector(".ss-bench");
    if (openBench && benchDetails) benchDetails.open = true;
    if (focusTarget || previousFocus) {
      const nextFocus = document.getElementById(focusTarget || previousFocus) || host.querySelector('[aria-pressed="true"]');
      nextFocus?.focus({ preventScroll: !focusTarget });
    }
  }

  function rebuild() {
    const { rosterId, league, players } = context;
    const roster = rosters.find(row => String(row.roster_id) === String(rosterId));
    model = roster ? buildStartSitModel({ roster, league, players, slate, canFill })
      : { message: "Sleeper did not return this roster." };
    paint();
  }

  async function refresh() {
    if (!context || controller || document.hidden) return;
    clearTimeout(timer);
    const { league } = context;
    const job = new AbortController();
    controller = job;
    host.setAttribute("aria-busy", "true");
    const fetchRows = suffix => apiGetWithRetry(sleeperLeaguePath(league.league_id, suffix), {
      signal: job.signal, timeoutMs: 12000, retries: 1,
    });
    try {
      // Re-evaluate kickoff locks immediately while the replacement slate loads.
      if (model && slate) rebuild();
      else host.innerHTML = '<p role="status">Checking your submitted lineup and this week’s games…</p>';
      const [weekly, rows] = await Promise.all([
        loadWeeklySlate({ signal: job.signal }),
        fetchRows("rosters"),
      ]);
      if (job.signal.aborted) return;
      if (!Array.isArray(rows)) throw new Error("No rosters");
      const currentWeek = !weekly.offSeason && String(league.season) === weekly.season;
      const matchups = currentWeek ? await fetchRows(`matchups/${weekly.week}`) : [];
      if (job.signal.aborted) return;
      if (!Array.isArray(matchups)) throw new Error("No weekly matchups");
      if (slate && (weekly.week !== slate.week || weekly.season !== slate.season)) view = defaultView();
      slate = weekly;
      rosters = weeklyRosters(rows, matchups);
      rebuild();
      const now = Date.now();
      nextRefresh = Object.values(slate.games).reduce((next, game) => {
        const kickoff = Date.parse(game.kickoff);
        return kickoff > now ? Math.min(kickoff, next) : next;
      }, now + WEEKLY_SLATE_TTL_MS);
    } catch {
      if (job.signal.aborted) return;
      slate = null;
      model = null;
      host.innerHTML = '<p role="status">Weekly lineup advice is unavailable. <button type="button" class="ghost-btn" data-refresh-lineup>Try again</button></p>';
      nextRefresh = Date.now() + WEEKLY_SLATE_TTL_MS;
    } finally {
      if (controller === job) {
        host.removeAttribute("aria-busy");
        controller = null;
        timer = setTimeout(refresh, Math.max(0, nextRefresh - Date.now()));
      }
    }
  }

  host.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-refresh-lineup")) {
      void refresh();
    } else if (button.hasAttribute("data-ss-compare")) {
      view = { tab: "compare", seat: Number(button.dataset.ssCompare), benchId: button.dataset.benchId || null };
      paint("ss-alternative");
    } else if (button.hasAttribute("data-ss-tab")) {
      view.tab = button.dataset.ssTab;
      paint();
    }
  });
  host.addEventListener("change", event => {
    const control = event.target;
    if (control.hasAttribute("data-ss-seat")) {
      view.seat = Number(control.value);
      view.benchId = null;
    } else if (control.hasAttribute("data-ss-bench")) {
      view.seat = Number(host.querySelector("[data-ss-seat]").value);
      view.benchId = control.value;
    } else return;
    paint();
  });
  document.addEventListener("visibilitychange", () => {
    if (context && !document.hidden && Date.now() >= nextRefresh) void refresh();
  });

  return function update(next) {
    const leagueChanged = context?.league.league_id !== next?.league.league_id;
    const teamChanged = leagueChanged || context?.rosterId !== next?.rosterId;
    const rebuildNeeded = teamChanged || context?.players !== next?.players || context?.league !== next?.league;
    if (teamChanged) {
      view = defaultView();
      model = null;
      host.replaceChildren();
    }
    if (leagueChanged) {
      controller?.abort();
      controller = null;
      clearTimeout(timer);
      slate = null;
      rosters = [];
      nextRefresh = 0;
      host.removeAttribute("aria-busy");
    }
    context = next;
    panel.classList.toggle("hidden", !context);
    if (!context) return;
    if (slate && rebuildNeeded) rebuild();
    if (Date.now() >= nextRefresh) void refresh();
    else if (teamChanged && !slate) {
      // Retry the new team's lookup immediately after a failed league refresh.
      void refresh();
    }
    if (teamChanged && controller && !model) {
      host.innerHTML = '<p role="status">Checking your submitted lineup and this week’s games…</p>';
    }
  };
}
