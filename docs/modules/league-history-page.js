import { escapeHtml, formatNumber } from "./html.js";
import { championsWall, allTimeStandings, leagueRecordBook, leagueTrends } from "./league-records.js";
import { renderRivalries } from "./league-rivalries-page.js";
import { renderTrophyCases } from "./league-trophies-page.js";
import { renderTraderAwards } from "./league-trader-awards-page.js";
import { renderOperationsAwards } from "./league-operations-awards-page.js";
import { renderDrafterAwards } from "./league-drafter-awards-page.js";

const e = (value) => escapeHtml(String(value ?? ""));
const whole = (value) => Number.isFinite(Number(value)) ? formatNumber(Number(value)) : "—";
const decimal = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—";
const safeSeason = (value) => /^20\d\d$/.test(String(value || "")) ? String(value) : "";

const RECORD_LABELS = Object.freeze({
  highWeek: "Highest weekly score",
  lowWeek: "Lowest weekly score",
  biggestWin: "Biggest blowout",
  closestWin: "Closest game",
  mostInLoss: "Most points in a loss",
  fewestInWin: "Fewest points in a win",
  highSeasonPF: "Most points in a season",
  bestSeasonRecord: "Best regular-season record",
});

function renderChampions(seasons) {
  const items = seasons.map((row) => `<li class="league-history-season">
    <h3>${e(row.season)} ${row.completed ? "" : '<span class="mini-chip">In progress</span>'}</h3>
    <dl>
      <div><dt>Champion</dt><dd>${e(row.champion || "Not confirmed")}</dd></div>
      ${row.runnerUp ? `<div><dt>Runner-up</dt><dd>${e(row.runnerUp)}</dd></div>` : ""}
      ${row.regularLeader ? `<div><dt>Regular-season leader</dt><dd>${e(row.regularLeader)}</dd></div>` : ""}
      ${row.pointsLeader ? `<div><dt>Points leader</dt><dd>${e(row.pointsLeader)}</dd></div>` : ""}
      ${row.completed && row.lastPlace ? `<div><dt>Last place (regular season)</dt><dd>${e(row.lastPlace)}</dd></div>` : ""}
      ${row.consolationWinner ? `<div><dt>Consolation winner</dt><dd>${e(row.consolationWinner)}</dd></div>` : ""}
    </dl>
  </li>`).join("");
  return `<section class="workspace-panel"><h2>Champions wall</h2><ol class="league-history-season-list">${items || "<li>No seasons found.</li>"}</ol></section>`;
}

function renderAllTime(rows) {
  if (!rows.length) return "";
  return `<section class="workspace-panel"><h2>All-time standings</h2>
    <p class="muted small">By Sleeper manager account across the loaded seasons. A team renamed by the same manager counts once; ownership changes remain separate.</p>
    <div class="league-history-scroll" role="region" aria-label="All-time standings table" tabindex="0">
      <table class="league-history-table"><thead><tr>
        <th scope="col">Manager</th><th scope="col">Seasons</th><th scope="col">W-L-T</th><th scope="col">Win %</th>
        <th scope="col">PF</th><th scope="col">PA</th><th scope="col">Playoffs</th><th scope="col">Titles</th><th scope="col">Finals</th>
      </tr></thead><tbody>
      ${rows.map((row) => `<tr><th scope="row">${e(row.name)}</th>
        <td>${whole(row.seasons)}</td><td>${whole(row.wins)}–${whole(row.losses)}–${whole(row.ties)}</td>
        <td>${row.winPct == null ? "—" : `${decimal(row.winPct)}%`}</td>
        <td>${whole(row.pf)}</td><td>${whole(row.pa)}</td>
        <td>${whole(row.playoffAppearances)}</td><td>${whole(row.titles)}</td><td>${whole(row.finals)}</td>
      </tr>`).join("")}</tbody></table>
    </div></section>`;
}

