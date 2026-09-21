import test from "node:test";
import assert from "node:assert/strict";
import {
  facePlayerId,
  playerInitials,
  renderPlayerFace,
  renderPlayerLabel,
  sleeperPlayerThumbUrl,
} from "../docs/modules/player-face.js";

test("player faces use Sleeper thumbs and fall back to initials", () => {
  assert.equal(sleeperPlayerThumbUrl("11564"), "https://sleepercdn.com/content/nfl/players/thumb/11564.jpg");
  assert.equal(sleeperPlayerThumbUrl(""), "");
  assert.equal(playerInitials("Ja'Marr Chase"), "JC");
  assert.equal(renderPlayerFace("", "Ja'Marr Chase"), "");
  assert.equal(renderPlayerFace("0", "Nobody"), "");

  const face = renderPlayerFace("11564", "Ja'Marr Chase", { size: "sm" });
  assert.match(face, /player-face-sm/);
  assert.match(face, /player-face-photo/);
  assert.match(face, /11564\.jpg/);
  assert.match(face, /player-face-initials">JC</);
  assert.match(face, /aria-hidden="true"/);

  const label = renderPlayerLabel("<b>Bad</b>", "9", { tag: "strong" });
  assert.match(label, /^<strong class="player-name">/);
  assert.match(label, /&lt;b&gt;Bad&lt;\/b&gt;/);
  assert.doesNotMatch(label, /<b>/);
  assert.equal(renderPlayerLabel("2027 1st", "", { tag: "strong" }), "<strong>2027 1st</strong>");
});

test("faces attach to players and skip picks", () => {
  assert.equal(facePlayerId({ assetId: "player:44", assetType: "player" }), "44");
  assert.equal(facePlayerId({ playerId: "player:44" }), "44");
  assert.equal(facePlayerId({ assetId: "pick:2027:r1:any", assetType: "pick", playerId: "44" }), "");
  assert.equal(facePlayerId("player:12"), "12");
  assert.equal(facePlayerId("0"), "");
});
