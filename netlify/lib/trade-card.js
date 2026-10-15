import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cardVerdict, stampLabel } from "../../docs/modules/trade-share.js";
import { createMeasurer, truncateToWidth } from "./text-measure.js";
import { CARD_CACHE, SAFE_HEADERS, codeFromPath, escapeMarkup, summaryForCode } from "./trade-share.js";

const W = 1200;
const H = 630;
// OG-CARD.md: tokens.css colors, 60/64px safe area, two 12px-radius panels.
const C = {
  bg: "#0c0c0e",
  panel: "#141416",
  panelSoft: "#1c1c1f",
  line: "rgba(244,241,236,0.12)",
  text: "#f4f1ec",
  muted: "#a89e96",
  mutedStrong: "#e4dcd4",
  amber: "#f0c36a",
  // RECHECK3: one neutral strong tone for Favors/Lopsided; no red/green on a public card.
  strong: "#f4f1ec",
  barBigger: "#e4dcd4",
  barSmaller: "#4a4540",
};
const SANS = "Instrument Sans";
const SAFE = { top: 60, bottom: 60, left: 64, right: 64 };
const COL_W = (W - SAFE.left - SAFE.right - 32) / 2; // 520
const COL_TOP = SAFE.top + 40 + 28;
const VERDICT_TOP = H - SAFE.bottom - 72;
const COL_H = VERDICT_TOP - 24 - COL_TOP;
const ROW_H = 52;
const MAX_ROWS = 4;
const NAME_SIZE = 28; // never shrinks; long names are cut by measured width
const PAD_X = 24;
const PILL_W = 58;
const TONE = { fair: C.amber, strong: C.strong };
const WORDMARK_H = 34;

// Without the font (unit tests), estimate wide: 0.62em a glyph.
const roughMeasure = (text, size) => Array.from(String(text ?? "")).length * size * 0.62;
const count = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");

// RECHECK3: direction by placement and a pointer, not colour. The bigger
// column's total is bright and gets a small triangle pointing at it.
function sideColumn(summary, key, x, measure, bigger = "") {
  const rows = summary[key];
  const credited = key === "give" ? summary.giveCredited : summary.getCredited;
  const label = key === "give" ? "YOU GIVE" : "YOU GET";
  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;
  const right = x + COL_W - PAD_X;
  const parts = [
    `<rect x="${x}" y="${COL_TOP}" width="${COL_W}" height="${COL_H}" rx="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1"/>`,
    `<text x="${x + PAD_X}" y="${COL_TOP + 40}" font-family="${SANS}" font-size="18" letter-spacing="1.5" fill="${C.muted}">${label}</text>`,
    `<text x="${right}" y="${COL_TOP + 40}" font-family="${SANS}" font-size="18" font-weight="700" fill="${bigger === key ? C.text : C.muted}" text-anchor="end">${escapeMarkup(count(credited))}</text>`,
  ];
  let y = COL_TOP + 50;
  shown.forEach((row, i) => {
    if (i > 0) parts.push(`<line x1="${x + PAD_X}" y1="${y}" x2="${right}" y2="${y}" stroke="${C.line}" stroke-width="1"/>`);
    const mid = y + ROW_H / 2;
    const pill = row.position === "PICK" ? "PK" : (row.position || "—");
    const valueText = count(row.value);
    const valueW = measure(valueText, NAME_SIZE);
    const nameX = x + PAD_X + PILL_W + 12;
    const nameMax = right - valueW - 16 - nameX;
    parts.push(
      `<rect x="${x + PAD_X}" y="${mid - 15}" width="${PILL_W}" height="30" rx="6" fill="${C.panelSoft}"/>`,
      `<text x="${x + PAD_X + PILL_W / 2}" y="${mid + 6}" font-family="${SANS}" font-size="16" font-weight="700" fill="${C.mutedStrong}" text-anchor="middle">${escapeMarkup(pill)}</text>`,
      `<text x="${nameX}" y="${mid + 10}" font-family="${SANS}" font-size="${NAME_SIZE}" font-weight="600" fill="${C.text}">${escapeMarkup(truncateToWidth(row.name, nameMax, NAME_SIZE, measure))}</text>`,
      `<text x="${right}" y="${mid + 10}" font-family="${SANS}" font-size="${NAME_SIZE}" font-weight="600" fill="${C.mutedStrong}" text-anchor="end">${escapeMarkup(valueText)}</text>`,
    );
    y += ROW_H;
  });
  if (more > 0) {
    y += 30;
    parts.push(`<text x="${x + PAD_X}" y="${y}" font-family="${SANS}" font-size="22" fill="${C.muted}">+${more} more</text>`);
  }
  if (summary.credit?.side === key) {
    // The package credit is part of this side's total, so say so on the card.
    y += 32;
    parts.push(
      `<text x="${x + PAD_X}" y="${y}" font-family="${SANS}" font-size="22" fill="${C.muted}">Stars cost extra</text>`,
      `<text x="${right}" y="${y}" font-family="${SANS}" font-size="22" font-weight="700" fill="${C.mutedStrong}" text-anchor="end">+${escapeMarkup(count(summary.credit.amount))}</text>`,
    );
  }
  return parts.join("");
}

