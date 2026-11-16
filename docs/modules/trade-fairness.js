import { escapeHtml } from "./html.js";
import { verdictCopy } from "./verdict-copy.js";

const STOPS = ["Lopsided", "Unfair", "Close", "Even", "Close", "Unfair", "Lopsided"];

// The scale is a view of the canonical credited-total verdict, never another metric.
export function tradeFairness(verdict, { ready = true, team1 = "Team 1", team2 = "Team 2" } = {}) {
  const copy = verdictCopy(verdict);
  const distance = { even: 0, edge: 1, favors: 2, lopsided: 3 }[copy.tier] ?? 0;
  const stop = 3 + (copy.side === "Get" ? -distance : copy.side === "Give" ? distance : 0);
  const winner = copy.side === "Get" ? team1 : team2;
  const sentence = !ready ? "Add players to both sides" : copy.tier === "even" ? "Even · within 5%" : `${copy.label} · ${winner} receives ${copy.more == null || copy.more > 900 ? "over 10× as much" : `${Math.round(copy.more)}% more`}`;
  return { stop, sentence, label: ready ? `${copy.label}, ${copy.side ? `favors ${winner}` : "balanced"}` : sentence };
}

export function renderTradeFairness(verdict, options = {}) {
  const scale = tradeFairness(verdict, options);
  return `<div class="trade-fairness${options.ready === false ? " is-empty" : ""}">
    <div class="trade-fairness-track" role="meter" aria-label="Trade fairness" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${scale.stop}" aria-valuetext="${escapeHtml(scale.label)}">
      <span class="trade-fairness-marker" style="left:${scale.stop / 6 * 100}%" aria-hidden="true"></span>
      ${STOPS.map((label, index) => `<span class="trade-fairness-stop${index === scale.stop ? " is-current" : ""}">${label}</span>`).join("")}
    </div>
    <p class="trade-fairness-sentence">${escapeHtml(scale.sentence)}</p>
  </div>`;
}
