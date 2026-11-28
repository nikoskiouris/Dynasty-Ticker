import { countLabel, escapeHtml } from "./html.js";
import { headToHeadHistory, rivalryHighlights } from "./league-rivalries.js";
import { formatPoints } from "./standings.js";

const e = (value) => escapeHtml(String(value ?? ""));

const historyCache = new WeakMap();
let selectedSeries = null;

function seriesHistory(archive) {
  if (!historyCache.has(archive)) historyCache.set(archive, headToHeadHistory(archive));
  return historyCache.get(archive);
}

function lookupSeries(history, left, right) {
  return history.pairByKey.get([left, right].sort((a, b) => a.localeCompare(b)).join("|"));
}

function seriesVerdict(pair) {
  const leader = pair.firstWins > pair.secondWins ? pair.firstName : pair.secondName;
  const trailer = pair.firstWins > pair.secondWins ? pair.secondName : pair.firstName;
  if (pair.meetings === 1) return pair.ties ? "One meeting, zero bragging rights." : `${leader} struck first.`;
  if (pair.firstWins === pair.secondWins) return "Nobody owns this rivalry. Yet.";
  if (Math.max(pair.firstWins, pair.secondWins) === pair.meetings) return `${trailer} is still looking for a first win.`;
  const latestWinner = pair.games[0].winnerKey;
  const leaderKey = pair.firstWins > pair.secondWins ? pair.first : pair.second;
  if (latestWinner && latestWinner !== leaderKey) return `${leader} leads. ${trailer} got the last word.`;
  return `${leader} has the bragging rights.`;
}

function gameLine(pair, game) {
  if (!game.winnerKey) return `Tied at ${formatPoints(game.firstPoints)} apiece`;
  const firstWon = game.winnerKey === pair.first;
  return `${firstWon ? pair.firstName : pair.secondName} won ${formatPoints(firstWon ? game.firstPoints : game.secondPoints)}–${formatPoints(firstWon ? game.secondPoints : game.firstPoints)}`;
}

function gameReceipt(pair, game, label) {
  return `<div><dt>${e(label)}</dt><dd>${e(gameLine(pair, game))}</dd>
    <dd class="faceoff-date">${e(game.season)} · Week ${e(game.week)}</dd></div>`;
}

function seriesResult(history, left, right) {
  const pair = lookupSeries(history, left, right);
  if (!pair) return '<p class="faceoff-empty">These two have no recorded meetings in the available Sleeper history.</p>';
  const firstOnLeft = left === pair.first;
  const latest = pair.games[0];
  const closest = pair.games.reduce((best, game) =>
    Math.abs(game.firstPoints - game.secondPoints) < Math.abs(best.firstPoints - best.secondPoints) ? game : best);
  const wins = (name, total) => `<div class="faceoff-total"><strong>${total}<small> ${total === 1 ? "win" : "wins"}</small></strong><span>${e(name)}</span></div>`;
  const verdict = seriesVerdict(pair);
  const totalMeetings = countLabel(pair.meetings, "recorded head-to-head week");
  const meetings = `${totalMeetings}${pair.ties ? ` · ${countLabel(pair.ties, "tie")}` : ""}`;
  const copy = `${verdict} In ${totalMeetings}, ${pair.firstName} has ${countLabel(pair.firstWins, "win")} and ${pair.secondName} has ${countLabel(pair.secondWins, "win")}${pair.ties ? `, with ${countLabel(pair.ties, "tie")}` : ""}. Each postseason week counts separately. ${latest.season}, Week ${latest.week} — ${gameLine(pair, latest)}.`;
  return `<div class="faceoff-score">
      ${firstOnLeft ? wins(pair.firstName, pair.firstWins) : wins(pair.secondName, pair.secondWins)}
      <span class="faceoff-dash" aria-hidden="true">–</span>
      ${firstOnLeft ? wins(pair.secondName, pair.secondWins) : wins(pair.firstName, pair.firstWins)}
    </div>
    <p class="faceoff-meetings">${e(meetings)}</p>
    <h3 class="faceoff-verdict">${e(verdict)}</h3>
    <dl class="faceoff-receipts">
      ${gameReceipt(pair, latest, latest === closest && pair.meetings > 1 ? "Last meeting · closest score" : "Last meeting")}
      ${latest !== closest ? gameReceipt(pair, closest, "Closest score") : ""}
    </dl>
    <div class="almanac-actions"><button type="button" data-action="copy-almanac-receipt" data-receipt-chapter="archive-rivalries" data-receipt-matchup="${e(`${left}|${right}`)}" data-almanac-receipt="${e(copy)}">Copy verdict</button><span role="status" class="almanac-copy-status"></span></div>`;
}

function renderComparison(leagueId, history, managers) {
  const featured = history.pairs[0];
  const valid = selectedSeries?.leagueId === leagueId
    && [selectedSeries.left, selectedSeries.right].every(key => managers.some(manager => manager.key === key));
  if (!valid) selectedSeries = { leagueId, left: featured.first, right: featured.second };
  const sorted = managers.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const picker = (label, side) => `<div class="faceoff-picker"><label for="almanac-rivalry-${side}">${label}</label>
    <select id="almanac-rivalry-${side}" data-rivalry-side="${side}">${sorted.map(({ key, name }) =>
      `<option value="${e(key)}"${key === selectedSeries[side] ? " selected" : ""}>${e(name)}</option>`).join("")}</select></div>`;
  return `<section class="faceoff" data-rivalry-league="${e(leagueId)}">
    <h2>Head-to-head</h2>
    <p class="faceoff-scope">Compare weekly scores, including playoff and consolation matchups. Each week of a two-week round counts separately.</p>
    <div class="faceoff-pickers">${picker("Manager", "left")}<span aria-hidden="true">vs.</span>${picker("Opponent", "right")}</div>
    <div class="faceoff-result" aria-live="polite" aria-atomic="true">${seriesResult(history, selectedSeries.left, selectedSeries.right)}</div>
  </section>`;
}

