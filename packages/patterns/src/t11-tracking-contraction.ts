// T11 — tracking contraction (R4). A label lands with very wide letter-spacing (≈ +0.6 em) that contracts to normal.
// Measured: 500 ms ease-out. Runtime: a node-level `tracking` tween (em) replaces style.tracking while it runs; the
// run stays centred because recentring uses the tracked width.
import { result, type AnchorIn, type MacroResult, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface TrackingContractionParams {
  id: string;
  text: string;
  style: TextStyleIn;
  at: number;
  anchor?: AnchorIn;
  fromTracking?: number;          // em
  toTracking?: number;            // em (default: the style's tracking)
  ms?: number;
  fadeMs?: number;                // the label fades in while it contracts (0 = no fade)
}

export function trackingContraction(p: TrackingContractionParams): MacroResult {
  const ms = p.ms ?? 500, fadeMs = p.fadeMs ?? 250;
  const tracks: TweenTrackIn[] = [
    { mode: "tween", prop: "tracking", at: p.at, ms, from: p.fromTracking ?? 0.6, to: p.toTracking ?? p.style.tracking ?? 0, ease: "settle" },
  ];
  if (fadeMs > 0) tracks.push({ mode: "tween", prop: "opacity", at: p.at, ms: fadeMs, from: 0, to: 1, ease: "settle" });
  return result({ nodes: [{ id: p.id, type: "text", text: p.text, style: p.style, ...(p.anchor ? { anchor: p.anchor } : {}), tracks }] });
}
