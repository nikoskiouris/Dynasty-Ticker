import { escapeHtml } from "./html.js";
import { headToHeadHistory, rivalryHighlights } from "./league-rivalries.js";

const e = (value) => escapeHtml(String(value ?? ""));

export function renderRivalries(archive) {
  const history = headToHeadHistory(archive);
  if (!history.pairs.length) return `<section class="workspace-panel"><h2>Head-to-head history</h2>
    <p class="muted">Completed head-to-head matchups are not available from Sleeper for these seasons.</p></section>`;
  const byPair = history.pairByKey;
  const managers = history.managers.filter((manager) =>
    history.pairs.some((pair) => pair.first === manager.key || pair.second === manager.key));
  const cells = managers.map((row) => `<tr><th scope="row">${e(row.name)}</th>${managers.map((col) => {
    if (row.key === col.key) return '<td aria-label="Same manager">—</td>';
    const key = [row.key, col.key].sort().join("|");
    const pair = byPair.get(key);
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
  return `<section class="workspace-panel">
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
        "Minimum 3 recorded meetings")}
      ${highlight("Most playoff meetings", top.playoff, `${top.playoff?.playoffGames || 0} playoff games`)}
    </dl>
  </section>`;
}
