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
  writeStorageNoticeDismissed,
} from "../docs/modules/site.js";
import { SAMPLE_LEAGUE_ID } from "../docs/modules/constants.js";
import { siteMarkup } from "./site-markup.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("document titles and descriptions change with tab and league", () => {
  const name = "Try Hard or Die Hard";
  const title = (page, room = "") => buildDocumentTitle({ page, room, leagueName: name, loaded: true });
  assert.equal(buildDocumentTitle({}), DEFAULT_TITLE);
  assert.equal(title("league"), "My team · Try Hard or Die Hard — Dynasty Ticker");
  // Old tab and room names still open, on the tab that took them over.
  for (const [page, room] of [["league", "scores"], ["recap"], ["team"], ["teams", "call"], ["history", "hall"]]) {
    assert.equal(title(page, room), "My team · Try Hard or Die Hard — Dynasty Ticker", `${page}/${room}`);
  }
  assert.equal(
    buildDocumentTitle({ page: "teams", leagueName: "Sunday Squad", loaded: true, room: "call", league: { settings: { type: 0 } } }),
    "My team · Sunday Squad — Dynasty Ticker"
  );
  assert.equal(title("trades", "lab"), "Find a trade · Try Hard or Die Hard — Dynasty Ticker");
  assert.equal(title("trades", "match"), "Find a trade · Try Hard or Die Hard — Dynasty Ticker");
  assert.equal(title("trades", "find"), "Find a trade · Try Hard or Die Hard — Dynasty Ticker");
  assert.equal(title("trader"), "Trade · Try Hard or Die Hard — Dynasty Ticker");
  assert.equal(title("players"), "Trade · Try Hard or Die Hard — Dynasty Ticker");
  assert.match(
    buildPageDescription({ page: "home", leagueName: name, loaded: true }),
    /Now open: Try Hard or Die Hard/
  );
  assert.match(
    buildPageDescription({ page: "trades", room: "value", leagueName: "Demo", loaded: true }),
    /You give and you get/i
  );
  assert.match(buildPageDescription({ page: "league", room: "team", loaded: true }), /standings/);
  assert.match(buildPageDescription({ page: "trades", room: "calculator", loaded: true }), /You give and you get/i);
  assert.match(buildPageDescription({ page: "trades", room: "find", loaded: true }), /Review trade/i);
  assert.doesNotMatch(
    ["league", "trades"].map((page) => buildPageDescription({ page, loaded: true })).join(" "),
    /this week|league history|past trades/i
  );
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
  ];
  for (const name of required) {
    assert.equal(existsSync(join(docs, name)), true, name);
  }

  const index = siteMarkup();
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
  assert.match(index, /id="sample-league-link"/);
  assert.match(index, /href="\.\/\?sample=1"/);
  assert.match(index, /See the sample league/);
  assert.match(index, /Connect my league/);
  assert.match(index, /class="empty-cta"/);
  assert.equal(existsSync(join(docs, "modules/recap.js")), false);
  assert.equal(existsSync(join(docs, "modules/recap-card.js")), false);
  assert.doesNotMatch(index, /id="landing-rather"/);
  assert.match(index, /Build a trade/);
  assert.match(index, /Your next dynasty move starts here\./);
  assert.match(index, /Explore player values, build a trade, or connect your Sleeper league\. Free\. No sign-up\./);
  assert.doesNotMatch(index, /Find your league/);
  assert.match(index, /id="sample-league-chip"/);
  assert.match(index, />Sample league · Connect yours</);
  assert.match(index, /id="sample-banner"/);
  assert.doesNotMatch(index, /This is a public sample league\. Connect your Sleeper username anytime\./);
  assert.doesNotMatch(readDocs("ui/league.html"), /Connect Sleeper|Find leagues</);
  assert.match(readDocs("app.js"), /Sample league — not this account\./);
  assert.match(readDocs("app.js"), /Viewing as \$\{me\.manager\?\.displayName \|\| "a roster"\}/);
  assert.match(readDocs("app.js"), /return "Sample league"/);
  assert.match(readDocs("app.js"), /Example roster/);
  assert.doesNotMatch(index, /id="public-ranks"/);
  assert.match(index, /id="ranks-dashboard"/);
  assert.match(index, /id="landing-username"/);
  assert.doesNotMatch(index, /See a value\. Check a trade\. Then your team\./);
  assert.doesNotMatch(index, /See the league\./);
  assert.doesNotMatch(index, /Then the next move/);
  assert.match(index, /Type your Sleeper username/);
  assert.doesNotMatch(index, /id="landing-jobs"/);
  assert.match(index, /brand\/wordmark-on-dark\.svg/);
  assert.match(index, /class="brand-wordmark/);
  assert.match(index, /class="brand-lockup brand-lockup--header"/);
  assert.match(index, /id="league-avatar"[\s\S]*brand\/mark\.svg/);
  assert.match(index, /class="league-mark"/);
  assert.doesNotMatch(index, /class="brand-mark"/);
  assert.doesNotMatch(index, /League Command Center/);
  assert.match(index, /id="landing-league-picker"/);
  assert.match(index, /id="start-dashboard"/);
  assert.match(index, /data-room-panel="team"/);
  assert.doesNotMatch(index, /id="landing-features"/);
  assert.doesNotMatch(index, /class="landing-features"/);
  assert.doesNotMatch(index, /step-badge accent/);
  assert.doesNotMatch(index, /id="landing-visits"/);
  assert.doesNotMatch(index, /id="footer-visits"/);
  assert.doesNotMatch(index, /anonymous visit ping/);
  assert.doesNotMatch(index, /secret-numbers/);
  assert.doesNotMatch(index, /Who would you rather have\?/);
  assert.doesNotMatch(index, /PPR 12-man Superflex/);
  assert.match(index, /id="username-error"/);
  assert.match(index, /data-theme="dark"/);
  assert.match(index, /theme-color" content="#0c0c0e"/);
  assert.doesNotMatch(index, /dynasty_ticker_theme/);
  assert.doesNotMatch(index, /id="theme-toggle-btn"/);
  assert.doesNotMatch(index, /id="mobile-theme-btn"/);
  assert.doesNotMatch(index, />Light mode</);
  assert.doesNotMatch(index, />Dark mode</);
  assert.doesNotMatch(index, /data-theme="light"/);
  assert.match(index, /href="\.\/tokens\.css"/);
  assert.doesNotMatch(index, /fonts\.googleapis\.com/);
  assert.doesNotMatch(index, /fonts\.gstatic\.com/);
  for (const page of ["trades", "league"]) {
    assert.match(index, new RegExp(`data-page="${page}"`));
    assert.match(index, new RegExp(`id="${page}-page"`));
  }
  assert.doesNotMatch(index, /data-page="players"/);
  assert.doesNotMatch(index, /id="players-page"/);
  assert.doesNotMatch(index, /data-page="history"/);
  assert.doesNotMatch(index, /id="history-page"/);
  assert.doesNotMatch(index, /id="room-nav"/);
  for (const room of ["calculator", "find", "team"]) {
    assert.match(index, new RegExp(`data-room-panel="${room}"`), room);
  }
  for (const room of ["ranks", "scores", "board", "activity", "history"]) {
    assert.doesNotMatch(index, new RegExp(`data-room-panel="${room}"`), room);
  }
  assert.doesNotMatch(index, /data-room-panel="recap"/);
  assert.doesNotMatch(index, /data-room-panel="hall"/);
  assert.doesNotMatch(index, /data-room-panel="seasons"/);
  assert.doesNotMatch(index, /data-room-panel="records"/);
  assert.doesNotMatch(index, /id="passport-dashboard"/);
  assert.doesNotMatch(index, /id="mock-dashboard"/);
  assert.doesNotMatch(index, /id="trade-log-dashboard"/);
  assert.match(index, /id="standings-dashboard"/);
  assert.match(index, /id="trade-match-dashboard"/);
  assert.match(index, /id="calculator-shell"/);
  assert.doesNotMatch(index, /id="value-calculator-shell"/);
  assert.match(index, /id="match-generate-btn"/);
  assert.doesNotMatch(index, /id="find-more-btn"/);
  assert.match(index, />Find partners</);
  assert.match(index, /data-page="trades" data-room="find"/);
  assert.match(index, /Review trade opens it in Check a trade/);
  assert.doesNotMatch(index, /Got an offer\?/);
  const tradesPage = index.slice(index.indexOf('id="trades-page"'), index.indexOf('id="league-page"'));
  assert.deepEqual(
    [...tradesPage.matchAll(/data-room-panel="([^"]+)"/g)].map((row) => row[1]),
    ["calculator", "find"],
  );
  assert.doesNotMatch(index, /id="history-dashboard"/);
  assert.match(index, /id="mobile-home-btn"/);
  assert.match(index, /data-action="league-home"/);
  assert.doesNotMatch(index, /id="mobile-chrome-title"[^>]*data-action/);
  assert.doesNotMatch(index, /id="hero-title"[^>]*data-action/);
  assert.doesNotMatch(index, /id="league-avatar"[^>]*data-action/);
  assert.doesNotMatch(index, /brand-lockup[^>]*data-action/);
  assert.match(index, /class="home-glyph"/);
  assert.doesNotMatch(index, /id="records-dashboard"/);
  assert.doesNotMatch(index, /id="mobile-share-btn"/);
  assert.doesNotMatch(index, /id="recap-dashboard"/);
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
  // QA 2026-10-18 (#10, owner): the landing footer links /privacy and /terms.
  assert.match(index, /class="launch-footer"[\s\S]*href="\/privacy">Privacy<[\s\S]*href="\/terms">Terms</);
  assert.match(index, /Free, no sign-up\./);
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
  assert.match(netlify, /from = "\/api\/searched-user"/);
  assert.doesNotMatch(netlify, /rather-vote/);
  assert.doesNotMatch(netlify, /from = "\/api\/visit"/);
  assert.doesNotMatch(netlify, /from = "\/api\/views"/);
  assert.match(netlify, /directory = "netlify\/functions"/);
  assert.match(readDocs("_redirects"), /\/api\/searched-user\s+\/\.netlify\/functions\/searched-user\s+200!/);
  assert.doesNotMatch(readDocs("_redirects"), /rather-vote/);
  assert.doesNotMatch(readDocs("_redirects"), /\/api\/visit/);

  const notFound = readDocs("404.html");
  assert.match(notFound, /Page not found/);
  assert.match(notFound, /<h1>/);
  assert.match(notFound, /theme-color" content="#0c0c0e"/);
  assert.match(notFound, /data-theme="dark"/);
  assert.match(notFound, /brand\/wordmark-on-dark\.svg/);
  assert.doesNotMatch(notFound, /class="brand-mark"/);
  assert.doesNotMatch(notFound, /League Command Center/);
  assert.doesNotMatch(notFound, /demo league/i);
  assert.doesNotMatch(notFound, new RegExp(SAMPLE_LEAGUE_ID));
  assert.doesNotMatch(notFound, /privacy\.html/);
  assert.doesNotMatch(notFound, /terms\.html/);
  assert.doesNotMatch(notFound, /Contact/);

  const privacy = readDocs("privacy.html");
  assert.match(privacy, /theme-color" content="#0c0c0e"/);
  assert.match(privacy, /brand\/wordmark-on-dark\.svg/);
  assert.doesNotMatch(privacy, /class="brand-mark"/);
  assert.doesNotMatch(privacy, /League Command Center/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /No accounts/);
  assert.match(privacy, /GitHub issues/);
  assert.match(privacy, /who would you rather have/);
  assert.match(privacy, /Public rather votes/);
  assert.match(privacy, /salted hash/);
  assert.match(privacy, /two days/);
  assert.match(privacy, /not sent to a third-party counter/);
  assert.doesNotMatch(privacy, /GitHub Pages/);
  assert.doesNotMatch(privacy, /visit count/i);
  assert.doesNotMatch(privacy, /page-views-api/);
  assert.doesNotMatch(privacy, /Last Sleeper username/);
  assert.doesNotMatch(privacy, /Last league ID/);

  const app = readDocs("app.js");
  assert.doesNotMatch(app, /class="pulse-tile \$\{tile\.tone\}" data-action/);
  assert.doesNotMatch(app, /class="window-call-banner \$\{call\.tone\}" data-action/);
  assert.doesNotMatch(app, />This team</);
  assert.doesNotMatch(app, /data-room="standings">Standings/);
  assert.doesNotMatch(app, /Last league remembered/);
  assert.doesNotMatch(app, /bindTicker\(|pickLatestCrown\(/);
  assert.match(app, /renderTradeDraft\(/);
  assert.doesNotMatch(app, /value-pick-board/);
  assert.doesNotMatch(app, /renderValueCalcPickBoard/);
  assert.match(app, /Add player or pick, like \$\{nextRookieDraftSeason\(\)\} early 1st/);
  assert.match(app, /listValueCalcAssets/);
  assert.doesNotMatch(readDocs("styles.css"), /value-pick-board/);
  assert.match(app, /function goLeagueHome/);
  assert.doesNotMatch(app, /from "\.\/modules\/recap/);
  assert.doesNotMatch(readDocs("styles.css"), /--ticker-duration|\.ticker-track/);
  assert.match(app, /shouldOpen = Boolean\(open\) && isPhoneLayout\(\)/);
  assert.doesNotMatch(app, /shouldOpen = Boolean\(open\) && isPhoneLayout\(\) && Boolean\(state\.leagueId\)/);
  assert.match(readDocs("index.html"), /id="phone-desk"/);

  const terms = readDocs("terms.html");
  assert.match(terms, /theme-color" content="#0c0c0e"/);
  assert.match(terms, /brand\/wordmark-on-dark\.svg/);
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

  assert.match(readDocs("modules/state.js"), /export const DEFAULT_THEME = "dark"/);
  assert.match(readDocs("modules/state.js"), /export const THEME_COLOR = "#0c0c0e"/);
  assert.doesNotMatch(readDocs("modules/state.js"), /THEME_STORAGE_KEY|light:\s*"#f6f1e8"/);
  assert.doesNotMatch(readDocs("app.js"), /applyTheme|readStoredTheme|THEME_STORAGE_KEY/);
  assert.doesNotMatch(readDocs("styles.css"), /data-theme="light"|:root\[data-theme="dark"\]/);
  assert.match(readDocs("site.webmanifest"), /"theme_color": "#0c0c0e"/);
  assert.match(readDocs("styles.css"), /burgundy ink/);
  assert.match(readDocs("styles.css"), /Phone landing: search first/);
  assert.match(readDocs("styles.css"), /Phone desk nav: /);

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

test("dead storage notice CSS and the sticky cta id rules are gone", () => {
  const css = readDocs("styles.css");
  assert.doesNotMatch(css, /\.storage-notice/);
  assert.doesNotMatch(css, /#sticky-mobile-cta/);
  assert.match(readDocs("styles.css"), /\.sticky-mobile-cta\s*\{[^}]*display:\s*none/s);
});

test("side rail is fixed so the page cannot scroll a blank screen past the last card", () => {
  const css = readDocs("styles.css");
  assert.match(css, /\.control-rail \{[^}]*position:\s*fixed/s);
  assert.match(css, /\.workspace \{[^}]*grid-column:\s*2/s);
  assert.match(css, /\.workspace \{\s*grid-column:\s*auto/s);
  assert.doesNotMatch(css, /^\.control-rail \{[^}]*position:\s*sticky/m);
});

test("phone scrolling stays put while the URL bar moves", () => {
  const css = readDocs("styles.css");
  const phone = css.slice(css.indexOf("Phone only."));
  assert.match(phone, /scroll-behavior:\s*auto/);
  assert.match(phone, /\.app-frame \{[^}]*min-height:\s*100svh/s);
  assert.doesNotMatch(phone, /100dvh/);
  assert.match(phone, /\.control-rail \{[^}]*height:\s*0/s);
  assert.match(phone, /\.control-rail \{[^}]*backdrop-filter:\s*none/s);
  assert.match(phone, /\.mobile-chrome \{[^}]*backdrop-filter:\s*none/s);
  assert.match(phone, /\.workspace-tabs \{[^}]*display:\s*none/s);
  assert.doesNotMatch(readDocs("app.js"), /scrollIntoView\(\{ inline: "center"/);
});

test("phone menu is a flat list of the three tabs in the side board", () => {
  const css = readDocs("styles.css");
  assert.doesNotMatch(css, /page tabs pin to the bottom edge/);
  assert.doesNotMatch(css, /Phone desk nav: page tabs sit in a fixed ink dock/);
  assert.doesNotMatch(css, /\.workspace-tabs \{[^}]*position:\s*fixed/s);
  assert.match(css, /\.phone-desk \{[^}]*display:\s*grid/s);
  assert.match(readDocs("app.js"), /data-phone-room="\$\{escapeHtml\(tab\.room\)\}" data-page="\$\{escapeHtml\(tab\.page\)\}"/);
  assert.doesNotMatch(readDocs("app.js"), /data-phone-page=/);
  assert.doesNotMatch(css, /\.asset-row-top \{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.asset-row-top \{[^}]*flex-direction:\s*row/s);
});

test("wide board can shut so the page fills the screen", () => {
  const css = readDocs("styles.css");
  const app = readDocs("app.js");
  const index = readDocs("index.html");
  assert.match(index, /id="desk-board-close"/);
  assert.match(index, /id="desk-board-open"/);
  assert.match(index, /id="board-tools"/);
  assert.match(readDocs("desk-shut.js"), /dynasty_ticker_board/);
  assert.match(index, /src="\.\/desk-shut\.js"/);
  assert.doesNotMatch(index, /<script>\s*try/);
  assert.match(app, /dynasty_ticker_board/);
  assert.match(app, /renderRanksToolbar/);
  assert.match(css, /html\.desk-shut \.workspace \{[^}]*grid-column:\s*1/s);
  assert.match(css, /html\.desk-shut \.control-rail \{[^}]*display:\s*none !important/s);
  assert.match(css, /Wide board shuts so the page fills the screen/);
  assert.match(index, /id="mobile-rail-close"[^>]*tabindex="-1"/);
  const deskShut = app.slice(app.indexOf("function setDeskBoardShut"), app.indexOf("function setMobileRailOpen"));
  assert.match(deskShut, /deskBoardClose\?\.setAttribute\("tabindex", "-1"\)/);
  assert.match(deskShut, /deskBoardClose\?\.removeAttribute\("tabindex"\)/);
  const rail = app.slice(app.indexOf("function setMobileRailOpen"), app.indexOf("function scrollChildIntoStrip"));
  assert.match(rail, /mobileRailClose\?\.setAttribute\("tabindex", "-1"\)/);
  assert.match(rail, /mobileRailClose\?\.removeAttribute\("tabindex"\)/);
});

test("each desk page is its own file and boot mounts them before the app", () => {
  const index = readDocs("index.html");
  const boot = readDocs("boot.js");
  assert.match(index, /id="ui-pages"/);
  assert.match(index, /src="\.\/boot\.js"/);
  assert.doesNotMatch(index, /id="players-page"/);
  assert.doesNotMatch(index, /id="trades-page"/);
  assert.doesNotMatch(index, /id="league-page"/);
  for (const file of ["landing.html", "trades.html", "league.html"]) {
    assert.match(boot, new RegExp(`\\./ui/${file.replace(".", "\\.")}`));
    assert.equal(existsSync(join(docs, "ui", file)), true);
  }
  assert.match(boot, /await import\("\.\/app\.js"\)/);
  assert.match(boot, /showBootError/);
  assert.match(boot, /role="alert"/);
  assert.match(boot, /paintFindLeagueButtons\(document, "loading"\)/);
  assert.doesNotMatch(boot, /player_values/);
  assert.match(readDocs("app.js"), /releaseBootGate\(document\)/);
  assert.match(readDocs("app.js"), /scheduleBootFind\(\(\) => requestFindLeagues\(\)\)/);
  assert.match(readDocs("app.js"), /applyBootFieldValue/);
  assert.match(index, /src="\.\/boot-intent\.js"/);
  assert.ok(index.indexOf('src="./boot-intent.js"') < index.indexOf('src="./boot.js"'));
  assert.match(index, /id="find-leagues-btn"[^>]*aria-disabled="true"[^>]*aria-busy="true"/);
  assert.match(index, /id="sticky-find-btn"[^>]*aria-disabled="true"[^>]*aria-busy="true"/);
  assert.doesNotMatch(index, /id="find-leagues-btn"[^>]*\sdisabled[\s=]/);
  assert.doesNotMatch(index, /id="sticky-find-btn"[^>]*\sdisabled[\s=]/);
  assert.match(readDocs("ui/landing.html"), /id="landing-find-btn"[^>]*aria-disabled="true"[^>]*aria-busy="true"/);
  assert.doesNotMatch(readDocs("ui/landing.html"), /id="landing-find-btn"[^>]*\sdisabled[\s=]/);
  assert.match(readDocs("ui/league.html"), /data-action="find-my-leagues"[^>]*aria-busy="true"/);
  assert.doesNotMatch(readDocs("ui/league.html"), /data-action="find-my-leagues"[^>]*\sdisabled[\s=]/);
  assert.doesNotMatch(index, /id="sleeper-username"[^>]*disabled/);
  assert.doesNotMatch(readDocs("ui/landing.html"), /id="landing-username"[^>]*disabled/);
  assert.match(index, /class="skip-link"/);
  assert.doesNotMatch(siteMarkup(), /id="landing-rather"/);
  assert.equal(existsSync(join(docs, "ui", "players.html")), false);
  assert.doesNotMatch(siteMarkup(), /Who would you rather have\?/);
  assert.match(siteMarkup(), /id="calculator-shell"/);
  assert.doesNotMatch(siteMarkup(), /id="weekly-help-btn"/);
});

test("the site never names KeepTradeCut", () => {
  const namesBrand = (text) => /KeepTradeCut|keeptradecut|keep trade cut/i.test(text) || /\bKTC\b/.test(text);
  const hits = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(html|js|css|svg|md|txt)$/i.test(entry.name)) continue;
      if (namesBrand(readFileSync(path, "utf8"))) hits.push(path.slice(docs.length + 1));
    }
  }
  walk(docs);
  for (const name of ["README.md", "AGENTS.md"]) {
    const path = join(docs, "..", name);
    if (namesBrand(readFileSync(path, "utf8"))) hits.push(name);
  }
  assert.deepEqual(hits, []);
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

test("user-facing copy says players and picks, not assets", () => {
  const app = readDocs("app.js");
  const voice = readDocs("modules/sample-voice.js");
  assert.match(readDocs("modules/html.js"), /1 player or pick/);
  assert.match(readDocs("modules/html.js"), /players & picks/);
  assert.match(voice, /No matching players & picks found on \$\{poss\} roster/);
  assert.doesNotMatch(app, /tap assets|traded assets|assets moved|matching assets|own assets|included assets|fewer assets|headline assets|high-value assets/);
  assert.doesNotMatch(voice, /assets/);
});
