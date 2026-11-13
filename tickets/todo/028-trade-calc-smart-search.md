# 028 · Trade Calc: one "smart search bar" at the top

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 2 puts a single **smart search bar** at the top center of Trade Calc. Today there are two ways to add assets: a search box per pane (`calc-search.js`, `renderCalcSearchInput()`) and a plain-words trade box ("Gibbs and a 1st for Nabers", `trade-talk.js` `parseTradeTalk()` / `applyTradeTalk()`, rendered by `renderTradeTalk()` and on the landing `#landing-talk-form`). The smart bar should merge them.

## Scope

- One search input centered at the top of Trade Calc (placeholder e.g. "Add a player or pick, or type a trade: Gibbs and a 1st for Nabers").
- As you type a name: a combobox of players/picks (reuse `listValueCalcAssets()`, `valueCalcAssetMatchesQuery()`, `handleCalcComboboxKey()`), each with face and value, and two add targets per row: "→ Team 1" and "→ Team 2" (keyboard: Enter adds to Team 1, Shift+Enter to Team 2, or arrow + choose).
- If the text reads like a whole trade ("X and a 1st for Y", "I got offered …"), Enter runs `parseTradeTalk()` / `applyTradeTalk()` and fills both columns, showing the existing reply line (`tradeTalkReply()`).
- Smart extras (only if cheap): typo/nickname tolerance via `PLAYER_ALIASES`/`normalizePlayerName()`, pick phrases via `parsePickPhrase()` ("2027 early 1st").
- Remove the per-column search inputs once this ships (keep a small "+ Add" per column that focuses the bar with that column preselected).

- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Show no 1QB, league-size, TE-premium or other format toggle, and add no alternate value mode.

## Out of scope

- AI/LLM parsing (future work, not now). Advice (ticket 030).

## Acceptance criteria (manual QA)

- Typing "jef" shows Justin Jefferson with face and value; choosing "→ Team 2" adds him to Team 2 Receives.
- Typing "Gibbs and a 1st for Nabers" + Enter fills both columns correctly and says what it did.
- Typing "2027 early 1st" offers the pick.
- Keyboard only: focus bar, type, arrow, Enter, Shift+Enter all work; screen reader announces the option count.
- Phone: the suggestion list is not hidden behind the keyboard; tapping a suggestion does not dismiss without adding (existing `armCalcClickSwallow` behaviour).
- Trade draft survives page changes and reloads.

## Dependencies

- 027 (columns to add into).

## Technical notes

- Files: `docs/modules/calc-search.js`, `docs/modules/trade-talk.js`, `docs/modules/value-calc.js`, `docs/app.js` (`renderTradeTalk`, `runTradeTalk`, `handleTradeTalkSubmit`, `addTalkChip`, `pickDraftSuggestion`, `calcSearchList`, `revealCalcSuggestions`, `handleCalcSearchFocus`, `handleWorkspaceInput`, `handleWorkspaceKeydown`), `docs/styles.css`.
- Data: player directory `docs/data/nfl_players_slim.json` + Sleeper `/players/nfl` cache (`loadPlayersWithCache()`), values `docs/data/player_values.json`.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
