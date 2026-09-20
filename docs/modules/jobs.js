import { escapeHtml } from "./html.js";

export const DESK_JOBS = Object.freeze([
  {
    id: "week",
    page: "league",
    room: "scores",
    label: "See this week",
    blurb: "Scores, standings, and awards",
    cta: "open this week's scores",
  },
  {
    id: "team",
    page: "teams",
    room: "roster",
    label: "Scout a team",
    blurb: "Sit/start, tank or contend, who stayed",
    cta: "scout a roster",
  },
  {
    id: "trade",
    page: "trades",
    room: "calculator",
    label: "Make a trade",
    blurb: "Calculator, find a partner, shop a player",
    cta: "make a trade",
  },
  {
    id: "history",
    page: "history",
    room: "hall",
    label: "League history",
    blurb: "Titles, seasons, record book",
    cta: "open league history",
  },
]);

export const DESK_MORE_JOBS = Object.freeze([
  {
    id: "recap",
    page: "league",
    room: "recap",
    label: "Write a recap",
    blurb: "Group-chat card of the week",
  },
  {
    id: "call",
    page: "teams",
    room: "call",
    label: "Tank or contend",
    blurb: "Desk call for your roster",
  },
  {
    id: "match",
    page: "trades",
    room: "match",
    label: "Find a partner",
    blurb: "Who has your holes",
  },
  {
    id: "lab",
    page: "trades",
    room: "lab",
    label: "Find deals",
    blurb: "Shop, target, or blockbuster",
  },
]);

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

export function renderDeskJobsMarkup({
  selectedId = "",
  heading = "What do you want to do?",
  hint = "",
  more = false,
  action = "",
} = {}) {
  const moreBlock = more
    ? `
      <p class="desk-jobs-kicker">Or jump to a tool</p>
      <div class="desk-jobs desk-jobs-more" role="group" aria-label="More tools">
        ${DESK_MORE_JOBS.map((job) => renderJobButton(job, { selectedId, action })).join("")}
      </div>
    `
    : "";
  return `
    <div class="desk-jobs-board">
      ${heading ? `<h2>${escapeHtml(heading)}</h2>` : ""}
      ${hint ? `<p class="muted desk-jobs-hint">${escapeHtml(hint)}</p>` : ""}
      <div class="desk-jobs" role="group" aria-label="What do you want to do">
        ${DESK_JOBS.map((job) => renderJobButton(job, { selectedId, action })).join("")}
      </div>
      ${moreBlock}
    </div>
  `;
}
