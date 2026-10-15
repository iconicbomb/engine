import { EASES, spring, springSettleTime, trackProgress, typewriterGlyphs, cubicBezier } from "../src/runtime-core";
import { parseGraph } from "@engine/graph";
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
const atEnd = typewriterGlyphs(tw, glyphs, 0.33 + glyphs.length / 26 + 0.1, 30);
assert(atEnd.every(s => s.visible && !s.scrambled), `typewriter: all ${glyphs.length} glyphs visible, none scrambled, 0.1s after the last`);
const mid = typewriterGlyphs(tw, glyphs, 0.33 + 10 / 26 + 0.02, 30);
assert(mid.filter(s => s.visible).length === 11 && mid[10].scrambled !== null && mid[8].scrambled === null, "typewriter: 11 visible, newest scrambled (2 frames), 9th resolved");
assert(trackProgress(title.tracks[0], 0.2) === null, "track not started returns null");
const exit = (g.beats[0].nodes[0] as any).tracks[0];
assert(trackProgress(exit, 2.3)! === 1 && trackProgress(exit, 2.15)! > 0.5, "exit tween: 50%+ at half, 100% at end");
const agent: any = g.beats[0].nodes[1];
assert(trackProgress(agent.tracks[2], 2.4, 3) === null && trackProgress(agent.tracks[2], 2.5, 3)! > 0, "staggerMs: 4th glyph starts 90ms later");
