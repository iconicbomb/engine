// Assembly: macros return loose nodes plus edits aimed at other nodes by id; these helpers place the nodes and
// apply the edits. Still pure — no macro or helper reads anything but its arguments.
import type { AnchorIn, GroupNodeIn, MacroResult, NodeIn, TrackIn } from "./macro";

export function group(p: { id: string; anchor?: AnchorIn; x?: number; y?: number; opacity?: number; tracks?: TrackIn[] }, children: NodeIn[]): GroupNodeIn {
  return {
    id: p.id, type: "group", ...(p.anchor ? { anchor: p.anchor } : {}), ...(p.x ? { x: p.x } : {}), ...(p.y ? { y: p.y } : {}),
    ...(p.opacity !== undefined ? { opacity: p.opacity } : {}), tracks: p.tracks ?? [], children,
  };
}

// Key order for emitted nodes, so a regenerated fixture diffs cleanly against a hand-written one.
const NODE_KEYS = ["id", "type", "text", "follows", "glyphs", "padding", "w", "h", "radius", "fill", "stroke", "sizeToContent", "style", "fit", "recenterEaseMs", "spring", "anchor", "x", "y", "clip", "opacity", "scale", "tracks", "children"];
function ordered(n: NodeIn): NodeIn {
  const src = n as Record<string, unknown>;
  const keys = [...NODE_KEYS.filter((k) => k in src), ...Object.keys(src).filter((k) => !NODE_KEYS.includes(k))];
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = src[k];
  return out as NodeIn;
}

/** Applies every result's `tracks` and `patches` to the node tree (by id). Throws on an id that doesn't exist. */
export function applyEdits(nodes: NodeIn[], results: MacroResult[]): NodeIn[] {
  const edits = results.flatMap((r) => [
    ...r.patches.map((p) => ({ target: p.target, apply: (n: any) => ({ ...n, ...p.set }) })),
    ...r.tracks.map((t) => ({ target: t.target, apply: (n: any) => ({ ...n, tracks: [...(n.tracks ?? []), t.track] }) })),
  ]);
  const hit = new Set<string>();
  const walk = (n: NodeIn): NodeIn => {
    let out: any = n;
    for (const e of edits) if (e.target === n.id) { out = e.apply(out); hit.add(e.target); }
    if (out.type === "group") out = { ...out, children: out.children.map(walk) };
    return ordered(out);
  };
  const tree = nodes.map(walk);
  const missing = edits.map((e) => e.target).filter((t) => !hit.has(t));
  if (missing.length) throw new Error(`macro edit targets unknown node(s): ${[...new Set(missing)].join(", ")}`);
  return tree;
}
