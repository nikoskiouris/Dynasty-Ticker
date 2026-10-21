import { escapeHtml } from "./html.js";
import { leagueTypeLabel } from "./league-format.js";
import { sleeperAvatarUrl } from "./sleeper.js";

export function isMissingSleeperUser(err) {
  if (!err || typeof err !== "object") return false;
  if (err.name === "SyntaxError") return false;
  const status = Number(err.status);
  if (status === 404) return true;
  if (Number.isFinite(status) && status !== 200) return false;
  return /No Sleeper user named|can't find .+ on Sleeper/i.test(String(err.message || ""));
}

export function isSleeperUnreachable(err) {
  if (!err || typeof err !== "object") return false;
  if (err.name === "SyntaxError") return false;
  const status = Number(err.status);
  if (Number.isFinite(status) && status > 0) return false;
  const message = String(err.message || "");
  if (/Network\/CORS|Failed to fetch|timed out|offline/i.test(message)) return true;
  if (err.name === "TypeError") return true;
  return globalThis.navigator?.onLine === false;
}

function isSleeperServerFailure(err) {
  if (!err || typeof err !== "object") return false;
  if (err.name === "SyntaxError") return true;
  const status = Number(err.status);
  return Number.isFinite(status) && status >= 500 && status <= 599;
}

