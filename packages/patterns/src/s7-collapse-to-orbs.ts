// S7 — collapse-to-orbs (R5). Row labels shrink to width 0 leaving the leading icon; the icons break out of the list
// and drift apart as depth-blurred spheres. Measured: collapse 200 ms; drift 900 ms with a depth-of-field blur ramp.
// Built from primitives: a layout:column list of layout:row rows (orb + label); labels collapse with clip.w; each orb
// then drifts to a deterministic golden-angle offset with a depth (scale 0.6–1.5) whose distance from the focal depth
// sets its blur (node `blur`, added for this device). Orbs are flat circles with a highlight (no lighting).
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn } from "./macro";

export interface CollapseToOrbsParams {
  id: string;                     // list group; rows <id>-row-<n> hold <id>-orb-<n> and <id>-label-<n>
  rows: { label: string; color: string }[];
  style: TextStyleIn;             // labels
  at: number;                     // the collapse starts
  anchor?: AnchorIn;
  orbSize?: number;
  collapseMs?: number;
  driftMs?: number;
  driftRadius?: number;           // px
  dofBlur?: number;               // px at the farthest depth
}

export function collapseToOrbs(p: CollapseToOrbsParams): MacroResult {
  const size = p.orbSize ?? Math.round(p.style.size * 1.3), collapse = p.collapseMs ?? 200, drift = p.driftMs ?? 900;
  const radius = p.driftRadius ?? 380, dof = p.dofBlur ?? 12, driftAt = sec(p.at + collapse / 1000);
  const rows: NodeIn[] = p.rows.map((r, i) => {
    const n = i + 1, ang = (i * 137.508 * Math.PI) / 180, frac = (i * 0.618034) % 1, depth = (i * 0.381966 + 0.2) % 1;
    const dist = radius * (0.55 + 0.45 * frac), scale = 0.6 + 0.9 * depth, blur = dof * Math.abs(depth - 0.5) * 2;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const orb: NodeIn = { id: `${p.id}-orb-${n}`, type: "rect", w: size, h: size, radius: size / 2, fill: r.color,
      children: [{ id: `${p.id}-orb-${n}-shine`, type: "rect", w: size * 0.34, h: size * 0.34, radius: size, fill: "#FFFFFF59", x: -size * 0.18, y: -size * 0.18 }],
      tracks: [
        { mode: "tween", prop: "x", at: driftAt, ms: drift, from: 0, to: round(Math.cos(ang) * dist), ease: "settle" },
        { mode: "tween", prop: "y", at: driftAt, ms: drift, from: 0, to: round(Math.sin(ang) * dist * 0.7), ease: "settle" },
        { mode: "tween", prop: "scale", at: driftAt, ms: drift, from: 1, to: round(scale), ease: "settle" },
        { mode: "tween", prop: "blur", at: driftAt, ms: drift, from: 0, to: round(blur), ease: "settle" },
      ] };
    const labelW = Math.round([...r.label].length * p.style.size * 0.62);
    const label: NodeIn = { id: `${p.id}-label-${n}`, type: "text", text: r.label, style: { ...p.style, align: "left" },
      clip: { x: 0, y: -p.style.size, w: labelW, h: p.style.size * 2 },
      tracks: [{ mode: "tween", prop: "clip.w", at: p.at, ms: collapse, from: labelW, to: 0, ease: "settle" }] };
    return group({ id: `${p.id}-row-${n}`, layout: { type: "row", gap: Math.round(p.style.size * 0.5), align: "center" } }, [orb, label]);
  });
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, layout: { type: "column", gap: Math.round(size * 0.35), align: "start" } }, rows)] });
}
