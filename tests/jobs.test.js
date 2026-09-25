import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANDING_HINT,
  DESK_JOBS,
  DESK_MORE_JOBS,
  jobById,
  deskJobsForLeague,
  landingSearchHint,
  renderDeskJobsMarkup,
  renderJobButton,
} from "../docs/modules/jobs.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

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
  assert.equal(DESK_JOBS.length, 4);
  assert.equal(jobById("players")?.room, "ranks");
  assert.equal(jobById("trade")?.room, "calculator");
  assert.equal(jobById("find")?.page, "trades");
  assert.equal(jobById("missing"), null);
  assert.equal(jobById("lab", { includeMore: false }), null);
});

test("landing hint names the chosen job", () => {
  assert.equal(landingSearchHint(null), DEFAULT_LANDING_HINT);
  assert.match(landingSearchHint(jobById("players")), /look up a player/);
  assert.match(landingSearchHint(jobById("trade")), /check a trade/);
});

test("job markup is buttons that deep-link into rooms", () => {
  const html = renderDeskJobsMarkup({
    heading: "What do you want to do?",
    hint: "Pick a job.",
    more: true,
    action: "go",
    selectedId: "trade",
  });
  assert.match(html, /What do you want to do\?/);
  assert.match(html, /data-action="go"/);
  assert.match(html, /data-job="players"[^>]*data-page="players"[^>]*data-room="ranks"/);
  assert.match(html, /desk-job active[^>]*data-job="trade"/);
  assert.match(html, /Or jump to a tool/);
  assert.match(html, /This week/);
  assert.match(html, /History/);
  assert.equal(renderJobButton(null), "");
});

test("redraft desk jobs drop mock and rename the call", () => {
  const { jobs, more } = deskJobsForLeague({ settings: { type: 0 } });
  assert.equal(jobs.find((job) => job.id === "team")?.blurb, "This week and your outlook");
  assert.equal(more.some((job) => job.id === "week"), true);
  const dynasty = deskJobsForLeague({ settings: { type: 2 } });
  assert.equal(dynasty.jobs.some((job) => job.id === "team"), true);
});

test("landing HTML leads with the username and skips the job quiz", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.match(index, />See a value\. Check a trade\. Then your team\.</);
  assert.doesNotMatch(index, />What do you want to do\?</);
  assert.doesNotMatch(index, /id="landing-jobs"/);
  assert.match(index, /id="landing-job-hint"/);
  assert.match(index, /id="landing-league-picker"/);
  assert.match(index, /id="start-dashboard"/);
  assert.match(index, /data-room-panel="team"/);
  assert.match(index, /Check an offer or find a deal/);
  assert.doesNotMatch(index, /Got an offer\?/);
  assert.doesNotMatch(index, /id="landing-features"/);
});
