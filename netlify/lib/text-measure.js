// Advance widths straight from a TrueType font (head, hhea, hmtx, cmap 4/12),
// so the OG card can truncate names by measured width without a layout engine.
// Kerning is ignored; callers keep a few px of slack.

function tables(view) {
  const count = view.getUint16(4);
  const out = {};
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    out[tag] = view.getUint32(at + 8);
  }
  return out;
}

function readCmap(view, base) {
  const count = view.getUint16(base + 2);
  let pick = null;
  for (let i = 0; i < count; i += 1) {
    const rec = base + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const sub = base + view.getUint32(rec + 4);
    const format = view.getUint16(sub);
    if (platform === 3 && encoding === 10 && format === 12) return { format, sub };
    if (platform === 0 && format === 12) pick = { format, sub };
    if (!pick && ((platform === 3 && encoding === 1) || platform === 0) && format === 4) pick = { format, sub };
  }
  return pick;
}

function glyphLookup(view, cmap) {
  if (!cmap) return () => 0;
  const { format, sub } = cmap;
  if (format === 12) {
    const groups = view.getUint32(sub + 12);
    return (code) => {
      for (let i = 0; i < groups; i += 1) {
        const g = sub + 16 + i * 12;
        const start = view.getUint32(g);
        const end = view.getUint32(g + 4);
        if (code >= start && code <= end) return view.getUint32(g + 8) + (code - start);
      }
      return 0;
    };
  }
  const segX2 = view.getUint16(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (code) => {
    if (code > 0xffff) return 0;
    for (let i = 0; i < segX2; i += 2) {
      if (code > view.getUint16(ends + i)) continue;
      const start = view.getUint16(starts + i);
      if (code < start) return 0;
      const delta = view.getInt16(deltas + i);
      const range = view.getUint16(ranges + i);
      if (!range) return (code + delta) & 0xffff;
      const glyph = view.getUint16(ranges + i + range + (code - start) * 2);
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
    return 0;
  };
}

// measure(text, sizePx) -> width in px.
export function createMeasurer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = tables(view);
  const unitsPerEm = view.getUint16(t.head + 18);
  const metrics = view.getUint16(t.hhea + 34);
  const glyphOf = glyphLookup(view, readCmap(view, t.cmap));
  const cache = new Map();
  const advance = (code) => {
    if (cache.has(code)) return cache.get(code);
    const glyph = glyphOf(code);
    const index = Math.min(glyph, metrics - 1);
    const width = view.getUint16(t.hmtx + index * 4);
    cache.set(code, width);
    return width;
  };
  return (text, size) => {
    let units = 0;
    for (const ch of String(text ?? "")) units += advance(ch.codePointAt(0));
    return (units / unitsPerEm) * size;
  };
}

// Longest prefix that fits maxWidth, with an ellipsis when cut. Never shrinks the font.
export function truncateToWidth(text, maxWidth, size, measure) {
  const value = String(text ?? "");
  if (!measure || measure(value, size) <= maxWidth) return value;
  const chars = Array.from(value);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${chars.slice(0, mid).join("").trimEnd()}…`, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join("").trimEnd()}…`;
}
