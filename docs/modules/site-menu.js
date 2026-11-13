import { readLastLeague } from './last-league.js';

// A history-backed modal: Back closes the menu without leaving the page.
export function mountSiteMenu({ navigate, document: doc = document, window: win = window } = {}) {
  const button = doc.createElement('button');
  button.id = 'site-menu-toggle';
  button.className = 'site-menu-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open menu');
  button.setAttribute('aria-controls', 'site-menu');
  button.setAttribute('aria-expanded', 'false');
  button.textContent = '☰';
  const backdrop = doc.createElement('div');
  backdrop.className = 'site-menu-backdrop';
  backdrop.hidden = true;
  const drawer = doc.createElement('section');
  drawer.id = 'site-menu';
  drawer.className = 'site-menu';
  drawer.hidden = true;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Site menu');
  drawer.innerHTML = `<div class="site-menu-head"><a href="/">Dynasty Ticker</a><button type="button" aria-label="Close menu">×</button></div><nav aria-label="Tools"><a href="/trade">Trade Calc</a><a href="/players">Player Rankings</a><a href="/leagues" data-menu-leagues>League History</a></nav>`;
  doc.body.append(button, backdrop, drawer);
  let open = false;
  let afterClose = null;
  let oldOverflow = '';
  let inerted = [];
  const hide = () => {
    open = false;
    drawer.hidden = backdrop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    doc.body.style.overflow = oldOverflow;
    inerted.forEach(([node, value]) => { node.inert = value; });
    inerted = [];
    button.focus({ preventScroll: true });
    const next = afterClose;
    afterClose = null;
    next?.();
  };
  const close = (next) => {
    if (!open) return;
    afterClose = next || null;
    if (win.history.state?.siteMenu) win.history.back();
    else hide();
  };
  const show = () => {
    const last = readLastLeague();
    drawer.querySelector('[data-menu-leagues]').href = last ? `/l/${last.leagueId}` : '/leagues';
    drawer.querySelectorAll('a').forEach(link => {
      const path = new URL(link.href).pathname;
      const current = path === '/' ? win.location.pathname === '/' : path.startsWith('/l/') || path === '/leagues'
        ? /^\/(leagues|l\/)/.test(win.location.pathname) : win.location.pathname.startsWith(path === '/players' ? '/player' : path);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    open = true;
    oldOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    inerted = [...doc.body.children].filter(node => ![button, backdrop, drawer].includes(node)).map(node => [node, node.inert]);
    inerted.forEach(([node]) => { node.inert = true; });
    drawer.hidden = backdrop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    win.history.pushState({ ...win.history.state, siteMenu: true }, '', win.location.href);
    drawer.querySelector('a').focus();
  };
  button.addEventListener('click', () => open ? close() : show());
  backdrop.addEventListener('click', () => close());
  drawer.querySelector('button').addEventListener('click', () => close());
  drawer.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = link.getAttribute('href');
    close(() => navigate ? navigate(href) : win.location.assign(href));
  });
  win.addEventListener('popstate', event => {
    if (!open) return;
    event.stopImmediatePropagation();
    hide();
  }, true);
  doc.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...drawer.querySelectorAll('a,button')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
  let touchX = 0;
  drawer.addEventListener('touchstart', event => { touchX = event.changedTouches[0]?.clientX || 0; }, { passive: true });
  drawer.addEventListener('touchend', event => { if (touchX - (event.changedTouches[0]?.clientX || 0) > 60) close(); }, { passive: true });
  return { close, show };
}
