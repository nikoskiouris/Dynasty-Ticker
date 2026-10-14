import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sleeperAvatarUrl } from "../docs/modules/sleeper.js";
import { renderPlayerFace, sleeperPlayerThumbUrl } from "../docs/modules/player-face.js";
import { renderLeaguePickerMarkup } from "../docs/modules/league-search.js";
import { renderRatherMarkup } from "../docs/modules/rather.js";
import { renderRanksBody } from "../docs/modules/ranks.js";
import {
  renderAvatar,
  renderMultiTeamPartyTitle,
  renderPowerHero,
  renderPowerStat,
  renderSleeperInsight,
} from "../docs/modules/roster-markup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVIL = "<img onerror=alert(1)>";
const ESCAPED = "&lt;img onerror=alert(1)&gt;";

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function assertStaysText(html) {
  assert.match(html, /&lt;img onerror=alert\(1\)&gt;/);
  const tags = html.replaceAll("&lt;", "‹").replaceAll("&gt;", "›");
  assert.doesNotMatch(tags, /<\s*img\b[^‹›]*\bonerror\s*=/i);
  assert.doesNotMatch(tags, /<\s*script\b/i);
}

test("malicious Sleeper display names stay text in power, insight, and multi-team markup", () => {
  const hero = renderPowerHero({
    score: 88,
    managerName: EVIL,
    grade: "A",
    tierClass: "elite",
    badges: [`${EVIL} Stack`],
  });
  const insight = renderSleeperInsight({
    title: "Draft Ammo",
    body: `1 first-round pick in the vault, led by ${EVIL}.`,
    tone: "gold",
  });
  const stat = renderPowerStat("Pick owner", EVIL);
  const party = `<h4>${renderMultiTeamPartyTitle(EVIL, false)}</h4>`;
  for (const html of [hero, insight, stat, party]) assertStaysText(html);
  assert.equal(renderMultiTeamPartyTitle(EVIL, true), "You");
  assert.doesNotMatch(hero, /<\s*img\b/i);
  assert.doesNotMatch(insight, /<\s*img\b/i);
});

test("avatar ids cannot break out of the img tag and foreign hosts are dropped", () => {
  const named = renderAvatar({ displayName: EVIL, avatar: "abc123" });
  assertStaysText(named);
  assert.match(named, /src="https:\/\/sleepercdn\.com\/avatars\/thumbs\/abc123"/);
  assert.equal([...named.matchAll(/<img\b/gi)].length, 1);

  const breakout = renderAvatar({ displayName: "Niko", avatar: `"><img onerror=alert(1)>` });
  assert.doesNotMatch(breakout, /<img\b/i);
  assert.match(breakout, />N</);

  const foreign = renderAvatar({ displayName: EVIL, avatar: "https://evil.example/x.png" });
  assert.doesNotMatch(foreign, /<img\b/i);
  assert.match(foreign, />&lt;</);
  assert.doesNotMatch(foreign, /onerror/);
});

test("sleeperAvatarUrl allowlists sleepercdn and bare avatar ids", () => {
  assert.equal(sleeperAvatarUrl(""), "");
  assert.equal(sleeperAvatarUrl("abc_123"), "https://sleepercdn.com/avatars/thumbs/abc_123");
  assert.equal(
    sleeperAvatarUrl("https://sleepercdn.com/avatars/thumbs/abc"),
    "https://sleepercdn.com/avatars/thumbs/abc"
  );
  assert.equal(
    sleeperAvatarUrl("http://sleepercdn.com/avatars/thumbs/abc"),
    "https://sleepercdn.com/avatars/thumbs/abc"
  );
  assert.equal(sleeperAvatarUrl("//cdn.sleepercdn.com/avatars/thumbs/abc"), "https://cdn.sleepercdn.com/avatars/thumbs/abc");
  assert.equal(sleeperAvatarUrl("https://evil.example/x.png"), "");
  assert.equal(sleeperAvatarUrl("http://evil.example/x.png"), "");
  assert.equal(sleeperAvatarUrl("javascript:alert(1)"), "");
  assert.equal(sleeperAvatarUrl("data:text/html,hi"), "");
  assert.equal(sleeperAvatarUrl("https://sleepercdn.com.evil.example/x"), "");
  assert.equal(sleeperAvatarUrl("https://user:pass@sleepercdn.com/avatars/thumbs/abc"), "");
  assert.equal(sleeperAvatarUrl(`"><img onerror=alert(1)>`), "");
});

