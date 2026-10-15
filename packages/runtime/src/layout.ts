// @engine/runtime — layout: anchors for both aspects, fit-to-width, and deterministic smoothing.
// Everything here is a pure function of time; no state is carried between frames.
import type { Node } from "@engine/graph";

export type Aspect = "16:9" | "9:16";

export function canvasSize(aspect: Aspect, refHeight: number): { w: number; h: number } {
  return { w: Math.round(aspect === "16:9" ? refHeight * 16 / 9 : refHeight * 9 / 16), h: refHeight };
}

export function resolveAnchor(node: Node, aspect: Aspect, w: number, h: number): { x: number; y: number; scale: number } {
  const a = node.anchor;
  const o = a.overrides?.[aspect];
  return { x: (o?.x ?? a.x) * w, y: (o?.y ?? a.y) * h, scale: o?.scale ?? 1 };
}

// A target value that changes in steps at known times (e.g. the visible width of a typewriter after each glyph),
// smoothed with an exponential approach of time constant tauMs. Computed by replaying the steps up to t, so the
// result depends only on t — a frame can be rendered in isolation and still match its neighbours.
export function smoothedSteps(steps: { t: number; value: number }[], t: number, tauMs: number, initial: number): number {
  const tau = Math.max(1e-6, tauMs / 1000);
  let v = initial, target = initial, last = 0;
  for (const s of steps) {
    if (s.t > t) break;
    v = v + (target - v) * (1 - Math.exp(-(s.t - last) / tau));   // approach the old target until this step lands
    target = s.value; last = s.t;
  }
  return v + (target - v) * (1 - Math.exp(-(t - last) / tau));
}

// Fit-to-width: the scale that keeps a run of width `widthPx` (at scale 1) inside boxW, never above 1, never below minScale.
export function fitScale(widthPx: number, lineHeightPx: number, boxW: number, boxH: number, minScale: number): number {
  const sw = widthPx > 0 ? boxW / widthPx : 1;
  const sh = lineHeightPx > 0 ? boxH / lineHeightPx : 1;
  return Math.max(minScale, Math.min(1, sw, sh));
}
