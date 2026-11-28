import { escapeHtml, formatNumber } from "./html.js";
import { championsWall, allTimeStandings, leagueRecordBook, leagueTrends } from "./league-records.js";
import { formatPoints } from "./standings.js";
import { renderRivalries } from "./league-rivalries-page.js";
import { renderMostTraded } from "./league-most-traded.js";
import { renderTrophyCases } from "./league-trophies-page.js";
import { renderTraderAwards } from "./league-trader-awards-page.js";
import { renderOperationsAwards } from "./league-operations-awards-page.js";
import { renderDrafterAwards } from "./league-drafter-awards-page.js";
import { renderManagerAward } from "./league-manager-award.js";

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
  worstSeasonRecord: "Worst regular-season record",
  winStreak: "Longest winning streak",
  loseStreak: "Longest losing streak",
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
    <p class="muted small">Luck is actual wins minus expected wins.</p>
    <div class="league-history-scroll" role="region" aria-label="All-time standings table" tabindex="0">
      <table class="league-history-table"><thead><tr>
        <th scope="col">Manager</th><th scope="col">Seasons</th><th scope="col">W-L-T</th><th scope="col">Win %</th>
        <th scope="col">PF</th><th scope="col">PA</th><th scope="col">Playoffs</th><th scope="col">Titles</th><th scope="col">Finals</th>
        <th scope="col">Avg finish</th><th scope="col">Luck</th>
      </tr></thead><tbody>
      ${rows.map((row) => `<tr><th scope="row">${e(row.name)}</th>
        <td>${whole(row.seasons)}</td><td>${whole(row.wins)}–${whole(row.losses)}–${whole(row.ties)}</td>
        <td>${row.winPct == null ? "—" : `${decimal(row.winPct)}%`}</td>
        <td>${formatPoints(row.pf)}</td><td>${formatPoints(row.pa)}</td>
        <td>${whole(row.playoffAppearances)}</td><td>${whole(row.titles)}</td><td>${whole(row.finals)}</td>
        <td>${row.avgFinish == null ? "—" : row.avgFinish.toFixed(1)}</td>
        <td>${row.luck == null ? "—" : `${row.luck > 0 ? "+" : ""}${row.luck.toFixed(1)}`}</td>
      </tr>`).join("")}</tbody></table>
    </div></section>`;
}

function renderRecords(book) {
  const entries = Object.entries(RECORD_LABELS).filter(([key]) => book.records[key]);
  if (!entries.length) return `<section class="workspace-panel"><h2>Record book</h2>
    <p class="muted">No weekly matchup records from Sleeper.</p></section>`;
  return `<section class="workspace-panel"><h2>Record book</h2>
    <p class="muted small">${whole(book.gamesRead)} completed head-to-head ${Number(book.gamesRead) === 1 ? "matchup" : "matchups"} across ${whole(book.seasonsRead)} ${Number(book.seasonsRead) === 1 ? "season" : "seasons"}. Excludes missing weeks.</p>
    <dl class="league-history-records">${entries.map(([key, label]) => {
      const item = book.records[key];
      const season = safeSeason(item.season);
      const week = Number(item.week);
      const where = [season, Number.isInteger(week) && week > 0 ? `Week ${week}` : item.weeks || "", item.partial ? "so far" : ""].filter(Boolean).join(" · ");
      const value = key === "bestSeasonRecord" || key === "worstSeasonRecord" ? `${decimal(item.value)}% (${e(item.record)})`
        : key === "winStreak" || key === "loseStreak" ? `${whole(item.value)} game${item.value === 1 ? "" : "s"}` : formatPoints(item.value);
      return `<div><dt>${e(label)}</dt><dd><strong>${value}</strong>
        <span>${e(item.team)}${item.opponent ? ` vs. ${e(item.opponent)}` : ""}</span>
        <span class="muted small">${e(where)}</span></dd></div>`;
    }).join("")}</dl></section>`;
}

function renderTrends(rows) {
  if (!rows.length) return "";
  const max = (key) => Math.max(1, ...rows.map((row) => Number(row[key]) || 0));
  const bar = (row, key, text) => {
    const value = Number(row[key]);
    if (!Number.isFinite(value) || row[key] == null) return "—";
    const width = Math.max(2, Math.round(value / max(key) * 100));
    return `<span class="trend-cell">${text}<span class="trend-bar" aria-hidden="true"><span style="width:${width}%"></span></span></span>`;
  };
  const moves = (row, key) => row.transactionsLoaded ? bar(row, key, whole(row[key])) : "—";
  return `<section class="workspace-panel"><h2>League trends</h2>
    <p class="muted small">Higher parity means a closer league.</p>
    <div class="league-history-scroll" role="region" aria-label="Season statistics table" tabindex="0">
      <table class="league-history-table"><thead><tr><th scope="col">Season</th>
      <th scope="col">Avg weekly score</th><th scope="col">Parity</th><th scope="col">Points spread</th><th scope="col">Trades</th><th scope="col">Picks traded</th><th scope="col">Waiver & free-agent moves</th>
      <th scope="col">Games counted</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><th scope="row">${e(row.season)}</th>
        <td>${row.averageScore == null ? "—" : formatPoints(row.averageScore)}</td>
        <td>${row.parity == null ? "—" : whole(row.parity)}</td>
        <td>${row.pointsSpread == null ? "—" : formatPoints(row.pointsSpread)}</td>
        <td>${moves(row, "trades")}</td><td>${moves(row, "picksTraded")}</td><td>${moves(row, "waivers")}</td><td>${whole(row.games)}</td>
      </tr>`).join("")}</tbody></table></div></section>`;
}

