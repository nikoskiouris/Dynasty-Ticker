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
  assert.equal(jobById("week")?.room, "scores");
  assert.equal(jobById("trade")?.room, "value");
  assert.equal(jobById("match")?.page, "trades");
  assert.equal(jobById("missing"), null);
  assert.equal(jobById("lab", { includeMore: false }), null);
});

test("landing hint names the chosen job", () => {
  assert.equal(landingSearchHint(null), DEFAULT_LANDING_HINT);
  assert.match(landingSearchHint(jobById("week")), /this week's scores/);
  assert.match(landingSearchHint(jobById("trade")), /make a trade/);
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
  assert.match(html, /data-job="week"[^>]*data-page="league"[^>]*data-room="scores"/);
  assert.match(html, /desk-job active[^>]*data-job="trade"/);
  assert.match(html, /Or jump to a tool/);
  assert.match(html, /Find a partner/);
  assert.match(html, /Tank or contend/);
  assert.match(html, /Rookie mock/);
  assert.equal(renderJobButton(null), "");
});

test("redraft desk jobs drop mock and rename the call", () => {
  const { jobs, more } = deskJobsForLeague({ settings: { type: 0 } });
  assert.equal(jobs.find((job) => job.id === "team")?.blurb, "Sit/start, in it or out");
  assert.equal(more.find((job) => job.id === "call")?.label, "In it or out");
  assert.equal(more.some((job) => job.id === "mock"), false);
  assert.equal(more.some((job) => job.id === "call"), true);
  const dynasty = deskJobsForLeague({ settings: { type: 2 } });
  assert.equal(dynasty.more.some((job) => job.id === "mock"), true);
});

test("landing HTML asks the job question and lists the four jobs", () => {
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.match(index, />What do you want to do\?</);
  assert.match(index, /id="landing-jobs"/);
  assert.match(index, /id="landing-job-hint"/);
  assert.match(index, /id="landing-league-picker"/);
  assert.match(index, /id="start-dashboard"/);
  assert.match(index, /data-room-panel="start"/);
  for (const job of DESK_JOBS) {
    assert.match(index, new RegExp(`data-job="${job.id}"`));
    assert.match(index, new RegExp(job.label.replaceAll("?", "\\?")));
  }
  assert.doesNotMatch(index, /id="landing-features"/);
});
