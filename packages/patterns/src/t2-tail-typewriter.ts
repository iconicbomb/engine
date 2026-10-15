// T2 — plain typewriter with tail highlight (R5, R7). The last N chars are tinted the brand colour and decay to the
// body colour as they age; blinking caret. Measured: R5 30 cps, tail 6 chars; R7 15 cps, tail 1 char; blink 500 ms.
// "Last N chars" is expressed through age: the tint decays over N / cps, the time it takes to type N more chars.
import { result, type MacroResult, type TextStyleIn, type TypewriterTrackIn } from "./macro";
import { withTypingMs } from "./typing";

export interface TailTypewriterParams {
  id: string;
  text: string;
  style: TextStyleIn;
  at: number;
  cps?: number;
  tailLength?: number;
  tailColor?: string;
  tailDecayMs?: number;                        // default: tailLength / cps
  caretStyle?: "none" | "bar" | "block";
  blinkMs?: number;
  caretHoldMs?: number;                        // caret keeps blinking this long after the last char
}

export function tailTypewriter(p: TailTypewriterParams): MacroResult {
  const cps = p.cps ?? 30, len = p.tailLength ?? 6;
  const track: TypewriterTrackIn = {
    mode: "typewriter",
    prop: "glyph.opacity",
    at: p.at,
    ms: 0,
    cps,
    tail: { len, color: p.tailColor ?? "tokens.accent", decayMs: p.tailDecayMs ?? Math.round(len / cps * 1000), strength: 1 },
    caret: { style: p.caretStyle ?? "bar", blinkMs: p.blinkMs ?? 500, holdAfterMs: p.caretHoldMs ?? 1200, preScale: 1 },
  };
  return result({ nodes: [{ id: p.id, type: "text", text: p.text, style: p.style, tracks: [withTypingMs(track, p.text)] }] });
}