function renderRecords(book) {
  const entries = Object.entries(RECORD_LABELS).filter(([key]) => book.records[key]);
  if (!entries.length) return `<section class="workspace-panel"><h2>Record book</h2>
    <p class="muted">Weekly records will appear when Sleeper has matchups for the loaded seasons.</p></section>`;
  return `<section class="workspace-panel"><h2>Record book</h2>
    <p class="muted small">Calculated from ${whole(book.gamesRead)} completed head-to-head matchups and ${whole(book.seasonsRead)} seasons. Missing Sleeper weeks are excluded.</p>
    <dl class="league-history-records">${entries.map(([key, label]) => {
      const item = book.records[key];
      const season = safeSeason(item.season);
      const week = Number(item.week);
      const where = [season, Number.isInteger(week) && week > 0 ? `Week ${week}` : ""].filter(Boolean).join(" · ");
      const value = key === "bestSeasonRecord" ? `${decimal(item.value)}% (${e(item.record)})` : whole(item.value);
      return `<div><dt>${e(label)}</dt><dd><strong>${value}</strong>
        <span>${e(item.team)}${item.opponent ? ` vs. ${e(item.opponent)}` : ""}</span>
        <span class="muted small">${e(where)}</span></dd></div>`;
    }).join("")}</dl></section>`;
}

function renderTrends(rows) {
  if (!rows.length) return "";
  return `<section class="workspace-panel"><h2>League trends</h2>
    <div class="league-history-scroll" role="region" aria-label="Season statistics table" tabindex="0">
      <table class="league-history-table"><thead><tr><th scope="col">Season</th>
      <th scope="col">Avg weekly score</th><th scope="col">Trades</th><th scope="col">Waiver & free-agent moves</th>
      <th scope="col">Games counted</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><th scope="row">${e(row.season)}</th>
        <td>${row.averageScore == null ? "—" : decimal(row.averageScore)}</td>
        <td>${whole(row.trades)}</td><td>${whole(row.waivers)}</td><td>${whole(row.games)}</td>
      </tr>`).join("")}</tbody></table></div></section>`;
}

export function renderLeagueHistory(archive, { valueNames = {}, values = {}, players = {}, showLineup = false } = {}) {
  const seasons = archive?.seasons || [];
  const leagueId = encodeURIComponent(String(archive?.leagueId || ""));
  const name = seasons[0]?.league?.name || "League";
  const years = seasons.map((item) => Number(item.season)).filter(Number.isFinite);
  const range = years.length ? `${Math.min(...years)}–${Math.max(...years)} · ${years.length} season${years.length === 1 ? "" : "s"}` : "No seasons loaded";
  const book = leagueRecordBook(archive);
  const issues = archive?.issues || [];
  return `<div class="league-history-page">
    <p><a href="/l/${leagueId}">← League</a></p>
    <header><h2>${e(name)} All-Time</h2><p class="muted">${e(range)}</p>
      <p class="muted small">12-team Superflex PPR is the only player-value reference. Game records and titles come from Sleeper.</p>
    </header>
    ${issues.length ? `<section class="workspace-panel" aria-label="Incomplete league data"><h2>Some history is unavailable</h2>
      <ul>${issues.slice(0, 12).map((issue) => `<li>${e(issue.message || "A Sleeper request failed")}</li>`).join("")}</ul>
      ${issues.length > 12 ? `<p class="muted">${issues.length - 12} more unavailable resources.</p>` : ""}
    </section>` : ""}
    ${renderChampions(championsWall(archive))}
    ${renderAllTime(allTimeStandings(archive))}
    ${renderRecords(book)}
    ${renderRivalries(archive)}
    ${renderTrends(leagueTrends(archive))}
    ${renderTrophyCases(archive, { valueNames })}
    ${renderTraderAwards(archive, { values, valueNames })}
    ${renderDrafterAwards(archive, { values, valueNames })}
    ${renderOperationsAwards(archive, { players, values, valueNames, showLineup })}
    <section class="workspace-panel"><h2>More history</h2><p class="muted">
      Composite manager awards are not available yet; a single overall rank needs validated category weights.
      These sections require additional calculation and verification; no rankings have been inferred.</p></section>
  </div>`;
}
