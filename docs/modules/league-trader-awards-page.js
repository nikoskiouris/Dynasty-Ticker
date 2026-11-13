import { escapeHtml, formatNumber } from "./html.js";
import { traderAwards } from "./league-trader-awards.js";

const e = (value) => escapeHtml(String(value ?? ""));
const number = (value) => Number.isFinite(Number(value)) ? formatNumber(Math.round(Number(value))) : "—";

function namedSide(row) {
  if (!row) return '<p class="muted">Not enough fully priced trades to name a leader.</p>';
  return `<strong>${e(row.name)}</strong> · net ${number(row.totalNet)} ·
    ${row.wins} positive of ${row.tradeCount} graded trades
    (${row.winRate.toFixed(0)}% positive-value share)`;
}

export function renderTraderAwards(archive, { values = {}, valueNames = {} } = {}) {
  const awards = traderAwards(archive, { values, valueNames });
  const rows = awards.standings.map((row) => `<tr>
    <th scope="row">${e(row.name)}</th>
    <td>${row.tradeCount}</td>
    <td>${row.eligible ? number(row.totalNet) : "Not enough trades"}</td>
    <td>${row.eligible ? `${row.winRate.toFixed(0)}%` : "—"}</td>
  </tr>`).join("");
  const single = (item) => item
    ? `${e(item.managerName)} · ${e(item.season)} · ${e(item.grade)} · net ${number(item.net)}`
    : "Not enough fully priced historical trades";
  return `<section class="workspace-panel">
    <h2>Trade awards · hindsight only</h2>
    <p class="muted small">${e(awards.basis)}; each net is the value received minus value sent, including the same package credit as Trade Calc. The trader leader is ranked by cumulative net, with win rate as a tie-breaker. Minimum ${awards.minTrades} fully priced trades per manager. This is not proof of trading skill.</p>
    <dl class="league-history-records">
      <div><dt>Highest cumulative net</dt><dd>${namedSide(awards.best)}</dd></div>
      <div><dt>Lowest cumulative net</dt><dd>${namedSide(awards.worst)}</dd></div>
      <div><dt>Best single value gain</dt><dd>${single(awards.bestSingle)}</dd></div>
      <div><dt>Worst single value loss</dt><dd>${single(awards.worstSingle)}</dd></div>
    </dl>
    ${rows ? `<div class="league-history-scroll" role="region" aria-label="Trader hindsight rankings" tabindex="0">
      <table class="league-history-table"><thead><tr><th scope="col">Manager</th>
        <th scope="col">Graded trades</th><th scope="col">Net value</th><th scope="col">Positive net share</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<p class="muted">No historical trades could be graded yet.</p>'}
    <p class="muted small">${awards.tradesGraded} trades graded · ${awards.tradesSkipped} excluded because a complete price was unavailable. Missing prices are never treated as zero.</p>
  </section>`;
}
