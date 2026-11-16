# 027 · Trade Calc: "Team 1 Receives" / "Team 2 Receives" two-column layout

Done: 2026-11-14, [#291](https://github.com/nikoskiouris/Dynasty-Ticker/pull/291)

**Status:** Done · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 2 (Trade Calc page):

- ☰ at top-left, a **smart search bar** top-center (ticket 028), a top-right button **"New: Give real trade advice"** (ticket 030).
- Two side-by-side columns: **"Team 1 Receives"** and **"Team 2 Receives"**. Each row shows the **player face**, the asset name (**Asset 1, Asset 2, …**) and its **Value**.
- Below both columns, a horizontal **fairness scale** (ticket 029).

Today the calculator is two panes "You give" / "You get" built by `renderDraftPane(side, view)` with tokens from `renderDraftTokens()`, totals from `renderDraftTotal()`, the per-pane search from `calc-search.js`, and a verdict block from `renderDraftVerdict()`. State is `state.valueCalc` with sides `give` / `get` (`VALUE_CALC_SIDES` in `value-calc.js`).

## Scope

- Re-label and restyle the two panes as **Team 1 Receives** (left) and **Team 2 Receives** (right). Mapping: Team 1 receives = the `get` side, Team 2 receives = the `give` side, so shared links (`/t/:code`, `?give=&get=`) keep meaning the same trade.
- When a league is connected and a partner chosen, replace "Team 1"/"Team 2" with the two team names (`renderTeamIdentity()`, `renderDraftPartnerPicker()`).
- Each row: face (`renderPlayerFace()` in `player-face.js`; picks get the existing pick token), name (linking to the player page, `playerLinkHtml()`), position/age small text, and the **value** right-aligned (same number as Player Rankings – one price, `getAssetValue()`).
- Each column shows its total (credited total incl. the existing "fewer, better pieces" extra, `creditedTotalsLine()` in `verdict-copy.js`), with remove (✕) per row and a Clear/Swap control (`swapValueCalcSides`, `clearValueCalcSides`).
- **Share a trade stays** (owner decision, Nov 13): keep the Share button visible in the new layout (`shareDraftTrade()` / `draftShareCode()`). A shared link (`/t/:code`) opens with the same assets in the same Team 1 / Team 2 columns, and the share card names the sides the same way.
- Each column keeps an "Add player or pick" input until ticket 028 replaces it with the single smart search.
- Phone (390 px): columns stack (Team 1 then Team 2) or sit side by side with compact rows – choose the more readable one and show both in the PR video.

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode.

## Out of scope

- Fairness scale visuals (029), smart search (028), trade advice (030), crowd call poll (deleted by 045).

## Acceptance criteria (manual QA)

- `/trade` shows "Team 1 Receives" and "Team 2 Receives" with an empty-state hint in each.
- Adding Bijan Robinson to Team 1 and two 1sts to Team 2 shows faces, names, values and both totals; the values equal the ones on Player Rankings.
- Removing, swapping and clearing work; Undo/restore notice still works; no SF/1QB control is shown anywhere on the page (`setDraftReplaced` / `renderDraftNotice`).
- Press Share, open the copied link in a private window: same trade, same columns, same totals.
- An old link `/trade?give=<id>&get=<id>` and an existing `/t/<code>` open with the assets on the correct sides.
- Connecting a league mid-trade keeps the trade and swaps the headers to team names (AGENTS.md: never erase work).
- 390, 820, 1280 px: no sideways scroll, names never overlap values.

## Dependencies

- 024, 044 (single value set). Can be built before 025 lands.

## Technical notes

- Files: `docs/app.js` (`renderTradeDraft`, `paintTradeDraft`, `patchTradeDraft`, `renderDraftPane`, `renderDraftPaneTitle`, `renderDraftTokens`, `renderDraftTotal`, `renderDraftPartnerPicker`, `renderSelectedTokenLabel`, `buildDraftView`), `docs/modules/value-calc.js`, `docs/modules/player-face.js`, `docs/modules/verdict-copy.js`, `docs/ui/trades.html`, `docs/styles.css`.
- `docs/app.js` is a conflict hotspot (43 open PRs touch it as of Nov 9). Rebase often.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
