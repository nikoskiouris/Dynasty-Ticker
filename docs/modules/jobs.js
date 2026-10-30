import { escapeHtml } from "./html.js";
export const DESK_JOBS = Object.freeze([
  {
    id: "trade",
    page: "trades",
    room: "calculator",
    label: "Check a trade",
    blurb: "You give and you get",
    cta: "check a trade",
  },
  {
    id: "team",
    page: "league",
    room: "team",
    label: "My team",
    blurb: "Roster, picks, standings, playoff odds",
    cta: "see your team",
  },
  {
    id: "find",
    page: "trades",
    room: "find",
    label: "Find a trade",
    blurb: "1-for-1 and 2-for-1 ideas",
    cta: "find a trade",
  },
]);

export const DESK_MORE_JOBS = Object.freeze([]);

export const DEFAULT_LANDING_HINT = "Type your Sleeper username, then pick a league.";

export function jobById(id, { includeMore = true } = {}) {
  const token = String(id || "");
  if (!token) return null;
  const list = includeMore ? [...DESK_JOBS, ...DESK_MORE_JOBS] : DESK_JOBS;
  return list.find((job) => job.id === token) || null;
}

export function landingSearchHint(job) {
  if (!job?.cta) return DEFAULT_LANDING_HINT;
  return `Type your Sleeper username to ${job.cta}.`;
}

export function renderJobButton(job, { selectedId = "", action = "" } = {}) {
  if (!job) return "";
  const selected = job.id === selectedId;
  const actionAttr = action ? ` data-action="${escapeHtml(action)}"` : "";
  return `
    <button type="button" class="desk-job${selected ? " active" : ""}"${actionAttr} data-job="${escapeHtml(job.id)}" data-page="${escapeHtml(job.page)}" data-room="${escapeHtml(job.room)}" aria-pressed="${selected ? "true" : "false"}">
      <strong>${escapeHtml(job.label)}</strong>
      <small>${escapeHtml(job.blurb)}</small>
    </button>
  `;
}

