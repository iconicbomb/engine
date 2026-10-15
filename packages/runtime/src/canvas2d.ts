// @engine/runtime — Canvas 2D implementation of `Runtime`. renderFrame(graph, t) is a pure function of its inputs:
// every value is derived from t by replaying the graph's tracks, so any frame can be rendered in isolation.
import type { Graph, Node, Track, Beat } from "@engine/graph";
import { trackProgress, typewriterGlyphs, glyphTime, typewriterEnd, spring } from "./runtime-core";
import type { Runtime, Shaper, ShapedGlyph, RenderTarget, GlyphState } from "./runtime-core";
import { resolveAnchor, smoothedSteps, fitScale, canvasSize } from "./layout";
import { EASES } from "./runtime-core";
const EASE_SETTLE = EASES.settle;
import type { Aspect } from "./layout";

type TextNode = Extract<Node, { type: "text" }>;
type RectNode = Extract<Node, { type: "rect" }>;
type BracketNode = Extract<Node, { type: "bracket" }>;
type TweenTrack = Extract<Track, { mode: "tween" }>;
type TypewriterTrack = Extract<Track, { mode: "typewriter" }>;

// What a drawn text node leaves behind for siblings (brackets) in the parent's coordinate space.
type Extents = { left: number; right: number; top: number; bottom: number; scale: number; steps: { t: number; right: number }[] };

type NumericProps = { opacity: number; scale: number; rotation: number; x: number; y: number };
const NUMERIC = new Set(["opacity", "scale", "rotation", "x", "y"]);

