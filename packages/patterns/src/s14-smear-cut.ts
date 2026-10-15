// S14 — motion-blur smear cut (R8): one frame of extreme vertical blur bridges two scenes, then a short settle.
// Measured: 1 frame at 30 fps + 100 ms (~133 ms), vertical. A beat transition (runtime: Beat.transition, type smear —
// the blur is each beat's own motion, 8 taps along its velocity): the macro returns it for the incoming beat, whose
// enter tracks start `enterDelay(transition)` later (smear: ms). Uses the measured ~133 ms; the bare smear type keeps
// the runtime default (160 ms).
import { result, type MacroResult } from "./macro";

export function smearCut(p: { ms?: number; direction?: "left" | "right" | "up" | "down" } = {}): MacroResult {
  return result({ transition: { type: "smear", ms: p.ms ?? Math.round(1000 / 30 + 100), direction: p.direction ?? "up" } });
}
