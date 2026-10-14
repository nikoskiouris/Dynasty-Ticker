import { escapeHtml } from "./html.js";
import { leagueTypeLabel } from "./league-format.js";
import { sleeperAvatarUrl } from "./sleeper.js";

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

  if (selected) return selected;
  return list[0] || null;
}

export function renderMeSelectOptions(rosters, selectedRosterId = "") {
  const selected = String(selectedRosterId ?? "");
  return [...(Array.isArray(rosters) ? rosters : [])]
    .sort((a, b) => String(a?.manager?.displayName || "").localeCompare(String(b?.manager?.displayName || "")))
    .map((roster) => {
      const id = String(roster?.rosterId ?? "");
      const selectedAttr = id && id === selected ? " selected" : "";
      return `<option value="${escapeHtml(id)}"${selectedAttr}>${escapeHtml(roster?.manager?.displayName || `Roster ${id}`)}</option>`;
    })
    .join("");
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
