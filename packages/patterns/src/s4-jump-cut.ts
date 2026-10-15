// S4 — jump-cut coverage (R5). No zoom animation between framings: hard cuts between wide / medium / close shots of
// the same UI, cinema-style, cut on action (a click). Measured: close-up holds 0.8–1.5 s. The cursor renders inside
// the camera, so it is scaled to match each shot.
// Emits camera frame tracks (runtime: camera `frame` tracks over the measure pass). A shot may set ms > 0 for a
// push-in instead of a cut. pressTimes() reads the cursor's press times out of cursorClick results so cuts land on
// the clicks.
import { result, type FrameTrackIn, type MacroResult } from "./macro";

export interface Shot {
  at: number;
  target: string;
  size?: "wide" | "medium" | "close" | number;
  ms?: number;                      // 0 = hard cut (default)
  ease?: "linear" | "settle" | "emphasis";
  anchor?: "center" | "left" | "right" | "top" | "bottom";
  offset?: { x: number; y: number };   // fractions of the target's box
  follow?: boolean;
}

export function jumpCuts(p: { shots: Shot[] }): MacroResult {
  const camera: FrameTrackIn[] = p.shots.map((s) => ({
    mode: "frame", at: s.at, target: s.target, size: s.size ?? "medium", ms: s.ms ?? 0,
    ...(s.ease ? { ease: s.ease } : {}), ...(s.anchor ? { anchor: s.anchor } : {}), ...(s.offset ? { offset: s.offset } : {}),
    ...(s.follow ? { follow: true } : {}),
  }));
  return result({ camera });
}

// the `at` of every press track the results put on `cursor`, in time order (cut-on-action points)
export function pressTimes(results: MacroResult[], cursor: string): number[] {
  return results.flatMap((r) => r.tracks).filter((t) => t.target === cursor && t.track.mode === "press").map((t) => t.track.at ?? 0).sort((a, b) => a - b);
}
