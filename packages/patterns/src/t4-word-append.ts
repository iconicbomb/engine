// T4 — word-by-word append (R4, R7). Whole words pop in at the line end with a fade from 30 % and a 20 px slide
// to the left; the sentence recentres on each append. Measured: 200–270 ms per word, ~4 words/s.
// Built from primitives: a word-unit typewriter (whole words appear at once, one every wordGapMs) plus per-glyph
// tweens timed from each glyph's reveal. The line recentres on each append with an exponential ease (the layout
// solver's smoothedSteps) that settles to ~95 % within recenterMs, by default the 230 ms word cadence.
import { result, type MacroResult, type TextStyleIn, type TweenTrackIn, type TypewriterTrackIn } from "./macro";
import { withTypingMs } from "./typing";

export interface WordAppendParams {
  id: string;
  text: string;
  style: TextStyleIn;
  at: number;
  wordGapMs?: number;
  slidePx?: number;
  fadeFrom?: number;
  popMs?: number;            // fade + slide duration of each word
  recenterMs?: number;       // recentre settles (~95 %) within this; spec word-append timing 200–270 ms
}

export function wordAppend(p: WordAppendParams): MacroResult {
  const popMs = p.popMs ?? 200;
  const track: TypewriterTrackIn = {
    mode: "typewriter",
    prop: "glyph.opacity",
    at: p.at,
    ms: 0,
    unit: "word",
    cps: 1000 / (p.wordGapMs ?? 230),       // words/s
    caret: { style: "none" },
  };
  const pops: TweenTrackIn[] = [
    { mode: "tween", prop: "opacity", at: 0, ms: popMs, from: p.fadeFrom ?? 0.3, to: 1, ease: "settle", relativeTo: "reveal" },
    { mode: "tween", prop: "x", at: 0, ms: popMs, from: p.slidePx ?? 20, to: 0, ease: "settle", relativeTo: "reveal" },
  ];
  // smoothedSteps is an exponential approach with time constant tau; 95 % is reached at tau * ln 20 (round down
  // so the line is at least 95 % recentred by recenterMs)
  const recenterEaseMs = Math.floor((p.recenterMs ?? 230) / Math.log(20));
  return result({ nodes: [{ id: p.id, type: "text", text: p.text, style: p.style, recenterEaseMs, tracks: [withTypingMs(track, p.text), ...pops] }] });
}
