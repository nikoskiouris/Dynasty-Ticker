import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyBootFieldValue,
  coalesceUsernameFields,
  handleBootIntent,
  keepUsernameFieldsEditable,
  paintFindLeagueButtons,
  queueFindForBoot,
  releaseBootGate,
  resetBootGate,
} from "../docs/modules/boot-gate.js";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function button(id, extra = {}) {
  const attrs = new Map();
  const node = {
    id,
    tagName: "BUTTON",
    textContent: extra.text || "Find my leagues",
    disabled: false,
    dataset: { ...(extra.dataset || {}) },
    style: {},
    setAttribute(name, value) {
      attrs.set(name, value);
      if (name === "data-boot-loading") node.dataset.bootLoading = value;
      if (name === "data-idle-label") node.dataset.idleLabel = value;
    },
    getAttribute(name) {
      return attrs.get(name) || null;
    },
    removeAttribute(name) {
      attrs.delete(name);
      if (name === "data-boot-loading") delete node.dataset.bootLoading;
    },
  };
  return node;
}

function input(id, value) {
  return {
    id,
    value,
    disabled: true,
    readOnly: true,
    removeAttribute() {
      this.disabled = false;
      this.readOnly = false;
    },
  };
}

function rootOf(nodes) {
  return {
    querySelector(selector) {
      const id = String(selector || "").replace("#", "");
      return nodes.find((node) => node.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === "button") return nodes.filter((node) => node.tagName === "BUTTON");
      return [];
    },
  };
}

test("boot leaves a typed username alone and only fills an empty field", () => {
  const typed = input("sleeper-username", "nikos");
  assert.equal(applyBootFieldValue(typed, ""), false);
  assert.equal(typed.value, "nikos");
  assert.equal(applyBootFieldValue(typed, "other"), false);
  assert.equal(typed.value, "nikos");
  const empty = input("league-id", "");
  assert.equal(applyBootFieldValue(empty, ""), false);
  assert.equal(empty.value, "");
  assert.equal(applyBootFieldValue(empty, "1315"), true);
  assert.equal(empty.value, "1315");
});

test("find buttons stay loading and username boxes stay editable until boot ends", () => {
  resetBootGate();
  const find = button("find-leagues-btn", { dataset: { idleLabel: "Find my leagues" } });
  const landing = button("landing-find-btn");
  const sticky = button("sticky-find-btn");
  const banner = button("sample-find", { dataset: { action: "find-my-leagues" }, text: "Find my leagues" });
  const name = input("sleeper-username", "kept");
  const landingName = input("landing-username", "");
  const root = rootOf([find, landing, sticky, banner, name, landingName]);
  paintFindLeagueButtons(root, "loading");
  keepUsernameFieldsEditable(root);
  for (const node of [find, landing, sticky, banner]) {
    assert.equal(node.disabled, true);
    assert.equal(node.getAttribute("aria-disabled"), "true");
    assert.equal(node.getAttribute("aria-busy"), "true");
    assert.equal(node.textContent, "Loading…");
  }
  assert.equal(name.disabled, false);
  assert.equal(name.readOnly, false);
  assert.equal(name.value, "kept");
  name.value = "typed-during-load";
  const queued = handleBootIntent({
    type: "keydown",
    key: "Enter",
    target: name,
    preventDefault() { this.defaultPrevented = true; },
  }, root);
  assert.equal(queued, true);
  assert.equal(queueFindForBoot(), true);
  landingName.value = "";
  const run = releaseBootGate(root);
  assert.equal(run, true);
  for (const node of [find, landing, sticky, banner]) {
    assert.equal(node.disabled, false);
    assert.equal(node.getAttribute("aria-disabled"), "false");
    assert.equal(node.getAttribute("aria-busy"), null);
    assert.equal(node.textContent, "Find my leagues");
  }
  assert.equal(name.value, "typed-during-load");
  assert.equal(landingName.value, "typed-during-load");
  assert.equal(handleBootIntent({ type: "submit", target: root, preventDefault() {} }, root), false);
});

test("a find click or form submit during boot is queued once", () => {
  resetBootGate();
  const find = button("find-leagues-btn", { dataset: { idleLabel: "Find my leagues", bootLoading: "1" } });
  find.setAttribute("data-boot-loading", "1");
  find.getBoundingClientRect = () => ({ left: 0, top: 0, right: 40, bottom: 20 });
  const form = {
    tagName: "FORM",
    querySelectorAll() { return [find]; },
  };
  const root = rootOf([find]);
  let prevented = 0;
  const submit = handleBootIntent({
    type: "submit",
    target: form,
    preventDefault() { prevented += 1; },
  }, root);
  const click = handleBootIntent({
    type: "click",
    target: { id: "under" },
    clientX: 10,
    clientY: 10,
    preventDefault() { prevented += 1; },
    stopPropagation() {},
  }, root);
  assert.equal(submit, true);
  assert.equal(click, true);
  assert.equal(prevented, 2);
  assert.equal(releaseBootGate(root), true);
  assert.equal(releaseBootGate(root), false);
});

test("app boot does not clear the username and does not fetch values before the gate opens", () => {
  const bootFn = app.slice(app.indexOf("function bootFromUrl"), app.indexOf("function currentDeskSnapshot"));
  assert.match(bootFn, /applyBootFieldValue/);
  assert.doesNotMatch(bootFn, /el\.sleeperUsername\.value\s*=/);
  assert.doesNotMatch(bootFn, /el\.landingUsername\.value\s*=/);
  const rather = app.slice(app.indexOf("async function bootLandingRather"), app.indexOf("async function loadRatherPromptContext"));
  assert.match(rather, /ensureValuesLoaded/);
  assert.doesNotMatch(rather, /fetchValuationBundles/);
  const init = app.slice(0, app.indexOf("function visibleRooms"));
  const releaseAt = init.lastIndexOf("releaseBootGate(document)");
  const ratherAt = init.lastIndexOf("void bootLandingRather()");
  assert.ok(releaseAt > ratherAt);
});

test("blank username fields are not wiped when boot coalesces them", () => {
  const rail = input("sleeper-username", "");
  const landing = input("landing-username", "");
  coalesceUsernameFields(rootOf([rail, landing]));
  assert.equal(rail.value, "");
  assert.equal(landing.value, "");
});
