import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE_URL,
  REPO_URL,
  SITE_NAME,
  SITE_URL,
  STORAGE_NOTICE_KEY,
  applyDocumentMeta,
  applyStorageNoticeHidden,
  buildDocumentTitle,
  buildPageDescription,
  readStorageNoticeDismissed,
  tickerDurationSeconds,
  writeStorageNoticeDismissed,
} from "../docs/modules/site.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("document titles and descriptions change with tab and league", () => {
  assert.equal(buildDocumentTitle({}), DEFAULT_TITLE);
  assert.equal(
    buildDocumentTitle({ page: "league", leagueName: "Try Hard or Die Hard", loaded: true }),
    "League · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "league", leagueName: "Try Hard or Die Hard", loaded: true, room: "scores" }),
    "Scores · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "recap", leagueName: "Try Hard or Die Hard", loaded: true }),
    "Recap · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "team", leagueName: "Try Hard or Die Hard", loaded: true }),
    "Teams · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "teams", leagueName: "Try Hard or Die Hard", loaded: true, room: "mock" }),
    "Mock · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "teams", leagueName: "Try Hard or Die Hard", loaded: true, room: "call" }),
    "Tank or contend · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "trades", leagueName: "Try Hard or Die Hard", loaded: true, room: "lab" }),
    "Find deals · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "trades", leagueName: "Try Hard or Die Hard", loaded: true, room: "match" }),
    "Partners · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "trader", leagueName: "Try Hard or Die Hard", loaded: true }),
    "Trades · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "history", leagueName: "Try Hard or Die Hard", loaded: true, room: "hall" }),
    "History · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.equal(
    buildDocumentTitle({ page: "history", leagueName: "Try Hard or Die Hard", loaded: true, room: "records" }),
    "Records · Try Hard or Die Hard — Dynasty Ticker"
  );
  assert.match(
    buildPageDescription({ page: "home", leagueName: "Try Hard or Die Hard", loaded: true }),
    /Now open: Try Hard or Die Hard/
  );
  assert.match(
    buildPageDescription({ page: "league", room: "recap", leagueName: "Demo", loaded: true }),
    /Group-chat recap/
  );
  assert.match(buildPageDescription({ page: "teams", room: "call", loaded: true }), /tank/);
  assert.match(buildPageDescription({ page: "trades", room: "calculator", loaded: true }), /two-team calculator/);
  assert.match(buildPageDescription({ page: "trades", room: "log", loaded: true }), /Graded past deals/);
  assert.match(buildPageDescription({ page: "trades", room: "match", loaded: true }), /Match with teams/);
  assert.equal(buildPageDescription({}), DEFAULT_DESCRIPTION);
});

test("applyDocumentMeta writes title and social tags", () => {
  const tags = {
    "og:title": { content: "" },
    description: { content: "" },
    "og:description": { content: "" },
    "twitter:title": { content: "" },
    "twitter:description": { content: "" },
  };
  const doc = {
    title: "",
    querySelector(selector) {
      if (selector.includes("og:title")) return tags["og:title"];
      if (selector.includes('name="description"')) return tags.description;
      if (selector.includes("og:description")) return tags["og:description"];
      if (selector.includes("twitter:title")) return tags["twitter:title"];
      if (selector.includes("twitter:description")) return tags["twitter:description"];
      return null;
    },
  };
  applyDocumentMeta(doc, { title: "Teams · Demo — Dynasty Ticker", description: "Scout any roster." });
  assert.equal(doc.title, "Teams · Demo — Dynasty Ticker");
  assert.equal(tags["og:title"].content, "Teams · Demo — Dynasty Ticker");
  assert.equal(tags.description.content, "Scout any roster.");
  assert.equal(tags["twitter:description"].content, "Scout any roster.");
});