export function restoreRivalryComparison(chapter, archive, matchup) {
  if (!archive || !matchup) return false;
  const [left, right, extra] = matchup.split("|");
  if (!left || !right || extra !== undefined || !lookupSeries(seriesHistory(archive), left, right)) return false;
  const first = chapter.querySelector('[data-rivalry-side="left"]');
  const second = chapter.querySelector('[data-rivalry-side="right"]');
  if (!first || !second) return false;
  first.value = left;
  second.value = right;
  updateRivalryComparison(first, archive);
  return true;
}

export function updateRivalryComparison(select, archive) {
  const host = select.closest("[data-rivalry-league]");
  if (!host || !archive || String(archive.leagueId) !== host.dataset.rivalryLeague) return;
  const side = select.dataset.rivalrySide;
  const other = side === "left" ? "right" : "left";
  const opponent = host.querySelector(`[data-rivalry-side="${other}"]`);
  // Switching to the opponent swaps sides and keeps both selectors usable in two-manager leagues.
  if (select.value === opponent.value) opponent.value = selectedSeries[side];
  selectedSeries = { leagueId: archive.leagueId, [side]: select.value, [other]: opponent.value };
  host.querySelector(".faceoff-result").innerHTML = seriesResult(seriesHistory(archive), selectedSeries.left, selectedSeries.right);
}

export function renderRivalries(archive) {
  const history = seriesHistory(archive);
  if (!history.pairs.length) return `<section class="workspace-panel"><h2>Head-to-head history</h2>
    <p class="muted">No completed head-to-head matchups from Sleeper.</p></section>`;
  const managers = history.managers.filter((manager) =>
    history.pairs.some((pair) => pair.first === manager.key || pair.second === manager.key));
  const cells = managers.map((row) => `<tr><th scope="row">${e(row.name)}</th>${managers.map((col) => {
    if (row.key === col.key) return '<td aria-label="Same manager">—</td>';
    const pair = lookupSeries(history, row.key, col.key);
    if (!pair) return '<td aria-label="No recorded meetings">—</td>';
    const wins = row.key === pair.first ? pair.firstWins : pair.secondWins;
    const losses = row.key === pair.first ? pair.secondWins : pair.firstWins;
    return `<td aria-label="${e(row.name)} versus ${e(col.name)}: ${wins} wins, ${losses} losses, ${pair.ties} ties">${wins}–${losses}${pair.ties ? `–${pair.ties}` : ""}</td>`;
  }).join("")}</tr>`).join("");
  const top = rivalryHighlights(history);
  const highlight = (label, pair, amount, qualifier = "") => pair
    ? `<div><dt>${e(label)}</dt><dd><strong>${e(pair.firstName)} vs. ${e(pair.secondName)}</strong>
        <span>${e(amount)}</span>${qualifier ? `<small class="muted">${e(qualifier)}</small>` : ""}</dd></div>`
    : "";
  const lopsided = top.lopsided && (top.lopsided.firstWins >= top.lopsided.secondWins ? top.lopsided.firstName : top.lopsided.secondName);
  return `${renderComparison(archive.leagueId, history, managers)}
  <section class="workspace-panel">
    <h2>Head-to-head grid</h2>
    <div class="league-history-scroll" role="region" tabindex="0" aria-label="All-time head-to-head records">
      <table class="league-history-table league-history-h2h"><thead>
        <tr><th scope="col">Manager</th>${managers.map((row) => `<th scope="col">${e(row.name)}</th>`).join("")}</tr></thead>
        <tbody>${cells}</tbody></table></div>
  </section>
  <section class="workspace-panel"><h2>Rivalries</h2>
    ${top.mostPlayed || top.lopsided || top.playoff ? "" : '<p class="muted">No pairing has met more than once yet.</p>'}
    <dl class="league-history-records">
      ${highlight("Most played", top.mostPlayed, `${top.mostPlayed?.meetings || 0} meetings`,
        top.mostPlayed?.tiedWith ? `Tied with ${top.mostPlayed.tiedWith} other ${top.mostPlayed.tiedWith === 1 ? "pairing" : "pairings"}` : "")}
      ${highlight("Most one-sided", top.lopsided,
        `${lopsided || ""} won ${Math.max(top.lopsided?.firstWins || 0, top.lopsided?.secondWins || 0)} of ${top.lopsided?.meetings || 0}`,
        `Minimum 3 recorded meetings${top.lopsided?.tiedWith ? ` · tied with ${top.lopsided.tiedWith} other ${top.lopsided.tiedWith === 1 ? "pairing" : "pairings"}` : ""}`)}
      ${highlight("Most playoff meetings", top.playoff, `${top.playoff?.playoffGames || 0} playoff games`)}
    </dl>
  </section>`;
}
