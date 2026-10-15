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
  const ease = track.mode === "press" ? "linear" : track.ease;
  return EASES[ease as Exclude<Ease, "bounce">](x);   // bounce returned above
}

export function lerp(a: number, b: number, p: number) { return a + (b - a) * p; }

// ---------- property resolution ----------
type Tween = Extract<Track, { mode: "tween" }>;
export type TrackCand = { tr: Tween; start: number };
// a tween's value at t; `start` overrides its own start (stagger / reveal offsets) and progress is measured from it
export function tweenValue(tr: Tween, tl: number, index: number, base: number, start?: number): number {
  const from = typeof tr.from === "number" ? tr.from : base;
  const to = typeof tr.to === "number" ? tr.to : base;
  const prog = start === undefined ? trackProgress(tr, tl, index) : trackProgress({ ...tr, at: start, staggerMs: 0 }, tl, 0);
  if (prog === null) return from;
  return from + (to - from) * prog;
}
const CARRY_BLEND_S = 0.08;   // tweens blend from the inherited motion into their own curve over 80 ms
const DERIV_H = 1e-3;         // backward difference for the handoff velocity
const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Several tracks may animate one property: the latest started one wins; before any has started, the earliest one's
// `from` holds. Velocity-preserving retargeting: if the winning track starts while an earlier track on the property
// is still moving, it inherits that motion's velocity — a spring (`bounce`) starts from the current value with it as
// initial velocity; a tween blends from the extrapolated old motion into its own curve over 80 ms (smoothstep, so
// position and velocity stay continuous). From rest (the earlier track finished or never moved) the value is exactly
// the plain track value. `carryVelocity: false` opts a track out.
export function resolveTracks(key: string, base: number, tl: number, cands: TrackCand[]): number {
  const own = cands.filter((c) => c.tr.prop === key);
  if (!own.length) return base;
  const started = own.filter((c) => c.start <= tl);
  const pick = started.length ? started.reduce((x, y) => (y.start >= x.start ? y : x)) : own.reduce((x, y) => (y.start < x.start ? y : x));
  const t0 = pick.start;
  const prev = started.length ? own.filter((c) => c !== pick && c.start < t0) : [];
  // an omitted `from` means the current value: with earlier tracks, the value they hand over at t0
  const x0 = prev.length ? resolveTracks(key, base, t0, prev) : base;
  const plain = tweenValue(pick.tr, tl, 0, typeof pick.tr.from === "number" ? base : x0, pick.start);
  if (!prev.length || pick.tr.carryVelocity === false) return plain;
  const v = handoffVelocity(key, base, t0, prev);
  if (v === 0) return plain;
  const dt = tl - t0;
  if (pick.tr.ease === "bounce") {
    const to = typeof pick.tr.to === "number" ? pick.tr.to : base;
    const sp = pick.tr.spring ?? { stiffness: 700, damping: 18, mass: 1 };
    return to + springOffset(dt, x0 - to, v, sp.stiffness, sp.damping, sp.mass);
  }
  if (dt >= CARRY_BLEND_S) return plain;
  const w = smoothstep(dt / CARRY_BLEND_S);
  return (x0 + v * dt) * (1 - w) + plain * w;
}
// velocity of the earlier tracks' motion at t0; exactly 0 when the track winning at t0 has finished (from rest)
function handoffVelocity(key: string, base: number, t0: number, prev: TrackCand[]): number {
  const win = prev.reduce((x, y) => (y.start >= x.start ? y : x));
  // (1 µs tolerance: timings are authored to the µs, and 1.85 + 0.04 = 1.8900000000000001 must count as "ended at 1.89")
  if (win.tr.ease !== "bounce" && t0 >= win.start + win.tr.ms / 1000 - 1e-6) return 0;
  const v = (resolveTracks(key, base, t0, prev) - resolveTracks(key, base, t0 - DERIV_H, prev)) / DERIV_H;
  return Math.abs(v) < 1e-9 ? 0 : v;
}
// displacement from rest of a damped spring with initial displacement d0 and velocity v0, after t seconds
export function springOffset(t: number, d0: number, v0: number, stiffness = 700, damping = 18, mass = 1): number {
  const w0 = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) return (d0 + (v0 + w0 * d0) * t) * Math.exp(-w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return Math.exp(-zeta * w0 * t) * (d0 * Math.cos(wd * t) + ((v0 + zeta * w0 * d0) / wd) * Math.sin(wd * t));
}

