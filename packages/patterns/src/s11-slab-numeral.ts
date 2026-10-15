// S11 — 3D slab letters + fly-through (R6). Each stroke is an extruded board; strokes rotate about Y to assemble the
// numeral; the camera flies between slabs to cut to a new background. Measured: scale-up 800 ms cubic in-out; slab
// assembly 400 ms with a 70 ms stagger; fly-through 400 ms.
// Flat version: digits are seven-segment slabs (a face rect over a darker offset side = the extrusion); each slab turns
// in about Y (node rotY 90 -> 0, orthographic) staggered 70 ms while the numeral scales up (emphasis, 800 ms); the
// fly-through is a camera frame track pushing into one slab over 400 ms (pair it with a transition into the next
// beat). Not modelled yet: per-slab gradients (two-tone face / side), true 3D extrusion and the camera path between
// slabs.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type FrameTrackIn, type MacroResult, type NodeIn } from "./macro";

// seven segments: a top, b upper-right, c lower-right, d bottom, e lower-left, f upper-left, g middle
const SEGMENTS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };

export interface SlabNumeralParams {
  id: string;                     // group; digits <id>-d<n>, slabs <id>-d<n>-<segment>
  value: string;                  // digits only
  size: number;                   // numeral height, px
  at: number;
  anchor?: AnchorIn;
  face?: string; side?: string;
  extrude?: number;               // px, the side's offset
  slabGap?: number;               // px between segments
  flyThrough?: { at: number; ms?: number };   // camera pushes into the first digit's middle slab
}

export function slabNumeral(p: SlabNumeralParams): MacroResult {
  if (!/^\d+$/.test(p.value)) throw new Error(`S11: value must be digits, got ${p.value}`);
  const H = p.size, W = Math.round(H * 0.58), t = Math.round(H * 0.15), gap = p.slabGap ?? Math.round(H * 0.025);
  const ext = p.extrude ?? Math.round(H * 0.05), face = p.face ?? "tokens.accent", side = p.side ?? "#7A3E14";
  const seg: Record<string, [number, number, number, number]> = {          // x, y, w, h (centre-based)
    a: [0, -H / 2 + t / 2, W - 2 * gap, t], d: [0, H / 2 - t / 2, W - 2 * gap, t], g: [0, 0, W - 2 * gap, t],
    b: [W / 2 - t / 2, -H / 4, t, H / 2 - 2 * gap], c: [W / 2 - t / 2, H / 4, t, H / 2 - 2 * gap],
    f: [-W / 2 + t / 2, -H / 4, t, H / 2 - 2 * gap], e: [-W / 2 + t / 2, H / 4, t, H / 2 - 2 * gap],
  };
  let k = 0;
  const digits: NodeIn[] = [...p.value].map((ch, i) => {
    const slabs = [...SEGMENTS[ch]].map((s): NodeIn => {
      const [x, y, w, h] = seg[s], at = sec(p.at + (k++ * 70) / 1000), id = `${p.id}-d${i + 1}-${s}`;
      return { ...group({ id, x: Math.round(x), y: Math.round(y), tracks: [
        { mode: "tween", prop: "rotY", at, ms: 400, from: 90, to: 0, ease: "settle" },
        { mode: "tween", prop: "opacity", at, ms: 120, from: 0, to: 1, ease: "linear" },
      ] }, [
        { id: `${id}-side`, type: "rect", w: Math.round(w), h: Math.round(h), radius: Math.round(t * 0.2), fill: side, x: ext, y: ext },
        { id: `${id}-face`, type: "rect", w: Math.round(w), h: Math.round(h), radius: Math.round(t * 0.2), fill: face },
      ]), rotY: 90 } as NodeIn;
    });
    return group({ id: `${p.id}-d${i + 1}` }, slabs);
  });
  const numeral = group({ id: p.id, anchor: p.anchor, layout: { type: "row", gap: Math.round(W * 0.3) }, tracks: [
    { mode: "tween", prop: "scale", at: p.at, ms: 800, from: 0.35, to: 1, ease: "emphasis" },
  ] }, digits);
  const camera: FrameTrackIn[] = p.flyThrough ? [
    { mode: "frame", at: p.flyThrough.at, ms: p.flyThrough.ms ?? 400, target: `${p.id}-d1-${SEGMENTS[p.value[0]].includes("g") ? "g" : SEGMENTS[p.value[0]][0]}`, size: 12, ease: "emphasis" },
  ] : [];
  return result({ nodes: [numeral], camera });
}
