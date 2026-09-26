# Agent instructions

## Product purpose

Dynasty Ticker helps a dynasty manager answer three connected questions:

1. **What is this player worth?** Players.
2. **Is this offer fair, and what is the tradeoff?** Trade.
3. **Does this move help my team and my window?** My League, and Trade with a league connected.

Players and the calculator must work without a league. Connecting Sleeper adds ownership, roster impact, and league context to the task already underway. It must never reset that task. A good visit ends with: "I understand the answer, why I should trust it, and what I can do next."

Competing with KeepTradeCut is a hypothesis we earn with trustworthy numbers and useful league context. More features or more elaborate formulas do not prove it.

## Decision priorities

When choices conflict, in this order:

1. Truthful answers.
2. Understandable completion of the user's task.
3. Reliable, responsive use on phones and iPads.
4. Useful depth.
5. More features and visual polish.

Explicit current instructions from the owner win. If one conflicts with an older ticket or PR, say so in the PR instead of silently following whichever you read last.

What follows from that:

- **One price.** The Players page market price (Sleeper trades mixed with KeepTradeCut, in the active format) is the number the calculator uses, with or without a league. Format (Superflex / 1QB), TE premium, the league board, and the uneven-package credit are shown as labeled adjustments. League screens outside the calculator still use the star-premium value; see ticket 016 before changing either side.
- **Three questions stay separate:** the market price, whether it fits my team, and why the other manager would say yes.
- **Never erase work.** League loads, team switches, Review trade, and Clear keep or restore the trade draft (`state.valueCalc`). An ownership mismatch is explained, not "fixed" by swapping players.
- **Label uncertainty.** Estimates, stale data, and heuristic scores say what they are. A score is not a probability. An honest empty state beats a filler deal.
- **Evidence is not proof.** KeepTradeCut, completed Sleeper trades, and crowd votes have different strengths. Do not claim they beat a baseline without a holdout test.
- **Keep capabilities, give each a clear home.** Consolidate duplicate implementations. Explain any removal in the PR. Old links keep working.
- **Feedback names a problem, not a fix.** "I don't understand this page" is a comprehension problem. Moving a button is one guess; check that it solved the problem.

## Proving a change

- Write acceptance criteria as observable user behavior before building.
- Walk the journey in a real browser at desktop, phone, and iPad sizes: find a player, add him to a trade, build the other side, read the verdict, connect Sleeper, see the same trade with team impact, adjust it. Review trade opens the same editable trade. Back stays on the site.
- Regression tests pin behavior (draft kept, one verdict, correct ownership, durable saves), not labels or tab counts.
- A developer walkthrough is not usability evidence. First-visit tasks live in `research/first-visit-tasks.md`. Never invent results.

## Cursor Cloud specific instructions

- Test changes yourself.
- Record a short screen video of the working change and show it to the user.
- After tests pass, commit, push, update the PR, and keep moving.

## Git branches

- Open PRs against **`develop`**. That is the working branch.
- Do **not** merge feature work into `prod` or leftover `main`.
- Promote `develop` → `prod` only when the user asks to cut a release.

## Tickets

Board is `tickets/`. **Do not delete ticket files** when they ship.

When a ticket is done:

1. Set `Status` to `Done` in the ticket file. Keep the rest of the file.
2. Add a `Shipped` line with the PR (`#57`).
3. Move the README row from Open to Done and link the PR.
4. Run `npm test` so `tests/tickets.test.js` agrees.

If an old ticket's product guidance conflicts with Product purpose, add a `Superseded` note to that ticket. Do not delete it or rewrite its history.

## Live site releases

- Merging to `develop` (or leftover `main`) must **not** publish [dynastyticker.com](https://dynastyticker.com/). Netlify git builds are **stopped** at the site (`stop_builds`). Ignore scripts are only a safety net if someone turns builds back on.
- GitHub Pages publishes `develop` to `https://nikoskiouris.github.io/Dynasty-Ticker/` as a preview of unreleased work. Do not set a Pages custom domain. That URL is not dynastyticker.com.
- Pushing or merging `develop` into `prod` cuts a GitHub Release. That runs `.github/workflows/deploy-release.yml`, which calls `scripts/deploy_live_site.sh`.
- Do not trigger a production deploy unless the user explicitly asks to cut a release / promote to prod.
- Do not run a scheduled Netlify production deploy. Market files refresh when a release is cut. The weekly Dynasty Nerds mock scrape may commit JSON to `develop`; that must not publish the live site.
- Local check: `npm run serve` (or `npm test`). Do not burn Netlify credits for preview deploys.
