import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

test("stop-slop skill walks concept, three directions, phone size, and a scan", () => {
  const skill = readFileSync(join(root, ".cursor/skills/stop-slop/SKILL.md"), "utf8");
  assert.match(skill, /Concept/);
  assert.match(skill, /Three directions/);
  assert.match(skill, /390×844/);
  assert.match(skill, /Slop scan/);
  assert.match(skill, /Critique/);
  assert.match(skill, /claim slip/);
  assert.match(skill, /design\/stop-slop\/index\.html/);
});

test("claim-slip demo stays off the live site and off the slop list", () => {
  const html = readFileSync(join(root, "design/stop-slop/index.html"), "utf8");
  assert.match(html, /390/);
  assert.match(html, /844/);
  assert.match(html, /claim slip/i);
  assert.match(html, /Film room/);
  assert.match(html, /Game program/);
  assert.match(html, /id="find-btn"/);
  assert.match(html, /id="sweetener"/);
  assert.doesNotMatch(html, /Inter/);
  assert.doesNotMatch(html, /Plus Jakarta/);
  assert.doesNotMatch(html, /linear-gradient/);
  assert.doesNotMatch(html, /backdrop-filter/);
  assert.doesNotMatch(html, /border-radius:\s*16px/);
  assert.doesNotMatch(html, /dynasty[\s._-]*desk/i);
});
