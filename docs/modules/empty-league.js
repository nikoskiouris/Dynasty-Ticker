import { escapeHtml } from "./html.js";

// No league yet. Offer the real connect path, and a way to try values without one.
// A fake demo league would show standings that are not the visitor's.
export function renderLeagueConnectEmpty(copy) {
  return `
    <div class="league-empty">
      <p class="muted">${escapeHtml(copy)}</p>
      <div class="calc-actions">
        <button type="button" data-action="draft-connect">Connect Sleeper</button>
        <button type="button" class="ghost-btn" data-action="go" data-page="players" data-room="ranks">Look up a player</button>
      </div>
    </div>
  `;
}
