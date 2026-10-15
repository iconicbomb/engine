// Showcase: every demo scene (R3 first, then the SCENES registry order) concatenated into one graph. Each scene is
// schema-parsed first (so defaults such as style colour "tokens.text" are explicit), then its token references are
// resolved against that scene's own tokens; beats are renumbered and every node id — and every string that refers
// to one (follows, moveTo / onHover, wire ends, camera frame targets) — is rewritten to the new beat prefix. Each
// scene after the first enters with a crossfade. Written by `pnpm gen:fixtures` to fixtures/showcase.graph.json;
// excluded from the default render-check (render it with tools/render-local.mjs --aspect).
import { parseGraph } from "@engine/graph";
import { SCENES } from "./index";

const SHOWCASE_TOKENS = { bg: "#0B0D12", text: "#FFFFFF", accent: "#FF8A3D", surface: "#1A1D26", font: "Inter" };

export function buildShowcase() {
  const beats: Record<string, unknown>[] = [];
  let start = 0;
  for (const name of Object.keys(SCENES)) {
    const g = parseGraph(SCENES[name]()) as unknown as { tokens: Record<string, string>; beats: Record<string, unknown>[] };
    const sorted = [...g.beats].sort((a, b) => (a.start as number) - (b.start as number));
    // old beat id -> new beat id, and every node id in the scene -> its renumbered id
    const beatMap = new Map<string, string>(), idMap = new Map<string, string>();
    sorted.forEach((b, i) => beatMap.set(b.id as string, `b${beats.length + i + 1}`));
    const collect = (n: Record<string, unknown>, oldBeat: string) => {
      const id = n.id as string;
      idMap.set(id, `${beatMap.get(oldBeat)}${id.slice(oldBeat.length)}`);
      ((n.children as Record<string, unknown>[] | undefined) ?? []).forEach((c) => collect(c, oldBeat));
    };
    for (const b of sorted) (b.nodes as Record<string, unknown>[]).forEach((n) => collect(n, b.id as string));
    const rewrite = (v: unknown): unknown => {
      if (typeof v === "string") {
        if (idMap.has(v)) return idMap.get(v);
        if (v.startsWith("tokens.") && g.tokens[v.slice(7)] !== undefined) return g.tokens[v.slice(7)];
        return v;
      }
      if (Array.isArray(v)) return v.map(rewrite);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]));
      return v;
    };
    sorted.forEach((b, i) => {
      const nb = rewrite(b) as Record<string, unknown>;
      nb.id = beatMap.get(b.id as string);
      nb.start = Math.round((start + ((b.start as number) - (sorted[0].start as number))) * 1e6) / 1e6;   // µs, as all timings
      if (i === 0 && beats.length > 0) nb.transition = { type: "crossfade" };
      beats.push(nb);
    });
    const last = sorted[sorted.length - 1];
    start = Math.round((start + ((last.start as number) - (sorted[0].start as number)) + (last.duration as number)) * 1e6) / 1e6;
  }
  return { version: 1, canvas: { aspect: "16:9", refHeight: 1080, fps: 30 }, tokens: SHOWCASE_TOKENS, beats };
}
