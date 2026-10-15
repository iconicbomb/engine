import { EASES, spring, springSettleTime, trackProgress, typewriterGlyphs, cubicBezier, lerpColor, pressFactor, hoverIntervals, hoverAmount, cursorPosition, frameView, clampView, cameraState } from "../src/runtime-core";
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