function wordmarkMarkup(wordmark) {
  const svg = String(wordmark || "");
  const box = /viewBox="([^"]+)"/.exec(svg);
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg);
  if (!box || !inner) {
    return `<text x="${SAFE.left}" y="${SAFE.top + 30}" font-family="${SANS}" font-size="28" font-weight="700" fill="${C.text}">Dynasty Ticker</text>`;
  }
  const [, , vw, vh] = box[1].trim().split(/\s+/).map(Number);
  const width = Math.round((vw / vh) * WORDMARK_H);
  return `<svg x="${SAFE.left}" y="${SAFE.top + 3}" width="${width}" height="${WORDMARK_H}" viewBox="${escapeMarkup(box[1])}">${inner[1]}</svg>`;
}

// OG-CARD.md: the verdict (48px bold sans, colored by tier only) is the boldest thing.
// Totals are credited, so the rows plus "Stars cost extra" add up to the header,
// and the verdict compares those two numbers.
export function renderCardSvg(summary, { measure = roughMeasure, wordmark = "" } = {}) {
  const verdict = cardVerdict(summary);
  const tone = TONE[verdict.tone] || C.amber;
  const verdictY = VERDICT_TOP + 54;
  const bigger = verdict.side === "Give" ? "give" : verdict.side === "Get" ? "get" : "";
  const giveShare = summary.giveCredited / Math.max(1, summary.giveCredited + summary.getCredited);
  const giveW = Math.round(W * giveShare);
  const giveFill = bigger === "get" ? C.barSmaller : C.barBigger;
  const getFill = bigger === "get" ? C.barBigger : C.barSmaller;
  const pctX = W - SAFE.right - (bigger === "get" ? 30 : 0);
  // Pointer drawn as a path (the card font has no ◀/▶ glyph): ◀ before the
  // line for Give (left column), ▶ after it for Get (right column).
  const ty = verdictY - 14;
  const tx = bigger === "give" ? Math.round(pctX - measure(verdict.pctText, 32) - 10) : W - SAFE.right;
  const pointer = bigger === "give"
    ? `<path d="M${tx - 20} ${ty} L${tx} ${ty - 11} L${tx} ${ty + 11} Z" fill="${tone}"/>`
    : bigger === "get" ? `<path d="M${tx} ${ty} L${tx - 20} ${ty - 11} L${tx - 20} ${ty + 11} Z" fill="${tone}"/>` : "";
  const stamp = summary.stamp ? `as of ${stampLabel(summary.stamp, { year: true })} · ` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${C.bg}"/>`
    + wordmarkMarkup(wordmark)
    + `<text x="${W - SAFE.right}" y="${SAFE.top + 28}" font-family="${SANS}" font-size="22" fill="${C.muted}" text-anchor="end">dynastyticker.com</text>`
    + sideColumn(summary, "give", SAFE.left, measure, bigger)
    + sideColumn(summary, "get", SAFE.left + COL_W + 32, measure, bigger)
    + `<text x="${SAFE.left}" y="${verdictY}" font-family="${SANS}" font-size="48" font-weight="700" fill="${tone}">${escapeMarkup(verdict.text)}</text>`
    + pointer
    + `<text x="${pctX}" y="${verdictY - 2}" font-family="${SANS}" font-size="32" font-weight="700" fill="${tone}" text-anchor="end">${escapeMarkup(verdict.pctText)}</text>`
    + `<text x="${W - SAFE.right}" y="${verdictY + 22}" font-family="${SANS}" font-size="16" fill="${C.muted}" text-anchor="end">${escapeMarkup(`${stamp}${summary.formatLabel}`)}</text>`
    + `<rect x="0" y="${H - 12}" width="${giveW}" height="12" fill="${giveFill}"/>`
    + `<rect x="${giveW}" y="${H - 12}" width="${W - giveW}" height="12" fill="${getFill}"/>`
    + `</svg>`;
}