export function renderLeagueHistory(archive, { valueNames = {}, values = {}, players = {}, peaks = null, showLineup = false, savedNote = "", caveat = "" } = {}) {
  const seasons = archive?.seasons || [];
  const leagueId = encodeURIComponent(String(archive?.leagueId || ""));
  const name = seasons[0]?.league?.name || "League";
  const years = seasons.map((item) => Number(item.season)).filter(Number.isFinite);
  const range = years.length ? `${Math.min(...years)}–${Math.max(...years)} · ${years.length} season${years.length === 1 ? "" : "s"}` : "No seasons loaded";
  const book = leagueRecordBook(archive);
  const issues = archive?.issues || [];
  const sections = [
    ["champions", "Champions wall", renderChampions(championsWall(archive))],
    ["standings", "All-time standings", renderAllTime(allTimeStandings(archive))],
    ["records", "Record book", renderRecords(book)],
    ["rivalries", "Head-to-head and rivalries", renderRivalries(archive)],
    ["trends", "League trends", renderTrends(leagueTrends(archive))],
    ["traded", "Most traded players", renderMostTraded(archive, { values, valueNames, players, peaks })],
    ["trophies", "Manager trophy cases", renderTrophyCases(archive, { valueNames, players })],
    ["traders", "Trade awards", renderTraderAwards(archive, { values, valueNames })],
    ["draft", "Draft awards", renderDrafterAwards(archive, { values, valueNames })],
    ["operations", "Lineup and waiver awards", renderOperationsAwards(archive, { players, values, valueNames, showLineup })],
    ["managers", "Manager awards", renderManagerAward(archive, { values, valueNames })],
  ].filter(([, , content]) => content);
  return `<div class="league-history-page">
    <p><a class="league-back" href="/l/${leagueId}">← League</a></p>
    <header><h2>${e(name)}</h2><p class="muted">${e(range)}</p>
      ${savedNote ? `<p class="league-saved-note" role="status">${e(savedNote)}</p>` : ""}
      ${caveat ? `<p class="muted small calc-market-caveat">${e(caveat)}</p>` : ""}
    </header>
    ${issues.length ? `<section class="workspace-panel" aria-label="Incomplete league data"><h2>Some history is unavailable</h2>
      <ul>${issues.slice(0, 12).map((issue) => `<li>${e(issue.message || "A Sleeper request failed")}</li>`).join("")}</ul>
      ${issues.length > 12 ? `<p class="muted">${issues.length - 12} more unavailable resources.</p>` : ""}
    </section>` : ""}
    <label class="history-jump"><span class="sr-only">Jump to history section</span>
      <select id="history-jump"><option value="">Jump to section</option>
        ${sections.map(([id, label]) => `<option value="archive-${id}">${label}</option>`).join("")}
      </select>
    </label>
    ${sections.map(([id, label, content]) => `<div class="history-section" id="archive-${id}" role="region" aria-label="${label}" tabindex="-1">${content}</div>`).join("")}
  </div>`;
}
