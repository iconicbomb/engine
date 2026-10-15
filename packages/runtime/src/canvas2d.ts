// @engine/runtime — Canvas 2D implementation of `Runtime`. renderFrame(graph, t) is a pure function of its inputs:
// every value is derived from t by replaying the graph's tracks, so any frame can be rendered in isolation.
import type { Graph, Node, Track, Beat } from "@engine/graph";
import { glyphTime, glyphHideTime, typewriterEnd, formatCount } from "@engine/graph";
import { trackProgress, typewriterGlyphs, spring, lerpColor, resolveTracks, tweenValue, pressFactor, cursorPosition, hoverIntervals, hoverAmount, cameraState, frameView } from "./runtime-core";
import type { Runtime, Shaper, ShapedGlyph, RenderTarget, GlyphState, CameraState } from "./runtime-core";
import { resolveAnchor, smoothedSteps, fitScale, canvasSize } from "./layout";
import { EASES } from "./runtime-core";
const EASE_SETTLE = EASES.settle;
import type { Aspect } from "./layout";

type TextNode = Extract<Node, { type: "text" }>;
type RectNode = Extract<Node, { type: "rect" }>;
type BracketNode = Extract<Node, { type: "bracket" }>;
type TweenTrack = Extract<Track, { mode: "tween" }>;
type TypewriterTrack = Extract<Track, { mode: "typewriter" }>;
type SweepTrack = Extract<Track, { mode: "sweep" }>;
type CountTrack = Extract<Track, { mode: "count" }>;
type CursorNode = Extract<Node, { type: "cursor" }>;
type GroupNode = { id: string; type: "group"; children: Node[]; scale: number; x: number; y: number; layout?: {
  type: "row" | "column"; gap: number; align: "start" | "center" | "end"; wrap: boolean; maxWidth?: number;
  overrides?: Partial<Record<Aspect, { gap?: number; maxWidth?: number }>> } };
type MoveToTrack = Extract<Track, { mode: "moveTo" }>;
type OnHoverTrack = Extract<Track, { mode: "onHover" }>;

// What a drawn text node leaves behind for siblings (brackets) in the parent's coordinate space.
type Box = { left: number; right: number; top: number; bottom: number };
// 2D affine matrix [a, b, c, d, e, f] (canvas convention) for the measure pass
type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const worldBox = (m: M, b: Box): Box => {
  const pts = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  return { left: Math.min(...pts.map((p) => p[0])), right: Math.max(...pts.map((p) => p[0])), top: Math.min(...pts.map((p) => p[1])), bottom: Math.max(...pts.map((p) => p[1])) };
};
type Slot = { x: number; y: number };
type Extents = { left: number; right: number; top: number; bottom: number; scale: number; steps: { t: number; right: number }[] };

type NumericProps = { opacity: number; scale: number; rotation: number; x: number; y: number };
const NUMERIC = new Set(["opacity", "scale", "rotation", "x", "y"]);

