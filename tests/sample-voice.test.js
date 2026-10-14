import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sampleRosterLabels } from "../docs/modules/sample-voice.js";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

test("sample mode drops first-person roster copy", () => {
  assert.equal(sampleRosterLabels({ viewingSample: false, ownerName: "Ada" }), null);
  const named = sampleRosterLabels({ viewingSample: true, ownerName: "Ada" });
  assert.equal(named.roster, "Ada's roster");
  assert.equal(named.oneOfMine, "One of Ada's");
  assert.equal(named.shopOption, "Shop a player or pick Ada owns");
  assert.equal(named.youGive, "Ada");
  assert.equal(named.heatOnRoster, "is on Ada's roster");
  assert.equal(named.teamTab, "Ada");
  const anon = sampleRosterLabels({ viewingSample: true, ownerName: "  " });
  assert.equal(anon.roster, "This team's roster");
  assert.equal(anon.oneOfMine, "One of theirs");
  assert.equal(anon.shopOption, "Shop a player or pick this team owns");
  assert.equal(anon.youGive, "This team");
  assert.equal(anon.heatOnRoster, "is on this team's roster");
  assert.equal(anon.teamTab, "This team");
  assert.doesNotMatch(`${named.roster} ${named.oneOfMine} ${named.shopOption} ${named.youGive} ${named.heatOnRoster} ${named.teamTab}`, /Your roster|One of mine|I own|You give|your roster|My team/);
});

test("sample labels are what the desk renders", () => {
  assert.match(app, /function syncSampleTradeCopy/);
  assert.match(app, /sampleVoice\(\)\?\.heatOnRoster \|\| "is on your roster"/);
  assert.match(app, /sampleVoice\(\)\?\.roster \|\| "Your roster"/);
  assert.match(app, /voice && page === "league" && room === HOME_ROOM/);
});