// Echo a long username short, so the error never overflows the layout.
export function shortUsername(username, max = 24) {
  const name = String(username || "").trim();
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function describeUserSearchFailure(err, username) {
  const name = shortUsername(username);
  if (isMissingSleeperUser(err)) {
    return { message: `We can't find "${name}" on Sleeper. Check the spelling.`, retry: false };
  }
  if (isSleeperUnreachable(err)) {
    return { message: "Sleeper isn't answering. Try again.", retry: true };
  }
  if (isSleeperServerFailure(err)) {
    return { message: "Sleeper had a hiccup. Try again.", retry: true };
  }
  return { message: "Sleeper is busy. Try again.", retry: true };
}

export function leagueStatusLabel(status) {
  const value = String(status || "").replaceAll("_", " ");
  if (!value) return "league";
  return value;
}

function normalizeHandle(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function findRosterById(rosters, rosterId) {
  if (rosterId == null || rosterId === "") return null;
  const token = String(rosterId).trim();
  if (!token || token === "0" || token === "NaN") return null;
  return (Array.isArray(rosters) ? rosters : []).find((roster) => String(roster?.rosterId) === token) || null;
}

function rawRosterMatchesUser(rawRoster, userId) {
  if (!userId || !rawRoster) return false;
  if (String(rawRoster.owner_id ?? "") === userId) return true;
  const coOwners = Array.isArray(rawRoster.co_owners) ? rawRoster.co_owners : [];
  return coOwners.some((id) => String(id ?? "") === userId);
}

export function findRosterForSleeperUser(rosters, sleeperUser, rawRosters = []) {
  const list = Array.isArray(rosters) ? rosters : [];
  if (!list.length || !sleeperUser) return null;

  const userId = String(sleeperUser.user_id ?? "").trim();
  const rawById = new Map(
    (Array.isArray(rawRosters) ? rawRosters : []).map((row) => [String(row?.roster_id ?? ""), row]),
  );

  if (userId) {
    const byManager = list.find((roster) => String(roster?.manager?.userId ?? "") === userId);
    if (byManager) return byManager;
    const byRaw = list.find((roster) => rawRosterMatchesUser(rawById.get(String(roster?.rosterId ?? "")), userId));
    if (byRaw) return byRaw;
  }

  const handles = [sleeperUser.username, sleeperUser.display_name].map(normalizeHandle).filter(Boolean);
  if (!handles.length) return null;
  return list.find((roster) => handles.includes(normalizeHandle(roster?.manager?.displayName))) || null;
}

export function resolveDefaultMeRoster({
  rosters = [],
  pendingMeRosterId = null,
  selectedRosterId = null,
  sleeperUser = null,
  rawRosters = [],
  userPickedMe = false,
} = {}) {
  const list = Array.isArray(rosters) ? rosters : [];
  const pending = findRosterById(list, pendingMeRosterId);
  if (pending) return pending;

  const selected = findRosterById(list, selectedRosterId);
  if (userPickedMe && selected) return selected;

  const searched = findRosterForSleeperUser(list, sleeperUser, rawRosters);
  if (searched) return searched;

  // A searched user who isn't in this league is not the first manager.
  if (sleeperUser) return null;

  if (selected) return selected;
  return list[0] || null;
}

export function noTeamInLeagueCopy(sleeperUser) {
  if (!sleeperUser) return "";
  const name = String(sleeperUser.display_name || sleeperUser.username || "").trim();
  if (name) return `${name} has no team in this league.`;
  return "This user has no team in this league.";
}

export function renderMeSelectOptions(rosters, selectedRosterId = "", viewer = null) {
  const selected = String(selectedRosterId ?? "");
  const viewerId = viewer?.sample && viewer?.rosterId != null ? String(viewer.rosterId) : "";
  const options = [...(Array.isArray(rosters) ? rosters : [])]
    .sort((a, b) => String(a?.manager?.displayName || "").localeCompare(String(b?.manager?.displayName || "")))
    .map((roster) => {
      const id = String(roster?.rosterId ?? "");
      const selectedAttr = id && id === selected ? " selected" : "";
      const name = roster?.manager?.displayName || `Roster ${id}`;
      const label = viewerId && id === viewerId ? "Sample league" : name;
      return `<option value="${escapeHtml(id)}"${selectedAttr}>${escapeHtml(label)}</option>`;
    })
    .join("");
  if (selected) return options;
  return `<option value="" selected>No team</option>${options}`;
}

export function seasonSearchHardFailStatus(season) {
  const year = String(season || "").trim() || "this year";
  return `Couldn't load ${year} leagues from Sleeper. Try again — we won't open a league until this year's list comes back.`;
}

export function seasonSearchHardFailField(season) {
  const year = String(season || "").trim() || "this year";
  return `Couldn't load ${year} leagues.`;
}

export function seasonSearchSoftFailNote(seasons) {
  const years = [...new Set((Array.isArray(seasons) ? seasons : []).map((season) => String(season || "").trim()).filter(Boolean))];
  if (!years.length) return "";
  if (years.length === 1) return `Also couldn't load ${years[0]}.`;
  return `Also couldn't load ${years.slice(0, -1).join(", ")} and ${years.at(-1)}.`;
}

export function renderLeagueSearchNote(seasons) {
  const note = seasonSearchSoftFailNote(seasons);
  if (!note) return "";
  return `<p class="league-picker-note muted">${escapeHtml(note)}</p>`;
}

export function renderLeaguePickerMarkup(leagues, currentSeason, selectedId = "") {
  if (!leagues?.length) return "";
  return `
    <div class="league-picker-head">
      <span class="eyebrow">Your leagues</span>
      <strong>Pick a league</strong>
    </div>
    <div class="league-picker-list">
      ${leagues.map((league) => {
        const avatar = sleeperAvatarUrl(league.avatar);
        const current = String(league.season || "") === String(currentSeason || "");
        const selected = String(league.league_id) === String(selectedId || "");
        return `
          <button type="button" class="league-pick ${current ? "current" : ""} ${selected ? "selected" : ""}" data-league-id="${escapeHtml(league.league_id)}" aria-pressed="${selected ? "true" : "false"}">
            <span class="league-pick-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(league.name || "League")} logo">` : `<span aria-hidden="true">${escapeHtml((league.name || "L").slice(0, 1))}</span>`}</span>
            <span class="league-pick-copy">
              <strong>${escapeHtml(league.name || "Untitled league")}</strong>
              <small>${escapeHtml(String(league.season || ""))} · ${Number(league.total_rosters || 0)} teams · ${escapeHtml(leagueTypeLabel(league))} · ${escapeHtml(leagueStatusLabel(league.status))}</small>
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}
