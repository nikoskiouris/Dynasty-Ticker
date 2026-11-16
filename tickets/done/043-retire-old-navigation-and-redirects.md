# 043 · Retire the three-tab desk: old nav, rail, redirects, clean-up

Done: 2026-11-13, [428f5d0](https://github.com/nikoskiouris/Dynasty-Ticker/commit/428f5d0e6544b6cf129992fffb7265e2556b11cc), [96401dc](https://github.com/nikoskiouris/Dynasty-Ticker/commit/96401dcf2786a4f2fb24c83956f993ac5529f3ab), [5b6dad0](https://github.com/nikoskiouris/Dynasty-Ticker/commit/5b6dad0b05df7c0aa44d688a60ec1e56d24048c7)

**Status:** Done · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

After the redesign, the old shell from ticket 020 / #195 is replaced: the tabs "Check a trade / Find a trade / My team", the phone section menu, and the left control rail. AGENTS.md says old links keep working.

**Feature deletion is ticket 045**, not this one. Find a trade, buy-low/sell-high, win-now, hot on Sleeper, crowd call and the rest are deleted there (owner decision, Nov 13, 2026). This ticket removes the leftover navigation shell and makes every old URL land somewhere sensible.

## Scope

- Redirect map (in `history-route.js` aliases, plus `docs/_redirects` where server-side). Old aliases in `PAGE_ALIASES` / `PLACE_ALIASES` go to the closest new page:
  - `players`, `player`, `value`, `ktc` → `/players`
  - `trade`, `trader`, `trades` → `/trade`
  - `history`, `hall`, `analytics`, `archive` → `/l/:id/history` (or `/leagues` with no league)
  - `week`, `matchups`, `now` → `/l/:id/standings`
  - `team`, `myteam`, `my-team`, `home` → `/l/:id/team`
  - `/t/:code` and `/trade?give=…&get=…` stay as they are. **Share a trade is kept** (owner decision, Nov 13). Do not redirect or remove them.
  - `?sample=1` → `/leagues` (if 045 hasn't done it).
  - `/connect` → `/leagues`; `/l/:id/ideas` → `/l/:id` (if 045 hasn't already done it).
- Remove dead code and CSS for the retired nav and rail: `renderRoomNav`, `renderPhoneDesk`, `handlePhoneDeskClick`, `leavePhoneMenu`, `orderNavTabs`, `#control-rail` / `#phone-desk` / `desk-board-*` markup and styles, `NAV_TABS`, unused rooms in `PAGE_ROOMS` / `ROOM_LABELS` / `ROOM_HINTS`, and `league-format.js` room helpers if 044 has not already removed them. Keep anything still used.
- Update `docs/sitemap.xml` and page `<title>`s.
- AGENTS.md "Product purpose" names the old areas ("Players", "Trade", "My League"). Propose the updated wording in the PR for Niko's approval.

## Out of scope

- Deleting features (045). The value-system collapse (044). New features.

## Acceptance criteria (manual QA)

- Every URL in the old route list and alias table opens a sensible new page. Walk the list in the PR, one line per URL.
- No leftover empty rail, tab bar or phone section menu at 390, 820 or 1280 px. No console errors.
- Bundle and CSS shrank: the PR notes before/after sizes of `docs/app.js` and `docs/styles.css`.
- Back/Forward never leaves the site after following an old link.
- An existing `/t/<code>` share link still opens the shared trade.

## Dependencies

- 024–042, 044 and 045. Do this last.

## Technical notes

- Files: `docs/modules/constants.js`, `docs/modules/history-route.js`, `docs/_redirects`, `netlify.toml`, `docs/app.js`, `docs/index.html`, `docs/ui/*.html`, `docs/styles.css`, `docs/sitemap.xml`.
- Tickets 020 and 021 were already marked `Superseded` in the ticket-set commit, so nothing to do there.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.

## Done notes (2026-11-13)

- Removed: the mobile header, control rail and backdrop, phone section menu, desk board, page tabs, site dock, `desk-shut.js`, `mobile-chrome-scroll.js`, `NAV_TABS`, `PHONE_LAYOUT_QUERY` and their handlers. League controls stay in a hidden holder that `/leagues` mounts.
- `legacyRedirect` (history-route.js) replaces `removedRoomRedirect`. `docs/_redirects` mirrors the `/l/:id/...` rows server-side.
- Sizes: `docs/app.js` 10,798 → 8,816 lines (438 KB → 347 KB), and `docs/styles.css` 8,654 → 6,437 lines (190 KB → 141 KB). These counts cover 043 and 045 together, from df93556.

Old URL walk (each checked in the browser, no console errors):

| Old URL | Lands on |
| --- | --- |
| `/?tab=players`, `/?view=ktc`, `/?tab=value` | `/players` |
| `/?tab=trade`, `/?tab=trades`, `/?tab=trader`, `/?view=find` | `/trade` (give/get kept) |
| `/?league=ID&tab=history`, `view=hall`, `tab=analytics`, `view=archive` | `/l/ID/history` |
| `/?tab=history` (no league) | `/leagues` |
| `/?league=ID&view=week`, `view=matchups`, `tab=now` | `/l/ID/standings` |
| `/?league=ID&tab=team`, `myteam`, `my-team`, `home` | `/l/ID/team` |
| `/connect` | `/leagues` |
| `/l/ID/ideas`, `/l/ID/league` | `/l/ID` |
| `/l/ID/week` | `/l/ID/standings` |
| `/l/ID/activity` | `/l/ID/trades` |
| `/?sample=1` / `/l/ID?sample=1` | `/leagues` / `/l/ID` |
| `/t/<code>`, `/trade?give=…&get=…` | unchanged |

Redirects use `replaceState`, so Back never steps through the old address. No rail, tab bar or phone menu is left at 390/820/1280 px. `sitemap.xml` already lists only `/`, `/trade`, `/players` and `/leagues`.

**For Niko (not edited):** AGENTS.md "Product purpose" still names the old areas. Proposed wording: *"Dynasty Ticker has three tools, reached from the ☰ menu: Trade Calc (is this trade fair?), Player Rankings (every player, ranked, with a player page), and League History (a Sleeper league's hub, standings, my team, recent trades and all-time records)."*

Demo: `/workspace/qa-045/video/043-old-links-and-menu-390.webm` on the bot's box.
