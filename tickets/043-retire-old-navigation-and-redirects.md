# 043 · Retire the three-tab desk: redirects, Find a trade's new home, clean-up

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

After the redesign, the old surfaces from ticket 020 / #195 (tabs "Check a trade / Find a trade / My team", the left control rail, the launch landing extras) are replaced. AGENTS.md: "Keep capabilities, give each a clear home… Explain any removal in the PR. Old links keep working."

The sketches do not show **Find a trade** (1-for-1 / 2-for-1 ideas, `renderTradeMatchRoom()`, `generateTradeMatches()`, `trade-match.js`, `/l/:id/ideas`), **buy-low/sell-high** (`renderBuySell()`, `buy-sell.js`), **win-now targets** (`renderWinNowTargets()`), the **crowd call** poll (`trade-poll.js`), or the landing's **example trade / hot on Sleeper** rows.

## Scope

- Decide (with Niko – ask in the PR description) and implement a home for each orphaned capability. Default proposal:
  - Find a trade, buy-low/sell-high, win-now targets → inside "Give real trade advice" (030) when a league is connected, plus a "Trade ideas" card on My Team (037).
  - Crowd call → stays under the Trade Calc verdict.
  - Hot on Sleeper → a small strip on Player Rankings.
- Redirect map (in `history-route.js` aliases and `docs/_redirects` where server-side): `/l/:id/ideas` → advice panel or My Team ideas card; `/connect` → `/leagues`; old aliases in `PAGE_ALIASES` / `PLACE_ALIASES` (players, trader, history, hall, analytics, archive, week, matchups…) → closest new page (e.g. `history|hall|archive` → `/l/:id/history`, `week|matchups` → `/l/:id/standings`).
- Remove dead code and CSS for the retired nav/rail (`renderRoomNav`, `renderPhoneDesk`, `#control-rail` styles, `NAV_TABS`, unused rooms), keeping anything still used.
- Update `docs/sitemap.xml`, page `<title>`s, `AGENTS.md` "Product purpose" nav wording if it names old tabs (owner approval needed for AGENTS.md product text – propose the diff in the PR).
- Add a `Superseded` note to tickets 020 and 021 pointing to this redesign set (AGENTS.md ticket rules).

## Out of scope

- New features.

## Acceptance criteria (manual QA)

- Every URL in the old route list and alias table opens a sensible new page (walk the list in the PR, one line per URL).
- Each orphaned capability above is reachable in ≤2 taps from a menu page, or its removal is explicitly approved by Niko in the PR.
- No console errors; no leftover empty rail or tab bar at 390/820/1280 px.
- Bundle/CSS shrank (note before/after sizes of `docs/app.js` and `docs/styles.css`).

## Dependencies

- 024–042 (do this last).

## Technical notes

- Files: `docs/modules/constants.js`, `docs/modules/history-route.js`, `docs/_redirects`, `netlify.toml`, `docs/app.js`, `docs/index.html`, `docs/ui/*.html`, `docs/styles.css`, `docs/sitemap.xml`, `tickets/020-three-tabs.txt`, `tickets/021-navigation-decision-tree.txt`.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**