const here = dirname(fileURLToPath(import.meta.url));
let resvgReady = null;
let fontBuffers = null;

async function firstFile(paths) {
  for (const path of paths) {
    try {
      return await readFile(path);
    } catch {
      // next
    }
  }
  throw new Error(`missing ${paths[0]}`);
}

async function loadFonts() {
  if (fontBuffers) return fontBuffers;
  const names = ["instrument-sans-400.ttf", "instrument-sans-700.ttf"];
  fontBuffers = await Promise.all(names.map((name) => firstFile([
    join(process.cwd(), "netlify/fonts", name),
    join(here, "../fonts", name),
  ])));
  return fontBuffers;
}

async function loadResvg() {
  const mod = await import("@resvg/resvg-wasm");
  if (!resvgReady) {
    const require = createRequire(import.meta.url);
    const wasmPaths = [join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm")];
    try {
      wasmPaths.push(require.resolve("@resvg/resvg-wasm/index_bg.wasm"));
    } catch {
      // bundled: rely on included_files
    }
    resvgReady = firstFile(wasmPaths).then((wasm) => mod.initWasm(wasm));
  }
  await resvgReady;
  return mod;
}

let artCache = null;

// The measurer (from the 700 face the names render in) and the wordmark SVG.
export async function loadCardArt() {
  if (artCache) return artCache;
  const [fonts, wordmark] = await Promise.all([
    loadFonts(),
    firstFile([
      join(process.cwd(), "docs/brand/wordmark-on-dark.svg"),
      join(here, "../../docs/brand/wordmark-on-dark.svg"),
    ]).then((buf) => buf.toString("utf8")).catch(() => ""),
  ]);
  artCache = { measure: createMeasurer(fonts[1]), wordmark };
  return artCache;
}

export async function renderCardPng(svg) {
  const [{ Resvg }, fonts] = await Promise.all([loadResvg(), loadFonts()]);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: SANS },
  });
  return resvg.render().asPng();
}

// /og/t/<code>.png renders PNG (what X, iMessage, Slack, and Facebook need).
// /og/t/<code>.svg is the same card as SVG, and the fallback if PNG fails.
export function createTradeCardHandler(deps = {}) {
  return async (req) => {
    const url = new URL(req.url);
    // Rewritten as ?file=<code>.png. Direct calls carry it as the last segment.
    const file = url.searchParams.get("file") ? `/${url.searchParams.get("file")}` : url.pathname;
    const wantsSvg = file.endsWith(".svg");
    const code = codeFromPath(file, { suffix: wantsSvg ? ".svg" : ".png" });
    const hit = code ? await summaryForCode(code, deps).catch(() => null) : null;
    if (!hit?.summary) {
      return new Response("Not found", { status: 404, headers: { ...SAFE_HEADERS, "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=60" } });
    }
    const art = await loadCardArt().catch(() => ({}));
    const svg = renderCardSvg(hit.summary, art);
    if (!wantsSvg) {
      try {
        const png = await (deps.renderPng || renderCardPng)(svg);
        return new Response(png, { status: 200, headers: { ...SAFE_HEADERS, "content-type": "image/png", "cache-control": CARD_CACHE } });
      } catch {
        // fall back to SVG below, briefly cached so a retry can render PNG
      }
    }
    return new Response(svg, {
      status: 200,
      headers: {
        ...SAFE_HEADERS,
        "content-type": "image/svg+xml",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "cache-control": wantsSvg ? CARD_CACHE : "public, max-age=300",
      },
    });
  };
}
