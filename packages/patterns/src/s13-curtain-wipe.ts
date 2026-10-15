// S13 — curtain / edge wipe (R7): the scene changes behind an edge sweeping up or sideways. Measured: 130 ms.
// A beat transition (runtime: Beat.transition, type curtain): the macro returns it for the incoming beat, whose enter
// tracks must start `enterDelay(transition)` later (curtain: ms/2) — the macro rule. Uses the measured 130 ms; the
// bare curtain type keeps the runtime default (600 ms). Not modelled yet: the curved edge and its 1–2 frames of edge
// blur (the panel edge is straight).
import { result, type MacroResult } from "./macro";

export function curtainWipe(p: { ms?: number; direction?: "left" | "right" | "up" | "down"; color?: string } = {}): MacroResult {
  return result({ transition: { type: "curtain", ms: p.ms ?? 130, direction: p.direction ?? "up", ...(p.color ? { color: p.color } : {}) } });
}
