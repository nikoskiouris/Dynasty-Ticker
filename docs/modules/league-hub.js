import { escapeHtml } from './html.js';
import { leagueStories } from "./league-stories.js";
import { renderAlmanacMasthead, renderAlmanacStory } from "./almanac-edition.js";
import { ordinal } from './standings.js';

import { leagueFormat } from './league-format.js';
export { leagueFormat };

// A regular-season leader is not a champion. Only a completed title match counts.
export function recentChampion(seasons = []) {
  for (const entry of [...seasons].sort((a, b) => Number(b.season || b.league?.season) - Number(a.season || a.league?.season))) {
    if (entry.league?.status !== 'complete') continue;
    const final = (entry.winnersBracket || []).find(row => Number(row.p) === 1 && row.w != null);
    if (!final) continue;
    const roster = (entry.rosters || []).find(row => String(row.roster_id) === String(final.w));
    const user = (entry.users || []).find(row => String(row.user_id) === String(roster?.owner_id));
    return { season: entry.season || entry.league?.season, name: user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${final.w}`, avatar: user?.avatar || '' };
  }
  return null;
}

// No username, no pick yet: ask which team is theirs instead of naming "Roster ?".
export function renderTeamPick({ myTeam, myRosterId, teams, controlId = "hub-team-select" }) {
  if (!teams.length) return myTeam ? `<p>Viewing as ${escapeHtml(myTeam)}</p>` : '';
  const chosen = myTeam ? String(myRosterId) : '';
  const options = [...teams]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: "base" }))
    .map(team => `<option value="${escapeHtml(String(team.id))}"${String(team.id) === chosen ? ' selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
  return `<p class="league-hub-pick"><label for="${escapeHtml(controlId)}">Your team</label> <select id="${escapeHtml(controlId)}">${chosen ? '' : '<option value="" selected>Select team</option>'}${options}</select></p>`;
}

export function renderLeagueHub({ league, leagueId, seasons = [], myTeam = '', myRosterId = '', teams = [], model = null, transactions = [], tradesLoaded = false, loading = false, caveat = '', savedNote = '' } = {}) {
  if (!league) return '<p role="status">Loading league…</p>';
  const id = encodeURIComponent(leagueId || league.league_id);
  const format = leagueFormat(league);
  const story = leagueStories({ seasons })[0];
  const winner = recentChampion(seasons);
  const years = seasons
    .filter(row => !['pre_draft', 'drafting'].includes(row.league?.status))
    .map(row => Number(row.season ?? row.league?.season))
    .filter(year => Number.isInteger(year) && year > 0);
  const yearRange = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : years[0] || league.season;
  const recent = transactions.filter(row => row.type === 'trade' && row.status === 'complete' && Number(row.status_updated || row.created) >= Date.now() - 30 * 86400000).length;
  const mine = myRosterId ? model?.teams?.get?.(String(myRosterId)) : null;
  const standingsTeaser = mine?.recordLabel && mine?.rank && Number(model?.finalThroughWeek) > 0
    ? `${mine.recordLabel} · ${ordinal(mine.rank)} through week ${model.finalThroughWeek}`
    : model?.finalThroughWeek ? `Through week ${model.finalThroughWeek}` : 'Records and playoff odds';
  const historyHref = `/l/${id}/history`;
  const links = [
    ['standings', 'Standings', standingsTeaser],
    ['team', 'My Team', myTeam || 'Roster and position ranks'],
    ['trades', 'Recent Trades', tradesLoaded ? `${recent} ${recent === 1 ? 'trade' : 'trades'} in 30 days` : 'Deals around the league'],
  ];
  return `<div class="almanac-hub">
    <nav class="almanac-return" aria-label="League selection"><a href="/leagues">← Change league</a></nav>
    ${renderAlmanacMasthead({ leagueName: league.name || 'League', edition: yearRange || 'Current edition', subtitle: format.chip, avatar: league.avatar })}
    ${savedNote ? `<p class="league-saved-note" role="status">${escapeHtml(savedNote)}</p>` : ''}
    ${story ? renderAlmanacStory(story, { leagueName: league.name, leagueId: leagueId || league.league_id, lead: true })
      : `<p class="almanac-empty"${loading ? ' role="status"' : ''}>${loading ? 'Reading season results from Sleeper…' : 'The record book opens with the first results. Every new champion and hard-luck loss gets a chance to make the almanac.'}</p>`}
    <nav class="almanac-features" aria-label="Explore league history">
      <a href="${historyHref}"><strong>Open the record book</strong><span>Champions, bad beats and season records</span><i aria-hidden="true">→</i></a>
      <a href="${historyHref}#archive-rivalries"><strong>Settle a score</strong><span>Compare two managers head to head</span><i aria-hidden="true">→</i></a>
    </nav>
    <div class="almanac-club">
      <header><h2>Around the league</h2>${renderTeamPick({ myTeam, myRosterId, teams })}</header>
      <nav class="almanac-club-links" aria-label="League pages">
        ${links.map(([path, label, teaser]) => `<a href="/l/${id}/${path}"><strong>${label}</strong><span>${escapeHtml(teaser)}</span><i aria-hidden="true">↗</i></a>`).join('')}
      </nav>
      ${winner && !['champion', 'repeat-champion'].includes(story?.id) ? `<p class="almanac-champ"><strong>${escapeHtml(winner.season)} champion</strong> ${escapeHtml(winner.name)}</p>` : ''}
      <p class="league-format-note">${escapeHtml(caveat || 'Values use 12-team Superflex PPR dynasty scoring.')}</p>
    </div>
  </div>`;
}
