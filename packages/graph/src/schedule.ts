// @engine/graph — typewriter schedule: when each glyph of a run appears (and, with `out`, disappears).
// Pure math over track data, shared by the runtime (to draw) and the pattern macros (to derive durations).
import type { Track } from "./schema";

type TypewriterTrack = Extract<Track, { mode: "typewriter" }>;

// Beat-local time at which glyph i (0-based) of an n-glyph run becomes visible. cps ramps linearly from
// track.cps to track.cps * track.ramp across the run; wordPauseMs is added after every space.
export function glyphTime(track: TypewriterTrack, glyphs: string[], i: number): number {
  if (track.unit === "word") return wordTime(track, glyphs, i);
  const n = Math.max(1, glyphs.length);
  let t = track.at;
  for (let j = 0; j < i; j++) {
    const cps = track.cps * (1 + (track.ramp - 1) * (n > 1 ? j / (n - 1) : 0));
    t += 1 / cps + (glyphs[j] === " " ? track.wordPauseMs / 1000 : 0);
  }
  return t;
}
export function typewriterEnd(track: TypewriterTrack, glyphs: string[]): number {
  return glyphTime(track, glyphs, glyphs.length);
}

// unit "word": glyph i appears with its word. A space opens the next word, so the visible run never ends in a space.
// cps is words/s (ramped across words like chars); wordPauseMs is added after each word. i = n gives the end time.
function wordTime(track: TypewriterTrack, glyphs: string[], i: number): number {
  const wordOf: number[] = [];
  let w = 0;
  glyphs.forEach((g, j) => { if (j > 0 && g === " " && glyphs[j - 1] !== " ") w++; wordOf.push(w); });
  const words = w + 1, upto = i >= glyphs.length ? words : wordOf[i];
  let t = track.at;
  for (let k = 0; k < upto; k++) {
    const cps = track.cps * (1 + (track.ramp - 1) * (words > 1 ? k / (words - 1) : 0));
    t += 1 / cps + track.wordPauseMs / 1000;
  }
  return t;
}
// Beat-local time at which glyph i is un-typed (removed from the right, evenly over out.ms), or Infinity.
export function glyphHideTime(track: TypewriterTrack, glyphs: string[], i: number): number {
  if (!track.out) return Infinity;
  const n = Math.max(1, glyphs.length);
  return track.out.at + ((n - i) / n) * (track.out.ms / 1000);
}
