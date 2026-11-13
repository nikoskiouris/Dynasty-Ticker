# 025 · Global slide-out menu (hamburger drawer) on every page

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 5: every page has a **menu icon (☰) at the top-left**. Clicking it slides a **drawer in from the left that overlays the current page** and lists three destinations:

- Trade Calc
- Player Rankings
- League History

It is the same menu on every page (sketches 2, 3, 6, 7 all show the icon). It replaces today's navigation: desktop tabs from `renderRoomNav()`, the phone section menu `#phone-desk` from `renderPhoneDesk()`, and the left "control rail" `#control-rail` that `setMobileRailOpen()` slides on phones.

## Scope

- A fixed top-left ☰ button on every page (Home included) that opens a left drawer over the page with a dimmed backdrop.
- Drawer lists Trade Calc (`/trade`), Player Rankings (`/players`), League History (`/leagues`, or `/l/:id` when a league is already remembered via `last-league.js`). A "Dynasty Ticker" wordmark at the top links Home (`/`).
- The current page is marked (`aria-current="page"`).
- Closes on: choosing an item, tapping the backdrop, pressing Esc, the ✕ button, or Back on phones (reuse the overlay-in-history pattern in `overlayPushed()` / `dismissRouteOverlay()` / `escapeRouteOverlay()`).
- Accessible: button has `aria-expanded`/`aria-controls`; focus moves into the drawer on open, is trapped while open, and returns to ☰ on close.
- Retire the old nav (tabs, `#phone-desk`, the rail's nav role) once the drawer ships. League connect controls that live in the rail (`#username-search-form`, `#league-picker`, `#me-select`, `#disconnect-btn`) move to League History (ticket 033) – leave them reachable until 033 lands.

## Out of scope

- Page content (other tickets). Account/settings items, search inside the drawer.

## Acceptance criteria (manual QA)

- On Home, Trade Calc, Player Rankings, a player page, League History and every league sub-page, ☰ is at the top-left and opens the same three-item drawer.
- The drawer overlays the page (page does not reflow or lose scroll position); the page behind cannot be scrolled while it is open.
- Each item opens its page; the drawer closes; Back returns to the previous page.
- With a half-built trade in the calculator, opening the menu, going to Player Rankings and coming back to Trade Calc shows the same trade (draft never erased).
- Keyboard: Tab reaches ☰, Enter opens, Tab cycles only inside the drawer, Esc closes and focus returns to ☰.
- Phone (390 px): drawer is at most ~85% of the width, swipe/tap backdrop closes it, Android/iOS Back closes the drawer instead of leaving the page.
- Works at 390, 820 and 1280 px with no sideways scroll.

## Dependencies

- 024 (page ids and routes).

## Technical notes

- Files: `docs/index.html` (`#mobile-chrome`, `#mobile-rail-toggle`, `#control-rail`, `#rail-backdrop`, `#phone-desk`), `docs/app.js` (`setMobileRailOpen`, `renderRoomNav`, `renderPhoneDesk`, `handlePhoneDeskClick`, `leavePhoneMenu`, `orderNavTabs`, `syncRoomUi`, `readDeskBoardShut`/`setDeskBoardShut`), `docs/modules/constants.js` (`NAV_TABS` → three menu items), `docs/modules/route-a11y.js`, `docs/modules/mobile-chrome-scroll.js`, `docs/styles.css`, `docs/tokens.css`.
- Consider a small `docs/modules/site-menu.js` that renders the drawer from a `MENU_ITEMS` list so pages don't each build it.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
