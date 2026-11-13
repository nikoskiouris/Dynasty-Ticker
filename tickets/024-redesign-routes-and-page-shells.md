# 024 · Redesign foundation: new page map, routes, and empty page shells

**Status:** Open · **Priority:** P0 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)
**Source:** Niko's 11 hand sketches, Nov 13, 2026 (UI redesign set, tickets 024–043)

## Context / sketch description

Niko's sketches replace today's three-tab desk ("Check a trade", "Find a trade", "My team", see ticket 020 / #195) with a tool-picker site of four destinations, all reached from one global menu (ticket 025):

1. **Home** – "Which tool to use?" (ticket 026)
2. **Trade Calc** – the trade calculator (tickets 027–030)
3. **Player Rankings** – a table of every player, plus a full-screen **Player detail** page (tickets 031–032)
4. **League History** – Sleeper username → pick a league → league hub with four sub-pages: **Standings**, **My Team**, **Recent Trades**, **Historical Data** (tickets 033–042)

This ticket lays the plumbing only: the page ids, the URL map, and an empty shell for each page so the feature tickets can be built in parallel without fighting over `docs/app.js`.

## Scope

- Define the new page ids and routes. Proposed URL map (keep it unless there is a strong reason; record any change in the PR):

  | Page | URL | Notes |
  | --- | --- | --- |
  | Home | `/` | Was the calculator (`HOME_PLACE` in `history-route.js`). |
  | Trade Calc | `/trade` (+ existing `/t/:shareCode`, `?give=&get=&league=`) | Existing calculator; must keep share links working. |
  | Player Rankings | `/players` | Today `/players` opens the board under Check a trade. |
  | Player detail | `/player/:sleeperId/:slug?` | Existing route; becomes full-screen (ticket 032). |
  | League History (pick league) | `/leagues` | New. Username + league picker (ticket 033). `/connect` should land here. |
  | League hub | `/l/:leagueId` | Today opens My team; becomes the hub (ticket 035). |
  | Standings | `/l/:leagueId/standings` | New. |
  | My Team | `/l/:leagueId/team` | Existing route, new page (ticket 037). |
  | Recent Trades | `/l/:leagueId/trades` | New. |
  | Historical Data | `/l/:leagueId/history` | New. |

- Update `docs/modules/constants.js` (`PAGE_IDS`, `DEFAULT_PAGE`, `NAV_TABS`, `PAGE_LABELS`, `PAGE_ROOMS`, `ROOM_LABELS`, `PAGE_ALIASES`, `PLACE_ALIASES`) and `docs/modules/history-route.js` (`ROUTES`, `HOME_PLACE`, `LEAGUE_ROOM_SEGMENT`, `parse…`/`urlPath` helpers) so every URL above parses to a page and back.
- Add an empty, titled section per page (in `docs/index.html` or a new `docs/ui/*.html` partial loaded the same way as `docs/ui/landing.html`, `league.html`, `trades.html`) with a visible `<h1>` and a "Coming soon" placeholder where the feature ticket will paint.
- Wire `setActivePage` / `openRoom` / `renderActivePage` / `bootFromUrl` / `applyDeskPopState` in `docs/app.js` so each page can be opened, reloaded, and reached by Back/Forward.
- `route-a11y.js`: each page announces its heading and moves focus to it on navigation (same pattern as today's rooms).
- Every old link keeps working (AGENTS.md "Old links keep working"): `/`, `/players`, `/trade`, `/connect`, `/l/:id`, `/l/:id/team`, `/l/:id/ideas`, `/player/:id`, `/t/:code`, and the aliases in `PAGE_ALIASES`/`PLACE_ALIASES` all land on the closest new page. Final redirect clean-up is ticket 043.

## Out of scope

- Visual design of any page (feature tickets).
- The global menu itself (ticket 025). Until 025 lands, temporarily keep the existing nav so the site stays usable.
- Removing Find a trade or other old surfaces (ticket 043).

## Acceptance criteria (manual QA)

- Typing each URL in the table into the address bar opens the right page with its heading; reloading stays on it.
- Moving between pages with links, then pressing Back and Forward, walks the same pages in order and never leaves the site.
- `/t/<code>` from an existing share still opens the shared trade in the calculator; `/trade?give=…&get=…` still prefills the trade.
- `/l/<sample league id>` opens the league hub shell; `/l/<id>/team` opens the My Team shell.
- A screen reader (VoiceOver or NVDA) announces each page title on navigation.
- No console errors on any page at 390, 820 and 1280 px wide.

## Dependencies

None. Every other ticket in this set depends on this one.

## Technical notes

- Files: `docs/modules/constants.js`, `docs/modules/history-route.js`, `docs/modules/desk-history.js`, `docs/modules/route-a11y.js`, `docs/app.js` (`setActivePage`, `openRoom`, `renderActivePage`, `bootFromUrl`, `applyDeskPopState`, `applyDeskPlaceFromHistory`, `updateUrlStateInner`, `goSiteHome`), `docs/index.html`, `docs/ui/*.html`, `docs/_redirects`, `netlify.toml` (SPA fallbacks for the new paths), `docs/sitemap.xml`.
- `docs/app.js` is ~10.5k lines and touched by most open PRs. Prefer putting each new page's renderer in its own module under `docs/modules/` (e.g. `home-page.js`, `rankings-page.js`, `league-hub.js`) and keep app.js changes to wiring.
- Product rules that still apply (AGENTS.md): one price for every player on every screen; never erase the trade draft (`state.valueCalc`) when changing pages or connecting a league.
- Repo policy: **no unit tests or automated test suites** (AGENTS.md, `.cursor/rules/no-unit-tests.mdc`). Verify by hand with `npm run serve` at phone, iPad and desktop widths and record a demo video per AGENTS.md "Shipping a change".

## Size estimate

**L** – touches routing, history, a11y and boot in the busiest file.
