import { escapeHtml } from "./html.js";

// The last real (not sample) league and team this browser opened, so a
// returning manager reopens it from home in one tap. Ticket 018.
export const LAST_LEAGUE_KEY = "dt:last-league:v1";
const LEAGUE_ID = /^\d{1,20}$/;
const MAX_TEXT = 80;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

export function normalizeLastLeague(raw) {
  if (!raw || typeof raw !== "object") return null;
  const leagueId = String(raw.leagueId || "");
  if (!LEAGUE_ID.test(leagueId) || /^0+$/.test(leagueId)) return null;
  const roster = Number(raw.rosterId);
  return {
    leagueId,
    leagueName: cleanText(raw.leagueName),
    rosterId: Number.isInteger(roster) && roster > 0 ? roster : null,
    managerName: cleanText(raw.managerName),
  };
}

export function readLastLeague(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(LAST_LEAGUE_KEY);
    return raw ? normalizeLastLeague(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeLastLeague(entry, storage = globalThis.localStorage) {
  const row = normalizeLastLeague(entry);
  if (!row) return false;
  try {
    storage?.setItem?.(LAST_LEAGUE_KEY, JSON.stringify(row));
    return true;
  } catch {
    return false;
  }
}

export function forgetLastLeague(storage = globalThis.localStorage) {
  try {
    storage?.removeItem?.(LAST_LEAGUE_KEY);
  } catch {
    /* Blocked storage has nothing to forget. */
  }
}

export function lastLeagueHref(entry) {
  const row = normalizeLastLeague(entry);
  if (!row) return "";
  return `/l/${row.leagueId}/team${row.rosterId ? `?me=${row.rosterId}` : ""}`;
}

export function lastLeagueMarkup(entry) {
  const row = normalizeLastLeague(entry);
  if (!row) return "";
  const name = row.leagueName || "your league";
  const who = row.managerName ? `As ${row.managerName}. ` : "";
  return `
    <a class="launch-action launch-primary launch-resume-open" href="${escapeHtml(lastLeagueHref(row))}">
      <strong>Open ${escapeHtml(name)} <span aria-hidden="true">›</span></strong>
      <span>${escapeHtml(who)}You opened it last time in this browser.</span>
    </a>
    <button type="button" class="link-btn launch-resume-forget" data-action="forget-last-league">Forget this league</button>
  `;
}