export function createRuntime(opts: { shaper: Shaper }): Runtime {
  const { shaper } = opts;
  const pathCache = new Map<string, Path2D>();
  const path2d = (d: string) => { let p = pathCache.get(d); if (!p) { p = new Path2D(d); pathCache.set(d, p); } return p; };

  // Everything a frame needs, as a pure function of (graph, t). boxesAt(t) runs the measure pass for beat-local t
  // (memoised per frame: camera frames with follow false measure at their own `at`).
  function frameEnv(graph: Graph, tSec: number, ctx: CanvasRenderingContext2D | null, k: number): { env: Env; beat: Beat } {
    const aspect = graph.canvas.aspect as Aspect;
    const { w, h } = canvasSize(aspect, graph.canvas.refHeight);
    const beat = pickBeat(graph.beats, tSec);
    const tl = tSec - beat.start;                      // beat-local time
    const byId = new Map<string, Node>();
    const index = (n: Node) => { byId.set(n.id, n); ((n as { children?: Node[] }).children ?? []).forEach(index); };
    beat.nodes.forEach(index);
    const memo = new Map<number, Map<string, Box>>();
    const env: Env = {
      ctx: ctx as CanvasRenderingContext2D, tokens: graph.tokens, tl, fps: graph.canvas.fps, aspect, w, h, k, extents: new Map(), byId,
      boxesAt: (t: number) => { let b = memo.get(t); if (!b) { b = measureBoxes(beat, { ...env, tl: t }); memo.set(t, b); } return b; },
    };
    return { env, beat };
  }

  function renderFrame(graph: Graph, tSec: number, target: RenderTarget) {
    const { ctx } = target;
    const aspect = graph.canvas.aspect as Aspect;
    const { w, h } = canvasSize(aspect, graph.canvas.refHeight);
    const k = target.height / h;                       // graph units -> device px
    const { env, beat } = frameEnv(graph, tSec, ctx, k);
    const tl = env.tl, tokens = graph.tokens;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    ctx.fillStyle = color(beat.background, tokens);
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    drawGlows(beat, ctx, tokens, tl, w, h);
    // camera over nodes and cursors (glows stay put); skipped entirely when it is the identity
    if (hasCamera(beat)) {
      const cam = cameraAt(beat, env);
      ctx.translate(w / 2, h / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.cx, -cam.cy);
    }
    // cursors are top-level and drawn last, on top of everything
    drawNodes(beat.nodes.filter((n) => n.type !== "cursor"), env, true);
    drawNodes(beat.nodes.filter((n) => n.type === "cursor"), env, true);
  }

  function hasCamera(beat: Beat) {
    const c = beat.camera;
    return c.tracks.length > 0 || c.zoom !== 1 || c.x !== 0 || c.y !== 0;
  }
  function cameraAt(beat: Beat, env: Env): CameraState {
    const c = beat.camera, W = env.w, H = env.h;
    const tweens = (c.tracks as Track[]).filter((tr): tr is TweenTrack => tr.mode === "tween").map((tr) => ({ tr, start: tr.at }));
    const base = (t: number) => ({
      zoom: resolve("zoom", c.zoom, t, tweens), cx: W / 2 + resolve("x", c.x, t, tweens), cy: H / 2 + resolve("y", c.y, t, tweens),
    });
    const frames = c.tracks.filter((tr): tr is Extract<typeof tr, { mode: "frame" }> => tr.mode === "frame");
    const target = (f: (typeof frames)[number], t: number) => {
      const b = env.boxesAt(f.follow ? t : f.at).get(f.target);
      return b ? frameView(f, b, W, H) : null;
    };
    return cameraState(frames, env.tl, base, target, W, H);
  }

  // ---------- measure pass: world-space boxes for every node (pure) ----------
  // Full laid-out extents: text uses its whole run at its fully-typed fit scale (a shot doesn't drift while a
  // typewriter runs); opacity is ignored. Cursors are measured last (their position reads the other boxes).
  function measureBoxes(beat: Beat, env: Env): Map<string, Box> {
    const out = new Map<string, Box>();
    const walk = (nodes: Node[], parent: M, top: boolean, slots: Map<string, Slot> | undefined) => {
      for (const n of nodes) {
        if (n.type === "cursor") continue;
        const props = hoverProps(n, numericProps(n, env.tl), env);
        const { cx, cy, s } = place(n, props, { ...env, slots }, top);
        const r = props.rotation * Math.PI / 180;
        const m = mul(mul(mul(parent, [1, 0, 0, 1, cx, cy]), [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]), [s, 0, 0, s, 0, 0]);
        const children = (n as { children?: Node[] }).children ?? [];
        walk(children, m, false, n.type === "group" ? layoutSlots(n as GroupNode, env) : undefined);
        let box: Box | null = null;
        if (n.type === "text") box = worldBox(m, fullTextBox(layoutText(n as TextNode, env)));
        else if (n.type === "rect") {
          const rn = n as RectNode;
          box = worldBox(m, rn.sizeToContent ? sizedBox(rn, env) : { left: -rn.w / 2, right: rn.w / 2, top: -rn.h / 2, bottom: rn.h / 2 });
        } else if (n.type === "group") box = unionBox(children.map((c) => out.get(c.id) ?? null));
        else if (n.type === "bracket") box = out.get((n as BracketNode).follows) ?? null;
        if (box) out.set(n.id, box);
      }
    };
    walk(beat.nodes, I, true, undefined);
    for (const n of beat.nodes) if (n.type === "cursor") {
      const p = cursorWorldPos(n as CursorNode, env, out), r = 16 * (n as CursorNode).size;
      out.set(n.id, { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r });
    }
    return out;
  }
  function fullTextBox(L: ReturnType<typeof layoutText>): Box {
    const { metrics, size, baseline, fullScale: fs, fullWidth: fw, style } = L;
    const x0 = style.align === "left" ? 0 : style.align === "right" ? -fw : -fw / 2;
    return { left: x0 * fs, right: (x0 + fw) * fs, top: (baseline - metrics.ascender * size) * fs, bottom: (baseline - metrics.descender * size) * fs };
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

  // extents: per group, parent space (brackets / follows). boxesAt(t): the measure pass, every node's box in world
  // space (moveTo / camera targets). byId: every node of the beat (onHover finds its cursor).
  type Env = {
    ctx: CanvasRenderingContext2D; tokens: Record<string, string>; tl: number; fps: number; aspect: Aspect; w: number; h: number; k: number;
    extents: Map<string, Extents>; byId: Map<string, Node>; boxesAt: (t: number) => Map<string, Box>;
    slots?: Map<string, Slot>;      // set while drawing / measuring the children of a laid-out group
  };

  function drawNodes(nodes: Node[], env: Env, topLevel: boolean) {
    for (const node of nodes) drawNode(node, env, topLevel);
  }

  function drawNode(node: Node, env: Env, topLevel: boolean) {
    const { ctx } = env;
    if (node.type === "cursor") return drawCursor(node as CursorNode, env);
    const props = hoverProps(node, numericProps(node, env.tl), env);
    const { cx, cy, s: nodeScale } = place(node, props, env, topLevel);
    if (props.opacity <= 0 || nodeScale === 0) return;   // invisible; followers would divide by nodeScale

    ctx.save();
    ctx.translate(cx, cy);
    if (props.rotation) ctx.rotate(props.rotation * Math.PI / 180);
    ctx.scale(nodeScale, nodeScale);
    ctx.globalAlpha *= clamp01(props.opacity);
    const clip = clipRect(node, env.tl);
    if (clip) { ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip(); }

    switch (node.type) {
      case "group": {
        const inner: Env = { ...env, extents: new Map(), slots: layoutSlots(node as GroupNode, env) };
        const children = (node as { children: Node[] }).children;
        drawNodes(children, inner, false);
        break;
      }
      case "rect": {
        const r = node as RectNode;
        const inner: Env = { ...env, extents: new Map(), slots: undefined };
        const box = r.sizeToContent ? sizedBox(r, inner) : undefined;
        drawRect(r, env, cx, cy, nodeScale, box);
        if (r.children.length) drawNodes(r.children, inner, false);
        break;
      }
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
  // Several tracks may animate one property: the latest started one wins; before any has started, the earliest
  // one's `from` holds (so a node can sit at one value and later pulse from another).
  // (velocity carry across a handoff: see resolveTracks in runtime-core)
  function resolve(key: string, base: number, tl: number, cands: { tr: TweenTrack; start: number }[]): number {
    return resolveTracks(key, base, tl, cands);
  }
  function numericProps(node: Node, tl: number): NumericProps {
    const cands = (node.tracks as Track[])
      .filter((tr): tr is TweenTrack => tr.mode === "tween" && NUMERIC.has(tr.prop) && tr.staggerMs === 0 && tr.relativeTo !== "reveal")
      .map((tr) => ({ tr, start: tr.at }));
    const base: NumericProps = { opacity: node.opacity, scale: node.scale, rotation: node.rotation, x: node.x, y: node.y };
    for (const k of NUMERIC) base[k as keyof NumericProps] = resolve(k as keyof NumericProps, base[k as keyof NumericProps], tl, cands);
    return base;
  }
  // per-glyph offsets: staggered tween tracks by glyph index; relativeTo "reveal" tracks start when the glyph is typed
  function glyphProps(node: TextNode, tl: number, index: number, revealAt: number): NumericProps {
    const cands = (node.tracks as Track[])
      .filter((tr): tr is TweenTrack => tr.mode === "tween" && NUMERIC.has(tr.prop) && (tr.staggerMs > 0 || tr.relativeTo === "reveal"))
      .map((tr) => ({ tr, start: tr.relativeTo === "reveal" ? revealAt + tr.at : tr.at + tr.staggerMs * index / 1000 }));
    const p: NumericProps = { opacity: 1, scale: 1, rotation: 0, x: 0, y: 0 };
    for (const k of NUMERIC) p[k as keyof NumericProps] = resolve(k as keyof NumericProps, p[k as keyof NumericProps], tl, cands);
    return p;
  }
  // colour-sweep weight of glyph `index` (0..1): flat-topped window with one-glyph soft edges; the latest started sweep wins
  function sweepAt(node: TextNode, tl: number): { track: SweepTrack; pos: number } | null {
    let hit: { track: SweepTrack; pos: number } | null = null;
    for (const tr of node.tracks) {
      if (tr.mode !== "sweep") continue;
      const prog = trackProgress(tr, tl);
      if (prog !== null && (!hit || tr.at >= hit.track.at)) hit = { track: tr, pos: tr.from + (tr.to - tr.from) * prog };
    }
    return hit;
  }

  // ---------- text ----------
  // Text layout as a pure function of (node, t): shaping, typewriter state, fit scale and run origin.
  // drawText paints from it; sizeToContent measures with it without painting.
  function layoutText(node: TextNode, env: Env) {
    const { tokens, tl, fps } = env;
    const style = node.style;
    const fontName = resolveToken(style.font, tokens);
    const size = style.size;
    const axes = { wght: style.weight, ...style.axes };
    const text = countText(node, tl) ?? node.text;
    const glyphs = shaper.shape(text, fontName, size, axes, style.features);
    const metrics = shaper.metrics(fontName);
    const chars = [...text];
    const tw = node.tracks.find((t: Track): t is TypewriterTrack => t.mode === "typewriter");
    const states: GlyphState[] = tw ? typewriterGlyphs(tw, chars, tl, fps) : chars.map(() => ({ visible: true, scrambled: null, freshness: 0 }));

    // tracking (letter-spacing) in em
    // a node-level `tracking` tween (em) replaces style.tracking while it runs (T11 tracking contraction)
    const trackingCands = (node.tracks as Track[])
      .filter((tr): tr is TweenTrack => tr.mode === "tween" && tr.prop === "tracking")
      .map((tr) => ({ tr, start: tr.at }));
    const tracking = (trackingCands.length ? resolve("tracking", style.tracking, tl, trackingCands) : style.tracking) * size;
    const advance = (g: ShapedGlyph) => g.xAdvance + tracking;
    const widthUpTo = (n: number) => glyphs.reduce((acc, g) => acc + (g.cluster < n ? advance(g) : 0), 0);
    const fullWidth = widthUpTo(chars.length);
    const visibleCount = states.filter(s => s.visible).length;
    const visibleWidth = widthUpTo(visibleCount);

    // fit-to-width: replay the typewriter steps so the smoothed scale depends only on t
    let scale = 1, fullScale = 1;
    const steps: { t: number; right: number }[] = [];
    // safe area: no text run may exceed 90% of the canvas width, whatever the aspect (9:16 reuses 16:9 graphs)
    const safeW = env.w * 0.9;
    const fit = node.fit
      ? { ...node.fit, w: Math.min(node.fit.w, safeW) }
      : fullWidth > safeW ? { w: safeW, h: env.h, minScale: 0.1, recenter: true, easeMs: 0 } : undefined;
    if (fit) {
      const f = fit;
      const lineH = size * (metrics.ascender - metrics.descender);
      fullScale = fitScale(fullWidth, lineH, f.w, f.h, f.minScale);   // the scale once fully typed (measure pass)
      if (tw) {
        const stepScales = chars.map((_, i) => ({ t: glyphTime(tw, chars, i + 1), value: fitScale(widthUpTo(i + 1), lineH, f.w, f.h, f.minScale) }));
        scale = smoothedSteps(stepScales, tl, f.easeMs, fitScale(0, lineH, f.w, f.h, f.minScale));
      } else {
        scale = fitScale(fullWidth, lineH, f.w, f.h, f.minScale);
      }
    }
    // run origin (centre of the visible run on the anchor when recentering)
    const runW = fit?.recenter === false ? fullWidth
      : tw && node.recenterEaseMs > 0 ? smoothedSteps(runSteps(tw, chars, widthUpTo), tl, node.recenterEaseMs, 0)
      : visibleWidth;
    const x0 = style.align === "left" ? 0 : style.align === "right" ? -runW : -runW / 2;
    const baseline = metrics.capHeight * size / 2;     // caps vertically centred on the anchor

    if (tw) {
      for (let i = 0; i < chars.length; i++) steps.push({ t: glyphTime(tw, chars, i + 1), right: 0 }); // filled below
    }

    return { style, fontName, size, axes, glyphs, metrics, chars, tw, states, advance, widthUpTo, visibleWidth, scale, steps, x0, baseline, fullWidth, fullScale };
  }
  // the text's box in its own space (after its fit scale), as drawText reports it
  function textBox(L: ReturnType<typeof layoutText>): Box {
    const { metrics, size, baseline, scale, x0, visibleWidth } = L;
    return { left: x0 * scale, right: (x0 + visibleWidth) * scale, top: (baseline - metrics.ascender * size) * scale, bottom: (baseline - metrics.descender * size) * scale };
  }

  function drawText(node: TextNode, env: Env): Extents & { scale: number } {
    const { ctx, tokens, tl } = env;
    const L = layoutText(node, env);
    const { style, fontName, size, axes, glyphs, metrics, chars, tw, states, advance, widthUpTo, visibleWidth, scale, steps, x0, baseline } = L;
    ctx.save();
    ctx.scale(scale, scale);
    const baseColor = color(style.color, tokens);
    const tailColor = tw ? color(tw.tail.color, tokens) : baseColor;
    const sweep = sweepAt(node, tl);
    const sweepColor = sweep ? color(sweep.track.color, tokens) : baseColor;

    // pass 1: glyphs
    let pen = x0;
    const positions: number[] = [];
    for (const g of glyphs) {
      positions.push(pen);
      const st = states[g.cluster] ?? states[states.length - 1];
      if (st?.visible) {
        const gp = glyphProps(node, tl, g.cluster, tw ? glyphTime(tw, chars, g.cluster) : 0);
        if (gp.opacity > 0) {
          const d = st.scrambled ? scrambleGlyph(st.scrambled, fontName, size, axes, style.features) : g.d;
          ctx.save();
          ctx.translate(pen + g.xOffset + gp.x, baseline + g.yOffset + gp.y);
          if (gp.scale !== 1) ctx.scale(gp.scale, gp.scale);
          ctx.globalAlpha *= clamp01(gp.opacity);
          const sw = sweep ? clamp01(sweep.track.window / 2 + 0.5 - Math.abs(g.cluster + 0.5 - sweep.pos)) : 0;
          const body = sw > 0 ? mixHex(baseColor, sweepColor, sw) : baseColor;
          ctx.fillStyle = st.freshness > 0 ? mix(body, tailColor, st.freshness * tw!.tail.strength) : body;
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
        const d = st.scrambled ? scrambleGlyph(st.scrambled, fontName, size, axes, style.features) : g.d;
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

  // visible-run width as a step function of time: grows as glyphs are typed, shrinks as they are un-typed
  function runSteps(tw: TypewriterTrack, chars: string[], widthUpTo: (n: number) => number): { t: number; value: number }[] {
    const steps = chars.map((_, i) => ({ t: glyphTime(tw, chars, i), value: widthUpTo(i + 1) }));
    if (tw.out) for (let i = chars.length - 1; i >= 0; i--) steps.push({ t: glyphHideTime(tw, chars, i), value: widthUpTo(i) });
    return steps;
  }
  // a count track replaces the node's text with the formatted value at time tl (latest started track wins)
  function countText(node: TextNode, tl: number): string | null {
    const counts = (node.tracks as Track[]).filter((t): t is CountTrack => t.mode === "count");
    if (!counts.length) return null;
    const started = counts.filter((t) => t.at <= tl);
    const hit = started.length ? started.reduce((x, y) => (y.at >= x.at ? y : x)) : counts.reduce((x, y) => (y.at < x.at ? y : x));
    const prog = trackProgress(hit, tl);
    return formatCount(hit, prog === null ? hit.from : hit.from + (hit.to - hit.from) * prog);
  }

  const scrambleCache = new Map<string, string>();
  function scrambleGlyph(ch: string, fontName: string, size: number, axes: Record<string, number>, features: string[]): string {
    const key = `${ch}|${fontName}|${size}|${JSON.stringify(axes)}|${features.join(",")}`;
    let d = scrambleCache.get(key);
    if (d === undefined) { d = shaper.shape(ch, fontName, size, axes, features)[0]?.d ?? ""; scrambleCache.set(key, d); }
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
    const [lg] = shaper.shape(node.glyphs[0], fontName, size, axes, node.style.features);
    const [rg] = shaper.shape(node.glyphs[1], fontName, size, axes, node.style.features);
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

  // ---------- clip ----------
  function clipRect(node: Node, tl: number): { x: number; y: number; w: number; h: number } | null {
    if (!node.clip) return null;
    const cands = (node.tracks as Track[])
      .filter((tr): tr is TweenTrack => tr.mode === "tween" && tr.prop.startsWith("clip."))
      .map((tr) => ({ tr, start: tr.at }));
    const c = node.clip;
    return {
      x: resolve("clip.x", c.x, tl, cands), y: resolve("clip.y", c.y, tl, cands),
      w: Math.max(0, resolve("clip.w", c.w, tl, cands)), h: Math.max(0, resolve("clip.h", c.h, tl, cands)),
    };
  }

  // ---------- hover (derived from the named cursor's moveTo tracks) ----------
  function hoverTracks(node: Node): OnHoverTrack[] {
    return (node.tracks as Track[]).filter((tr): tr is OnHoverTrack => tr.mode === "onHover");
  }
  function hoverOf(h: OnHoverTrack, node: Node, env: Env): number {
    const cursor = env.byId.get(h.cursor);
    return cursor ? hoverAmount(h, hoverIntervals(cursor.tracks as Track[], node.id), env.tl) : 0;
  }
  function hoverProps(node: Node, p: NumericProps, env: Env): NumericProps {
    for (const h of hoverTracks(node)) {
      if (!NUMERIC.has(h.prop) || typeof h.to !== "number") continue;
      const key = h.prop as keyof NumericProps;
      p[key] = p[key] + (h.to - p[key]) * hoverOf(h, node, env);
    }
    return p;
  }
  // a rect's fill at t: fill tweens (latest started wins, sRGB lerp), then onHover fill
  function rectFill(node: RectNode, env: Env): string | null {
    const base = node.fill ? color(node.fill, env.tokens) : null;
    const tweens = (node.tracks as Track[]).filter((tr): tr is TweenTrack => tr.mode === "tween" && tr.prop === "fill");
    const hovers = hoverTracks(node).filter((h) => h.prop === "fill");
    if (!tweens.length && !hovers.length) return base;
    let c = base ?? "#00000000";
    if (tweens.length) {
      const started = tweens.filter((tr) => tr.at <= env.tl);
      const pick = started.length ? started.reduce((x, y) => (y.at >= x.at ? y : x)) : tweens.reduce((x, y) => (y.at < x.at ? y : x));
      const from = typeof pick.from === "string" ? color(pick.from, env.tokens) : c;
      const to = typeof pick.to === "string" ? color(pick.to, env.tokens) : c;
      c = lerpColor(from, to, trackProgress(pick, env.tl) ?? 0);
    }
    for (const h of hovers) if (typeof h.to === "string") c = lerpColor(c, color(h.to, env.tokens), hoverOf(h, node, env));
    return c;
  }

  // ---------- cursor ----------
  // the cursor's world position: a replay of its moveTo tracks over this frame's measured boxes — a function of (graph, t)
  function cursorWorldPos(node: CursorNode, env: Env, boxes: Map<string, Box>) {
    const a = resolveAnchor(node, env.aspect, env.w, env.h);
    const props = numericProps(node, env.tl);
    const point = (m: MoveToTrack) => {
      const b = boxes.get(m.target);
      if (!b) return null;                               // unreachable for a valid graph: every node is measured
      const mx = (b.left + b.right) / 2, my = (b.top + b.bottom) / 2;
      const [x, y] = m.anchor === "left" ? [b.left, my] : m.anchor === "right" ? [b.right, my]
        : m.anchor === "top" ? [mx, b.top] : m.anchor === "bottom" ? [mx, b.bottom] : [mx, my];
      return { x: x + m.offset.x * (b.right - b.left), y: y + m.offset.y * (b.bottom - b.top) };   // offset: box fractions
    };
    return cursorPosition(node.tracks as Track[], env.tl, { x: a.x + props.x, y: a.y + props.y }, point);
  }

  function drawCursor(node: CursorNode, env: Env) {
    const { ctx } = env;
    const a = resolveAnchor(node, env.aspect, env.w, env.h);
    const props = numericProps(node, env.tl);
    if (props.opacity <= 0) return;
    const pos = cursorWorldPos(node, env, env.boxesAt(env.tl));
    const s = props.scale * a.scale * node.size * pressFactor(node.tracks as Track[], env.tl);
    ctx.save();
    ctx.translate(pos.x, pos.y);                       // the hotspot (arrow / hand tip, avatar centre)
    ctx.scale(s, s);
    ctx.globalAlpha *= clamp01(props.opacity);
    ctx.lineJoin = "round";
    if (node.style === "avatar") {
      // photo placeholder: neutral so it reads on any fill it hovers (brand-filled cards included)
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#C9CED6"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 19.5, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
    } else {
      ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = "#111111"; ctx.lineWidth = 1.5;
      const pth = path2d(node.style === "hand" ? HAND_PATH : ARROW_PATH);
      ctx.fill(pth); ctx.stroke(pth);
    }
    ctx.restore();
  }

  // ---------- layout pass (sizeToContent) ----------
  // A child's box in its parent's space: its anchor/x/y/scale applied to its own box. Opacity is ignored (layout).
  function measureNode(n: Node, env: Env): Box | null {
    const props = numericProps(n, env.tl);
    const { cx, cy, s } = place(n, props, env, false);
    let box: Box | null = null;
    if (n.type === "text") box = textBox(layoutText(n as TextNode, env));
    else if (n.type === "rect") box = (n as RectNode).sizeToContent ? sizedBox(n as RectNode, { ...env, slots: undefined }) : { left: -n.w / 2, right: n.w / 2, top: -n.h / 2, bottom: n.h / 2 };
    else if (n.type === "group") {
      const inner = { ...env, slots: layoutSlots(n as GroupNode, env) };
      box = unionBox(((n as { children: Node[] }).children).map((c) => measureNode(c, inner)));
    }
    if (!box) return null;
    return { left: cx + box.left * s, right: cx + box.right * s, top: cy + box.top * s, bottom: cy + box.bottom * s };
  }

  // ---------- placement + row / column layout ----------
  // where a node's origin sits in its parent's space, and its scale: a laid-out child takes its slot (its anchor is
  // ignored), anything else its anchor (top-level: canvas position; child: relative to the parent's origin)
  function place(n: Node, props: NumericProps, env: Env, top: boolean): { cx: number; cy: number; s: number } {
    const slot = env.slots?.get(n.id);
    if (slot) return { cx: slot.x + props.x, cy: slot.y + props.y, s: props.scale };
    const a = resolveAnchor(n, env.aspect, env.w, env.h);
    return { cx: (top ? a.x : a.x - env.w / 2) + props.x, cy: (top ? a.y : a.y - env.h / 2) + props.y, s: props.scale * a.scale };
  }
  // a node's rest box in its own frame times its rest scale (tracks ignored, so a child popping in or sliding doesn't
  // move its neighbours); null for nodes with no box (brackets, cursors)
  function restBox(n: Node, env: Env): Box | null {
    let b: Box | null = null;
    if (n.type === "text") b = fullTextBox(layoutText(n as TextNode, env));
    else if (n.type === "rect") b = (n as RectNode).sizeToContent ? sizedBox(n as RectNode, { ...env, slots: undefined }) : { left: -n.w / 2, right: n.w / 2, top: -n.h / 2, bottom: n.h / 2 };
    else if (n.type === "group") {
      const g = n as GroupNode, slots = layoutSlots(g, env);
      b = unionBox(g.children.map((c: Node) => {
        const cb = restBox(c, env);
        if (!cb) return null;
        const sl = slots?.get(c.id);
        const a = resolveAnchor(c, env.aspect, env.w, env.h);
        const ox = sl ? sl.x + c.x : a.x - env.w / 2 + c.x, oy = sl ? sl.y + c.y : a.y - env.h / 2 + c.y;
        return { left: ox + cb.left, right: ox + cb.right, top: oy + cb.top, bottom: oy + cb.bottom };
      }));
    }
    if (!b) return null;
    return { left: b.left * n.scale, right: b.right * n.scale, top: b.top * n.scale, bottom: b.bottom * n.scale };
  }
  // slot (child origin, in the group's space) for every child of a laid-out group; undefined without a layout
  function layoutSlots(g: GroupNode, env: Env): Map<string, Slot> | undefined {
    const L = g.layout;
    if (!L) return undefined;
    const o = L.overrides?.[env.aspect];
    const gap: number = o?.gap ?? L.gap, maxMain: number | undefined = o?.maxWidth ?? L.maxWidth;
    const row = L.type === "row";
    const items = (g.children as Node[]).flatMap((c) => { const b = restBox(c, env); return b ? [{ id: c.id, b }] : []; });
    const mainLen = (b: Box) => (row ? b.right - b.left : b.bottom - b.top);
    const crossLen = (b: Box) => (row ? b.bottom - b.top : b.right - b.left);
    type Line = { items: typeof items; main: number; cross: number };
    const lines: Line[] = [];
    let cur: Line = { items: [], main: 0, cross: 0 };
    for (const it of items) {
      const len = mainLen(it.b);
      if (L.wrap && maxMain !== undefined && cur.items.length && cur.main + gap + len > maxMain) { lines.push(cur); cur = { items: [], main: 0, cross: 0 }; }
      cur.main += (cur.items.length ? gap : 0) + len;
      cur.cross = Math.max(cur.cross, crossLen(it.b));
      cur.items.push(it);
    }
    if (cur.items.length) lines.push(cur);
    const blockMain = Math.max(0, ...lines.map((l) => l.main));
    const blockCross = lines.reduce((s, l) => s + l.cross, 0) + gap * Math.max(0, lines.length - 1);
    const slots = new Map<string, Slot>();
    let crossAt = -blockCross / 2;
    for (const line of lines) {
      let mainAt = L.align === "start" ? -blockMain / 2 : L.align === "end" ? blockMain / 2 - line.main : -line.main / 2;
      for (const { id, b } of line.items) {
        const lead = row ? b.left : b.top, cLead = row ? b.top : b.left, cLen = crossLen(b);
        const m = mainAt - lead;
        const c = (L.align === "start" ? crossAt : L.align === "end" ? crossAt + line.cross - cLen : crossAt + (line.cross - cLen) / 2) - cLead;
        slots.set(id, row ? { x: m, y: c } : { x: c, y: m });
        mainAt += mainLen(b) + gap;
      }
      crossAt += line.cross + gap;
    }
    return slots;
  }
  // the rect's own box: children's union + padding, at least w x h (grown symmetrically about the content centre)
  function sizedBox(r: RectNode, env: Env): Box {
    const pad = r.sizeToContent!;
    const c = unionBox(r.children.map((n: Node) => measureNode(n, env))) ?? { left: 0, right: 0, top: 0, bottom: 0 };
    const mx = (c.left + c.right) / 2, my = (c.top + c.bottom) / 2;
    const hw = Math.max(r.w / 2, (c.right - c.left) / 2 + pad.padX), hh = Math.max(r.h / 2, (c.bottom - c.top) / 2 + pad.padY);
    return { left: mx - hw, right: mx + hw, top: my - hh, bottom: my + hh };
  }

  // ---------- rect ----------
  function drawRect(node: RectNode, env: Env, cx: number, cy: number, nodeScale: number, box?: Box) {
    const { ctx, tokens } = env;
    if (node.follows) {
      // like a bracket: place in the parent's space at the followed text's edge, sized by its fit scale
      const ext = env.extents.get(node.follows.node);
      if (!ext) return;
      const f = node.follows, half = node.w * ext.scale / 2 + f.gap * ext.scale;
      ctx.scale(1 / nodeScale, 1 / nodeScale);
      ctx.translate(-cx, -cy);
      ctx.translate(f.edge === "left" ? ext.left - half : ext.right + half, (ext.top + ext.bottom) / 2);
      ctx.scale(nodeScale * ext.scale, nodeScale * ext.scale);   // keep the node's own scale (e.g. a pop) about its centre
    }
    const w = box ? box.right - box.left : node.w, h = box ? box.bottom - box.top : node.h;
    const x = box ? box.left : -node.w / 2, y = box ? box.top : -node.h / 2, r = Math.min(node.radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    const fill = rectFill(node, env);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (node.stroke) { ctx.strokeStyle = color(node.stroke.color, tokens); ctx.lineWidth = node.stroke.width; ctx.stroke(); }
  }

  function measure(graph: Graph, tSec: number): Map<string, Box> {
    const { env } = frameEnv(graph, tSec, null, 1);
    return env.boxesAt(env.tl);
  }
  function camera(graph: Graph, tSec: number): CameraState {
    const { env, beat } = frameEnv(graph, tSec, null, 1);
    return hasCamera(beat) ? cameraAt(beat, env) : { zoom: 1, cx: env.w / 2, cy: env.h / 2 };
  }

  return { renderFrame, measure, camera };
}

// ---------- cursor glyphs: px at size 1, hotspot at the origin ----------
const ARROW_PATH = "M0 0 L0 26 L6.5 20 L11 30.5 L15 28.7 L10.6 18.6 L19 18.6 Z";
const HAND_PATH = "M0 0 C1.7 0 3 1.3 3 3 L3 11 C4.6 10.2 6.6 10.6 7.4 12 C9 11.3 10.9 11.8 11.6 13.3 C13.3 12.8 15 13.6 15.4 15.3 "
  + "L16.6 21.5 C17.4 25.8 14.6 30 10.2 30 L5.6 30 C3.2 30 1.1 28.6 0.2 26.4 L-4.6 15.6 C-5.3 14 -4.5 12.2 -2.9 11.7 "
  + "C-1.9 11.4 -0.8 11.7 -0.1 12.5 L-3 8.6 L-3 3 C-3 1.3 -1.7 0 0 0 Z";

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
function unionBox(boxes: (Box | null)[]): Box | null {
  const bs = boxes.filter((b): b is Box => b !== null);
  if (!bs.length) return null;
  return { left: Math.min(...bs.map((b) => b.left)), right: Math.max(...bs.map((b) => b.right)), top: Math.min(...bs.map((b) => b.top)), bottom: Math.max(...bs.map((b) => b.bottom)) };
}
function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a: string, b: string, t: number): string {
  if (!a.startsWith("#") || !b.startsWith("#")) return t > 0.5 ? b : a;
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  if (!a.startsWith("#") || !b.startsWith("#")) return t > 0.5 ? b : a;
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
