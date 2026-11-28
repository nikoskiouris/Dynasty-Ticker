# Dynasty Ticker

Dynasty Ticker helps a Sleeper dynasty manager answer three questions: what is this player worth, is this trade fair, and does this move help my team. The site publishes one dynasty value per supported asset for 12-team superflex PPR leagues. Player point projections come directly from Sleeper. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app:** `docs/` — the site at [dynastyticker.com](https://dynastyticker.com/).
- **Modules:** `docs/modules/` — routing, Sleeper client, values, verdict copy, trade talk, rankings, league history, season engine.
- **Functions:** `netlify/` — shared-trade pages and cards (`/t/<code>`), the daily player-value file (`market`), first-party page counts, the searched-username list.
- **Player values:** `player-values/` — the valuation model, daily builder and historical evaluation.
- **Agent coding policy:** `.cursor/skills/no-unit-tests/SKILL.md` — no unit tests or automated test suite.

## Web app

Open `docs/` locally (`npm run serve`) or [dynastyticker.com](https://dynastyticker.com/).

Home is a tool picker with three tools, and the ☰ menu reaches every page. Trade Calculator and Player Rankings work before a league is connected.

1. **Trade Calculator** (`/trade?give=…&get=…`) — two columns (Team 1 receives / Team 2 receives) and one trade draft. Type a whole trade in plain words in the talk box ("Gibbs and a 1st for Nabers", "is Gibbs for Bijan fair?", "undo") or add pieces by search. One verdict on a fairness scale (Even, Close, Unfair, Lopsided), an "Even it up" suggestion, and **Give real trade advice** (rules, no AI). The calculator is never team-specific: with or without a league it shows Team 1 / Team 2 and no ownership or Team impact. Connecting Sleeper keeps the trade. **Share trade** makes a `/t/<code>` link with its own preview card.
2. **Player Rankings** (`/players`) — every priced player and pick, sortable, with search (nicknames like JSN work). Player pages (`/player/<sleeper id>`) show the price, the factors behind it, its trend, production, and similar values.
3. **League History** (`/leagues`, then `/l/<league>`) — enter a Sleeper username or league ID. The league hub links to **Standings** (luck, playoff odds), **My Team** (position ranks, roster value, bench, picks, superlatives), **Recent Trades** (graded on today's values) and **Historical Data** (champions, all-time standings, records, head-to-head, trends, awards).

Old links (`?tab=…`, `?view=ranks`, removed rooms like Find a trade) still open the closest page.

Product purpose and how to choose between competing asks live in `AGENTS.md`. First-visit usability tasks live in `research/first-visit-tasks.md`.

### Value source
Rankings, player pages, Trade Calculator, League History and share cards read the same **12-team Superflex full-PPR dynasty** snapshot at `docs/data/player_values.json`. Players and picks use a 0–100 scale with hundredth-point precision. Player values reflect projected lineup advantage, future production and format-specific market quotes. The calculator applies its package adjustment when comparing offers. Each asset keeps the same individual price throughout the app.

Run `python3 player-values/build_trade_values.py` to refresh the board and `python3 scripts/check_market_files.py --fail-on-age` to check the generated file. The [model notes](player-values/README.md) document the inputs, weights, assumptions and historical checks.

The daily refresh (`.github/workflows/refresh-player-values.yml`) commits the new snapshot to `develop` and publishes the same checked files to the `market-data` Netlify Blobs store (`scripts/publish_market_blobs.mjs`). On the live site, `/data/player_values.json` and `/data/price-history/*` go through the `market` function, which serves the newer of that copy and the release's own copy. So values on dynastyticker.com update daily without a deploy. The repository variable `MARKET_PUBLISH=off` turns that off.

## Live site (dynastyticker.com)

The live app is a static site on **Netlify**. Public URL: `https://dynastyticker.com/`. That is the product. `develop` is the integration branch. Unreleased work stays on `develop` until a release.

**Work on `develop`. Site code updates only when `develop` is merged into `prod`.** That merge cuts a GitHub Release, and GitHub Actions uploads it with the Netlify CLI. Merges to `develop` (or leftover `main`) do not publish the live site. Player values are the exception: they reach the live site daily (see Value source).

**github.io is not the app.** Do not treat `nikoskiouris.github.io` as Dynasty Ticker or as a preview of `develop`. After dynastyticker.com is serving this desk, turn GitHub Pages off in the repo settings, or replace the leftover Pages site with a 301 to `https://dynastyticker.com/`. Do not add a Pages custom domain. This repo no longer publishes `docs/` to Pages.

Netlify emails on a GitHub merge do **not** mean credits were spent. On credit plans, a **successful production deploy** costs 15 credits. Skipped, canceled, and failed git deploys cost 0, but they still start a job and still email you. **Stop builds** (not “stop auto publishing”) is the switch that prevents the job from existing. This repo turns that on through the Netlify API. Bandwidth, web requests, and functions still use credits when people visit the site.

1. GitHub → **Settings → General → Default branch:** `develop`. Scheduled jobs run only from the default branch. While that setting stays on `main`, the daily player-value refresh never starts, and `docs/data` goes stale.
2. Open [Netlify](https://app.netlify.com/), sign up with GitHub, **Add new site → Import an existing project**, pick this repo.
3. Netlify reads `netlify.toml` (`publish = docs`). First deploy gives a `*.netlify.app` URL.
4. **Domain management → Add custom domain:** `dynastyticker.com` and `www.dynastyticker.com`.
5. In **Namecheap** (you just bought this name there), paste the DNS records Netlify shows. Apex `A` / `www` `CNAME`. Wait for SSL.
6. Repo **Settings → Secrets and variables → Actions**, add:
   - `NETLIFY_AUTH_TOKEN` — Netlify user access token (User settings → Applications → New access token).
   - `NETLIFY_SITE_ID` — Site API ID (Site configuration → Site details).
7. On the Netlify site, set **Environment variables** (Site configuration → Environment variables), scoped to **Functions** and **Runtime**:
   - `VISIT_SALT` — secret salt for the first-party page-view hash.
   Do not commit it. Do not reuse `dynasty-ticker-traffic-v1` (that string shipped in source and is rejected). `scripts/deploy_live_site.sh` checks before upload. If the salt is missing or still that old default, `scripts/ensure_netlify_salts.py` writes a new random secret to the site and does not print it. A salt that is already a real secret is left alone. You can also set `VISIT_SALT` in the deploy environment; the script copies that value instead of generating a new one.
8. GitHub Actions runs `.github/workflows/stop-netlify-git-builds.yml` so Netlify **Build status = Stopped builds**. Confirm in Netlify: **Project configuration → Build & deploy → Continuous deployment → Build settings → Stopped builds**. Do **not** use “Stop auto publishing”; that still starts a canceled production job. `netlify.toml` skip/refuse scripts are only a backup.
9. Repo **Settings → Pages**: turn the source **off** once dynastyticker.com matches this desk. If a github.io URL is still up, replace it with a redirect to `https://dynastyticker.com/`. Do **not** add a custom domain there. Visit counts stay on dynastyticker.com only. An old Pages workflow left on `main` checks out `develop` and runs `scripts/stage_pages_preview.sh`. That script refuses, so the dispatch cannot publish a second desk.

Cut a release: open a PR from `develop` into `prod` and merge it (or push `develop` to `prod`). Workflow `.github/workflows/cut-release.yml` publishes a GitHub Release. `.github/workflows/deploy-release.yml` then uploads `docs/` plus functions with the Netlify CLI. Optional manual refresh of the last release: `.github/workflows/deploy-site.yml`. Local check: `npm run serve`. There is no GitHub Pages preview workflow.

### Traffic

**Netlify Web Analytics** counts people who hit the site. In the project sidebar: **Analytics & metrics → Web analytics**. Unique visitors are distinct IP addresses. Pageviews are real page loads, not the WordPress scan 404s (those sit under resources-not-found). It updates about hourly. Ad blockers do not hide visits. The free window is about 7 days. The 30-day range costs extra. Skip it for now. Do not use **Observability** for the user count. That one includes bots. **Real user monitoring** is page speed, not users.

A week in mid-September 2026 read **557 unique visitors** and **879 pageviews**, almost all on `/` because the desk is one page. Treat that as roughly **400 real people** that week, not 557 humans. China, Germany, and Singapore add scanner IPs. Someone on Wi-Fi and cell data can count twice.

Who actually opened a league is the searched-username list below. The old desk tally and `/secret-numbers` page are gone. The old third-party `page-views-api.ratneshc.com` counter stays retired. A first-party page-view hash, when the host runs it, uses `VISIT_SALT` and is not shown on the page.

### Searched usernames

The live site saves a Sleeper username only after someone searches it **and one of that user's leagues actually opens**. A click and a one-league auto-open both count. A typo never opens a league, so it is never saved. The saved name is the one Sleeper returns, so a misspelling stays on the same row instead of becoming a new person. A search that only shows the league list, a league ID / URL load, and a shared link save nothing.

Each save reads the CSV already stored, adds a row or updates that username, and writes the full list back. Old rows stay. A save never replaces the file with only the newest name.

The list is one CSV in Netlify Blobs: store `desk-users`, key `searched-users.csv`. One row per username:

```
username,user_id,first_seen,last_seen,searches
```

- **username** — lowercase Sleeper username, as Sleeper returned it (not what was typed).
- **user_id** — Sleeper user id. It stays the same if the username changes.
- **first_seen / last_seen** — UTC.
- **searches** — how many searches ended in a loaded league. Opening a second league from the same results does not count twice. A repeat leaves every other username on the list.

Download it from Netlify: **Data & Storage → Blobs → desk-users → searched-users.csv**. Or from a terminal, after `npm install`:

```
NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... node scripts/searched_users.mjs
```

That writes `searched-users.csv` (gitignored). **This repo is public. Never commit that file.** There is no public URL for the list; `/api/searched-user` only accepts writes from dynastyticker.com. Localhost never sends a username. github.io is not the app, so it must not be treated as a second desk.

## Notes
- Player assets: `player:<sleeper_player_id>`
- Pick assets: `pick:<season>:r<round>:<original_owner|any>`
- Playoff odds are a 4000-season Monte Carlo. Each simulated season draws team quality from the posterior, so a Week 1 favorite is not a 100% lock. 100% / 0% only appear when a team has mathematically clinched or been eliminated.
- Every page has the ☰ menu (Trade Calculator, Player Rankings, League History). Home is the tool picker.
