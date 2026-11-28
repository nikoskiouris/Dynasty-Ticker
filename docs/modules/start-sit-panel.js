import { apiGetWithRetry, sleeperLeaguePath } from "./sleeper.js";
import { loadWeeklySlate, WEEKLY_SLATE_TTL_MS } from "./weekly-slate.js";
import { renderStartSit } from "./start-sit.js";

// Only an open My Team page polls. Read the submitted roster again with each
// slate so a manager's edit in Sleeper is reflected on the next refresh.
export function createStartSitPanel(panel, { canFill, slotLabel }) {
  const host = panel?.querySelector("#team-start-sit-content");
  if (!host) return () => {};
  let context = null;
  let controller = null;
  let timer = null;
  let slate = null;
  let rosters = [];
  let lastPaint = null;
  let nextRefresh = 0;

  function paint(previouslyOpen = false) {
    if (!context || !slate) return;
    const { rosterId, league, players } = context;
    const roster = rosters.find(row => String(row.roster_id) === String(rosterId));
    if (lastPaint?.slate === slate && lastPaint.rosterId === rosterId && lastPaint.players === players) return;
    const sameTeam = lastPaint?.rosterId === rosterId;
    const open = sameTeam && (previouslyOpen || host.querySelector("details")?.open);
    const focused = sameTeam && host.querySelector("summary") === document.activeElement;
    host.innerHTML = roster
      ? renderStartSit({ league, roster, players, slate, canFill, slotLabel })
      : '<p role="status">Sleeper did not return this roster.</p>';
    if (open && host.querySelector("details")) host.querySelector("details").open = true;
    if (focused) host.querySelector("summary")?.focus({ preventScroll: true });
    lastPaint = { slate, rosterId, players };
  }

  async function refresh() {
    if (!context || controller || document.hidden) return;
    clearTimeout(timer);
    const leagueId = context.league.league_id;
    const job = new AbortController();
    controller = job;
    const previouslyOpen = host.querySelector("details")?.open;
    host.innerHTML = '<p role="status">Checking the submitted lineup and this week’s games…</p>';
    const fetchRows = suffix => apiGetWithRetry(sleeperLeaguePath(leagueId, suffix), {
      signal: job.signal, timeoutMs: 12000, retries: 1,
    });
    try {
      const [weekly, rows] = await Promise.all([
        loadWeeklySlate({ signal: job.signal }),
        fetchRows("rosters"),
      ]);
      if (job.signal.aborted) return;
      if (!Array.isArray(rows)) throw new Error("No rosters");
      // A roster's default starters can diverge from the submitted lineup,
      // especially once a game locks. The selected week's matchup owns its slots.
      const currentWeek = !weekly.offSeason && String(context.league.season) === weekly.season;
      const matchups = currentWeek ? await fetchRows(`matchups/${weekly.week}`) : [];
      if (job.signal.aborted) return;
      if (!Array.isArray(matchups)) throw new Error("No weekly matchups");
      const weekByRoster = new Map(matchups.map(row => [String(row.roster_id), row]));
      rosters = rows.map(row => {
        const matchup = weekByRoster.get(String(row.roster_id));
        const eligible = new Set((matchup?.players || []).map(String));
        return {
          ...row, starters: matchup?.starters,
          players: Array.isArray(row.players) && Array.isArray(matchup?.players)
            ? row.players.filter(id => eligible.has(String(id))) : null,
        };
      });
      slate = weekly;
      paint(previouslyOpen);
      const now = Date.now();
      // Invalidate the visible recommendation as soon as a game kicks off.
      nextRefresh = Object.values(slate.games).reduce((next, game) => {
        const kickoff = Date.parse(game.kickoff);
        return kickoff > now ? Math.min(kickoff, next) : next;
      }, now + WEEKLY_SLATE_TTL_MS);
    } catch {
      if (job.signal.aborted) return;
      slate = null;
      lastPaint = null;
      host.innerHTML = '<p role="status">Weekly lineup advice is unavailable. <button type="button" class="ghost-btn" data-refresh-lineup>Try again</button></p>';
      nextRefresh = Date.now() + WEEKLY_SLATE_TTL_MS;
    } finally {
      if (controller === job) {
        controller = null;
        timer = setTimeout(refresh, Math.max(0, nextRefresh - Date.now()));
      }
    }
  }

  host.addEventListener("click", event => {
    if (event.target.closest("[data-refresh-lineup]")) void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (context && !document.hidden && Date.now() >= nextRefresh) void refresh();
  });

  return function update(next) {
    if (context?.league.league_id !== next?.league.league_id) {
      controller?.abort();
      controller = null;
      clearTimeout(timer);
      slate = null;
      lastPaint = null;
      nextRefresh = 0;
    }
    context = next;
    panel.classList.toggle("hidden", !context);
    if (!context) return;
    if (slate && Date.now() < nextRefresh) paint();
    else if (Date.now() >= nextRefresh) void refresh();
  };
}