// ---------- colour (fill tweens, onHover fill) ----------
// sRGB lerp of #RRGGBB / #RRGGBBAA, returned as #RRGGBBAA. Perceptual (OKLab) interpolation is a later improvement.
export function lerpColor(a: string, b: string, p: number): string {
  const A = parseHex(a), B = parseHex(b);
  if (!A || !B) return p < 0.5 ? a : b;
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, "0")).join("");
}
function parseHex(c: string): number[] | null {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) : 255];
}

// ---------- cursor (pure functions of the cursor's tracks and t) ----------
type MoveTo = Extract<Track, { mode: "moveTo" }>;
type OnHover = Extract<Track, { mode: "onHover" }>;
const byAt = <T extends { at: number }>(xs: T[]) => [...xs].sort((a, b) => a.at - b.at);

// press: scale multiplier, dipping to 0.96 and back over each press track's ms
export function pressFactor(tracks: Track[], t: number): number {
  let f = 1;
  for (const tr of tracks) {
    if (tr.mode !== "press" || t < tr.at || tr.ms <= 0 || t > tr.at + tr.ms / 1000) continue;
    f *= 1 - 0.04 * Math.sin(Math.PI * (t - tr.at) / (tr.ms / 1000));
  }
  return f;
}

// cursor position: from `start`, each started moveTo eases from where the cursor was toward its target point.
// `point` resolves a moveTo's target point (canvas space) for this frame; null = target not laid out, hold position.
export function cursorPosition(tracks: Track[], t: number, start: { x: number; y: number }, point: (m: MoveTo) => { x: number; y: number } | null) {
  let cur = start;
  for (const m of byAt(tracks.filter((tr): tr is MoveTo => tr.mode === "moveTo"))) {
    if (t < m.at) break;
    const target = point(m);
    if (!target) continue;
    const p = trackProgress(m, t) ?? 0;
    const next = { x: lerp(cur.x, target.x, p), y: lerp(cur.y, target.y, p) };
    if (m.arc) {
      // bow perpendicular to the travel: arc * distance at the midpoint, 0 at both ends
      const dx = target.x - cur.x, dy = target.y - cur.y, len = Math.hypot(dx, dy) || 1, bow = m.arc * len * 4 * p * (1 - p);
      next.x += (-dy / len) * bow; next.y += (dx / len) * bow;
    }
    cur = next;
  }
  return cur;
}

// hover intervals of `nodeId` under a cursor: [arrival of a moveTo that targets it, start of the cursor's next moveTo)
export function hoverIntervals(cursorTracks: Track[], nodeId: string): { start: number; end: number }[] {
  const moves = byAt(cursorTracks.filter((tr): tr is MoveTo => tr.mode === "moveTo"));
  return moves.flatMap((m, i) => m.target === nodeId ? [{ start: m.at + m.ms / 1000, end: i + 1 < moves.length ? moves[i + 1].at : Infinity }] : []);
}
// hover amount 0..1 at t: eases in from each interval's start over ms, eases back out from its end
export function hoverAmount(h: OnHover, intervals: { start: number; end: number }[], t: number): number {
  const live = intervals.filter((iv) => iv.start <= t);
  if (!live.length) return 0;
  const iv = live[live.length - 1];
  const ease = EASES[h.ease], d = Math.max(1e-6, h.ms / 1000);
  const into = (x: number) => ease(Math.min(1, Math.max(0, x / d)));
  if (t < iv.end) return into(t - iv.start);
  return into(iv.end - iv.start) * (1 - into(t - iv.end));
}

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

