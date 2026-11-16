# 047 · /players: Rank and Age sort buttons break mid-word on phones

Done: 2026-11-16, PR link pending

**Status:** Done · **Priority:** P2 · **Size:** S · **Owner:** Cursor

## Context / owner decision

Niko, Nov 16, 2026, approved fixing the Player Rankings header on phones. At about 390 wide the Rank and Age sort buttons show as dark pills with the text split mid-word ("Ra/nk", "Ag/e"). Seen on the live site after release `prod-20261116-225206-7a0d59f`.

## Cause

In `docs/styles.css`, the tap-target rule `main details > summary::before { … }` was missing its closing `}`. Everything after it was parsed as nested inside that rule and never matched:
- `.rank-sort-btn` (`all: unset; white-space: nowrap`) from #349;
- the sticky-header `z-index` / `top: 64px` rules from #348.

The sort buttons fell back to the generic `button` style (pill, `padding: 0 12px`), which does not fit a 50px column.

## Fix

CSS only: close that rule. `.rank-sort-btn` now applies as written. The header buttons read as plain sortable header text on one line, with no mid-word breaks. The sticky header also clears the ☰ button on phones, as #348 intended. No JS, ranking, value, data or copy changes.

## Acceptance (observable)

- At 390 wide, the `/players` header shows "Rank ↓" and "Age" on one line, with no horizontal overflow.
- At 1280 wide, the header shows "Overall Rank ↓", "Age" and "Team" on one line.
- Tapping Age still sorts youngest first.
