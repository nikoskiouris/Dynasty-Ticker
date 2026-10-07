import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderLeagueConnectEmpty } from "../docs/modules/empty-league.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("an empty league room offers connect and a player lookup", () => {
  const html = renderLeagueConnectEmpty(`Connect Sleeper to open the scoreboard. <img>`);
  assert.match(html, /Connect Sleeper to open the scoreboard\. &lt;img&gt;/);
  assert.match(html, /data-action="draft-connect"/);
  assert.match(html, /data-action="go"/);
  assert.match(html, /data-page="players"/);
  assert.doesNotMatch(html, /<img>/);
  assert.doesNotMatch(html, /demo league/i);
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(app, /renderLeagueConnectEmpty\(/);
  assert.doesNotMatch(app, /pick a job/);
  assert.doesNotMatch(app, /Load a league to open/);
});
