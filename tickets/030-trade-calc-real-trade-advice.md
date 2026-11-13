# 030 · Trade Calc: "New: Give real trade advice" button

**Status:** Open · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 2 shows a top-right button labelled **"New: Give real trade advice"**. Niko did not draw what it opens. Interpretation for this ticket (confirm with Niko in the PR if different): pressing it gives plain-English advice on the trade on screen – should I do it, what to ask for to make it fair, and (with a league connected) whether it helps my team.

Building blocks already exist:
- Even-up suggestions: `findEvenUpPick()`, `evenUpLine()`, `renderDraftMethod()` in `docs/app.js`; `evenUpCopy()`, `EVEN_UP_OFFER_ABOVE`, `EVEN_UP_CLOSES_AT` in `verdict-copy.js`.
- Price neighbours for counter-offers: `priceNeighbors()` in `trade-talk.js`.
- Team fit with a league: `buildDraftImpact()`, `buildTradeImpactAnalysis()`, `buildTradePowerUpgrade()`, `renderImpactAnalysis()`, contend/rebuild window `window-call.js` (`analyzeWindowCall`).
- Partner fit / why they say yes: `trade-match.js`, `enrichTradeIdea()`.
- Before #195 there was also a "Find a trade" ideas room (still at `/l/:id/ideas`, `renderTradeMatchRoom()`).

## Scope

- Top-right button "New: Give real trade advice" (badge "New"), disabled with a hint until both columns have at least one asset.
- Opens a panel/drawer from the right with up to four short sections:
  1. **Verdict in one line** (same tier as the scale, ticket 029).
  2. **How to make it fair** – the smallest add (a pick or a player) that moves it to Even, using `findEvenUpPick()` / `priceNeighbors()`; one tap applies it to the trade.
  3. **For your team** (only with a league + "my team" chosen) – starter impact and window fit from `buildDraftImpact()` / window call, e.g. "Makes your starting lineup 3rd → 2nd; fits a contender."
  4. **Why they'd say yes / no** – from trade-match need/surplus grading when a partner is chosen.
- Every line labels uncertainty (AGENTS.md "Label uncertainty"; "a score is not a probability").
- Without a league: show 1–2 and a "Connect your league for team-specific advice" link to League History.

## Out of scope

- LLM-generated prose or any paid API. Auto-sending offers to Sleeper.
- Changing player prices.

## Acceptance criteria (manual QA)

- With an empty side, the button is disabled and says why.
- For a lopsided trade, advice names a concrete add (e.g. "Add a 2027 mid 2nd to Team 2 to make it Even") and applying it moves the scale to Even or Close.
- With the sample league connected and my team chosen, the "For your team" section appears and its numbers match the My Team page.
- Advice never contradicts the scale verdict.
- Panel closes with Esc/✕/Back; trade is unchanged unless a suggestion was applied.
- 390/820/1280 px usable.

## Dependencies

- 027, 029. League parts depend on a connected league (existing flow, later ticket 033).

## Technical notes

- Files: `docs/app.js` (functions listed above, plus `renderDraftTeam`, `buildDraftOfferText`), `docs/modules/verdict-copy.js`, `docs/modules/trade-talk.js`, `docs/modules/trade-match.js`, `docs/modules/window-call.js`, `docs/modules/package-value.js`, new `docs/modules/trade-advice.js` suggested.
- Open question for Niko: is "real trade advice" this, or a human/expert review service? Note the answer in the PR.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**L**
