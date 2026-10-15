import { EASES, spring, springSettleTime, trackProgress, typewriterGlyphs, cubicBezier, lerpColor, pressFactor, hoverIntervals, hoverAmount, cursorPosition, frameView, clampView, cameraState, resolveTracks, tweenValue, pathLength, pathBounds, flattenPath, wirePath, anchorPoint } from "../src/runtime-core";
import { parseGraph, glyphTime, typewriterEnd, TypewriterTrack, SweepTrack, CountTrack, formatCount, Track, OnHoverTrack, FrameTrack } from "@engine/graph";
import { readFileSync } from "node:fs";
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
// endpoints + monotonic
for (const name of ["linear","settle","emphasis"] as const) {
  const f = EASES[name]; let prev = -1, mono = true;
  for (let i = 0; i <= 100; i++) { const y = f(i/100); if (y < prev - 1e-9) mono = false; prev = y; }
  assert(Math.abs(f(0)) < 1e-9 && Math.abs(f(1) - 1) < 1e-9 && mono, `${name}: 0->1 and monotonic`);
}
// settle shape: R8 measured deltas 10,8,6,4,4,3,2,2,2,1... over 18 frames -> fast start, long tail: >60% done by 25% of time
assert(EASES.settle(0.25) > 0.6 && EASES.settle(0.5) > 0.85, `settle: ${EASES.settle(0.25).toFixed(2)} at 25%, ${EASES.settle(0.5).toFixed(2)} at 50%`);
// emphasis: peak velocity at ~35% (R6 IX: peak at frame 9 of 24)
let best = 0, bestX = 0; for (let i = 1; i < 100; i++) { const v = EASES.emphasis(i/100) - EASES.emphasis((i-1)/100); if (v > best) { best = v; bestX = i/100; } }
assert(bestX > 0.28 && bestX < 0.42, `emphasis: peak velocity at ${bestX} of the move (measured ~0.35)`);
// spring: one visible overshoot ~30%, settles ~0.5s
let peak = 0; for (let t = 0; t < 2; t += 0.001) peak = Math.max(peak, spring(t));
const st = springSettleTime();
assert(peak > 1.2 && peak < 1.4, `bounce: overshoot ${((peak-1)*100).toFixed(0)}% (target 20-40%)`);
const st5 = springSettleTime(700, 18, 1, 0.05);
assert(st5 > 0.25 && st5 < 0.45 && st < 0.7, `bounce: visibly settled (5%) in ${st5.toFixed(2)}s, at rest (1%) in ${st.toFixed(2)}s (R4 pill: ~0.33s)`);
assert(Math.abs(spring(5) - 1) < 1e-3, "bounce: ends at 1");
// bezier solver agrees with a known point: ease-in-out (0.42,0,0.58,1) at 0.5 = 0.5
assert(Math.abs(cubicBezier(0.42,0,0.58,1)(0.5) - 0.5) < 1e-4, "bezier solver symmetric point");
// track evaluation against the R3 graph
const g = parseGraph(JSON.parse(readFileSync("fixtures/r3-hook.graph.json","utf8")));
const title: any = (g.beats[0].nodes[0] as any).children[0];
const tw = title.tracks[0];
const glyphs = [...title.text];
const atEnd = typewriterGlyphs(tw, glyphs, typewriterEnd(tw, glyphs) + 0.1, 30);
assert(atEnd.every(s => s.visible && !s.scrambled), `typewriter: all ${glyphs.length} glyphs visible, none scrambled, 0.1s after the last`);
const mid = typewriterGlyphs(tw, glyphs, glyphTime(tw, glyphs, 10) + 0.01, 30);
assert(mid.filter(s => s.visible).length === 11 && mid[10].scrambled !== null && mid[8].scrambled === null, "typewriter: 11 visible, newest scrambled, 9th resolved");
const ramped = glyphTime(tw, glyphs, 28) - glyphTime(tw, glyphs, 27), first = glyphTime(tw, glyphs, 1) - glyphTime(tw, glyphs, 0);
assert(tw.ramp > 1 ? ramped < first : ramped === first, `typewriter ramp: first gap ${(first*1000).toFixed(0)}ms, last gap ${(ramped*1000).toFixed(0)}ms`);
assert(trackProgress(title.tracks[0], 0.2) === null, "track not started returns null");
const exit = (g.beats[0].nodes[0] as any).tracks[0];
assert(trackProgress(exit, exit.at + exit.ms / 1000)! === 1 && trackProgress(exit, exit.at + exit.ms / 2000)! > 0.5, "exit tween: 50%+ at half, 100% at end");
const agent: any = g.beats[0].nodes[1];
assert(trackProgress(agent.tracks[2], 2.4, 3) === null && trackProgress(agent.tracks[2], 2.5, 3)! > 0, "staggerMs: 4th glyph starts 90ms later");
// un-type (T13): glyphs disappear from the right, evenly over out.ms
const unt = TypewriterTrack.parse({ mode: "typewriter", prop: "glyph.opacity", at: 0, cps: 100, out: { at: 1, ms: 300 } });
const five = [..."Lumen"];
const vis = (t: number) => typewriterGlyphs(unt, five, t, 30).map(s => s.visible ? 1 : 0).join("");
assert(vis(0.99) === "11111" && vis(1.07) === "11110" && vis(1.25) === "10000" && vis(1.31) === "00000", `untype: ${vis(0.99)} -> ${vis(1.07)} -> ${vis(1.25)} -> ${vis(1.31)}`);
// sweep tracks ease like tweens and hold at the end
const sw = SweepTrack.parse({ mode: "sweep", prop: "glyph.color", at: 1, ms: 400, from: -2, to: 10 });
assert(trackProgress(sw, 0.9) === null && trackProgress(sw, 1.4) === 1 && trackProgress(sw, 1.2)! > 0.5, "sweep: null before, settle-eased, 1 at the end");
// count tracks (S2): grouping, decimals, prefix/suffix, negatives
const ct = (o: object) => CountTrack.parse({ mode: "count", prop: "text", from: 0, to: 1, ...o });
assert(formatCount(ct({ suffix: "+" }), 17000) === "17,000+" && formatCount(ct({ decimals: 1, prefix: "$" }), 1234567.25) === "$1,234,567.3"
  && formatCount(ct({ separator: " " }), -4200) === "-4 200" && formatCount(ct({}), 999.4) === "999", "formatCount: 17,000+ / $1,234,567.3 / -4 200 / 999");