// ---------- paths (pure, no DOM) ----------
export type Pt = { x: number; y: number };
const PATH_TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
// SVG path -> polylines (one per subpath). Cubics in 24 steps, quadratics in 16; A segments as straight chords.
export function flattenPath(d: string): Pt[][] {
  const toks = d.match(PATH_TOKEN) ?? [];
  const subs: Pt[][] = [];
  let cur: Pt[] = [], x = 0, y = 0, sx = 0, sy = 0, cmd = "", i = 0;
  let lastC: Pt | null = null, lastQ: Pt | null = null;
  const isCmd = (t: string) => /^[A-Za-z]$/.test(t);
  const num = () => (i < toks.length && !isCmd(toks[i]) ? parseFloat(toks[i++]) : NaN);
  const to = (nx: number, ny: number) => { cur.push({ x: nx, y: ny }); x = nx; y = ny; };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      cur.push({ x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 });
    }
    x = x3; y = y3;
  };
  const quad = (x1: number, y1: number, x2: number, y2: number) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 16; k++) { const t = k / 16, u = 1 - t; cur.push({ x: u * u * x0 + 2 * u * t * x1 + t * t * x2, y: u * u * y0 + 2 * u * t * y1 + t * t * y2 }); }
    x = x2; y = y2;
  };
  while (i < toks.length) {
    if (isCmd(toks[i])) cmd = toks[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") { to(sx, sy); lastC = lastQ = null; cmd = ""; continue; }
    const before = i;
    if (C === "M") {
      const nx = num() + ox, ny = num() + oy;
      if (Number.isNaN(nx + ny)) break;
      if (cur.length > 1) subs.push(cur);
      cur = [{ x: nx, y: ny }]; x = sx = nx; y = sy = ny; cmd = rel ? "l" : "L"; lastC = lastQ = null;
    } else if (C === "L") { const nx = num() + ox, ny = num() + oy; if (Number.isNaN(nx + ny)) break; to(nx, ny); lastC = lastQ = null; }
    else if (C === "H") { const nx = num() + ox; if (Number.isNaN(nx)) break; to(nx, y); lastC = lastQ = null; }
    else if (C === "V") { const ny = num() + oy; if (Number.isNaN(ny)) break; to(x, ny); lastC = lastQ = null; }
    else if (C === "C" || C === "S") {
      let x1: number, y1: number;
      if (C === "C") { x1 = num() + ox; y1 = num() + oy; } else { x1 = lastC ? 2 * x - lastC.x : x; y1 = lastC ? 2 * y - lastC.y : y; }
      const x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy;
      if (Number.isNaN(x1 + y1 + x2 + y2 + x3 + y3)) break;
      cubic(x1, y1, x2, y2, x3, y3); lastC = { x: x2, y: y2 }; lastQ = null;
    } else if (C === "Q" || C === "T") {
      let x1: number, y1: number;
      if (C === "Q") { x1 = num() + ox; y1 = num() + oy; } else { x1 = lastQ ? 2 * x - lastQ.x : x; y1 = lastQ ? 2 * y - lastQ.y : y; }
      const x2 = num() + ox, y2 = num() + oy;
      if (Number.isNaN(x1 + y1 + x2 + y2)) break;
      quad(x1, y1, x2, y2); lastQ = { x: x1, y: y1 }; lastC = null;
    } else if (C === "A") {
      for (let k = 0; k < 5; k++) num();
      const nx = num() + ox, ny = num() + oy;
      if (Number.isNaN(nx + ny)) break;
      to(nx, ny); lastC = lastQ = null;
    } else break;
    if (i === before) break;   // malformed: nothing consumed
  }
  if (cur.length > 1) subs.push(cur);
  return subs;
}
export function pathLength(d: string): number {
  let L = 0;
  for (const sub of flattenPath(d)) for (let k = 1; k < sub.length; k++) L += Math.hypot(sub[k].x - sub[k - 1].x, sub[k].y - sub[k - 1].y);
  return L;
}
export function pathBounds(d: string): Box | null {
  const pts = flattenPath(d).flat();
  if (!pts.length) return null;
  return { left: Math.min(...pts.map((q) => q.x)), right: Math.max(...pts.map((q) => q.x)), top: Math.min(...pts.map((q) => q.y)), bottom: Math.max(...pts.map((q) => q.y)) };
}
// a point on a box: anchor (center / edge midpoints) + offset as fractions of the box
export function anchorPoint(b: Box, anchor: "center" | "left" | "right" | "top" | "bottom", offset: { x: number; y: number }): Pt {
  const mx = (b.left + b.right) / 2, my = (b.top + b.bottom) / 2;
  const [x, y] = anchor === "left" ? [b.left, my] : anchor === "right" ? [b.right, my]
    : anchor === "top" ? [mx, b.top] : anchor === "bottom" ? [mx, b.bottom] : [mx, my];
  return { x: x + offset.x * (b.right - b.left), y: y + offset.y * (b.bottom - b.top) };
}
// wire geometry as an SVG path: s = horizontal-tangent cubic, line, arc = quadratic bowing perpendicular by bend*|d|
export function wirePath(a: Pt, b: Pt, curve: "s" | "line" | "arc", bend: number): string {
  if (curve === "line") return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (curve === "arc") {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const cx = (a.x + b.x) / 2 + (-dy / len) * 2 * bend * len, cy = (a.y + b.y) / 2 + (dx / len) * 2 * bend * len;
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  }
  const dx = b.x - a.x;
  return `M ${a.x} ${a.y} C ${a.x + dx * bend} ${a.y} ${b.x - dx * bend} ${b.y} ${b.x} ${b.y}`;
}