test("content security policy blocks inline script and frames", () => {
  const policy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://sleepercdn.com https://*.sleepercdn.com; connect-src 'self' https://api.sleeper.app https://fonts.googleapis.com https://fonts.gstatic.com; form-action 'self'; frame-src 'none'";
  const toml = read("netlify.toml");
  assert.match(toml, /\[\[headers\]\]/);
  assert.match(toml, new RegExp(policy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(toml, /X-Content-Type-Options = "nosniff"/);
  assert.match(toml, /for = "\/data\/\*"/);
  assert.match(toml, /Cache-Control = "public, max-age=0, must-revalidate"/);
  assert.doesNotMatch(toml, /Content-Encoding/);
  assert.match(toml, /frame-ancestors 'none'/);
  assert.match(toml, /base-uri 'self'/);
  assert.match(toml, /object-src 'none'/);
  assert.match(toml, /script-src 'self'/);
  assert.doesNotMatch(toml, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(toml, /script-src 'unsafe-inline'/);
  for (const file of ["docs/index.html", "docs/404.html", "docs/privacy.html", "docs/terms.html"]) {
    assert.match(read(file), new RegExp(policy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const index = read("docs/index.html");
  assert.match(index, /src="\.\/desk-shut\.js"/);
  assert.match(index, /type="module" src="\.\/boot\.js"/);
  assert.doesNotMatch(index, /<script>\s*try/);
});

test("Sleeper names, ids, and avatars stay text in league, rather, and rank markup", () => {
  const evilId = `1"><img onerror=alert(1)>`;
  const picker = renderLeaguePickerMarkup([{
    league_id: evilId,
    name: EVIL,
    season: EVIL,
    status: `${EVIL}_open`,
    avatar: `https://evil.example/x.png"><img onerror=alert(1)>`,
    total_rosters: 12,
    settings: { type: 2 },
  }], "2026", evilId);
  assertStaysText(picker);
  assert.doesNotMatch(picker, /evil\.example/);
  assert.doesNotMatch(picker, /<img\b/i);

  const thumb = sleeperPlayerThumbUrl("11566");
  const rather = renderRatherMarkup({
    left: {
      name: EVIL,
      meta: EVIL,
      detail: EVIL,
      photoUrl: thumb,
      assetId: "player:11566",
      initials: "EV",
    },
    right: {
      name: "Safe",
      photoUrl: "javascript:alert(1)",
      assetId: "player:2",
    },
  }, "sf", { status: EVIL, matchup: `${EVIL} vs Safe` });
  assertStaysText(rather);
  assert.match(rather, /src="https:\/\/sleepercdn\.com\/content\/nfl\/players\/thumb\/11566\.jpg"/);
  assert.equal([...rather.matchAll(/<img\b/gi)].length, 1);
  assert.doesNotMatch(rather, /javascript:/i);

  const foreignPhoto = renderRatherMarkup({
    left: { name: "A", photoUrl: "https://evil.example/a.png", assetId: "player:a" },
    right: { name: "B", photoUrl: `"><img onerror=alert(1)>`, assetId: "player:b" },
  });
  assert.doesNotMatch(foreignPhoto, /<img\b/i);
  assert.doesNotMatch(foreignPhoto, /evil\.example/);
  assert.doesNotMatch(foreignPhoto, /onerror/i);

  const ranks = renderRanksBody({
    card: {
      kind: "player",
      assetId: evilId,
      playerId: evilId,
      name: EVIL,
      photoUrl: "https://evil.example/face.png",
      value: 10,
      initials: "<",
      note: EVIL,
      owner: { name: EVIL, mine: false },
    },
    rows: [{
      kind: "player",
      assetId: evilId,
      playerId: "99",
      name: EVIL,
      value: 10,
      owner: { mine: false, name: EVIL },
    }],
  });
  assertStaysText(ranks);
  assert.doesNotMatch(ranks, /evil\.example/);
  assert.match(ranks, /data-asset-id="1&quot;&gt;&lt;img onerror=alert\(1\)&gt;"/);

  const face = renderPlayerFace(evilId, EVIL);
  assert.match(face, /%3Cimg%20onerror/);
  assert.doesNotMatch(face, /<\s*img\b[^>]*\bonerror\s*=/i);
  assert.match(face, /&lt;O/);
});

test("roster ids in desk markup cannot break out of attributes", () => {
  const app = read("docs/app.js");
  assert.doesNotMatch(app, /data-roster-id="\$\{(?!escapeHtml\()/);
  assert.doesNotMatch(app, /<option value="\$\{(?!escapeHtml\()/);
  assert.doesNotMatch(read("docs/modules/rather.js"), /escapeHtml\(player\.photoUrl\)/);
  assert.doesNotMatch(read("docs/modules/ranks.js"), /escapeHtml\(row\.photoUrl\)/);
});

test("docs pages have no inline handlers, inline scripts, eval, or third-party scripts", () => {
  const pages = [];
  const scripts = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (name.endsWith(".html")) pages.push(path);
      if (name.endsWith(".js")) scripts.push(path);
    }
  }
  walk(join(root, "docs"));
  assert.ok(pages.some((path) => path.endsWith(`${join("docs", "index.html")}`)));
  assert.ok(pages.some((path) => path.endsWith("404.html")));
  assert.ok(pages.some((path) => path.endsWith("privacy.html")));
  assert.ok(pages.some((path) => path.endsWith("terms.html")));
  for (const path of pages) {
    const html = readFileSync(path, "utf8");
    const label = relative(root, path);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, label);
    assert.doesNotMatch(html, /javascript:/i, label);
    assert.doesNotMatch(html, /<iframe\b|<object\b|<embed\b/i, label);
    const tags = [...html.matchAll(/<script\b([^>]*)>/gi)];
    assert.ok(tags.length === 0 || label === "docs/index.html", label);
    for (const tag of tags) {
      const src = tag[1].match(/\ssrc\s*=\s*["']([^"']+)["']/i);
      assert.ok(src, `${label} script needs a src`);
      assert.match(src[1], /^\.\//, src[1]);
      assert.doesNotMatch(src[1], /^https?:/i);
    }
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc\s*=)[^>]*>/i, label);
    for (const sheet of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)) {
      const href = sheet[0].match(/\bhref=["']([^"']+)["']/i);
      assert.ok(href, label);
      assert.match(href[1], /^(?:\.\/|https:\/\/fonts\.googleapis\.com\/)/, `${label} ${href[1]}`);
    }
  }
  for (const path of scripts) {
    const src = readFileSync(path, "utf8");
    assert.doesNotMatch(src, /\beval\s*\(/, relative(root, path));
    assert.doesNotMatch(src, /new Function\s*\(/, relative(root, path));
    assert.doesNotMatch(src, /import\s+["']https?:/i, relative(root, path));
  }
});
