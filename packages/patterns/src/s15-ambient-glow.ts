// S15 — glow / neon environment (R8, R9; also R3's backdrop). Brand-colour bloom under the content plus a softer
// glow from the top, each fading in. Only the elliptical glows exist in the runtime today; the spec's god-rays,
// halo arc, sparkles and drifting bokeh (rayCount, sparkleDensity) are not modelled yet.
import { result, type GlowIn, type MacroResult } from "./macro";

export interface GlowLayer {
  x: number; y: number;      // centre, canvas fractions (may sit just off-canvas)
  rx: number; ry: number;    // radii, canvas fractions
  intensity: number;         // resting intensity, 0..1
  color?: string;            // defaults to the macro's bloomColor
  fadeIn?: { at: number; ms: number };
}

export interface AmbientGlowParams {
  bloomColor?: string;
  layers?: GlowLayer[];                    // default: under-glow + top glow
  fadeIn?: { at: number; ms: number };     // for layers without their own; default: from the beat start over enterMs
}

export const DEFAULT_GLOW_LAYERS: GlowLayer[] = [
  { x: 0.5, y: 1.03, rx: 0.72, ry: 0.9, intensity: 0.39 },   // bloom under the content
  { x: 0.5, y: -0.03, rx: 0.6, ry: 0.65, intensity: 0.2 },   // softer glow from the top
];

export function ambientGlow(p: AmbientGlowParams = {}): MacroResult {
  const color = p.bloomColor ?? "tokens.accent";
  const glows: GlowIn[] = (p.layers ?? DEFAULT_GLOW_LAYERS).map((l) => {
    const fade = l.fadeIn ?? p.fadeIn ?? { at: 0, ms: 400 };
    return {
      x: l.x, y: l.y, rx: l.rx, ry: l.ry, color: l.color ?? color, intensity: l.intensity,
      tracks: [{ mode: "tween", prop: "intensity", at: fade.at, ms: fade.ms, from: 0, to: l.intensity, ease: "settle" }],
    };
  });
  return result({ glows });
}