// ---------- beat transitions ----------
// unit vector of a direction (y-down)
export function dirVec(d: "left" | "right" | "up" | "down"): { x: number; y: number } {
  return d === "left" ? { x: -1, y: 0 } : d === "right" ? { x: 1, y: 0 } : d === "up" ? { x: 0, y: -1 } : { x: 0, y: 1 };
}

// ---------- camera (pure) ----------
type FrameTrackT = Extract<import("@engine/graph").CameraTrack, { mode: "frame" }>;
const FILL = { wide: 0.5, medium: 0.7, close: 0.9 } as const;
// the view a frame track asks for, for a target box (world space), before clamping
export function frameView(f: FrameTrackT, b: { left: number; right: number; top: number; bottom: number }, W: number, H: number): { zoom: number; cx: number; cy: number } {
  const bw = Math.max(1e-3, b.right - b.left), bh = Math.max(1e-3, b.bottom - b.top);
  const zoom = typeof f.size === "number" ? f.size : Math.min((W * FILL[f.size]) / bw, (H * FILL[f.size]) / bh);
  const mx = (b.left + b.right) / 2, my = (b.top + b.bottom) / 2;
  const [x, y] = f.anchor === "left" ? [b.left, my] : f.anchor === "right" ? [b.right, my]
    : f.anchor === "top" ? [mx, b.top] : f.anchor === "bottom" ? [mx, b.bottom] : [mx, my];
  return { zoom, cx: x + f.offset.x * bw, cy: y + f.offset.y * bh };
}
// keep the viewport inside the canvas: zoom >= 1, centre within [W/2z, W - W/2z] x [H/2z, H - H/2z]
export function clampView(v: { zoom: number; cx: number; cy: number }, W: number, H: number) {
  const zoom = Math.max(1, v.zoom), hw = W / (2 * zoom), hh = H / (2 * zoom);
  return { zoom, cx: Math.min(W - hw, Math.max(hw, v.cx)), cy: Math.min(H - hh, Math.max(hh, v.cy)) };
}
// camera at t by replaying frame tracks: each transition starts from the replayed state at its own `at`
export function cameraState(frames: FrameTrackT[], t: number, base: (t: number) => { zoom: number; cx: number; cy: number },
  target: (f: FrameTrackT, t: number) => { zoom: number; cx: number; cy: number } | null, W: number, H: number) {
  const fs = [...frames].sort((a, b) => a.at - b.at);
  const at = (k: number, time: number): { zoom: number; cx: number; cy: number } => {
    if (k === 0) return clampView(base(time), W, H);
    const f = fs[k - 1];
    if (time < f.at) return at(k - 1, time);
    const to = target(f, time);
    if (!to) return at(k - 1, time);
    const toC = clampView(to, W, H);
    const p = f.ms <= 0 ? 1 : EASES[f.ease](Math.min(1, (time - f.at) / (f.ms / 1000)));
    if (p >= 1) return toC;
    const from = at(k - 1, f.at);
    return clampView({ zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(toC.zoom), p)), cx: lerp(from.cx, toC.cx, p), cy: lerp(from.cy, toC.cy, p) }, W, H);
  };
  return at(fs.length, t);
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
  // the font's variable axes (tag -> range); absent axes can be synthesized (slnt -> oblique shear)
  axes?(font: string): Record<string, { min: number; default: number; max: number }>;
}

export interface RenderTarget { width: number; height: number; ctx: CanvasRenderingContext2D }

// The one entry point. Pure: same (graph, t) -> same pixels. The Remotion harness and the editor both call it.
export type Box = { left: number; right: number; top: number; bottom: number };
export type CameraState = { zoom: number; cx: number; cy: number };   // cx/cy: the world point at the frame centre

export interface Runtime {
  renderFrame(graph: Graph, tSec: number, target: RenderTarget): void;
  // pure layout pass: every node's box in world space (graph units, before the camera), full laid-out extents
  measure(graph: Graph, tSec: number): Map<string, Box>;
  // ids of the drawable nodes visible at tSec (what renderFrame would show: transitions included); for coverage checks
  visible(graph: Graph, tSec: number): string[];
  // the camera at tSec (identity = { zoom: 1, cx: W/2, cy: H/2 })
  camera(graph: Graph, tSec: number): CameraState;
}
