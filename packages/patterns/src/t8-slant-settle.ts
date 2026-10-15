// T8 — variable-font slant settle (R6). "Made by" enters italic / sheared and un-shears to upright; the swap-out
// re-shears. It reads as a font axis (slnt / ital), not a transform. Measured: shear-in 270 ms; swap 200 ms.
// Emits `axis.slnt` tracks (runtime: animated font axes, added for this device; a font without a slnt axis — the
// vendored Inter has only wght — gets a synthetic oblique, as browsers do). Optional `weight` animates the real
// wght axis. The swap re-shears and fades the word while the next one shears in.
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface SlantSettleParams {
  id: string;                     // <id> and, with a swap, <id>-next
  text: string;
  style: TextStyleIn;
  at: number;
  anchor?: AnchorIn;
  slant?: number;                 // slnt the word enters / leaves with (degrees, negative leans right)
  ms?: number;
  weight?: { from: number; to: number };            // real wght axis, alongside the slant
  swap?: { at: number; text: string; ms?: number };
}

export function slantSettle(p: SlantSettleParams): MacroResult {
  const slant = p.slant ?? -12, ms = p.ms ?? 270;
  const enter = (at: number): TweenTrackIn[] => [
    { mode: "tween", prop: "axis.slnt", at, ms, from: slant, to: 0, ease: "settle" },
    { mode: "tween", prop: "opacity", at, ms: Math.round(ms * 0.6), from: 0, to: 1, ease: "settle" },
    ...(p.weight ? [{ mode: "tween" as const, prop: "axis.wght", at, ms, from: p.weight.from, to: p.weight.to, ease: "settle" as const }] : []),
  ];
  const first: TweenTrackIn[] = enter(p.at);
  const nodes: NodeIn[] = [];
  if (p.swap) {
    const sms = p.swap.ms ?? 200;
    first.push(
      { mode: "tween", prop: "axis.slnt", at: p.swap.at, ms: sms, from: 0, to: slant, ease: "settle" },
      { mode: "tween", prop: "opacity", at: p.swap.at, ms: sms, from: 1, to: 0, ease: "settle" },
    );
    nodes.push({ id: `${p.id}-next`, type: "text", text: p.swap.text, style: p.style, ...(p.anchor ? { anchor: p.anchor } : {}),
      tracks: [{ mode: "tween", prop: "opacity", at: 0, ms: 0, from: 0, to: 0, ease: "linear" }, ...enter(sec(p.swap.at + sms / 2000))] });
  }
  nodes.unshift({ id: p.id, type: "text", text: p.text, style: p.style, ...(p.anchor ? { anchor: p.anchor } : {}), tracks: first });
  return result({ nodes });
}
