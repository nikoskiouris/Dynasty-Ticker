import { escapeHtml } from './html.js';
import { readLastLeague } from './last-league.js';

// "Recent: <league>" above the username box. Redrawn from the saved record
// every time the page opens, so "Forget this league" (or opening another
// league) never leaves a stale link behind.
export function renderLeagueRecent(root = document) {
  const controls = root?.querySelector?.('#league-entry-controls');
  if (!controls) return;
  controls.querySelector('.league-recent')?.remove();
  const last = readLastLeague();
  if (last) controls.insertAdjacentHTML('afterbegin', `<p class="league-recent"><a href="/l/${encodeURIComponent(last.leagueId)}">Return to ${escapeHtml(last.leagueName || 'your league')}</a> <button type="button" class="link-btn" data-action="forget-last-league">Forget this league</button></p>`);
}

export function moveLeagueControls(host) {
  if (host?.dataset.controlsMounted) { renderLeagueRecent(host); return; }
  if (!host) return;
  host.dataset.controlsMounted = '1';
  host.innerHTML = `<p class="muted">Find standings, rosters and past trades from your Sleeper league.</p><div id="league-entry-controls"></div>`;
  const controls = host.querySelector('#league-entry-controls');
  const source = document.querySelector('#username-search-form')?.closest('.league-module');
  if (source) controls.append(source);
  ['identity-section', 'disconnect-btn'].forEach(id => {
    const node = document.getElementById(id);
    if (node) controls.append(node);
  });
  try { const saved = localStorage.getItem('dt:sleeper-username'); const input = document.getElementById('sleeper-username'); if (saved && input && !input.value) input.value = saved; } catch {}
  const label = document.querySelector('label[for="sleeper-username"]');
  if (label) label.textContent = 'Sleeper username';
  const button = document.getElementById('find-leagues-btn');
  if (button) { button.dataset.idleLabel = 'Find my leagues'; if (button.dataset.bootLoading !== '1') button.textContent = 'Find my leagues'; }
  const summary = document.querySelector('#league-id-fallback summary');
  if (summary) summary.textContent = 'Use a league ID or link';
  renderLeagueRecent(host);
}