test("ship-ready files exist with titles, robots, sitemap, and a compressed OG image", () => {
  const required = [
    "404.html",
    "privacy.html",
    "terms.html",
    "robots.txt",
    "sitemap.xml",
    "favicon.svg",
    "favicon.ico",
    "apple-touch-icon.png",
    "og-image.jpg",
    "site.webmanifest",
    "brand/wordmark.svg",
    "brand/wordmark-on-dark.svg",
    "brand/mark.svg",
    "data/nfl_schedule.json",
  ];
  for (const name of required) {
    assert.equal(existsSync(join(docs, name)), true, name);
  }

  const index = readDocs("index.html");
  assert.match(index, /property="og:image"/);
  assert.match(index, /og-image\.jpg/);
  assert.match(index, /rel="canonical"/);
  assert.match(index, /apple-touch-icon/);
  assert.match(index, /id="sticky-mobile-cta"/);
  assert.match(index, /id="sticky-find-btn"/);
  assert.doesNotMatch(index, /id="storage-notice"/);
  assert.doesNotMatch(index, /id="landing-demo-btn"/);
  assert.doesNotMatch(index, /id="rail-demo-btn"/);
  assert.doesNotMatch(index, /id="sticky-demo-btn"/);
  assert.doesNotMatch(index, /id="copy-league-id-btn"/);
  assert.doesNotMatch(index, /Use demo league/);
  assert.doesNotMatch(index, /Open demo/);
  assert.match(index, /id="landing-rather"/);
  assert.match(index, /id="landing-username"/);
  assert.match(index, />What do you want to do\?</);
  assert.match(index, /id="landing-jobs"/);
  assert.match(index, /brand\/wordmark\.svg/);
  assert.match(index, /class="brand-wordmark/);
  assert.match(index, /class="brand-lockup brand-lockup--landing"/);
  assert.match(index, /id="league-avatar"[\s\S]*brand\/mark\.svg/);
  assert.match(index, /class="league-mark"/);
  assert.doesNotMatch(index, /class="brand-mark"/);
  assert.doesNotMatch(index, /League Command Center/);
  assert.match(index, /id="landing-league-picker"/);
  assert.match(index, /id="start-dashboard"/);
  assert.doesNotMatch(index, /id="landing-features"/);
  assert.doesNotMatch(index, /class="landing-features"/);
  assert.doesNotMatch(index, /step-badge accent/);
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /anonymous visit ping/);
  assert.doesNotMatch(index, /secret-numbers/);
  assert.match(index, /Who would you rather have\?/);
  assert.match(index, /PPR 12-man Superflex/);
  assert.match(index, /id="username-error"/);
  assert.match(index, /data-theme="light"/);
  assert.match(index, /theme-color" content="#eef3f2"/);
  assert.match(index, /dynasty_ticker_theme/);
  assert.match(index, />Dark mode</);
  assert.match(index, /id="theme-toggle-btn"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(index, /data-theme="dark"/);
  assert.match(index, /family=Inter:/);
  for (const page of ["league", "teams", "trades", "history"]) {
    assert.match(index, new RegExp(`data-page="${page}"`));
    assert.match(index, new RegExp(`id="${page}-page"`));
  }
  assert.match(index, /id="room-nav"/);
  for (const room of ["start", "scores", "standings", "power", "awards", "recap", "roster", "mock", "call", "loyalty", "passports", "log", "match", "calculator", "lab", "hall", "seasons", "records"]) {
    assert.match(index, new RegExp(`data-room-panel="${room}"`), room);
  }
  assert.match(index, /id="passport-dashboard"/);
  assert.match(index, /id="mock-dashboard"/);
  assert.match(index, /id="window-call-dashboard"/);
  assert.match(index, /id="trade-log-dashboard"/);
  assert.match(index, /id="trade-match-dashboard"/);
  assert.match(index, /id="match-generate-btn"/);
  assert.match(index, />Find matches</);
  assert.match(index, /Calculator, partners, deals/);
  assert.match(index, /id="records-dashboard"/);
  assert.match(index, /id="mobile-share-btn"/);
  assert.doesNotMatch(index, /id="trader-menu"/);
  assert.doesNotMatch(index, /data-trade-room=/);
  assert.doesNotMatch(index, /data-league-room=/);
  assert.doesNotMatch(index, /data-page="team"/);
  assert.doesNotMatch(index, /data-page="trader"/);
  assert.doesNotMatch(index, /href="#league-wire"/);
  assert.doesNotMatch(index, /data-page="home"/);
  assert.doesNotMatch(index, /data-trade-mode="calculator"/);
  assert.doesNotMatch(index, /Plus Jakarta/);

  const usernameInput = index.match(/<input[^>]*id="sleeper-username"[^>]*>/)?.[0] || "";
  const landingUsername = index.match(/<input[^>]*id="landing-username"[^>]*>/)?.[0] || "";
  const leagueInput = index.match(/<input[^>]*id="league-id"[^>]*>/)?.[0] || "";
  assert.match(usernameInput, /value=""/);
  assert.match(landingUsername, /value=""/);
  assert.match(leagueInput, /value=""/);
  assert.doesNotMatch(usernameInput, /value="[^"]+"/);
  assert.doesNotMatch(leagueInput, /value="[^"]+"/);
  assert.match(usernameInput, /autocomplete="off"/);
  assert.doesNotMatch(index, /last username, league/);
  assert.doesNotMatch(index, /privacy\.html/);
  assert.doesNotMatch(index, /terms\.html/);
  assert.doesNotMatch(index, />Privacy</);
  assert.doesNotMatch(index, />Terms</);
  assert.doesNotMatch(index, />Contact</);
  assert.doesNotMatch(index, /workspace-footer/);

  const robots = readDocs("robots.txt");
  assert.match(robots, /Sitemap: https:\/\/dynastyticker\.com\/sitemap\.xml/);

  const sitemap = readDocs("sitemap.xml");
  assert.doesNotMatch(sitemap, /privacy\.html/);
  assert.doesNotMatch(sitemap, /terms\.html/);
  assert.equal(SITE_URL, "https://dynastyticker.com/");
  assert.equal(SITE_NAME, "Dynasty Ticker");
  assert.equal(REPO_URL, "https://github.com/nikoskiouris/Dynasty-Ticker");
  assert.match(sitemap, /https:\/\/dynastyticker\.com\//);
  assert.match(index, /canonical" href="https:\/\/dynastyticker\.com\//);
  assert.doesNotMatch(index, /github\.io/);
  assert.doesNotMatch(index, /GitHub Pages/);
  assert.doesNotMatch(sitemap, /secret-numbers/);

  const netlify = readFileSync(join(docs, "../netlify.toml"), "utf8");
  assert.match(netlify, /publish = "docs"/);
  assert.match(netlify, /dynastyticker\.com/);
  assert.match(netlify, /from = "\/api\/visit"/);
  assert.match(netlify, /from = "\/api\/views"/);
  assert.match(netlify, /from = "\/api\/rather-vote"/);
  assert.match(netlify, /directory = "netlify\/functions"/);
  assert.match(readDocs("_redirects"), /\/api\/visit\s+\/\.netlify\/functions\/visit\s+200!/);
  assert.match(readDocs("_redirects"), /\/api\/rather-vote\s+\/\.netlify\/functions\/rather-vote\s+200!/);

  const notFound = readDocs("404.html");
  assert.match(notFound, /Page not found/);
  assert.match(notFound, /<h1>/);
  assert.match(notFound, /theme-color" content="#eef3f2"/);
  assert.match(notFound, /data-theme="light"/);
  assert.match(notFound, /brand\/wordmark\.svg/);
  assert.doesNotMatch(notFound, /class="brand-mark"/);
  assert.doesNotMatch(notFound, /League Command Center/);
  assert.doesNotMatch(notFound, /demo league/i);
  assert.doesNotMatch(notFound, /1315165104303513600/);
  assert.doesNotMatch(notFound, /privacy\.html/);
  assert.doesNotMatch(notFound, /terms\.html/);
  assert.doesNotMatch(notFound, /Contact/);

  const privacy = readDocs("privacy.html");
  assert.match(privacy, /theme-color" content="#eef3f2"/);
  assert.match(privacy, /brand\/wordmark\.svg/);
  assert.doesNotMatch(privacy, /class="brand-mark"/);
  assert.doesNotMatch(privacy, /League Command Center/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /No accounts/);
  assert.match(privacy, /GitHub issues/);
  assert.match(privacy, /who would you rather have/);
  assert.match(privacy, /Public rather votes/);
  assert.doesNotMatch(privacy, /GitHub Pages/);
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /Last Sleeper username/);
  assert.doesNotMatch(privacy, /Last league ID/);

  const app = readDocs("app.js");
  assert.doesNotMatch(app, /Last league remembered/);
  assert.match(app, /tickerDurationSeconds\(items\.length\)/);
  assert.match(readDocs("styles.css"), /--ticker-duration: 60s/);

  const terms = readDocs("terms.html");
  assert.match(terms, /theme-color" content="#eef3f2"/);
  assert.match(terms, /brand\/wordmark\.svg/);
  assert.doesNotMatch(terms, /class="brand-mark"/);
  assert.doesNotMatch(terms, /League Command Center/);
  assert.match(terms, /not affiliated/i);
  assert.match(terms, /as is/i);

  assert.doesNotMatch(readDocs("styles.css"), /\.brand-mark\s*\{/);
  assert.match(readDocs("styles.css"), /\.league-avatar \.league-mark/);
  assert.match(readDocs("app.js"), /brand\/mark\.svg/);
  assert.match(readDocs("app.js"), /function brandMarkAvatarHtml/);
  assert.doesNotMatch(readDocs("app.js"), /leagueName \|\| "L"\)\.trim\(\)\.charAt/);
  assert.doesNotMatch(readDocs("favicon.svg"), /\brx="/);
  assert.match(readDocs("favicon.svg"), /fill="#4b4b51"/);

  assert.match(readDocs("modules/state.js"), /export const DEFAULT_THEME = "light"/);
  assert.match(readDocs("app.js"), /return DEFAULT_THEME/);
  assert.match(readDocs("site.webmanifest"), /"theme_color": "#eef3f2"/);
  assert.match(readDocs("styles.css"), /Daylight mint desk/);
  assert.match(readDocs("styles.css"), /Phone landing: search first/);
  assert.match(readDocs("styles.css"), /Phone desk nav: page tabs stick under the header/);

  assert.ok(statSync(join(docs, "og-image.jpg")).size < 120_000);
  assert.match(OG_IMAGE_URL, /og-image\.jpg$/);
});

test("Got it hides the storage notice and remembers the choice", () => {
  const memory = new Map();
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
  };

  assert.equal(readStorageNoticeDismissed(storage), false);
  writeStorageNoticeDismissed(storage);
  assert.equal(memory.get(STORAGE_NOTICE_KEY), "1");
  assert.equal(readStorageNoticeDismissed(storage), true);

  const classes = new Set();
  const notice = {
    hidden: false,
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  applyStorageNoticeHidden(notice, true);
  assert.equal(notice.hidden, true);
  assert.equal(classes.has("hidden"), true);
});

test("storage notice CSS does not override the hidden attribute", () => {
  const css = readDocs("styles.css");
  assert.match(css, /\.storage-notice:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(css, /\.storage-notice\s*\{[^}]*display:\s*flex/s);
});

test("phone desk nav puts pages on top and rooms on the bottom", () => {
  const css = readDocs("styles.css");
  assert.match(css, /Phone desk nav: page tabs stick under the header/);
  assert.match(css, /room strip pins to the bottom edge/);
  assert.doesNotMatch(css, /page tabs pin to the bottom edge/);
  assert.match(css, /\.workspace-tabs \{[^}]*position:\s*sticky/s);
  assert.match(css, /\.workspace-tabs \{[^}]*order:\s*-1/s);
  assert.match(css, /\.room-nav \{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(
    css,
    /\.asset-row-top,\s*\.asset-item \{[^}]*flex-direction:\s*column/s
  );
  assert.match(
    css,
    /\.asset-row-top,\s*\.asset-item \{[^}]*flex-direction:\s*row/s
  );
});

test("ticker loops slower so names stay readable", () => {
  assert.equal(tickerDurationSeconds(0), 50);
  assert.equal(tickerDurationSeconds(4), 50);
  assert.equal(tickerDurationSeconds(8), 72);
  assert.equal(tickerDurationSeconds(12), 108);
});

test("product name Dynasty Ticker never shares the repo with the old brand", () => {
  const banned = /dynasty[\s._-]*desk/i;
  const skipDir = new Set([".git", "node_modules", ".cursor"]);
  const skipFile = /\.(png|jpe?g|ico|webp|gif|woff2?|ttf|hash)$/i;
  const root = join(docs, "..");
  const hits = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skipDir.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (skipFile.test(entry.name)) continue;
      const text = readFileSync(path, "utf8");
      if (banned.test(text)) hits.push(path.slice(root.length + 1));
    }
  }

  walk(root);
  assert.deepEqual(hits, []);
});
