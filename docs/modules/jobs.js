import { escapeHtml } from "./html.js";
import { isRoomVisible, leagueTypeId } from "./league-format.js";

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
    room: "match",
    label: "Make a trade",
    blurb: "Find a partner, then the calculator",
    cta: "make a trade",
  },
  {
    id: "history",
    page: "league",
    room: "history",
    label: "League history",
    blurb: "Last champion, titles, records",
    cta: "open league history",
  },
]);

export const DESK_MORE_JOBS = Object.freeze([
  {
    id: "call",
    page: "teams",
    room: "call",
    label: "Tank or contend",
    blurb: "Desk call for your roster",
  },
  {
    id: "mock",
    page: "teams",
    room: "mock",
    label: "Rookie mock",
    blurb: "2027 SF board, 1sts and 2nds",
  },
  {
    id: "match",
    page: "trades",
    room: "match",
    label: "Find a partner",
    blurb: "Who has your holes",
  },
  {
    id: "ranks",
    page: "trades",
    room: "ranks",
    label: "Player values",
    blurb: "Ranks and the pick they equal",
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

function relabelJobForLeague(job, league) {
  if (!job || leagueTypeId(league) !== "redraft") return job;
  if (job.id === "team") return { ...job, blurb: "Sit/start, in it or out" };
  if (job.id === "call") return { ...job, label: "In it or out", blurb: "Playoff push, bubble, or out" };
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
