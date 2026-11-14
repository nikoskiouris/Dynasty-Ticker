import { escapeHtml } from './html.js';
import { ordinal } from './standings.js';

// What this league plays, in one chip: "14-team · 1QB · PPR · TE bonus".
// It describes the league only; every value still uses the one 12-team
// Superflex PPR dynasty set (ticket 044).
export function leagueFormat(league) {
  const slots = (league?.roster_positions || []).map(slot => String(slot).toUpperCase());
  const superflex = slots.includes('SUPER_FLEX') || slots.includes('OP') || slots.filter(slot => slot === 'QB').length >= 2;
  const scoring = league?.scoring_settings || {};
  const rec = Number(scoring.rec);
  const ppr = rec >= 1 ? 'PPR' : rec >= 0.5 ? 'Half PPR' : Number.isFinite(rec) ? 'Standard' : '';
  const teBonus = Number(scoring.bonus_rec_te) > 0;
  const teams = Number(league?.total_rosters) || 0;
  const type = Number(league?.settings?.type);
  const mode = type === 2 ? 'Dynasty' : type === 1 ? 'Keeper' : 'Redraft';
  const chip = [teams ? `${teams}-team` : '', superflex ? 'SF' : '1QB', ppr, teBonus ? 'TE bonus' : '', mode].filter(Boolean).join(' · ');
  const matches = teams === 12 && superflex && rec === 1 && !teBonus && type === 2;
  return { chip, matches };
}

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
function renderTeamPick({ myTeam, myRosterId, teams }) {
  if (!teams.length) return myTeam ? `<p>Viewing as ${escapeHtml(myTeam)}</p>` : '';
  const chosen = myTeam ? String(myRosterId) : '';
  const options = [...teams]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(team => `<option value="${escapeHtml(String(team.id))}"${String(team.id) === chosen ? ' selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
  return `<p class="league-hub-pick"><label for="hub-team-select">${myTeam ? 'Viewing as' : 'Which team is yours?'}</label> <select id="hub-team-select">${chosen ? '' : '<option value="" selected>Pick your team</option>'}${options}</select></p>`;
}

export function renderLeagueHub({ league, leagueId, seasons = [], myTeam = '', myRosterId = '', teams = [], model = null, transactions = [], tradesLoaded = false, loading = false, caveat = '' } = {}) {
  if (!league) return '<p role="status">Loading league…</p>';
  const id = encodeURIComponent(leagueId || league.league_id);
  const winner = recentChampion(seasons);
  const recent = transactions.filter(row => row.type === 'trade' && row.status === 'complete' && Number(row.status_updated || row.created) >= Date.now() - 30 * 86400000).length;
  const mine = myRosterId ? model?.teams?.get?.(String(myRosterId)) : null;
  const standingsTeaser = mine?.recordLabel && mine?.rank
    ? `You're ${mine.recordLabel}, ${ordinal(mine.rank)}${model?.finalThroughWeek ? ` through week ${model.finalThroughWeek}` : ''}`
    : model?.finalThroughWeek ? `Through week ${model.finalThroughWeek}` : 'Records, playoff odds and luck';
  const format = leagueFormat(league);
  const valuesLine = format.matches
    ? 'Values: 12-team Superflex PPR dynasty, the same format as this league.'
    : 'Values are built for 12-team Superflex PPR dynasty, not this league\'s format.';
  const links = [
    ['standings', 'Standings', standingsTeaser],
    ['team', 'My Team', myTeam || 'Pick your team above to see your roster'],
    ['trades', 'Recent Trades', tradesLoaded ? `${recent} completed trades in the last 30 days` : 'Browse completed league trades'],
    ['history', 'Historical Data', loading ? 'Loading seasons…' : `${seasons.length} seasons of records`],
  ];
  return `<header class="league-hub-header">${league.avatar ? `<img width="64" height="64" alt="" src="https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(league.avatar)}">` : ''}<h2>${escapeHtml(league.name || 'Your league')}</h2><p>${escapeHtml(league.season)} · <span class="league-format-chip">${escapeHtml(format.chip)}</span></p><p class="muted small">${escapeHtml(caveat || valuesLine)}</p><a href="/leagues">Change league</a></header>
  ${renderTeamPick({ myTeam, myRosterId, teams })}
  <h2>What to see?</h2><nav class="league-hub-grid" aria-label="League pages">${links.map(([path, label, teaser]) => `<a class="workspace-panel" href="/l/${id}/${path}"><h3>${label}</h3><p>${escapeHtml(teaser)}</p></a>`).join('')}</nav>
  <section class="workspace-panel league-winner" aria-label="Recent winner">${winner ? `${winner.avatar ? `<img width="48" height="48" alt="" src="https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(winner.avatar)}">` : ''}<h2>RECENT WINNER: ★ ${escapeHtml(winner.name)} ★</h2><p>${escapeHtml(winner.season)} champion</p>` : `<h2>${loading ? 'Loading recent winner…' : 'No champion yet'}</h2><p>${loading ? 'Checking completed seasons and playoff brackets.' : 'First season in progress, or Sleeper has not published a completed championship bracket.'}</p>`}</section>`;
}
