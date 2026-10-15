// @engine/runtime — phase 0 core: easing, springs, track evaluation, and the interfaces every
// other module implements. This file has no DOM or canvas dependency so it runs in tests and in Node.
import type { Graph, Track, Node, Ease } from "@engine/graph";
import { glyphTime, glyphHideTime } from "@engine/graph";

// ---------- easing (measured on the references, see spec "Timing and easing model") ----------
// cubic-bezier solver (same semantics as CSS). Returns y for progress x in [0,1].
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const dx = sampleX(t) - x; if (Math.abs(dx) < 1e-6) break; const s = slopeX(t); if (Math.abs(s) < 1e-6) break; t -= dx / s; }
    let lo = 0, hi = 1; if (t < 0 || t > 1 || Math.abs(sampleX(t) - x) > 1e-5) { t = x; while (hi - lo > 1e-6) { t = (lo + hi) / 2; if (sampleX(t) < x) lo = t; else hi = t; } }
    return sampleY(t);
  };
}

export const EASES: Record<Exclude<Ease, "bounce">, (x: number) => number> = {
  linear: (x) => Math.min(1, Math.max(0, x)),
  settle: cubicBezier(0.16, 1, 0.3, 1),     // expo-out: R8 card stack, R9 dashboard — no overshoot, long tail
  emphasis: cubicBezier(0.5, 0, 0.1, 1),    // in-out with a longer out: R6 numeral scale-up, peak velocity ~35% in
};

// Underdamped spring, closed form, from 0 to 1 with zero initial velocity. t in seconds.
export function spring(t: number, stiffness = 700, damping = 18, mass = 1): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) { const a = w0 * t; return 1 - (1 + a) * Math.exp(-a); } // critically damped fallback
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
}
// Time for the spring to stay within `tol` of rest — used when a track says ease:"bounce" with no ms.
export function springSettleTime(stiffness = 700, damping = 18, mass = 1, tol = 0.01): number {
  const w0 = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  return -Math.log(tol * Math.sqrt(1 - zeta * zeta)) / (zeta * w0);
}

// Progress 0..1 of a track at beat-local time `t` (seconds). Returns null before the track starts.
export function trackProgress(track: Track, t: number, index = 0): number | null {
  const start = track.at + (track.mode === "tween" ? (track.staggerMs ?? 0) * index / 1000 : 0);
  if (t < start) return null;
  if (track.mode === "typewriter") return Math.min(1, (t - start) / (track.ms / 1000));
  if (track.mode === "tween" && track.ease === "bounce") {
    const s = track.spring ?? { stiffness: 700, damping: 18, mass: 1 };
    return spring(t - start, s.stiffness, s.damping, s.mass);
  }
  const raw = track.ms === 0 ? 1 : (t - start) / (track.ms / 1000);
  const x = raw >= 1 - 1e-6 ? 1 : raw;
  return EASES[track.ease as Exclude<Ease, "bounce">](x);   // bounce returned above
}

export function lerp(a: number, b: number, p: number) { return a + (b - a) * p; }

// ---------- typewriter state (what the renderer needs per glyph at time t) ----------
export type GlyphState = {
  visible: boolean;
  scrambled: string | null;   // substitute glyph to draw instead of the real one, or null
  freshness: number;          // 1 = just typed, decays to 0 over tail.decayMs
};
export function typewriterGlyphs(track: Extract<Track, { mode: "typewriter" }>, glyphs: string[], t: number, fps: number): GlyphState[] {
  return glyphs.map((_, i) => {
    const shown = glyphTime(track, glyphs, i);
    if (t < shown || t >= glyphHideTime(track, glyphs, i)) return { visible: false, scrambled: null, freshness: 0 };
    const age = t - shown;
    const scrambleFor = track.scramble.frames / fps;
    const scrambled = age < scrambleFor ? track.scramble.symbols[(i * 7 + Math.floor(age * fps)) % track.scramble.symbols.length] : null;
    const freshness = track.tail.len > 0 && track.tail.decayMs > 0 ? Math.max(0, 1 - age / (track.tail.decayMs / 1000)) : 0;
    return { visible: true, scrambled, freshness };
  });
}

// ---------- interfaces the rest of phase 0 implements ----------
export interface ShapedGlyph {
  glyph: string;      // the source character(s) of this glyph's cluster
  gid: number;
  cluster: number;    // code-point index into the source text
  xAdvance: number;   // px
  xOffset: number;    // px
  yOffset: number;    // px, y-down
  d: string;          // SVG path in px, y-down, origin at the glyph's pen position
}
export interface FontMetrics { ascender: number; descender: number; capHeight: number; xHeight: number } // em units
export interface Shaper {
  // harfbuzzjs behind this; `axes` are variable-font axis values ("wght", "slnt", ...)
  // features: OpenType feature strings as HarfBuzz parses them ("tnum", "-liga", "ss01=1")
  shape(text: string, font: string, sizePx: number, axes: Record<string, number>, features?: string[]): ShapedGlyph[];
  metrics(font: string): FontMetrics;
}

export interface RenderTarget { width: number; height: number; ctx: CanvasRenderingContext2D }

// The one entry point. Pure: same (graph, t) -> same pixels. The Remotion harness and the editor both call it.
export interface Runtime {
  renderFrame(graph: Graph, tSec: number, target: RenderTarget): void;
}
