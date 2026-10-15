// T1 — scramble typewriter (R3). Each new char shows a random symbol for 1–2 frames, then resolves; the leading
// edge carries a soft bloom. Measured: 26 cps, scramble hold 33–67 ms, bloom radius ~1 em (spec, pattern library).
import { TypewriterTrack } from "@engine/graph";
import { typewriterEnd } from "@engine/runtime";
import { result, type MacroResult, type TextStyleIn, type TypewriterTrackIn } from "./macro";

export interface ScrambleTypewriterParams {
  id: string;
  text: string;
  style: TextStyleIn;
  at: number;                          // beat-local seconds the first glyph appears
  cps?: number;                        // chars/s at the start of the run
  ramp?: number;                       // cps multiplier reached by the last char
  wordPauseMs?: number;
  scrambleFrames?: number;
  symbolSet?: string;
  tail?: { len: number; color: string; decayMs: number };
  caret?: { style: "none" | "bar" | "block" | "glass"; blinkMs: number; holdAfterMs: number; preScale: number; color?: string };
  bloom?: { radius: number; intensity: number };
}

export function scrambleTypewriter(p: ScrambleTypewriterParams): MacroResult {
  const track: TypewriterTrackIn = {
    mode: "typewriter",
    prop: "glyph.opacity",
    at: p.at,
    ms: 0, // set below from the glyph schedule
    cps: p.cps ?? 26,
    scramble: { frames: p.scrambleFrames ?? 1, symbols: p.symbolSet ?? "#%*@!<" },
    tail: p.tail ?? { len: 4, color: "tokens.accent", decayMs: 300 },
    caret: p.caret ?? { style: "bar", blinkMs: 500, holdAfterMs: 0, preScale: 1 },
    bloom: p.bloom ?? { radius: p.style.size, intensity: 1 },
    ramp: p.ramp ?? 1,
    wordPauseMs: p.wordPauseMs ?? 0,
  };
  // `ms` is the typing duration, derived from the same glyph schedule the runtime uses, so it can't drift from cps/ramp.
  track.ms = Math.round(typewriterEnd(TypewriterTrack.parse({ ...track, at: 0 }), [...p.text]) * 1000);
  return result({ nodes: [{ id: p.id, type: "text", text: p.text, style: p.style, tracks: [track] }] });
}
