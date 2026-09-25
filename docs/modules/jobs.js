import { escapeHtml } from "./html.js";
import { isRoomVisible, leagueTypeId } from "./league-format.js";

export const DESK_JOBS = Object.freeze([
  {
    id: "players",
    page: "players",
    room: "ranks",
    label: "Players",
    blurb: "What is this player worth?",
    cta: "look up a player",
  },
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
    blurb: "Outlook, roster, and next move",
    cta: "see your team",
  },
  {
    id: "find",
    page: "trades",
    room: "find",
    label: "Find a trade",
    blurb: "Shop, target, or a partner",
    cta: "find a trade",
  },
]);

export const DESK_MORE_JOBS = Object.freeze([
  {
    id: "week",
    page: "league",
    room: "scores",
    label: "This week",
    blurb: "Matchups and scores",
  },
  {
    id: "board",
    page: "league",
    room: "board",
    label: "League",
    blurb: "Standings and ranks",
  },
  {
    id: "history",
    page: "league",
    room: "history",
    label: "History",
    blurb: "Titles, records, who stayed",
  },
]);

export const DEFAULT_LANDING_HINT = "Type your Sleeper username, then pick a league.";

function relabelJobForLeague(job, league) {
  if (!job || leagueTypeId(league) !== "redraft") return job;
  if (job.id === "team") return { ...job, blurb: "This week and your outlook" };
  return job;
}

export function deskJobsForLeague(league) {
  const jobs = DESK_JOBS
    .filter((job) => isRoomVisible(job.page, job.room, league))
    .map((job) => relabelJobForLeague(job, league));
  const more = DESK_MORE_JOBS
    .filter((job) => isRoomVisible(job.page, job.room, league))
    .map((job) => relabelJobForLeague(job, league));
  return { jobs, more };
}

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
  jobs = DESK_JOBS,
  moreJobs = DESK_MORE_JOBS,
} = {}) {
  const jobList = Array.isArray(jobs) && jobs.length ? jobs : DESK_JOBS;
  const extraList = Array.isArray(moreJobs) ? moreJobs : DESK_MORE_JOBS;
  const moreBlock = more
    ? `
      <p class="desk-jobs-kicker">Or jump to a tool</p>
      <div class="desk-jobs desk-jobs-more" role="group" aria-label="More tools">
        ${extraList.map((job) => renderJobButton(job, { selectedId, action })).join("")}
      </div>
    `
    : "";
  return `
    <div class="desk-jobs-board">
      ${heading ? `<h2>${escapeHtml(heading)}</h2>` : ""}
      ${hint ? `<p class="muted desk-jobs-hint">${escapeHtml(hint)}</p>` : ""}
      <div class="desk-jobs" role="group" aria-label="What do you want to do">
        ${jobList.map((job) => renderJobButton(job, { selectedId, action })).join("")}
      </div>
      ${moreBlock}
    </div>
  `;
}
