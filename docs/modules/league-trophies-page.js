import { escapeHtml } from "./html.js";
import { managerTrophyCases } from "./league-trophies.js";

const e = (value) => escapeHtml(String(value ?? ""));
const seasonLabel = (result) => result
  ? `${result.season} · ${result.wins}–${result.losses}${result.ties ? `–${result.ties}` : ""} · regular-season finish #${result.finish ?? "?"}`
  : "Not enough completed games";

const fullName = (raw) => String(raw?.full_name || [raw?.first_name, raw?.last_name].filter(Boolean).join(" ")).trim();

export function renderTrophyCases(archive, { valueNames = {}, players = {} } = {}) {
  const profiles = managerTrophyCases(archive);
  if (!profiles.length) return "";
  const items = profiles.map((profile) => {
    const player = profile.mostFrequentRosterPlayer;
    const playerName = player && (valueNames[`player:${player.playerId}`] || fullName(players[player.playerId]) || `Player ${player.playerId}`);
    return `<details class="league-trophy-card">
      <summary><strong>${e(profile.name)}</strong> · ${profile.titles} championship${profile.titles === 1 ? "" : "s"}</summary>
      <dl>
        <div><dt>Best regular season</dt><dd>${e(seasonLabel(profile.bestSeason))}</dd></div>
        <div><dt>Worst regular season</dt><dd>${e(seasonLabel(profile.worstSeason))}</dd></div>
        ${profile.favoriteTradePartner ? `<div><dt>Most frequent trade partner</dt>
          <dd>${e(profile.favoriteTradePartner.managerName)} · ${profile.favoriteTradePartner.trades} completed ${Number(profile.favoriteTradePartner.trades) === 1 ? "trade" : "trades"}</dd></div>` : ""}
        ${player ? `<div><dt>Most recurring season-end roster player</dt>
          <dd>${e(playerName)} · ${player.seasonAppearances} season${player.seasonAppearances === 1 ? "" : "s"}</dd></div>` : ""}
      </dl>
    </details>`;
  }).join("");
  return `<section class="workspace-panel"><h2>Manager trophy cases</h2>
    <div class="league-trophy-list">${items}</div>
  </section>`;
}
