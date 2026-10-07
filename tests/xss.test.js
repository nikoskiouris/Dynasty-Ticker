import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sleeperAvatarUrl } from "../docs/modules/sleeper.js";
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
  const policy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://sleepercdn.com; connect-src 'self' https://api.sleeper.app; form-action 'self'; frame-src 'none'";
  const toml = read("netlify.toml");
  assert.match(toml, /\[\[headers\]\]/);
  assert.match(toml, /X-Content-Type-Options = "nosniff"/);
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
