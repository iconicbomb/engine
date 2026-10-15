// @engine/runtime — text shaping via HarfBuzz (harfbuzzjs). Environment-agnostic: the caller supplies the
// wasm bytes and font bytes (Node reads files, the browser fetches them), so the same module runs in tests,
// in Remotion's Chrome and in the editor. Output is in px, y-down, ready for Canvas/SVG.
import type { ShapedGlyph, Shaper, FontMetrics } from "./runtime-core";

// harfbuzzjs ships CommonJS without types; keep the surface we use typed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hbLoader: (opts: { wasmBinary: Uint8Array }) => Promise<unknown> = require("harfbuzzjs/hb.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hbjs: (instance: unknown) => HB = require("harfbuzzjs/hbjs.js");

type HBGlyph = { g: number; cl: number; ax: number; ay: number; dx: number; dy: number };
type HB = {
  createBlob(data: Uint8Array): { destroy(): void };
  createFace(blob: unknown, index: number): { upem: number; reference_table(tag: string): Uint8Array; getAxisInfos(): Record<string, { min: number; default: number; max: number }>; destroy(): void };
  createFont(face: unknown): { setScale(x: number, y: number): void; setVariations(v: Record<string, number>): void; glyphToPath(gid: number): string; destroy(): void };
  createBuffer(): { addText(s: string): void; guessSegmentProperties(): void; json(): HBGlyph[]; destroy(): void };
  shape(font: unknown, buffer: unknown, features?: string): void;
};

export interface ShaperAssets {
  wasm: Uint8Array;
  fonts: Record<string, Uint8Array>;   // font name -> TTF/OTF bytes (woff2 must be decoded by the caller)
}

export async function createShaper(assets: ShaperAssets): Promise<Shaper> {
  const instance = await hbLoader({ wasmBinary: assets.wasm });
  const hb = hbjs(instance);

  type Loaded = { face: ReturnType<HB["createFace"]>; font: ReturnType<HB["createFont"]>; upem: number; metrics: FontMetrics; axes: Record<string, { min: number; default: number; max: number }> };
  const loaded = new Map<string, Loaded>();
  for (const [name, bytes] of Object.entries(assets.fonts)) {
    const blob = hb.createBlob(bytes);
    const face = hb.createFace(blob, 0);
    const font = hb.createFont(face);
    const upem = face.upem;
    font.setScale(upem, upem);
    loaded.set(name, { face, font, upem, metrics: readMetrics(face, upem), axes: face.getAxisInfos() });
  }
  const defaultName = Object.keys(assets.fonts)[0];
  const pathCache = new Map<string, string>();   // `${font}|${axesKey}|${gid}` -> path in font units

  const pick = (fontName: string): Loaded => loaded.get(fontName) ?? loaded.get(defaultName)!;

  const applyAxes = (L: Loaded, axes: Record<string, number>) => {
    const v: Record<string, number> = {};
    for (const [k, info] of Object.entries(L.axes)) {
      const want = axes[k];
      v[k] = want === undefined ? info.default : Math.min(info.max, Math.max(info.min, want));
    }
    L.font.setVariations(v);
    return Object.entries(v).map(([k, x]) => `${k}=${x}`).join(",");
  };

  return {
    metrics(fontName) { return pick(fontName).metrics; },
    axes(fontName) { return pick(fontName).axes; },
    shape(text, fontName, sizePx, axes, features = []) {
      const L = pick(fontName);
      const axesKey = applyAxes(L, axes);
      const buf = hb.createBuffer();
      buf.addText(text);
      buf.guessSegmentProperties();
      hb.shape(L.font, buf, features.length ? features.join(",") : undefined);   // e.g. "tnum", "-liga", "ss01"
      const raw = buf.json();
      buf.destroy();
      const k = sizePx / L.upem;
      const cps = [...text];                           // code points, so cluster -> char works for astral chars
      const byteToIndex = clusterIndex(text);
      return raw.map((g): ShapedGlyph => {
        const key = `${fontName}|${axesKey}|${g.g}`;
        let d = pathCache.get(key);
        if (d === undefined) { d = L.font.glyphToPath(g.g); pathCache.set(key, d); }
        const idx = byteToIndex.get(g.cl) ?? 0;
        return {
          glyph: cps[idx] ?? "",
          gid: g.g,
          cluster: idx,
          xAdvance: g.ax * k,
          xOffset: g.dx * k,
          yOffset: -g.dy * k,
          d: scalePath(d, k),                           // y flipped to y-down, scaled to px
        };
      });
    },
  };
}

// harfbuzzjs reports clusters as UTF-8 byte offsets when text is added with addText; map to code-point indices.
function clusterIndex(text: string): Map<number, number> {
  const m = new Map<number, number>();
  let byte = 0, i = 0;
  for (const cp of text) {
    m.set(byte, i);
    const c = cp.codePointAt(0)!;
    byte += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    i++;
  }
  return m;
}

// hhea: ascender int16 @4, descender int16 @6; OS/2: sCapHeight int16 @88 (version >= 2), sxHeight @86.
function readMetrics(face: { reference_table(tag: string): Uint8Array }, upem: number): FontMetrics {
  const i16 = (b: Uint8Array, o: number) => { const v = (b[o] << 8) | b[o + 1]; return v & 0x8000 ? v - 0x10000 : v; };
  const hhea = face.reference_table("hhea");
  const os2 = face.reference_table("OS/2");
  const ascender = hhea.length >= 8 ? i16(hhea, 4) / upem : 0.9;
  const descender = hhea.length >= 8 ? i16(hhea, 6) / upem : -0.25;
  const version = os2.length >= 2 ? (os2[0] << 8) | os2[1] : 0;
  const capHeight = version >= 2 && os2.length >= 90 ? i16(os2, 88) / upem : 0.7;
  const xHeight = version >= 2 && os2.length >= 88 ? i16(os2, 86) / upem : 0.5;
  return { ascender, descender, capHeight, xHeight };
}

// Scale an SVG path string by k and flip y (HarfBuzz is y-up, canvas is y-down). harfbuzzjs emits only
// M/L/Q/C/Z with absolute coordinates, so a numeric pass is enough.
function scalePath(d: string, k: number): string {
  let out = "", num = "", isY = false;
  const flush = () => { if (num) { const v = parseFloat(num) * k; out += (isY ? -v : v).toFixed(2); num = ""; isY = !isY; } };
  for (let i = 0; i < d.length; i++) {
    const ch = d[i];
    if ((ch >= "0" && ch <= "9") || ch === "." || ch === "-" || ch === "e" || ch === "E") { num += ch; continue; }
    flush();
    if (ch === "M" || ch === "L" || ch === "Q" || ch === "C" || ch === "Z") { isY = false; out += ch; }
    else if (ch === ",") out += ",";
    else if (ch === " ") out += " ";
  }
  flush();
  return out;
}
