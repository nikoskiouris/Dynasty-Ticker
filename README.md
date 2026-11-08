# Dynasty Ticker

Dynasty Ticker helps a Sleeper dynasty manager answer three questions: what is this player worth, is this trade fair, and does this move help my team. Player values come from Dynasty Ticker's independent full-PPR football forecast. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app:** `docs/` — the site at [dynastyticker.com](https://dynastyticker.com/).
- **Modules:** `docs/modules/` — routing, Sleeper client, values, verdict copy, trade talk, trade match, season engine.
- **Functions:** `netlify/` — shared-trade pages and cards (`/t/<code>`), first-party page counts, the searched-username list.
- **Player values:** `player-values/` — the forecast that writes `docs/data/player_values.json`.
- **Tests:** `tests/` — Node and Python (`npm test`), browser journeys in `tests/e2e` (`npm run e2e`).

## Web app

Open `docs/` locally (`npm run serve`) or [dynastyticker.com](https://dynastyticker.com/).

Home offers four ways in: type a trade in plain words ("Gibbs and a 1st for Nabers"), connect a Sleeper username, try the sample league (`/?sample=1`, invented managers), or look up a player.

### Tabs
Three tabs, one bar at every width. Check a trade and the players board work before a league is connected.

1. **Check a trade** (`/trade?give=…&get=…`) — one calculator (you give / you get) and one trade draft. Describe a trade in plain words or add pieces by search. One verdict ("You give 12% more"), the reason under **Why?**, and, with a league, who owns each piece and both rosters' lineup impact. Connecting Sleeper keeps the trade. **Share trade** makes a `/t/<code>` link with its own preview card.
2. **Find a trade** (`/l/<league>/ideas`) — ideas for your team, Shop a player (fair offers from the league), and the best partners. **Review trade** opens the idea in Check a trade.
3. **My team** (`/l/<league>/team`) — the contend-or-rebuild call with playoff odds, your next move, position ranks, best lineup, bench and picks, standings and playoff odds.

The players board and player pages (`/player/<sleeper id>`) show each price, its trend, and similar values. Old links (`?tab=…`, `?view=ranks`, removed rooms) still open the closest page.

Product purpose and how to choose between competing asks live in `AGENTS.md`. First-visit usability tasks live in `research/first-visit-tasks.md`.

### Value source
There is one player-value system: `player-values/`.

- Two published maps: **1QB full PPR** and **Superflex full PPR**.
- Age, NFL experience, opportunity, efficiency, availability, team environment, draft investment for thin samples, and position-specific career retention feed an eight-season football forecast.
- Value is discounted usable PPR production above a reference alternative, converted with one fixed 20× display ruler.
- RB/WR/TE use the same player value in both formats. Superflex changes QB scarcity; future pick values can also differ by format.
- No imported external dynasty rankings, fitted trade-market prices, TE/RB scoring premiums, crowd-vote price shifts, star multipliers, league-specific prices, or age/position fallback guesses feed the published player price.
- Check a trade, Find a trade, My team, the players board and the share cards all read `docs/data/player_values.json`.
- League trade history and crowd votes remain useful context/preferences, but they do not create a second player price.
- Package consolidation credit can still affect a trade verdict without changing any player's listed price.

The complete design and caveats live in `player-values/SPEC.md`; implementation details are in `player-values/README.md`. The chronological one-year holdout (observation count, MAE, and persistence MAE) lives on the snapshot `meta.validation` object and in `player-values/validation.json`. It validates that narrow retention target, not eight-year market-price accuracy. Refresh with `python3 player-values/build.py`. `python3 scripts/check_market_files.py` checks the committed file. `npm test` warns when that file is old. A live publish and the player-value refresh fail if it is older than 21 days. The refresh validates before atomically replacing the last good snapshot. The 2027 Superflex rookie mock remains a separate display feature and refreshes with `python3 scripts/update_dynasty_rookie_mock.py`.

## Live site (dynastyticker.com)

The live app is a static site on **Netlify**. Public URL: `https://dynastyticker.com/`. That is the product. `develop` is the integration branch. Unreleased work stays on `develop` until a release.

**Work on `develop`. Live site updates only when `develop` is merged into `prod`.** That merge cuts a GitHub Release. GitHub Actions then scrapes market files and uploads with the Netlify CLI. Merges to `develop` (or leftover `main`) do not publish the live site.

**github.io is not the app.** Do not treat `nikoskiouris.github.io` as Dynasty Ticker or as a preview of `develop`. After dynastyticker.com is serving this desk, turn GitHub Pages off in the repo settings, or replace the leftover Pages site with a 301 to `https://dynastyticker.com/`. Do not add a Pages custom domain. This repo no longer publishes `docs/` to Pages.

Netlify emails on a GitHub merge do **not** mean credits were spent. On credit plans, a **successful production deploy** costs 15 credits. Skipped, canceled, and failed git deploys cost 0, but they still start a job and still email you. **Stop builds** (not “stop auto publishing”) is the switch that prevents the job from existing. This repo turns that on through the Netlify API. Bandwidth, web requests, and functions still use credits when people visit the site.

1. GitHub → **Settings → General → Default branch:** `develop`. Scheduled jobs run only from the default branch. While that setting stays on `main`, the Tuesday player-value refresh and the Monday rookie-mock refresh never start, and `docs/data` goes stale.
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

Cut a release: open a PR from `develop` into `prod` and merge it (or push `develop` to `prod`). Workflow `.github/workflows/cut-release.yml` publishes a GitHub Release. `.github/workflows/deploy-release.yml` then uploads `docs/` plus functions with the Netlify CLI. Optional manual refresh of the last release: `.github/workflows/deploy-site.yml`. Tests: `.github/workflows/test.yml`. Local check: `npm run serve`. There is no GitHub Pages preview workflow.

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
- Phones (`max-width: 700px`) get a fixed three-tab bar at the bottom and a "Connect my league" chip in the header. iPad and desktop show the same three tabs in one row above the page.
