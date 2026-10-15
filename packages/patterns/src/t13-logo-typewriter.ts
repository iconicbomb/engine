// T13 — logo-anchored typewriter (R5, R7). The logo mark lands, then the wordmark types outward from it; it reverses
// by un-typing from the right back into the mark. Measured: type 400 ms, un-type 270 ms.
// Emits a group (the lockup) holding the wordmark and a rounded-rect mark standing in for a logo (image/path nodes
// arrive with media slots in phase 2); the mark follows the wordmark's left edge (runtime: rect `follows`, added for
// this device). The wordmark's base x is offset by half the mark + gap so the finished lockup is centred, and the lockup
// scales down at 9:16 so the mark stays on canvas. Not modelled yet: the mark "splitting/widening" as the wordmark
// leaves it, and R7's 130 ms wordmark wipe.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type TextStyleIn, type TypewriterTrackIn, sizeOf } from "./macro";
import { withTypingMs } from "./typing";

export interface LogoTypewriterParams {
  id: string;                     // lockup group id; children are <id>-wordmark and <id>-mark
  text: string;                   // the wordmark
  style: TextStyleIn;
  at: number;                     // the mark lands here; typing starts markLeadMs later
  anchor?: AnchorIn;
  markLeadMs?: number;
  typeMs?: number;                // whole wordmark typed in this long (cps derived)
  untype?: { at: number; ms?: number };
  mark?: { size?: number; color?: string; radius?: number; gap?: number };
}

export function logoTypewriter(p: LogoTypewriterParams): MacroResult {
  const n = [...p.text].length;
  const typeMs = p.typeMs ?? 400;
  const size = p.mark?.size ?? Math.round(sizeOf(p.style) * 0.8);
  const gap = p.mark?.gap ?? Math.round(sizeOf(p.style) * 0.2);
  const track: TypewriterTrackIn = {
    mode: "typewriter",
    prop: "glyph.opacity",
    at: sec(p.at + (p.markLeadMs ?? 200) / 1000),
    ms: 0,
    cps: n / (typeMs / 1000),
    caret: { style: "none" },
    ...(p.untype ? { out: { at: p.untype.at, ms: p.untype.ms ?? 270 } } : {}),
  };
  const lockup = group({ id: p.id, anchor: p.anchor ?? { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.8 } } } }, [
    // the wordmark is drawn first so the mark can read its extents
    { id: `${p.id}-wordmark`, type: "text", text: p.text, style: p.style, x: (size + gap) / 2, tracks: [withTypingMs(track, p.text)] },
    { id: `${p.id}-mark`, type: "rect", w: size, h: size, radius: p.mark?.radius ?? Math.round(size * 0.28),
      fill: p.mark?.color ?? "tokens.accent",
      follows: { node: `${p.id}-wordmark`, edge: "left", gap },
      tracks: [{ mode: "tween", prop: "scale", at: p.at, ms: 400, from: 0, to: 1, ease: "bounce" }] },
  ]);
  return result({ nodes: [lockup] });
}
