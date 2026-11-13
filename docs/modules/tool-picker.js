import { escapeHtml } from './html.js';
import { readLastLeague } from './last-league.js';

export function renderToolPicker(host) {
  if (!host) return;
  const last = readLastLeague();
  const leagueHref = last ? `/l/${last.leagueId}` : '/leagues';
  host.innerHTML = `<div class="tool-picker"><h1>Dynasty Ticker</h1><h2>Which tool to use?</h2><div id="home-resume" class="home-resume">${last ? `<a href="${leagueHref}">Back to ${escapeHtml(last.leagueName || 'your league')}</a>` : ''}</div><div class="tool-picker-cards"><a href="/trade"><strong>Trade Calc</strong><span>Is this trade fair?</span></a><a href="/players"><strong>Player Rankings</strong><span>Every player, ranked</span></a><a href="${leagueHref}"><strong>League History</strong><span>Your Sleeper league's story</span></a></div><p class="tool-picker-note">All info on this page is optimized for 12 team SF PPR Dynasty.</p></div>`;
}

export function moveLeagueControls(host) {
  if (!host || host.dataset.controlsMounted) return;
  host.dataset.controlsMounted = '1';
  host.innerHTML = `<p class="muted">Connect Sleeper to explore your league's story. Your trade draft stays saved.</p><div id="league-entry-controls"></div>`;
  const controls = host.querySelector('#league-entry-controls');
  const source = document.querySelector('#username-search-form')?.closest('.league-module');
  if (source) controls.append(source);
  ['identity-section', 'disconnect-btn'].forEach(id => {
    const node = document.getElementById(id);
    if (node) controls.append(node);
  });
  try { const saved = localStorage.getItem('dt:sleeper-username'); const input = document.getElementById('sleeper-username'); if (saved && input && !input.value) input.value = saved; } catch {}
  const label = document.querySelector('label[for="sleeper-username"]');
  if (label) label.textContent = 'Enter your Sleeper username:';
  const button = document.getElementById('find-leagues-btn');
  if (button) { button.dataset.idleLabel = 'Find my leagues'; if (button.dataset.bootLoading !== '1') button.textContent = 'Find my leagues'; }
  const summary = document.querySelector('#league-id-fallback summary');
  if (summary) summary.textContent = 'Paste a league ID instead';
  const last = readLastLeague();
  if (last) controls.insertAdjacentHTML('afterbegin', `<p><a href="/l/${last.leagueId}">Recent: ${escapeHtml(last.leagueName || 'your league')}</a></p>`);
}
