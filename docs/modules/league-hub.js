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
  return { chip };
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
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: "base" }))
    .map(team => `<option value="${escapeHtml(String(team.id))}"${String(team.id) === chosen ? ' selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
  return `<p class="league-hub-pick"><label for="hub-team-select">Your team</label> <select id="hub-team-select">${chosen ? '' : '<option value="" selected>Select team</option>'}${options}</select></p>`;
}

export function renderLeagueHub({ league, leagueId, seasons = [], myTeam = '', myRosterId = '', teams = [], model = null, transactions = [], tradesLoaded = false, loading = false, caveat = '', savedNote = '' } = {}) {
  if (!league) return '<p role="status">Loading league…</p>';
  const id = encodeURIComponent(leagueId || league.league_id);
  const winner = recentChampion(seasons);
  // A season that hasn't drafted (the offseason league) has no records yet,
  // so "N seasons of records" below doesn't count it.
  seasons = seasons.filter(row => !['pre_draft', 'drafting'].includes(String(row?.league?.status || '')));
  const recent = transactions.filter(row => row.type === 'trade' && row.status === 'complete' && Number(row.status_updated || row.created) >= Date.now() - 30 * 86400000).length;
  const mine = myRosterId ? model?.teams?.get?.(String(myRosterId)) : null;
  // "You're 0-0, 3rd" before any game is final ranks nothing.
  const standingsTeaser = mine?.recordLabel && mine?.rank && Number(model?.finalThroughWeek) > 0
    ? `${mine.recordLabel} · ${ordinal(mine.rank)}${model?.finalThroughWeek ? ` through week ${model.finalThroughWeek}` : ''}`
    : model?.finalThroughWeek ? `Through week ${model.finalThroughWeek}` : 'Record and playoff odds';
  const format = leagueFormat(league);
  // The 044 caveat (marketCaveat) when the league differs; otherwise the plain rule.
  const valuesLine = caveat || 'Values: 12-team Superflex PPR dynasty.';
  const links = [
    ['standings', 'Standings', standingsTeaser],
    ['team', 'My Team', myTeam || ''],
    ['trades', 'Recent Trades', tradesLoaded ? `${recent} ${Number(recent) === 1 ? 'trade' : 'trades'} in 30 days` : ''],
    ['history', 'Historical Data', loading ? 'Loading seasons…' : `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"}`],
  ];
  return `<header class="league-hub-header">
    ${league.avatar ? `<img width="40" height="40" alt="" src="https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(league.avatar)}">` : ''}
    <div><p>${escapeHtml(league.season)} · ${escapeHtml(format.chip)}</p></div>
    <a href="/leagues">Change league</a>
  </header>
  <p class="league-format-note">${escapeHtml(valuesLine)}</p>
  ${savedNote ? `<p class="league-saved-note" role="status">${escapeHtml(savedNote)}</p>` : ''}
  ${renderTeamPick({ myTeam, myRosterId, teams })}
  <nav class="league-hub-grid" aria-label="League pages">
    ${links.map(([path, label, teaser]) => `<a href="/l/${id}/${path}">
      <strong>${label}</strong><span>${escapeHtml(teaser)}</span><i aria-hidden="true">→</i></a>`).join('')}
  </nav>
  <section class="league-winner" aria-label="Recent champion">
    ${winner ? `${winner.avatar ? `<img width="36" height="36" alt="" src="https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(winner.avatar)}">` : ''}
      <div><h3>${escapeHtml(winner.season)} champion</h3><p>${escapeHtml(winner.name)}</p></div>`
      : `<p>${loading ? 'Loading champion…' : 'No confirmed champion in the available Sleeper brackets.'}</p>`}
  </section>`;
}
