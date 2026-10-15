import test from "node:test";
import assert from "node:assert/strict";
import { classifyRequest } from "../scripts/serve_site.mjs";

test("spa rewrite serves index for desk routes and 404 for a missing asset", () => {
  const player = classifyRequest("/player/9221");
  assert.equal(player.status, 200);
  assert.match(player.file, /index\.html$/);

  const asset = classifyRequest("/app.js");
  assert.equal(asset.status, 200);
  assert.match(asset.file, /app\.js$/);

  const missing = classifyRequest("/does-not-exist.js");
  assert.equal(missing.status, 404);
  assert.match(missing.file, /404\.html$/);
  assert.doesNotMatch(missing.file, /index\.html$/);

  assert.equal(classifyRequest("/api/rather-vote").status, 404);
  assert.match(classifyRequest("/api/rather-vote").file, /404\.html$/);
  assert.equal(classifyRequest("/.netlify/functions/rather-vote").status, 404);
  assert.equal(classifyRequest("/%").status, 400);
  assert.equal(classifyRequest("/favicon.ico").status, 200);
  assert.match(classifyRequest("/favicon.ico").file, /favicon\.ico$/);
  assert.equal(classifyRequest("/site.webmanifest").status, 200);
  assert.equal(classifyRequest("/robots.txt").status, 200);
});
