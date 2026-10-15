// S8 — bezier wire fan (R4). 8–12 curves draw from a hub node outward in both directions; small dots travel along them
// continuously. Measured: draw 400 ms; dots 1.5 px/frame.
// Emits top-level `wire` nodes from the hub's facing edge to each target's facing edge (s-curves, geometry from the
// measure pass), drawing on with trim.end 0 -> 1 over 400 ms settle, staggered 70 ms across the fan (left and right
// interleaved from the top). Not modelled yet: the travelling dots — a wire `dots` field vs follower nodes on a path is
// an open schema question.
import { result, sec, type MacroResult, type NodeIn } from "./macro";

export interface WireFanParams {
  id: string;                     // wires are <id>-wire-<n>
  hub: string;                    // node the fan grows from
  left?: string[];                // targets left of the hub, top to bottom
  right?: string[];               // targets right of the hub, top to bottom
  at: number;
  drawMs?: number;
  staggerMs?: number;
  bend?: number;
  stroke?: string;
  strokeWidth?: number;
  glow?: { radius: number; intensity: number };
}

export function wireFan(p: WireFanParams): MacroResult {
  const left = p.left ?? [], right = p.right ?? [];
  if (left.length + right.length === 0) throw new Error("S8: wireFan needs at least one target");
  // interleave sides from the top so the fan grows symmetrically
  const order: { target: string; side: "left" | "right" }[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (i < left.length) order.push({ target: left[i], side: "left" });
    if (i < right.length) order.push({ target: right[i], side: "right" });
  }
  const drawMs = p.drawMs ?? 400, stagger = p.staggerMs ?? 70;
  const wires: NodeIn[] = order.map((o, n) => ({
    id: `${p.id}-wire-${n + 1}`, type: "wire",
    from: { target: p.hub, anchor: o.side }, to: { target: o.target, anchor: o.side === "left" ? "right" : "left" },
    curve: "s", bend: p.bend ?? 0.5, stroke: p.stroke ?? "tokens.accent", strokeWidth: p.strokeWidth ?? 3,
    ...(p.glow ? { glow: p.glow } : {}), trim: { start: 0, end: 0 },
    tracks: [{ mode: "tween", prop: "trim.end", at: sec(p.at + (n * stagger) / 1000), ms: drawMs, from: 0, to: 1, ease: "settle" }],
  }));
  return result({ nodes: wires });
}