// OpenType features reach HarfBuzz: Inter's proportional "1" is narrower than "0"; with tnum every digit is equal
void (async () => {
  const { createShaper } = await import("../src/shaper");
  const sh = await createShaper({ wasm: new Uint8Array(readFileSync("packages/runtime/wasm/hb.wasm")), fonts: { Inter: new Uint8Array(readFileSync("packages/runtime/fonts/Inter-Variable.ttf")) } });
  const width = (s: string, f?: string[]) => sh.shape(s, "Inter", 100, { wght: 500 }, f).reduce((a, g) => a + g.xAdvance, 0);
  const p1 = width("1111"), p0 = width("0000"), t1 = width("1111", ["tnum"]), t0 = width("0000", ["tnum"]);
  assert(p1 < p0 && Math.abs(t1 - t0) < 1e-6, `features: proportional 1111=${p1.toFixed(1)} < 0000=${p0.toFixed(1)}; tnum 1111=${t1.toFixed(1)} == 0000=${t0.toFixed(1)}`);
})();
// cursor math (pure): press dip, hover intervals / amount, moveTo path, colour lerp
{
  const tr = (o: object) => Track.parse(o);
  assert(lerpColor("#000000", "#FFFFFF", 0.5) === "#808080ff" && lerpColor("#FF000000", "#FF0000FF", 1) === "#ff0000ff", "lerpColor: sRGB midpoint, alpha channel");
  const press = [tr({ mode: "press", at: 1 })];
  assert(pressFactor(press, 0.99) === 1 && Math.abs(pressFactor(press, 1.04) - 0.96) < 1e-9 && pressFactor(press, 1.081) === 1, "press: 1 -> 0.96 at mid-press -> 1 after 80 ms");
  const moves = [tr({ mode: "moveTo", target: "b1-a", at: 0.4 }), tr({ mode: "moveTo", target: "b1-b", at: 1.4 }), press[0]];
  const iv = hoverIntervals(moves, "b1-a");
  assert(iv.length === 1 && iv[0].start === 0.9 && iv[0].end === 1.4 && hoverIntervals(moves, "b1-b")[0].end === Infinity, "hover: from moveTo arrival until the next moveTo starts");
  const h = OnHoverTrack.parse({ mode: "onHover", cursor: "b1-c", prop: "fill", to: "#FFFFFF" });
  assert(hoverAmount(h, iv, 0.89) === 0 && hoverAmount(h, iv, 1.1) === 1 && hoverAmount(h, iv, 1.45) > 0 && hoverAmount(h, iv, 1.6) === 0, "hover: eases in over 130 ms, out after leaving");
  const pts: Record<string, { x: number; y: number }> = { "b1-a": { x: 100, y: 0 }, "b1-b": { x: 300, y: 50 } };
  const pos = (t: number) => cursorPosition(moves, t, { x: 0, y: 0 }, (m) => pts[m.target]);
  assert(pos(0.3).x === 0 && pos(0.9).x === 100 && pos(1.9).x === 300 && pos(1.9).y === 50 && pos(1.65).x > 100 && pos(1.65).x < 300, "moveTo: holds, travels, arrives at at + ms, chains from the last target");
  const arcMove = [Track.parse({ mode: "moveTo", target: "b1-a", at: 0, ms: 1000, ease: "linear", arc: 0.15 })] as any;
  const ap = (t: number) => cursorPosition(arcMove, t, { x: 0, y: 0 }, (m) => pts[m.target]);
  assert(Math.abs(ap(0.5).x - 50) < 1e-9 && Math.abs(ap(0.5).y - 15) < 1e-9 && ap(1).x === 100 && Math.abs(ap(1).y) < 1e-9 && Math.abs(ap(0.25).y - 11.25) < 1e-9
    && (Track.parse({ mode: "moveTo", target: "b1-a", at: 0 }) as any).arc === 0,
    "moveTo arc: bows perpendicular by arc x distance at the midpoint (4p(1-p) profile), lands exactly; default 0 (straight)");
}
// camera math (pure): fill-fraction zoom, clamp, hard cut, log-space zoom, transitions start from the replayed state
{
  const W = 1920, H = 1080, box = { left: 100, right: 500, top: 200, bottom: 400 };       // 400 x 200
  const f = (o: object) => FrameTrack.parse({ mode: "frame", target: "b1-x", ...o });
  const close = frameView(f({ size: "close" }), box, W, H), wide = frameView(f({ size: "wide" }), box, W, H);
  assert(Math.abs(close.zoom - Math.min(W * 0.9 / 400, H * 0.9 / 200)) < 1e-9 && close.cx === 300 && close.cy === 300 && Math.abs(wide.zoom - 2.4) < 1e-9,
    `frame: close zoom = min(W*0.9/w, H*0.9/h) = ${close.zoom.toFixed(2)}, centred on the box; wide ${wide.zoom.toFixed(2)}`);
  const off = frameView(f({ size: 2, anchor: "left", offset: { x: 0.5, y: -0.5 } }), box, W, H);
  assert(off.zoom === 2 && off.cx === 300 && off.cy === 200, "frame: explicit zoom; anchor + offset as box fractions");
  const c = clampView({ zoom: 0.5, cx: 0, cy: 0 }, W, H), c2 = clampView({ zoom: 2, cx: 100, cy: 2000 }, W, H);
  assert(c.zoom === 1 && c.cx === W / 2 && c.cy === H / 2 && c2.cx === W / 4 && c2.cy === H - H / 4, "clamp: zoom >= 1, viewport kept inside the canvas");
  const base = () => ({ zoom: 1, cx: W / 2, cy: H / 2 });
  const frames = [f({ at: 1, size: 4, ms: 0 }), f({ at: 2, size: 1, ms: 400 })];
  const st = (t: number) => cameraState(frames, t, base, (fr) => frameView(fr, box, W, H), W, H);
  const mid = st(2.2);
  assert(st(0.99).zoom === 1 && st(1).zoom === 4 && st(1.99).zoom === 4 && st(2.4).zoom === 1 && mid.zoom < 4 && mid.zoom > 1,
    "cameraState: holds base, hard cut at 1 s, 400 ms transition back from the replayed state");
  const p = EASES.emphasis(0.5);
  assert(Math.abs(Math.log(mid.zoom) - (Math.log(4) + (Math.log(1) - Math.log(4)) * p)) < 1e-9, "cameraState: zoom interpolates in log space");
}
// camera fixture (S4): the framed card's projected box stays fully inside the canvas through the close-up
void (async () => {
  const { createShaper } = await import("../src/shaper");
  const { createRuntime } = await import("../src/canvas2d");
  const sh = await createShaper({ wasm: new Uint8Array(readFileSync("packages/runtime/wasm/hb.wasm")), fonts: { Inter: new Uint8Array(readFileSync("packages/runtime/fonts/Inter-Variable.ttf")) } });
  const rt = createRuntime({ shaper: sh });
  const raw = JSON.parse(readFileSync("fixtures/s4-jump-cut.graph.json", "utf8"));
  const press = raw.beats[0].camera.tracks.map((t: any) => t.at);              // [0, press1, press2]
  for (const aspect of ["9:16", "16:9"] as const) {
    const gr = parseGraph({ ...raw, canvas: { ...raw.canvas, aspect } });
    const W = aspect === "9:16" ? Math.round(1080 * 9 / 16) : Math.round(1080 * 16 / 9), H = 1080;
    let worst = Infinity, n = 0, zooms: number[] = [];
    for (let t = press[1] + 0.3; t < press[2]; t += 1 / 30, n++) {
      const cam = rt.camera(gr, t), b = rt.measure(gr, t).get("b1-cards-1")!;
      const sx = (x: number) => (x - cam.cx) * cam.zoom + W / 2, sy = (y: number) => (y - cam.cy) * cam.zoom + H / 2;
      worst = Math.min(worst, sx(b.left), W - sx(b.right), sy(b.top), H - sy(b.bottom));
      zooms.push(cam.zoom);
    }
    const before = rt.camera(gr, press[1] - 0.01), after = rt.camera(gr, press[2]), justBefore = rt.camera(gr, press[2] - 0.001);
    assert(worst >= 0 && n > 20 && Math.min(...zooms) > 1.5 && after.zoom === before.zoom && after.cx === before.cx && justBefore.zoom > 1.5,
      `camera fixture ${aspect}: card 1 fully inside the canvas through the close-up (min margin ${worst.toFixed(1)} px over ${n} frames, zoom ${zooms[0].toFixed(2)}); hard cut back to the same wide framing (zoom ${before.zoom.toFixed(2)})`);
  }
})();
// row / column layout (measure pass): sequential placement from rest boxes, gap, align, wrap, per-aspect overrides,
// tracks applied after layout without moving neighbours
void (async () => {
  const { createShaper } = await import("../src/shaper");
  const { createRuntime } = await import("../src/canvas2d");
  const sh = await createShaper({ wasm: new Uint8Array(readFileSync("packages/runtime/wasm/hb.wasm")), fonts: { Inter: new Uint8Array(readFileSync("packages/runtime/fonts/Inter-Variable.ttf")) } });
  const rt = createRuntime({ shaper: sh });
  const rect = (n: number, w: number, h: number, extra: object = {}) => ({ id: `b1-r${n}`, type: "rect", w, h, ...extra });
  const g = (layout: object, aspect = "16:9", r1: object = {}) => parseGraph({ version: 1, canvas: { aspect }, tokens: {}, beats: [{ id: "b1", type: "hook", start: 0, duration: 2,
    nodes: [{ id: "b1-g", type: "group", layout, children: [rect(1, 100, 40, r1), rect(2, 200, 60), rect(3, 50, 40)] }],
    camera: { tracks: [{ mode: "frame", target: "b1-g", size: 1 }] } }] });     // a frame track so the measure pass runs
  const at = (gr: any, t = 0) => rt.measure(gr, t);
  const m = at(g({ type: "row", gap: 20 }));
  const b1 = m.get("b1-r1")!, b2 = m.get("b1-r2")!, b3 = m.get("b1-r3")!;
  assert(b1.left === 765 && b1.right === 865 && b2.left === 885 && b2.right === 1085 && b3.left === 1105 && b1.top === 520 && b2.top === 510,
    "layout row: 100 + 20 + 200 + 20 + 50 centred on the origin, centred across the line");
  const s = at(g({ type: "row", gap: 20, align: "start" }));
  assert(s.get("b1-r1")!.top === 510 && s.get("b1-r3")!.top === 510, "layout row align start: tops aligned to the line");
  const c = at(g({ type: "column", gap: 10 }));
  assert(c.get("b1-r1")!.top === 540 - 80 && c.get("b1-r2")!.top === 540 - 80 + 50 && c.get("b1-r2")!.left === 860 && c.get("b1-r1")!.left === 910,
    "layout column: stacked with the gap, centred across");
  const w = at(g({ type: "row", gap: 20, wrap: true, maxWidth: 250 }));
  assert(w.get("b1-r1")!.top === 450 && w.get("b1-r2")!.top === 510 && w.get("b1-r3")!.top === 590 && w.get("b1-r3")!.left === 935,
    "layout wrap: each child on its own line at maxWidth 250, lines centred, gap between lines");
  const o = at(g({ type: "row", gap: 20, overrides: { "9:16": { gap: 0 } } }, "9:16"));
  assert(o.get("b1-r1")!.left === 304 - 175 && o.get("b1-r2")!.left === 304 - 75, "layout overrides: 9:16 gap 0");
  const tr = g({ type: "row", gap: 20 }, "16:9", { tracks: [{ mode: "tween", prop: "y", at: 0, ms: 1000, from: 30, to: 0, ease: "linear" }] });
  const t0 = at(tr, 0);
  assert(t0.get("b1-r1")!.top === 550 && t0.get("b1-r2")!.left === 885 && t0.get("b1-r2")!.top === 510, "layout: a child's track applies after layout and doesn't move its neighbours");
})();
// velocity-preserving retargeting (pure): a track starting mid-motion inherits the velocity; from rest it is exact
{
  const tw = (o: object) => ({ tr: Track.parse({ mode: "tween", prop: "x", ...o }) as any, start: (o as any).at as number });
  const A = tw({ at: 0, ms: 1000, from: 0, to: 1000, ease: "linear" });             // 1000 px/s
  const B = tw({ at: 0.5, ms: 400, to: -200, ease: "settle" });                       // retarget mid-motion, from = current
  const f = (t: number, cs = [A, B]) => resolveTracks("x", 0, t, cs);
  const h = 1e-4, v0 = (f(0.5) - f(0.5 - h)) / h, v1 = (f(0.5 + h) - f(0.5)) / h;
  const plainB = (t: number) => resolveTracks("x", 0, t, [A, { ...B, tr: { ...B.tr, carryVelocity: false } }]);
  assert(Math.abs(f(0.5) - 500) < 1e-9 && Math.abs(v0 - 1000) < 1e-3 && Math.abs(v1 - 1000) < 5 && f(0.58) === plainB(0.58) && f(0.7) === plainB(0.7),
    `retarget tween: continuous at the handoff (x 500, velocity ${v0.toFixed(0)} -> ${v1.toFixed(0)} px/s), on its own curve from +80 ms`);
  assert(Math.abs(plainB(0.5) - 500) < 1e-9 && Math.abs((plainB(0.5 + h) - plainB(0.5)) / h) > 1e4,
    "carryVelocity false: starts at the current value but with its own (very different) velocity");
  const S = tw({ at: 0.5, ms: 400, to: -200, ease: "bounce" });
  const g = (t: number) => resolveTracks("x", 0, t, [A, S]);
  const sv = (g(0.5 + h) - g(0.5)) / h;
  assert(Math.abs(g(0.5) - 500) < 1e-9 && Math.abs(sv - 1000) < 60 && Math.abs(g(3) + 200) < 1e-3, `retarget spring: starts at 500 moving ${sv.toFixed(0)} px/s, settles at -200`);
  const R = tw({ at: 1.2, ms: 400, from: 1000, to: 0, ease: "settle" });               // A ended at 1.0: from rest
  const plainR = (t: number) => resolveTracks("x", 0, t, [A, { ...R, tr: { ...R.tr, carryVelocity: false } }]);
  assert([1.2, 1.25, 1.3, 1.5].every((t) => resolveTracks("x", 0, t, [A, R]) === plainR(t)), "from rest: exactly the plain track value");
  const E = tw({ at: 1.0, ms: 400, from: 1000, to: 0, ease: "settle" });               // starts exactly as A ends
  assert([1.0, 1.05, 1.2].every((t) => resolveTracks("x", 0, t, [A, E]) === tweenValue(E.tr, t, 0, 0, 1.0)), "handoff exactly at the previous end counts as rest");
}
// paths (pure): length and bounds by flattening, relative commands, smooth reflections; wire geometry
{
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  assert(pathLength("M0 0 L100 0") === 100 && pathLength("M0 0 H100 V100 H0 Z") === 400 && pathLength("m10 10 h100 v100 h-100 z") === 400,
    "pathLength: lines, H/V, relative commands, Z closes");
  const quarter = pathLength("M100 0 C100 55.228 55.228 100 0 100");               // r = 100 quarter circle
  assert(near(quarter, Math.PI * 50, 0.2), `pathLength: cubic quarter circle ${quarter.toFixed(2)} ~ ${(Math.PI * 50).toFixed(2)}`);
  const sRefl = flattenPath("M0 0 C0 50 50 50 50 0 S100 -50 100 0"), tRefl = flattenPath("M0 0 Q25 50 50 0 T100 0");
  assert(sRefl[0].some((p) => p.y < -30) && tRefl[0].some((p) => p.y < -20) && flattenPath("M0 0 L10 0 M20 0 L30 0").length === 2,
    "flattenPath: S / T reflect the previous control point; M starts a subpath");
  const b = pathBounds("M-10 5 L40 -20 L30 60")!;
  assert(b.left === -10 && b.right === 40 && b.top === -20 && b.bottom === 60, "pathBounds");
  const box = { left: 0, right: 200, top: 0, bottom: 100 };
  const pa = anchorPoint(box, "right", { x: 0, y: 0.25 });
  assert(pa.x === 200 && pa.y === 75, "anchorPoint: edge anchor + fractional offset");
  assert(wirePath({ x: 0, y: 0 }, { x: 200, y: 100 }, "s", 0.5) === "M 0 0 C 100 0 100 100 200 100" && wirePath({ x: 0, y: 0 }, { x: 10, y: 0 }, "line", 0.5) === "M 0 0 L 10 0",
    "wirePath: s cubic with horizontal tangents (bend 0.5), line");
  const arc = flattenPath(wirePath({ x: 0, y: 0 }, { x: 200, y: 0 }, "arc", 0.25))[0];
  assert(near(Math.max(...arc.map((p) => Math.abs(p.y))), 50, 0.5), "wirePath arc: bows perpendicular by bend * |d| (0.25 * 200 = 50)");
}
// font axes: the vendored Inter exposes only wght (slnt is synthesized as an oblique by the runtime)
void (async () => {
  const { createShaper } = await import("../src/shaper");
  const sh = await createShaper({ wasm: new Uint8Array(readFileSync("packages/runtime/wasm/hb.wasm")), fonts: { Inter: new Uint8Array(readFileSync("packages/runtime/fonts/Inter-Variable.ttf")) } });
  const ax = sh.axes!("Inter");
  const w = (wght: number) => sh.shape("H", "Inter", 100, { wght })[0].d;
  assert(Object.keys(ax).join() === "wght" && ax.wght.min === 100 && ax.wght.max === 900 && w(300) !== w(800), "axes: Inter has wght 100-900 (real axis changes outlines); no slnt -> synthesized");
})();
// visible(): what renderFrame would show; the planner's coverage gate — the golden graph never has more than 250 ms
// without a visible node, at either aspect
void (async () => {
  const { createShaper } = await import("../src/shaper");
  const { createRuntime } = await import("../src/canvas2d");
  const sh = await createShaper({ wasm: new Uint8Array(readFileSync("packages/runtime/wasm/hb.wasm")), fonts: { Inter: new Uint8Array(readFileSync("packages/runtime/fonts/Inter-Variable.ttf")) } });
  const rt = createRuntime({ shaper: sh });
  const g = parseGraph({ version: 1, canvas: { aspect: "16:9" }, tokens: {}, beats: [
    { id: "b1", type: "hook", start: 0, duration: 1, nodes: [{ id: "b1-a", type: "rect", w: 10, h: 10, tracks: [{ mode: "tween", prop: "opacity", at: 0.5, ms: 0, from: 0, to: 1 }] },
      { id: "b1-t", type: "text", text: "Hi", style: { size: 40 }, tracks: [{ mode: "typewriter", prop: "glyph.opacity", at: 0.2, cps: 10, caret: { style: "none" } }] }] },
    { id: "b2", type: "cta", start: 1, duration: 1, transition: { type: "crossfade", ms: 400 }, nodes: [{ id: "b2-a", type: "rect", w: 10, h: 10, opacity: 0.01 }, { id: "b2-g", type: "group", children: [{ id: "b2-c", type: "rect", w: 1, h: 1 }] }] },
  ] });
  const v = (t: number) => rt.visible(g, t).join();
  assert(v(0.1) === "" && v(0.25) === "b1-t" && v(0.6) === "b1-a,b1-t" && v(1.1) === "b1-a,b1-t,b2-c" && v(1.5) === "b2-c",
    "visible: faded / untyped / near-transparent nodes don't count, groups aren't drawables, a crossfade shows both beats");
  const golden = JSON.parse(readFileSync("fixtures/demo.graph.json", "utf8"));
  for (const aspect of ["16:9", "9:16"]) {
    const gr = parseGraph({ ...golden, canvas: { ...golden.canvas, aspect } });
    const end = gr.beats.at(-1)!.start + gr.beats.at(-1)!.duration, fps = gr.canvas.fps;
    let run = 0, worst = 0, worstAt = 0;
    for (let f = 0; f < Math.ceil(end * fps); f++) {
      if (rt.visible(gr, f / fps).length === 0) { run++; if (run > worst) { worst = run; worstAt = f / fps; } } else run = 0;
    }
    assert(worst / fps <= 0.25, `coverage ${aspect}: golden demo graph's longest stretch with no visible node is ${Math.round(worst / fps * 1000)} ms (<= 250 ms${worst ? `, ending ${worstAt.toFixed(2)} s` : ""})`);
  }
})();
