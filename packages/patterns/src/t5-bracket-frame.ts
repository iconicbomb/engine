// T5 — bracket / brace framing (R3). A [ ] or { } pair tracks the framed text's extents; the closing glyph springs
// outward when the text grows, then settles. Measured: settle ~300 ms with ~10 % overshoot (spec, pattern library);
// the spring defaults to the `bounce` preset, spring(700, 18, 1).
import { result, type MacroResult, type SpringIn, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface BracketFrameParams {
  id: string;
  follows: string;                     // id of the text node it frames (same beat)
  style: TextStyleIn;
  glyphPair?: [string, string];
  padding?: number;
  spring?: SpringIn;
  /** When the pair fades in. Omitted = visible from the beat start. */
  appear?: { at: number; ms: number };
}

export function bracketFrame(p: BracketFrameParams): MacroResult {
  const tracks: TweenTrackIn[] = p.appear
    ? [{ mode: "tween", prop: "opacity", at: p.appear.at, ms: p.appear.ms, from: 0, to: 1, ease: "settle" }]
    : [];
  return result({
    nodes: [{
      id: p.id,
      type: "bracket",
      follows: p.follows,
      glyphs: p.glyphPair ?? ["[", "]"],
      padding: p.padding ?? 24,
      style: p.style,
      spring: p.spring ?? { stiffness: 700, damping: 18, mass: 1 },
      ...(p.appear ? { opacity: 0 } : {}),
      tracks,
    }],
  });
}
