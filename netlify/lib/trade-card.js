import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { CARD_CACHE, SAFE_HEADERS, codeFromPath, escapeMarkup, summaryForCode } from "./trade-share.js";

const W = 1200;
const H = 630;
const C = { bg: "#0c0c0e", panel: "#141416", line: "#2a2a2e", text: "#f4f1ec", muted: "#a89e96", green: "#3dcc8a", red: "#ff7a72", amber: "#f0c36a" };
const SANS = "Instrument Sans";
const SERIF = "Instrument Serif";

function fit(text, max) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sideRows(rows, x, label, total) {
  const shown = rows.slice(0, 4);
  const more = rows.length - shown.length;
  const lines = shown.map((row, i) => {
    const y = 296 + i * 46;
    return `<text x="${x}" y="${y}" font-family="${SANS}" font-size="26" fill="${C.text}">${escapeMarkup(fit(row.name, 26))}</text>`
      + `<text x="${x + 500}" y="${y}" font-family="${SANS}" font-size="26" font-weight="700" fill="${C.muted}" text-anchor="end">${escapeMarkup(row.value.toLocaleString("en-US"))}</text>`;
  }).join("");
  const extra = more > 0 ? `<text x="${x}" y="${296 + 4 * 46}" font-family="${SANS}" font-size="22" fill="${C.muted}">+${more} more</text>` : "";
  return `<text x="${x}" y="210" font-family="${SANS}" font-size="20" font-weight="700" letter-spacing="2" fill="${C.muted}">${escapeMarkup(label)}</text>`
    + `<text x="${x + 500}" y="216" font-family="${SANS}" font-size="44" font-weight="700" fill="${C.text}" text-anchor="end">${escapeMarkup(total.toLocaleString("en-US"))}</text>`
    + `<line x1="${x}" y1="240" x2="${x + 500}" y2="240" stroke="${C.line}" stroke-width="2"/>`
    + lines + extra;
}

// Restrained serif headline, the percent is the boldest thing on the card.
export function renderCardSvg(summary) {
  const tone = summary.tone === "bad" ? C.red : summary.tone === "good" ? C.green : C.amber;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${C.bg}"/>`
    + `<rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="8" fill="${C.panel}"/>`
    + `<text x="80" y="118" font-family="${SERIF}" font-size="40" fill="${C.text}">${escapeMarkup(fit(summary.label, 34))}</text>`
    + `<text x="${W - 80}" y="118" font-family="${SANS}" font-size="64" font-weight="700" fill="${tone}" text-anchor="end">${escapeMarkup(`${summary.pct}%`)}</text>`
    + `<text x="${W - 80}" y="146" font-family="${SANS}" font-size="18" fill="${C.muted}" text-anchor="end">apart</text>`
    + sideRows(summary.give, 80, "GIVE", summary.giveTotal)
    + sideRows(summary.get, 620, "GET", summary.getTotal)
    + `<text x="80" y="${H - 66}" font-family="${SANS}" font-size="20" font-weight="700" fill="${C.text}">Dynasty Ticker</text>`
    + `<text x="${W - 80}" y="${H - 66}" font-family="${SANS}" font-size="20" fill="${C.muted}" text-anchor="end">${escapeMarkup(`Market prices · ${summary.formatLabel}`)}</text>`
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
  const names = ["instrument-sans-400.ttf", "instrument-sans-700.ttf", "instrument-serif-400.ttf"];
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
    const svg = renderCardSvg(hit.summary);
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
