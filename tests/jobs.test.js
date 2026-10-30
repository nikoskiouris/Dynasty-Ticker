import test from "node:test";
import assert from "node:assert/strict";
import { siteMarkup } from "./site-markup.js";
import {
  DEFAULT_LANDING_HINT,
  DESK_JOBS,
  DESK_MORE_JOBS,
  jobById,
  landingSearchHint,
  renderJobButton,
} from "../docs/modules/jobs.js";

test("desk jobs map to real rooms and stay unique", () => {
  const ids = new Set();
  for (const job of [...DESK_JOBS, ...DESK_MORE_JOBS]) {
    assert.equal(ids.has(job.id), false, job.id);
    ids.add(job.id);
    assert.ok(job.page);
    assert.ok(job.room);
    assert.ok(job.label);
    assert.ok(job.blurb);
  }
  assert.equal(DESK_JOBS.length, 3);
  assert.equal(jobById("players"), null);
  assert.equal(jobById("trade")?.room, "calculator");
  assert.equal(jobById("team")?.page, "league");
  assert.equal(jobById("find")?.page, "trades");
  assert.equal(jobById("missing"), null);
  assert.equal(jobById("lab", { includeMore: false }), null);
});

test("landing hint names the chosen job", () => {
  assert.equal(landingSearchHint(null), DEFAULT_LANDING_HINT);
  assert.match(landingSearchHint(jobById("find")), /find a trade/);
  assert.match(landingSearchHint(jobById("trade")), /check a trade/);
});

test("job buttons deep-link into rooms", () => {
  const html = renderJobButton(jobById("trade"), { action: "go", selectedId: "trade" });
  assert.match(html, /data-action="go"/);
  assert.match(html, /desk-job active[^>]*data-job="trade"[^>]*data-page="trades"[^>]*data-room="calculator"/);
  assert.match(renderJobButton(jobById("find")), /data-page="trades"[^>]*data-room="find"/);
  assert.equal(renderJobButton(null), "");
});

test("landing HTML leads with the username and skips the job quiz", () => {
  const index = siteMarkup();
  assert.doesNotMatch(index, /See a value\. Check a trade\. Then your team\./);
  assert.doesNotMatch(index, />What do you want to do\?</);
  assert.doesNotMatch(index, /id="landing-jobs"/);
  assert.match(index, /id="landing-job-hint"/);
  assert.match(index, /id="landing-league-picker"/);
  assert.match(index, /id="start-dashboard"/);
  assert.match(index, /data-room-panel="team"/);
  assert.match(index, /data-page="trades" data-room="find"/);
  assert.doesNotMatch(index, /Got an offer\?/);
  assert.doesNotMatch(index, /id="landing-features"/);
});
