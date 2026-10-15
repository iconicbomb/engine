// Shared by the typewriter macros: a typewriter track's `ms` is its typing duration, derived from the same glyph
// schedule the runtime uses, so it can't drift from cps / ramp / wordPauseMs.
import { TypewriterTrack, typewriterEnd } from "@engine/graph";
import type { TypewriterTrackIn } from "./macro";

export function withTypingMs(track: TypewriterTrackIn, text: string): TypewriterTrackIn {
  track.ms = Math.round(typewriterEnd(TypewriterTrack.parse({ ...track, at: 0 }), [...text]) * 1000);
  return track;
}
