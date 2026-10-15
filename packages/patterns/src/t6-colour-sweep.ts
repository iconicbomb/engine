// T6 — colour sweep / keyword highlight (R4). A 4-glyph tinted window sweeps across the text and recedes off the
// far end; with a keyword it instead stops on that word, sized to it, and holds. Measured: 0.4–0.5 s per sweep.
// Emits a sweep track on an existing text node (runtime: "sweep" track mode, added for this device).
import { result, type MacroResult, type SweepTrackIn } from "./macro";

export interface ColourSweepParams {
  target: string;            // id of the text node to sweep
  text: string;              // that node's text (for glyph positions; macros never read the graph)
  at: number;
  sweepMs?: number;
  windowGlyphs?: number;
  color?: string;
  direction?: "ltr" | "rtl";
  keyword?: string;          // stop on this word and hold (first occurrence)
}

export function colourSweep(p: ColourSweepParams): MacroResult {
  const n = [...p.text].length;
  let window = p.windowGlyphs ?? 4, stop: number | undefined;
  if (p.keyword !== undefined) {
    const idx = p.text.indexOf(p.keyword);
    if (idx < 0) throw new Error(`T6: keyword "${p.keyword}" not in "${p.text}"`);
    const len = [...p.keyword].length;
    window = len;                                          // the hold covers exactly the keyword
    stop = [...p.text.slice(0, idx)].length + len / 2;
  }
  // window centres just off each end of the run (glyph-index units)
  const offStart = -window / 2, offEnd = n + window / 2;
  const from = p.direction === "rtl" ? offEnd : offStart;
  const to = stop ?? (p.direction === "rtl" ? offStart : offEnd);
  const track: SweepTrackIn = { mode: "sweep", prop: "glyph.color", at: p.at, ms: p.sweepMs ?? 450, from, to, window, color: p.color ?? "tokens.accent", ease: "settle" };
  return result({ tracks: [{ target: p.target, track }] });
}
