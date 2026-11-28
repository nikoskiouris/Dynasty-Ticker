import { escapeHtml } from "./html.js";
import { displayMore, verdictCopy } from "./verdict-copy.js";

// The scale is a view of the canonical credited-total verdict, never another metric.
export function tradeFairness(verdict, { ready = true, team1 = "Team 1", team2 = "Team 2" } = {}) {
  const copy = verdictCopy(verdict);
  const distance = { even: 0, edge: 1, favors: 2, lopsided: 3 }[copy.tier] ?? 0;
  const stop = 3 + (copy.side === "Get" ? -distance : copy.side === "Give" ? distance : 0);
  const winner = copy.side === "Get" ? team1 : team2;
  const sentence = !ready ? "Add a player or pick to the other side to see the verdict." : copy.tier === "even" ? "Even · within 5%" : `${copy.label} · ${winner} receives ${copy.more == null || copy.more > 900 ? "over 10× as much" : `${displayMore(copy.more)}% more`}`;
  return { stop, sentence, label: ready ? `${copy.label}, ${copy.side ? `favors ${winner}` : "balanced"}` : sentence };
}

export function renderTradeFairness(verdict, options = {}) {
  const scale = tradeFairness(verdict, options);
  const [verdictLabel, explanation] = scale.sentence.split(" · ");
  return `<div class="trade-fairness${options.ready === false ? " is-empty" : ""}">
    <p class="trade-fairness-sentence">${explanation ? `<strong>${escapeHtml(verdictLabel)}</strong> · ${escapeHtml(explanation)}` : escapeHtml(verdictLabel)}</p>
  </div>`;
}

export function renderTradeScale(verdict, options = {}) {
  const scale = tradeFairness(verdict, options);
  const labels = ["Lopsided", "Unfair", "Close", "Even", "Close", "Unfair", "Lopsided"];
  const stop = (label, index) => {
    const team = index === 0 ? options.team1 || "Team 1" : index === 6 ? options.team2 || "Team 2" : "";
    return `<span class="trade-fairness-stop${index === scale.stop ? " is-current" : ""}" aria-hidden="true">
      <span class="trade-scale-tier">${label}</span>${team ? '<abbr class="trade-scale-short" title="Lopsided">Lop.</abbr>' : ""}${team ? `<small>${escapeHtml(team)}</small>` : ""}
    </span>`;
  };
  return `<div class="trade-fairness-track" role="meter" aria-label="Trade fairness" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${scale.stop}" aria-valuetext="${escapeHtml(scale.label)}">
    <span class="trade-fairness-marker" style="left:${scale.stop / 6 * 100}%" aria-hidden="true"></span>
    ${labels.map(stop).join("")}
  </div>`;
}
