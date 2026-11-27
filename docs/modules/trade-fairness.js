import { escapeHtml } from "./html.js";
import { verdictLineNamed } from "./verdict-copy.js";

export function renderTradeFairness(verdict, { ready = true, team1 = "Team 1", team2 = "Team 2", prefix = "" } = {}) {
  const sentence = ready
    ? verdictLineNamed(verdict, { Get: `${team1} receives`, Give: `${team2} receives` })
    : "Add players or picks to both sides";
  return `<p class="trade-fairness-sentence">${escapeHtml(prefix ? `${prefix} · ${sentence}` : sentence)}</p>`;
}
