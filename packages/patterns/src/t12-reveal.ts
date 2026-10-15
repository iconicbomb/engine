// T12 — 3D-ish letter reveal (R3). The word appears instantly, oversized, and settles to 1.0x while its glyphs lead
// in from the side with a per-glyph stagger. Measured: ~200 ms, from 1.3x (spec, pattern library). Extruded depth
// needs the phase-6 WebGL layer; until then the reveal is scale + per-glyph slide.
// Because only one text animation runs at a time, the reveal can also drive the exit of the text it replaces
// (`handoff`): that text shrinks and fades just before the reveal lands.
import { result, sec, type AnchorIn, type MacroResult, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface RevealParams {
  id: string;
  text: string;
  style: TextStyleIn;
  anchor?: AnchorIn;
  at: number;
  ms?: number;              // scale + slide duration
  fromScale?: number;
  leadPx?: number;          // glyphs slide in from this x offset
  glyphStaggerMs?: number;
  fadeMs?: number;          // the near-instant pop-in
  handoff?: {
    target: string;         // node being replaced
    at: number;
    ms: number;
    scaleTo: number;
    fadeDelayMs: number;    // fade starts this long after the shrink
    fadeMs: number;
  };
}

export function reveal(p: RevealParams): MacroResult {
  const ms = p.ms ?? 200;
  const tracks: TweenTrackIn[] = [
    { mode: "tween", prop: "opacity", at: p.at, ms: p.fadeMs ?? 67, from: 0, to: 1, ease: "linear" },
    { mode: "tween", prop: "scale", at: p.at, ms, from: p.fromScale ?? 1.3, to: 1, ease: "emphasis" },
    { mode: "tween", prop: "x", at: p.at, ms, from: p.leadPx ?? 40, to: 0, ease: "emphasis", staggerMs: p.glyphStaggerMs ?? 25 },
  ];
  const h = p.handoff;
  return result({
    nodes: [{ id: p.id, type: "text", text: p.text, style: p.style, anchor: p.anchor ?? { x: 0.5, y: 0.5 }, opacity: 0, tracks }],
    tracks: h ? [
      { target: h.target, track: { mode: "tween", prop: "scale", at: h.at, ms: h.ms, from: 1, to: h.scaleTo, ease: "emphasis" } },
      { target: h.target, track: { mode: "tween", prop: "opacity", at: sec(h.at + h.fadeDelayMs / 1000), ms: h.fadeMs, from: 1, to: 0, ease: "settle" } },
    ] : [],
  });
}
