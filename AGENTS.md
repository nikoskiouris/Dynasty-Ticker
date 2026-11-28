# Agent instructions

## Product purpose

Dynasty Ticker helps a dynasty manager answer three connected questions:

1. **What is this player worth?** Player Rankings (`/players`) and the player page (`/player/<id>`).
2. **Is this offer fair, and what is the tradeoff?** Trade Calculator (`/trade`), including the talk box that reads a typed trade, and shared trade links (`/t/<code>`).
3. **Does this move help my team and my window?** League History for a connected Sleeper league (`/l/<id>`: hub, Standings, My Team, Recent Trades, Historical Data). Trade Calculator is never team-specific (owner rule, Nov 19, 2026): with or without a league it shows Team 1 / Team 2, no league header, team browse, ownership or Team impact.

Home opens Player Rankings. The shared header links to Player Rankings, Trade Calculator and League History. Player Rankings and Trade Calculator must work without a league. Connecting Sleeper adds league context to League History and Player Rankings. It must never reset that task. A good visit ends with: "I understand the answer, why I should trust it, and what I can do next."

Trustworthy numbers and useful league context are the product. More features or more elaborate formulas do not prove it.

## Decision priorities

When choices conflict, in this order:

1. Truthful answers.
2. Understandable completion of the user's task.
3. Reliable, responsive use on phones and iPads.
4. Useful depth.
5. More features and visual polish.

Explicit current instructions from the owner win. If one conflicts with an older ticket or PR, say so in the PR instead of silently following whichever you read last.

What follows from that:

- **One value system (owner rule, Nov 13, 2026).** The site is optimized for 12-team Superflex PPR dynasty, and that is the only value system. No 1QB, other league sizes, TE premium or other scoring toggles, or alternate value modes (done in `tickets/done/044-*`). A connected league of any other shape still loads; its pages say once that values are built for 12-team Superflex PPR. Old 1QB share links open on today's Superflex prices with a note.
- **One price.** Publish one versioned 12-team Superflex full-PPR dynasty value per supported asset in `docs/data/player_values.json`. The clean rebuild requested November 28, 2026 uses player production, future outlook and format-specific external market evidence. Rankings, player pages, the calculator, League History and share cards use that snapshot. Keep historical prices available for dated trade links.
- **Source names.** Name Sleeper for projections and league data. Historical rankings source names stay in `player-values/`. The calculator’s fewer, better pieces adjustment can change a trade verdict while keeping each listed value the same.
- **Three questions stay separate:** the market price, whether it fits my team, and why the other manager would say yes.
- **Never erase work.** League loads, team switches, a typed new trade, and Clear keep or restore the trade draft (`state.valueCalc`): Restore draft brings back what was replaced, and the talk box's "undo" steps back through its own changes but never past a manual edit. "Open in Trade Calculator" from Recent Trades opens a new tab so the draft stays. An ownership mismatch is explained, not "fixed" by swapping players.
- **Label uncertainty.** Estimates, stale data, and heuristic scores say what they are. A score is not a probability. An honest empty state beats a filler deal.
- **Evidence is not proof.** Use a chronological holdout for trade fit. Explain limited direct evidence and remember that completed trades show the deals that got accepted.
- **Keep capabilities, give each a clear home.** Consolidate duplicate implementations. Explain any removal in the PR. Old links keep working.
- **Feedback names a problem, not a fix.** "I don't understand this page" is a comprehension problem. Moving a button is one guess; check that it solved the problem.

## Owner policy: no unit tests or automated test suites

- Do not write unit tests or add any automated test suite, snapshots, mocks, fixtures, test-only dependencies, or test CI jobs unless the owner explicitly asks to reverse this policy.
- Do not recreate the removed Node, Python, or browser tests. Read `.cursor/skills/no-unit-tests/SKILL.md` before coding.
- Verify changes manually in a browser or CLI as appropriate. Syntax checks, build checks, data-integrity validation, and deployment safeguards remain allowed; never claim automated tests passed.
- Describe what was and was not manually checked in each PR.

## Proving a change

- Write acceptance criteria as observable user behavior before building.
- Walk the journey in a real browser at desktop (1280), phone (390) and iPad (810–820) sizes: find a player, add him to a trade, build the other side, read the verdict, connect Sleeper, see the same trade unchanged (no team names), adjust it. Back stays on the site. For league pages use a real public Sleeper league ID; the sample league was removed (045).
- During manual regression review, check behavior (draft kept, one verdict, correct ownership, durable saves), not labels or tab counts.
- A developer walkthrough is not usability evidence. First-visit tasks live in `research/first-visit-tasks.md`. Never invent results.

## Shipping a change

