# 030 · Trade Calc: "New: Give real trade advice" button (existing logic, no AI)

**Status:** Open · **Priority:** P1 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 2 shows a top-right button labelled **"New: Give real trade advice"**. Niko did not draw what it opens.

**Owner decision (Nov 13, 2026):** build it from the app's **existing logic only, with no AI**. Niko plans to add AI later, which is future work and out of scope here.

Pressing the button gives plain-English advice on the trade on screen: how fair it is, what to add to make it fair, and (with a league connected) whether it helps my team.

Building blocks that stay after ticket 045:
- Even-up suggestions: `findEvenUpPick()`, `evenUpLine()`, `renderDraftMethod()` in `docs/app.js`; `evenUpCopy()`, `EVEN_UP_OFFER_ABOVE`, `EVEN_UP_CLOSES_AT` in `verdict-copy.js`.
- Price neighbours for counter-offers: `priceNeighbors()` in `trade-talk.js`.
- Team impact with a league: `buildDraftImpact()`, `buildTradeImpactAnalysis()`, `buildOptimalStartingLineup()`, `renderImpactAnalysis()`.

**Not used:** `trade-match.js` (Find a trade), `window-call.js` (contend/rebuild call), buy-sell and win-now are deleted by 045. Do not rebuild them inside this panel.

## Scope

- Top-right button "New: Give real trade advice" (with a "New" badge). It is disabled, with a hint, until both columns have at least one asset.
- It opens a panel from the right with up to three short sections:
  1. **Verdict in one line**, the same tier as the scale (ticket 029).
  2. **How to make it fair:** the smallest add (a pick or a player) that moves the trade to Even, using `findEvenUpPick()` / `priceNeighbors()`. One tap applies it to the trade.
  3. **For your team** (only with a league connected and "my team" chosen): starting-lineup impact from `buildDraftImpact()`, e.g. "Your starting lineup goes from 3rd to 2nd in the league." Positional depth before and after.
- Every line labels uncertainty (AGENTS.md "Label uncertainty"; a score is not a probability).
- Without a league, show sections 1–2 and a "Connect your league for team-specific advice" link to League History.
- **Value rule (owner, Nov 13, 2026):** one value system only: 12-team Superflex PPR dynasty (ticket 044). Advice never uses another format.

## Out of scope

- **AI / LLM advice:** future work (owner, Nov 13). No model calls, no paid APIs.
- "Why the other manager says yes" and partner matching. That logic (trade-match) is deleted by 045 and may come back later.
- Auto-sending offers to Sleeper. Changing player prices.

## Acceptance criteria (manual QA)

- With an empty side, the button is disabled and says why.
- For a lopsided trade, the advice names a concrete add (e.g. "Add a 2027 mid 2nd to Team 2 to make it Even"), and applying it moves the scale to Even or Close.
- With the sample league connected and my team chosen, the "For your team" section appears and its lineup rank matches the My Team page.
- The advice never contradicts the scale's verdict.
- The panel closes with Esc, ✕ or Back. The trade is unchanged unless a suggestion was applied.
- Usable at 390, 820 and 1280 px.

## Dependencies

- 027, 029, 044, 045 (so the panel is not built on code about to be deleted). The league part needs a connected league (033).

## Technical notes

- Files: `docs/app.js` (`findEvenUpPick`, `evenUpLine`, `renderDraftMethod`, `buildDraftImpact`, `buildTradeImpactAnalysis`, `renderDraftTeam`, `buildDraftOfferText`), `docs/modules/verdict-copy.js`, `docs/modules/trade-talk.js`, `docs/modules/package-value.js`. A new `docs/modules/trade-advice.js` is suggested.
- Leave a clear seam (one function like `buildTradeAdvice(view)`) so a later AI ticket can add a section without rewriting the panel.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**: smaller than first scoped, now that partner matching is out.

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
