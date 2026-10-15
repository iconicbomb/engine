// S11 — 3D slab letters + fly-through (R6). Each glyph is an extruded board; digits turn in about Y to assemble the
// numeral; the camera flies into the first digit to cut to a new background. Measured: scale-up 800 ms cubic in-out;
// assembly 400 ms with a 70 ms stagger; fly-through 400 ms.
// Look-layer version: each digit is a real glyph (text node) with `style.extrude` — `depth` stacked copies of the
// outline along (dx, dy) behind the face in the side colour — so the numeral keeps the font's shapes (R6 is a heavy
// grotesk, not a seven-segment display). Each digit turns in (rotY 90 -> 0, orthographic affine over the whole
// extruded glyph) staggered 70 ms while the numeral scales up (emphasis, 800 ms); the extrusion depth grows with the
// turn. The fly-through is a camera frame track pushing into the first digit over 400 ms (pair it with a transition
// into the next beat). Not modelled yet: perspective foreshortening, the camera path between slabs.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type FrameTrackIn, type MacroResult, type NodeIn } from "./macro";

export interface SlabNumeralParams {
  id: string;                     // group; digits <id>-d<n>
  value: string;                  // digits (any glyphs work)
  size: number;                   // numeral height, px (cap height ~ 0.73 size)
  at: number;
  anchor?: AnchorIn;
  face?: string; side?: string;
  weight?: number;
  extrude?: number;               // depth in px (default 6 % of size)
  flyThrough?: { at: number; ms?: number };   // camera pushes into the first digit
}

export function slabNumeral(p: SlabNumeralParams): MacroResult {
  const face = p.face ?? "tokens.accent", side = p.side, depth = p.extrude ?? Math.round(p.size * 0.06);
  const digits: NodeIn[] = [...p.value].map((ch, i) => {
    const at = sec(p.at + (i * 70) / 1000), id = `${p.id}-d${i + 1}`;
    return {
      id, type: "text", text: ch, rotY: 90, opacity: 0,
      style: { size: p.size, weight: p.weight ?? 800, color: face, tracking: 0, extrude: { depth, dx: 0.55, dy: 0.55, ...(side ? { color: side } : {}) } },
      tracks: [
        { mode: "tween", prop: "rotY", at, ms: 400, from: 90, to: 0, ease: "settle" },
        { mode: "tween", prop: "opacity", at, ms: 120, from: 0, to: 1, ease: "linear" },
        { mode: "tween", prop: "extrude.depth", at, ms: 400, from: 0, to: depth, ease: "settle" },
      ],
    } as NodeIn;
  });
  const numeral = group({ id: p.id, anchor: p.anchor, layout: { type: "row", gap: Math.round(p.size * 0.12) }, tracks: [
    { mode: "tween", prop: "scale", at: p.at, ms: 800, from: 0.35, to: 1, ease: "emphasis" },
  ] }, digits);
  const camera: FrameTrackIn[] = p.flyThrough ? [
    { mode: "frame", at: p.flyThrough.at, ms: p.flyThrough.ms ?? 400, target: `${p.id}-d1`, size: 12, ease: "emphasis", offset: { x: 0, y: 0.1 } },
  ] : [];
  return result({ nodes: [numeral], camera });
}