These apply to every agent (Cursor, Claude Code, or any other). How to record: `.cursor/skills/ship-with-demo/SKILL.md`.

- Manually verify changes yourself without creating or running automated test suites.
- Every change ships with a demo video that shows what changed and how it works, including changes with nothing on screen (docs, tests, scripts, data jobs): show the diff, the terminal, or the page that proves the result. After you put up or update a PR, show the owner the video. Embed it in the PR when your tools can upload it; otherwise send it in the final reply.
- A demo video is not usability evidence (see Proving a change).
- Claude Code sessions save demos under `pr-artifacts/`; Cursor uses `/opt/cursor/artifacts/`. Name the file in the PR either way.
- A launch video, only when the owner asks for one, follows `.cursor/skills/brag/SKILL.md`.
- After manual verification and the demo are recorded, commit, push, and update the PR.

## Git branches

- Open PRs against **`develop`**. That is the working branch.
- Do **not** merge feature work into `prod` or leftover `main`.
- Promote `develop` → `prod` only when the user asks to cut a release.
- Merge a PR into `develop` only when the owner asks. Stacked PRs say what they sit on; merge the base first.

## Tickets

The board is `tickets/`. Open tickets live in `tickets/todo/` and finished ones in `tickets/done/`. The index is `tickets/README.md`. **Do not delete ticket files.**

When a ticket is finished, the implementer must, in the **same PR or commit as the work**:

1. `git mv tickets/todo/<NNN-name>.md tickets/done/`.
2. Add `Done: <YYYY-MM-DD>, <PR or commit link>` on the line under the ticket's title, and set `Status` to `Done`. Keep the rest of the file.
3. Update `tickets/README.md`: move the row from To do to Done, point its link at `done/`, and fill in the Done column.
4. Manually confirm the file location, the ticket status and the README row agree. Do not add a ticket test.

If an old ticket's product guidance conflicts with Product purpose, add a `Superseded` note to that ticket. Do not delete it or rewrite its history. A ticket dropped without being built moves to `tickets/done/` with Status `Superseded`.

## Live site releases

- Merging to `develop` (or leftover `main`) must **not** publish [dynastyticker.com](https://dynastyticker.com/). Netlify git builds are **stopped** at the site (`stop_builds`). Ignore scripts are only a safety net if someone turns builds back on.
- The public app is [dynastyticker.com](https://dynastyticker.com/) on Netlify. `develop` is the integration branch. github.io is not the app. Do not publish the desk to GitHub Pages. After the live site matches this build, turn Pages off or 301 the leftover github.io URL to dynastyticker.com. Do not set a Pages custom domain.
- Merging `develop` into `prod` (a PR from `develop` to `prod`, as each release so far) runs `.github/workflows/cut-release.yml`: its first job cuts a GitHub Release, and its `deploy` job deploys that release with `scripts/deploy_live_site.sh`. A release published by that workflow's token does not trigger `.github/workflows/deploy-release.yml`; that one runs for a release published by hand. `.github/workflows/deploy-site.yml` is manual only and redeploys the latest release. After a deploy, load dynastyticker.com and `/data/player_values.json` to confirm it.
- Do not trigger a production deploy unless the user explicitly asks to cut a release / promote to prod.
- Do not run a scheduled Netlify production deploy.
- **Player values refresh daily without a deploy.** `.github/workflows/refresh-player-values.yml` runs every day on `develop`: it rebuilds `docs/data/player_values.json`, runs `scripts/check_market_files.py --fail-on-age`, archives the dated snapshot under `docs/data/price-history/`, commits with `[skip netlify]`, and then `scripts/publish_market_blobs.mjs` writes the same files to the `market-data` Netlify Blobs store. On the live site `/data/player_values.json` and `/data/price-history/*` are rewritten to the `market` function (`netlify/lib/market-data.js`), which serves the newer of that published copy and the release's own copy. Set the repository variable `MARKET_PUBLISH=off` to stop daily publishing; the site then shows the release's values. Code still ships only with a release.
- GitHub runs scheduled workflows only from the repository default branch. That branch must be `develop`, or the daily player-value refresh never starts.
- `scripts/stage_pages_preview.sh` refuses. An old Pages workflow must not publish the desk.
- Local check: `npm run serve` plus focused manual verification. No automated test suite. Do not burn Netlify credits for preview deploys.
- Netlify functions (`netlify/functions/`: trade-page, trade-card, market, collect, searched-user, analytics-stats) need site environment variable `VISIT_SALT` (Functions and Runtime scope). The daily values publish and the deploy workflows need the `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` repository secrets. `scripts/deploy_live_site.sh` runs `scripts/ensure_netlify_salts.py` and will not publish until it is a real secret. Do not commit the values. The old public default `dynasty-ticker-traffic-v1` is rejected.
