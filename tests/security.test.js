import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_SECURITY_POLICY, META_CONTENT_SECURITY_POLICY } from "../docs/modules/csp.js";
import { sleeperAvatarUrl } from "../docs/modules/sleeper.js";
import { escapeHtml } from "../docs/modules/html.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("sleeper avatar urls stay on the sleeper cdn and cannot break an attribute", () => {
  assert.equal(
    sleeperAvatarUrl("abcDEF_12-3"),
    "https://sleepercdn.com/avatars/thumbs/abcDEF_12-3",
  );
  assert.equal(
    sleeperAvatarUrl("https://sleepercdn.com/avatars/thumbs/abc.jpg"),
    "https://sleepercdn.com/avatars/thumbs/abc.jpg",
  );
  for (const bad of [
    "",
    "abc\" onerror=\"alert(1)",
    "javascript:alert(1)",
    "https://evil.example/a.jpg",
    "http://sleepercdn.com/avatars/thumbs/abc",
    "https://sleepercdn.com/content/nfl/players/thumb/1.jpg",
    "../avatars/thumbs/abc",
    "abc def",
  ]) {
    assert.equal(sleeperAvatarUrl(bad), "", bad);
  }
  const markup = `<img src="${escapeHtml(sleeperAvatarUrl("abc\"><script>"))}" alt="">`;
  assert.doesNotMatch(markup, /<script>/);
});

test("pages and netlify share one script-locked content security policy", () => {
  assert.match(CONTENT_SECURITY_POLICY, /script-src 'self'/);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.doesNotMatch(META_CONTENT_SECURITY_POLICY, /frame-ancestors/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-eval/);
  assert.match(CONTENT_SECURITY_POLICY, /connect-src 'self' https:\/\/api\.sleeper\.app/);
  assert.match(CONTENT_SECURITY_POLICY, /img-src 'self' https:\/\/sleepercdn\.com/);
  for (const file of ["docs/index.html", "docs/privacy.html", "docs/terms.html", "docs/404.html"]) {
    assert.ok(read(file).includes(`content="${META_CONTENT_SECURITY_POLICY}"`), file);
    assert.equal(read(file).includes("frame-ancestors"), false, file);
  }
  const netlify = read("netlify.toml");
  assert.ok(netlify.includes(`Content-Security-Policy = "${CONTENT_SECURITY_POLICY}"`));
  assert.match(netlify, /X-Content-Type-Options = "nosniff"/);
  assert.match(netlify, /X-Frame-Options = "DENY"/);
});

test("the desk boot script is a file, not an inline script", () => {
  const index = read("docs/index.html");
  assert.match(index, /<script src="\.\/desk-boot\.js"><\/script>/);
  const scripts = index.match(/<script\b[^>]*>/g) || [];
  assert.ok(scripts.length >= 2);
  assert.ok(scripts.every((tag) => /\ssrc=/.test(tag)));
  assert.match(read("docs/desk-boot.js"), /dynasty_ticker_board/);
});

test("sleeper names, badges, and avatar src are escaped before innerHTML", () => {
  const app = read("docs/app.js");
  assert.match(app, /escapeHtml\(profile\.managerName\)/);
  assert.match(app, /escapeHtml\(badge\)/);
  assert.match(app, /escapeHtml\(sleeperAvatarUrl\(manager\?\.avatar\)\)|const src = sleeperAvatarUrl\(manager\?\.avatar\)/);
  assert.match(app, /escapeHtml\(src\)/);
  assert.match(app, /const leagueAvatarSrc = sleeperAvatarUrl\(league\.avatar\)/);
  assert.match(app, /escapeHtml\(leagueAvatarSrc\)/);
  assert.match(app, /escapeHtml\(participant\.roster\.manager\.displayName\)/);
  assert.match(app, /escapeHtml\(idea\.counterpartyName\)/);
  assert.match(app, /escapeHtml\(row\.name\)/);
  assert.match(app, /escapeHtml\(contextLabel\)/);
  assert.doesNotMatch(app, /img src="\$\{avatarUrl/);
  assert.doesNotMatch(app, /<h3>\$\{profile\.managerName\}<\/h3>/);
  assert.doesNotMatch(app, /<h4>\$\{isMe \? "You" : participant\.roster\.manager\.displayName\}<\/h4>/);
});