export function createRuntime(opts: { shaper: Shaper }): Runtime {
  const { shaper } = opts;
  const pathCache = new Map<string, Path2D>();
  const path2d = (d: string) => { let p = pathCache.get(d); if (!p) { p = new Path2D(d); pathCache.set(d, p); } return p; };

  function renderFrame(graph: Graph, tSec: number, target: RenderTarget) {
    const { ctx } = target;
    const aspect = graph.canvas.aspect as Aspect;
    const { w, h } = canvasSize(aspect, graph.canvas.refHeight);
    const k = target.height / h;                       // graph units -> device px
    const beat = pickBeat(graph.beats, tSec);
    const tl = tSec - beat.start;                      // beat-local time
    const tokens = graph.tokens;
    const fps = graph.canvas.fps;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    ctx.fillStyle = color(beat.background, tokens);
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    drawGlows(beat, ctx, tokens, tl, w, h);
    const env: Env = { ctx, tokens, tl, fps, aspect, w, h, extents: new Map() };
    drawNodes(beat.nodes, env, true);
  }

  // Background glows: additive elliptical radial gradients with a gaussian-like falloff that reaches zero.
  function drawGlows(beat: Beat, ctx: CanvasRenderingContext2D, tokens: Record<string, string>, tl: number, w: number, h: number) {
    for (const g of beat.glows) {
      let intensity = g.intensity;
      for (const tr of g.tracks) if (tr.mode === "tween" && tr.prop === "intensity") intensity = tweenValue(tr, tl, 0, intensity);
      if (intensity <= 0) continue;
      const [r, gg, b] = hexToRgb(color(g.color, tokens));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(g.x * w, g.y * h);
      ctx.scale(g.rx * w, g.ry * h);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const stops: [number, number][] = [[0, 1], [0.2, 0.78], [0.4, 0.42], [0.6, 0.17], [0.8, 0.045], [1, 0]];
      for (const [p, a] of stops) grad.addColorStop(p, `rgba(${r},${gg},${b},${(a * intensity).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }

  type Env = { ctx: CanvasRenderingContext2D; tokens: Record<string, string>; tl: number; fps: number; aspect: Aspect; w: number; h: number; extents: Map<string, Extents> };

  function drawNodes(nodes: Node[], env: Env, topLevel: boolean) {
    for (const node of nodes) drawNode(node, env, topLevel);
  }

  function drawNode(node: Node, env: Env, topLevel: boolean) {
    const { ctx } = env;
    const a = resolveAnchor(node, env.aspect, env.w, env.h);
    const props = numericProps(node, env.tl);
    // top-level anchors are canvas positions; a child's anchor is relative to its parent's origin
    const cx = (topLevel ? a.x : a.x - env.w / 2) + props.x;
    const cy = (topLevel ? a.y : a.y - env.h / 2) + props.y;
    const nodeScale = props.scale * a.scale;
    if (props.opacity <= 0) return;

    ctx.save();
    ctx.translate(cx, cy);
    if (props.rotation) ctx.rotate(props.rotation * Math.PI / 180);
    ctx.scale(nodeScale, nodeScale);
    ctx.globalAlpha *= clamp01(props.opacity);

    switch (node.type) {
      case "group": {
        const inner: Env = { ...env, extents: new Map() };
        drawNodes((node as { children: Node[] }).children, inner, false);
        break;
      }
      case "rect": drawRect(node as RectNode, env); break;
      case "text": {
        const ext = drawText(node as TextNode, env);
        // extents are reported in the parent's space (undo this node's transform)
        env.extents.set(node.id, {
          left: cx + ext.left * nodeScale, right: cx + ext.right * nodeScale,
          top: cy + ext.top * nodeScale, bottom: cy + ext.bottom * nodeScale,
          scale: ext.scale * nodeScale,
          steps: ext.steps.map(s => ({ t: s.t, right: cx + s.right * nodeScale })),
        });
        break;
      }
      case "bracket": drawBracket(node as BracketNode, env, cx, cy, nodeScale); break;
    }
    ctx.restore();
  }

  // ---------- properties ----------
  function numericProps(node: Node, tl: number): NumericProps {
    const p: NumericProps = { opacity: node.opacity, scale: node.scale, rotation: node.rotation, x: 0, y: 0 };
    for (const tr of node.tracks) {
      if (tr.mode !== "tween" || !NUMERIC.has(tr.prop) || tr.staggerMs > 0) continue;
      const key = tr.prop as keyof NumericProps;
      p[key] = tweenValue(tr, tl, 0, p[key]);
    }
    return p;
  }
  function tweenValue(tr: TweenTrack, tl: number, index: number, base: number): number {
    const from = typeof tr.from === "number" ? tr.from : base;
    const to = typeof tr.to === "number" ? tr.to : base;
    const prog = trackProgress(tr, tl, index);
    if (prog === null) return from;
    return from + (to - from) * prog;
  }
  // per-glyph offsets from staggered tween tracks on a text node
  function glyphProps(node: TextNode, tl: number, index: number): NumericProps {
    const p: NumericProps = { opacity: 1, scale: 1, rotation: 0, x: 0, y: 0 };
    for (const tr of node.tracks) {
      if (tr.mode !== "tween" || !NUMERIC.has(tr.prop) || tr.staggerMs <= 0) continue;
      const key = tr.prop as keyof NumericProps;
      p[key] = tweenValue(tr, tl, index, p[key]);
    }
    return p;
  }

  // ---------- text ----------
  function drawText(node: TextNode, env: Env): Extents & { scale: number } {
    const { ctx, tokens, tl, fps } = env;
    const style = node.style;
    const fontName = resolveToken(style.font, tokens);
    const size = style.size;
    const axes = { wght: style.weight, ...style.axes };
    const glyphs = shaper.shape(node.text, fontName, size, axes);
    const metrics = shaper.metrics(fontName);
    const chars = [...node.text];
    const tw = node.tracks.find((t: Track): t is TypewriterTrack => t.mode === "typewriter");
    const states: GlyphState[] = tw ? typewriterGlyphs(tw, chars, tl, fps) : chars.map(() => ({ visible: true, scrambled: null, freshness: 0 }));

    // tracking (letter-spacing) in em
    const tracking = style.tracking * size;
    const advance = (g: ShapedGlyph) => g.xAdvance + tracking;
    const widthUpTo = (n: number) => glyphs.reduce((acc, g) => acc + (g.cluster < n ? advance(g) : 0), 0);
    const fullWidth = widthUpTo(chars.length);
    const visibleCount = states.filter(s => s.visible).length;
    const visibleWidth = widthUpTo(visibleCount);

    // fit-to-width: replay the typewriter steps so the smoothed scale depends only on t
    let scale = 1;
    const steps: { t: number; right: number }[] = [];
    // safe area: no text run may exceed 90% of the canvas width, whatever the aspect (9:16 reuses 16:9 graphs)
    const safeW = env.w * 0.9;
    const fit = node.fit
      ? { ...node.fit, w: Math.min(node.fit.w, safeW) }
      : fullWidth > safeW ? { w: safeW, h: env.h, minScale: 0.1, recenter: true, easeMs: 0 } : undefined;
    if (fit) {
      const f = fit;
      const lineH = size * (metrics.ascender - metrics.descender);
      if (tw) {
        const stepScales = chars.map((_, i) => ({ t: glyphTime(tw, chars, i + 1), value: fitScale(widthUpTo(i + 1), lineH, f.w, f.h, f.minScale) }));
        scale = smoothedSteps(stepScales, tl, f.easeMs, fitScale(0, lineH, f.w, f.h, f.minScale));
      } else {
        scale = fitScale(fullWidth, lineH, f.w, f.h, f.minScale);
      }
    }
    // run origin (centre of the visible run on the anchor when recentering)
    const runW = fit?.recenter === false ? fullWidth : visibleWidth;
    const x0 = style.align === "left" ? 0 : style.align === "right" ? -runW : -runW / 2;
    const baseline = metrics.capHeight * size / 2;     // caps vertically centred on the anchor

    if (tw) {
      for (let i = 0; i < chars.length; i++) steps.push({ t: glyphTime(tw, chars, i + 1), right: 0 }); // filled below
    }

    ctx.save();
    ctx.scale(scale, scale);
    const baseColor = color(style.color, tokens);
    const tailColor = tw ? color(tw.tail.color, tokens) : baseColor;

    // pass 1: glyphs
    let pen = x0;
    const positions: number[] = [];
    for (const g of glyphs) {
      positions.push(pen);
      const st = states[g.cluster] ?? states[states.length - 1];
      if (st?.visible) {
        const gp = glyphProps(node, tl, g.cluster);
        if (gp.opacity > 0) {
          const d = st.scrambled ? scrambleGlyph(st.scrambled, fontName, size, axes) : g.d;
          ctx.save();
          ctx.translate(pen + g.xOffset + gp.x, baseline + g.yOffset + gp.y);
          if (gp.scale !== 1) ctx.scale(gp.scale, gp.scale);
          ctx.globalAlpha *= clamp01(gp.opacity);
          ctx.fillStyle = st.freshness > 0 ? mix(baseColor, tailColor, st.freshness * 0.35) : baseColor;
          ctx.fill(path2d(d));
          ctx.restore();
        }
      }
      pen += advance(g);
    }
    // pass 2: bloom on fresh glyphs (phase-0 stand-in: blurred additive redraw; real multi-radius bloom is phase 6)
    if (tw && tw.bloom.radius > 0 && tw.bloom.intensity > 0) {
      glyphs.forEach((g, gi) => {
        const st = states[g.cluster];
        if (!st?.visible || st.freshness <= 0) return;
        const d = st.scrambled ? scrambleGlyph(st.scrambled, fontName, size, axes) : g.d;
        for (const [r, wgt] of [[tw.bloom.radius, 0.7], [tw.bloom.radius * 2.5, 0.45]] as const) {   // tight + wide layers
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha *= clamp01(st.freshness * tw.bloom.intensity * wgt);
          ctx.filter = `blur(${r}px)`;
          ctx.translate(positions[gi] + g.xOffset, baseline + g.yOffset);
          ctx.fillStyle = tailColor;
          ctx.fill(path2d(d));
          ctx.restore();
        }
      });
    }
    // pass 3: caret
    if (tw && tw.caret.style !== "none") {
      const typingEnd = typewriterEnd(tw, chars);
      const typing = tl >= tw.at && tl < typingEnd;
      const alive = tl < typingEnd + tw.caret.holdAfterMs / 1000 || typing;
      const blinkOn = Math.floor((tl * 1000) / tw.caret.blinkMs) % 2 === 0;
      if (alive && (typing || blinkOn || tl < tw.at)) {
        // before typing starts the caret lands from preScale to 1 (settle ease), as in R3's opening
        const pre = tl < tw.at && tw.at > 0 ? 1 + (tw.caret.preScale - 1) * (1 - EASE_SETTLE(tl / tw.at)) : 1;
        const em = size * pre;
        const cw = tw.caret.style === "block" ? em * 0.5 : tw.caret.style === "glass" ? Math.max(3, em * 0.09) : Math.max(2, em * 0.06);
        const chh = (metrics.ascender - metrics.descender) * em * 0.95;
        const cx0 = x0 + visibleWidth + size * 0.04, cy0 = baseline - metrics.ascender * size * 0.95 - (chh - (metrics.ascender - metrics.descender) * size * 0.95) / 2;
        const cc = tw.caret.color ? color(tw.caret.color, tokens) : tailColor;
        if (tw.caret.style === "glass") {
          ctx.save();
          roundRectPath(ctx, cx0, cy0, cw, chh, cw / 2);
          ctx.globalAlpha *= 0.35; ctx.fillStyle = cc; ctx.fill();
          ctx.globalAlpha /= 0.35; ctx.globalAlpha *= 0.9; ctx.strokeStyle = cc; ctx.lineWidth = Math.max(1.5, em * 0.012); ctx.stroke();
          ctx.restore();
        } else {
          ctx.fillStyle = cc;
          ctx.fillRect(cx0, cy0, cw, chh);
        }
      }
    }
    ctx.restore();

    // extents in this node's local space (before the fit scale is undone by the caller's nodeScale)
    const top = baseline - metrics.ascender * size, bottom = baseline - metrics.descender * size;
    for (let i = 0; i < steps.length; i++) {
      const wI = widthUpTo(i + 1);
      const xr = (style.align === "left" ? 0 : style.align === "right" ? -wI : -wI / 2) + wI;
      steps[i].right = xr * scale;                     // approximate: uses the current scale for all steps
    }
    return { left: x0 * scale, right: (x0 + visibleWidth) * scale, top: top * scale, bottom: bottom * scale, scale, steps };
  }

  const scrambleCache = new Map<string, string>();
  function scrambleGlyph(ch: string, fontName: string, size: number, axes: Record<string, number>): string {
    const key = `${ch}|${fontName}|${size}|${JSON.stringify(axes)}`;
    let d = scrambleCache.get(key);
    if (d === undefined) { d = shaper.shape(ch, fontName, size, axes)[0]?.d ?? ""; scrambleCache.set(key, d); }
    return d;
  }

  // ---------- bracket ----------
  function drawBracket(node: BracketNode, env: Env, cx: number, cy: number, nodeScale: number) {
    const { ctx, tokens, tl } = env;
    const ext = env.extents.get(node.follows);
    if (!ext) return;
    const fontName = resolveToken(node.style.font, tokens);
    const size = node.style.size * ext.scale;          // brackets follow the text's fit scale
    const axes = { wght: node.style.weight, ...node.style.axes };
    const [lg] = shaper.shape(node.glyphs[0], fontName, size, axes);
    const [rg] = shaper.shape(node.glyphs[1], fontName, size, axes);
    const m = shaper.metrics(fontName);
    const midY = (ext.top + ext.bottom) / 2;
    // right edge springs toward each new target as the text grows
    let rightTarget = ext.right, prevTarget = ext.right, tStep = 0;
    for (let i = 0; i < ext.steps.length; i++) {
      const s = ext.steps[i];
      if (s.t > tl) break;
      prevTarget = i > 0 ? ext.steps[i - 1].right : ext.steps[0].right;
      rightTarget = s.right; tStep = s.t;
    }
    const sp = node.spring;
    const rightX = tStep > 0 ? prevTarget + (rightTarget - prevTarget) * spring(tl - tStep, sp.stiffness, sp.damping, sp.mass) : ext.right;
    const pad = node.padding * ext.scale;
    ctx.fillStyle = color(node.style.color, tokens);
    // we are inside this node's own transform; undo it to draw in the parent's space
    ctx.save();
    ctx.scale(1 / nodeScale, 1 / nodeScale);
    ctx.translate(-cx, -cy);
    const ty = midY + (m.ascender + m.descender) * size / 2;   // bracket's vertical centre on the text's centre
    if (lg) { ctx.save(); ctx.translate(ext.left - pad - lg.xAdvance, ty); ctx.fill(path2d(lg.d)); ctx.restore(); }
    if (rg) { ctx.save(); ctx.translate(rightX + pad, ty); ctx.fill(path2d(rg.d)); ctx.restore(); }
    ctx.restore();
  }

  // ---------- rect ----------
  function drawRect(node: RectNode, env: Env) {
    const { ctx, tokens } = env;
    const x = -node.w / 2, y = -node.h / 2, r = Math.min(node.radius, node.w / 2, node.h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + node.w - r, y); ctx.arcTo(x + node.w, y, x + node.w, y + r, r);
    ctx.lineTo(x + node.w, y + node.h - r); ctx.arcTo(x + node.w, y + node.h, x + node.w - r, y + node.h, r);
    ctx.lineTo(x + r, y + node.h); ctx.arcTo(x, y + node.h, x, y + node.h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    if (node.fill) { ctx.fillStyle = color(node.fill, tokens); ctx.fill(); }
    if (node.stroke) { ctx.strokeStyle = color(node.stroke.color, tokens); ctx.lineWidth = node.stroke.width; ctx.stroke(); }
  }

  return { renderFrame };
}

// ---------- helpers ----------
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function pickBeat(beats: Beat[], t: number): Beat {
  const hit = beats.find(b => t >= b.start && t < b.start + b.duration);
  return hit ?? beats[beats.length - 1];
}
function resolveToken(v: string, tokens: Record<string, string>): string {
  return v.startsWith("tokens.") ? (tokens[v.slice(7)] ?? v) : v;
}
function color(v: string, tokens: Record<string, string>): string { return resolveToken(v, tokens); }
function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  if (!a.startsWith("#") || !b.startsWith("#")) return t > 0.5 ? b : a;
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
