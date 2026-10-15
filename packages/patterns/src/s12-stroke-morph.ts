// S12 — glyph-shared morph, shape level (R6). The strokes of one form become another's (X -> V + I): strokes are the
// shared unit, not the glyph. Measured: 500 ms.
// Each stroke is a line `path` of the pair's longest length, placed at its midpoint and rotated; its visible length is
// a symmetric trim. Strokes are matched greedily by nearest midpoint; matched strokes tween x / y / rotation (the short
// way: a line at a equals a + 180°) / length; unmatched source strokes shrink out and unmatched target strokes grow in.
import { group } from "./assemble";
import { result, type AnchorIn, type MacroResult, type NodeIn, type TweenTrackIn } from "./macro";

export type Stroke = { x1: number; y1: number; x2: number; y2: number };

export interface StrokeMorphParams {
  id: string;                     // group; strokes <id>-s<n>
  from: Stroke[];
  to: Stroke[];
  at: number;
  anchor?: AnchorIn;
  ms?: number;
  stroke?: string;
  width?: number;
}

const geo = (s: Stroke) => ({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, len: Math.hypot(s.x2 - s.x1, s.y2 - s.y1), ang: (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI });
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function strokeMorph(p: StrokeMorphParams): MacroResult {
  const ms = p.ms ?? 500, width = p.width ?? 28, color = p.stroke ?? "tokens.accent";
  const A = p.from.map(geo), B = p.to.map(geo);
  // greedy nearest-midpoint matching over all pairs
  const pairs: [number, number][] = [], usedA = new Set<number>(), usedB = new Set<number>();
  const cand = A.flatMap((a, i) => B.map((b, j) => ({ i, j, d: Math.hypot(a.x - b.x, a.y - b.y) }))).sort((u, v) => u.d - v.d);
  for (const c of cand) if (!usedA.has(c.i) && !usedB.has(c.j)) { pairs.push([c.i, c.j]); usedA.add(c.i); usedB.add(c.j); }
  const nodes: NodeIn[] = [];
  const line = (n: number, g: ReturnType<typeof geo>, maxLen: number, lenFrom: number, lenTo: number, extra: TweenTrackIn[], opacity?: number): NodeIn => {
    const trimAt = (len: number) => r3((1 - len / maxLen) / 2);
    return { id: `${p.id}-s${n}`, type: "path", d: `M ${r3(-maxLen / 2)} 0 L ${r3(maxLen / 2)} 0`, stroke: color, strokeWidth: width,
      x: r3(g.x), y: r3(g.y), rotation: r3(g.ang), trim: { start: trimAt(lenFrom), end: r3(1 - trimAt(lenFrom)) }, ...(opacity !== undefined ? { opacity } : {}),
      tracks: [
        { mode: "tween", prop: "trim.start", at: p.at, ms, from: trimAt(lenFrom), to: trimAt(lenTo), ease: "emphasis" },
        { mode: "tween", prop: "trim.end", at: p.at, ms, from: r3(1 - trimAt(lenFrom)), to: r3(1 - trimAt(lenTo)), ease: "emphasis" },
        ...extra,
      ] } as NodeIn;
  };
  let n = 0;
  for (const [i, j] of pairs) {
    const a = A[i], b = B[j];
    let d = b.ang - a.ang;                         // shortest rotation for an undirected line: within ±90°
    while (d > 90) d -= 180;
    while (d < -90) d += 180;
    nodes.push(line(++n, a, Math.max(a.len, b.len), a.len, b.len, [
      { mode: "tween", prop: "x", at: p.at, ms, from: r3(a.x), to: r3(b.x), ease: "emphasis" },
      { mode: "tween", prop: "y", at: p.at, ms, from: r3(a.y), to: r3(b.y), ease: "emphasis" },
      { mode: "tween", prop: "rotation", at: p.at, ms, from: r3(a.ang), to: r3(a.ang + d), ease: "emphasis" },
    ]));
  }
  A.forEach((a, i) => { if (!usedA.has(i)) nodes.push(line(++n, a, a.len, a.len, 0, [])); });       // shrink out
  B.forEach((b, j) => { if (!usedB.has(j)) nodes.push(line(++n, b, b.len, 0, b.len, [])); });       // grow in
  return result({ nodes: [group({ id: p.id, anchor: p.anchor }, nodes)] });
}
