import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseShareParams } from "../docs/modules/parse.js";
import { CONTENT_SECURITY_POLICY } from "../docs/modules/site.js";
import {
  renderAvatarMarkup,
  renderBadgeRow,
  renderEscapedNameList,
  renderInsightMarkup,
  safeAvatarUrl,
} from "../docs/modules/sleeper-markup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ATTACK = `<img src=x onerror=alert(1)>`;

test("sleeper avatar ids cannot break out of src", () => {
  assert.equal(safeAvatarUrl(`abc"><script>`), "");
  assert.equal(safeAvatarUrl("javascript:alert(1)"), "");
  assert.equal(safeAvatarUrl("../etc/passwd"), "");
  assert.match(safeAvatarUrl("a1b2c3"), /\/a1b2c3$/);
  const html = renderAvatarMarkup({
    displayName: ATTACK,
    avatar: `"><svg onload=alert(1)>`,
  });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /onerror/);
  assert.doesNotMatch(html, /onload/);
  assert.match(html, /&lt;/);
});

test("badges, insights, and name lists escape sleeper text", () => {
  const badges = renderBadgeRow([ATTACK, "QB Edge"]);
  assert.match(badges, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(badges, /<img/);
  const insight = renderInsightMarkup({ title: ATTACK, body: `</span><script>alert(1)</script>`, tone: `blue"><script>` });
  assert.doesNotMatch(insight, /<script>/);
  assert.doesNotMatch(insight, /class="insight-item blue/);
  assert.match(insight, /class="insight-item"/);
  assert.match(insight, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(renderInsightMarkup({ title: "League", body: "Superflex", tone: "blue" }), /class="insight-item blue"/);
  const names = renderEscapedNameList([{ name: ATTACK }], (item) => item.name);
  assert.match(names, /&lt;img/);
  assert.doesNotMatch(names, /<img/);
});

test("share-link fields stay data, not markup", () => {
  const parsed = parseShareParams(`?league=${encodeURIComponent(ATTACK)}&tone=${encodeURIComponent(ATTACK)}&asset=${encodeURIComponent(ATTACK)}&view=ranks&me=1`);
  assert.equal(parsed.asset, "");
  assert.equal(parsed.tone, ATTACK);
  assert.equal(parsed.leagueId, ATTACK);
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(app, /el\.leagueId\.value = fields\.leagueId/);
  assert.match(app, /state\.ranks\.selectedId = parsed\.asset/);
  assert.doesNotMatch(app, /innerHTML[^;\n]*parsed\.(tone|asset|leagueId)/);
  assert.doesNotMatch(app, /innerHTML[^;\n]*fields\.leagueId/);
  assert.match(app, /escapeHtml\(profile\.managerName\)/);
  assert.match(app, /renderInsightMarkup\(insight\)/);
  assert.match(app, /renderAvatarMarkup\(manager/);
  assert.match(app, /safeAvatarUrl\(league\.avatar\)/);
  assert.match(app, /escapeHtml\(idea\.counterpartyName\)/);
  assert.match(app, /escapeHtml\(contextLabel\)/);
});

test("pages ship a script-blocking content security policy", () => {
  const index = readFileSync(join(root, "docs/index.html"), "utf8");
  const netlify = readFileSync(join(root, "netlify.toml"), "utf8");
  assert.ok(index.includes(CONTENT_SECURITY_POLICY));
  assert.ok(netlify.includes(CONTENT_SECURITY_POLICY));
  assert.match(CONTENT_SECURITY_POLICY, /script-src 'self'/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-eval/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /script-src[^;]*unsafe-inline/);
  const scripts = [...index.matchAll(/<script\b([^>]*)>/g)];
  assert.ok(scripts.length >= 1);
  for (const match of scripts) assert.match(match[1], /\ssrc=/);
  assert.match(index, /src="\.\/desk-boot\.js"/);
  const boot = readFileSync(join(root, "docs/desk-boot.js"), "utf8");
  assert.match(boot, /dynasty_ticker_board/);
});
