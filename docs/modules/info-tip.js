import { escapeHtml } from "./html.js";

export const INFO_ICON_PX = 18;
export const INFO_HIT_PX = 44;
export const INFO_HIT_OUTSET = (INFO_HIT_PX - INFO_ICON_PX) / 2;
export const INFO_SHEET_MIN_HEIGHT = 160;
export const INFO_PHONE_MAX_WIDTH = 700;

export function valuesWorkText(date = "") {
  const when = String(date || "").trim();
  const updated = when ? ` Updated ${when}.` : "";
  return `Values come from our own football forecast: projected points, age and role, not crowd votes. Same number everywhere on the site.${updated}`;
}

// Plain words for terms a first-time or non-native reader may not know.
export const GLOSSARY = Object.freeze({
  PPR: "PPR (points per reception): every catch scores 1 point.",
  Superflex: "Superflex: one lineup spot can hold a quarterback, so quarterbacks are worth more.",
  "1QB": "1QB: only one quarterback starts, so quarterbacks are worth less.",
  Stars: "Stars: one great player is worth more than several average players that add up to the same total. Player prices stay the same.",
  "Pick slot": "Pick slot, like 1.04: round 1, 4th pick in that round.",
  "Pick Hoarder": "Pick Hoarder: this team owns 3 or more future 1st-round picks.",
  Edge: "Edge: this position group is one of the strongest in the league.",
  Quest: "Quest: this position group is one of the weakest in the league, so it needs help.",
  Lopsided: "Lopsided: one side gets more than 28% more value. Most managers would say no.",
  "Youth Core": "Youth Core: many young players who should keep their value for years.",
  Stack: "Stack: several players from the same NFL team.",
  "Title Threat": "Title Threat: a power score of 90 or more.",
});

export function badgeMeaning(badge) {
  const text = String(badge || "").trim();
  if (GLOSSARY[text]) return GLOSSARY[text].replace(/^[^:]+:\s*/, "");
  const tail = text.split(/\s+/).pop();
  if (/\s/.test(text) && GLOSSARY[tail]) return GLOSSARY[tail].replace(/^[^:]+:\s*/, "");
  return "";
}

export function infoTipMarkup({ id, label, text } = {}) {
  const popId = String(id || "").trim();
  const name = String(label || "More info").trim() || "More info";
  const body = String(text || "");
  if (!popId || !body) return "";
  return `<button type="button" class="info" aria-label="${escapeHtml(name)}" aria-expanded="false" aria-controls="${escapeHtml(popId)}">i</button><div id="${escapeHtml(popId)}" class="info-pop" role="dialog" aria-label="${escapeHtml(name)}" hidden tabindex="-1"><p>${escapeHtml(body)}</p></div>`;
}

export function infoUsesSheet({ width = 0, height = 0 } = {}) {
  return Number(width) <= INFO_PHONE_MAX_WIDTH && Number(height) > INFO_SHEET_MIN_HEIGHT;
}

export function openInfoTip(button, pop) {
  if (!button || !pop) return;
  pop.hidden = false;
  button.setAttribute("aria-expanded", "true");
  if (pop.tabIndex == null || pop.tabIndex < 0) pop.tabIndex = -1;
  pop.focus();
}

export function closeInfoTip(button, pop, { restore = true } = {}) {
  if (pop) pop.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
  if (restore && button) button.focus();
}

export function createInfoTipController() {
  let current = null;

  function closeCurrent({ restore = true } = {}) {
    if (!current) return;
    closeInfoTip(current.button, current.pop, { restore });
    current = null;
  }

  return {
    toggle(button, pop) {
      if (!button || !pop) return;
      if (current?.button === button) {
        closeCurrent({ restore: true });
        return;
      }
      closeCurrent({ restore: false });
      openInfoTip(button, pop);
      current = { button, pop };
    },
    escape() {
      closeCurrent({ restore: true });
    },
    outside(target) {
      if (!current) return;
      if (current.button === target || current.button.contains?.(target)) return;
      if (current.pop === target || current.pop.contains?.(target)) return;
      closeCurrent({ restore: true });
    },
    get openId() {
      return current?.pop?.id || "";
    },
  };
}

export function bindInfoTips(doc = globalThis.document) {
  if (!doc?.addEventListener) return { controller: null };
  const controller = createInfoTipController();

  function popFor(button) {
    const id = button?.getAttribute?.("aria-controls") || "";
    const source = id ? doc.getElementById(id) : null;
    if (!source || typeof doc.createElement !== "function" || !doc.body?.appendChild) return source;
    // Show a copy at the body level: a re-render, a transformed or clipped
    // parent, or an overflow box can otherwise hide the text.
    let portal = doc.getElementById("info-portal");
    if (!portal) {
      portal = doc.createElement("div");
      portal.id = "info-portal";
      portal.className = "info-pop";
      portal.setAttribute("role", "dialog");
      portal.hidden = true;
      portal.tabIndex = -1;
      doc.body.appendChild(portal);
    }
    if (portal.dataset) portal.dataset.source = id;
    portal.setAttribute("aria-label", source.getAttribute("aria-label") || "More info");
    portal.innerHTML = source.innerHTML;
    return portal;
  }

  function place(button, pop) {
    if (!pop || !button?.getBoundingClientRect) return;
    const width = doc.documentElement?.clientWidth || globalThis.innerWidth || 0;
    const height = pop.scrollHeight || 0;
    const sheet = infoUsesSheet({ width, height });
    pop.classList.toggle("info-sheet", sheet);
    if (sheet || !pop.style) return;
    const rect = button.getBoundingClientRect();
    const viewportHeight = globalThis.innerHeight || width;
    const below = viewportHeight - rect.bottom;
    const above = below < height + 12 && rect.top > below;
    pop.style.left = `${Math.max(8, Math.min(rect.left, width - 288))}px`;
    pop.style.top = above ? `${Math.max(8, rect.top - height - 8)}px` : `${rect.bottom + 8}px`;
  }

  doc.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".info");
    if (button) {
      event.preventDefault();
      const pop = popFor(button);
      controller.toggle(button, pop);
      if (controller.openId) place(button, pop);
      return;
    }
    controller.outside(event.target);
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" && event.key !== " " && event.key !== "Enter") return;
    const button = event.target?.closest?.(".info");
    if ((event.key === "Enter" || event.key === " ") && button) {
      event.preventDefault();
      const pop = popFor(button);
      controller.toggle(button, pop);
      if (controller.openId) place(button, pop);
      return;
    }
    if (event.key === "Escape" && controller.openId) {
      event.preventDefault();
      controller.escape();
    }
  });

  return { controller };
}

const PRICE_LEGEND = {
  model: ["Value", "Same number on Check a trade, Find a trade, and My team."],
  package: ["Stars", "One great player is worth more than several average players that add up to the same total. This changes the trade verdict. Player prices stay the same."],
};

export function renderPriceLegend(ids = ["model"]) {
  const rows = (Array.isArray(ids) ? ids : ["model"])
    .map((id) => PRICE_LEGEND[id])
    .filter(Boolean);
  if (!rows.length) return "";
  return `<ul class="price-legend">${rows.map(([label, text], index) => `<li><span>${escapeHtml(label)}</span>${infoTipMarkup({
    id: `pop-legend-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    label,
    text,
  })}</li>`).join("")}</ul>`;
}
