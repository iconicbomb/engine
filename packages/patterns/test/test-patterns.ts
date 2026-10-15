import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseGraph, glyphTime, TypewriterTrack } from "@engine/graph";
import { ambientGlow, applyEdits, bracketFrame, colourSweep, fitToWidth, logoTypewriter, reveal, scrambleTypewriter, tailTypewriter, wordAppend } from "../src/index";
import { SCENES } from "../scenes/index";
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

// macros are pure: same params, same output, nothing shared between calls
const p = { id: "b1-t", text: "Hello world", style: { size: 100 }, at: 0.2 };
const a = scrambleTypewriter(p), b = scrambleTypewriter(p);
assert(isDeepStrictEqual(a, b) && a !== b && a.nodes[0] !== b.nodes[0], "T1: deterministic, fresh objects per call");
const tw: any = a.nodes[0].tracks![0];
assert(tw.ms === Math.round(11 / 26 * 1000), `T1: ms derived from the glyph schedule (${tw.ms} ms for 11 chars at 26 cps)`);

// T3 is a patch on the text node; T5 / T12 emit nodes; edits on unknown ids throw
const tree: any[] = applyEdits(a.nodes, [fitToWidth({ target: "b1-t", w: 800, h: 200 })]);
assert(tree[0].fit?.w === 800 && tree[0].fit.minScale === 0.25, "T3: fit applied with schema-matching defaults");
assert(bracketFrame({ id: "b1-br", follows: "b1-t", style: { size: 200 } }).nodes[0].opacity === undefined, "T5: no appear -> visible from beat start");
assert(throws(() => applyEdits(a.nodes, [reveal({ id: "b1-r", text: "X", style: { size: 10 }, at: 1, handoff: { target: "b1-nope", at: 0.5, ms: 100, scaleTo: 0.5, fadeDelayMs: 0, fadeMs: 100 } })])),
  "T12: handoff to an unknown node is rejected");

// S15: one glow per layer, each fading in from 0 to its resting intensity
const glow = ambientGlow();
assert(glow.glows.length === 2 && glow.glows.every((g: any) => g.tracks[0].from === 0 && g.tracks[0].to === g.intensity && g.color === "tokens.accent"),
  "S15: default under + top layers, intensity fade-in tracks, brand colour");

// T2: the tint covers the last N chars by decaying over N / cps; full-strength tint
const t2: any = tailTypewriter({ id: "b1-x", text: "Pick any of 17,000 models", style: { size: 100 }, at: 0 }).nodes[0].tracks![0];
assert(t2.cps === 30 && t2.tail.len === 6 && t2.tail.decayMs === 200 && t2.tail.strength === 1 && t2.ms === 833,
  `T2: R5 defaults — 30 cps, tail 6 chars decaying over ${t2.tail.decayMs} ms, typed in ${t2.ms} ms`);

// T4: words land wordGapMs apart, and each word's glyphs land within one frame of each other
const t4 = wordAppend({ id: "b1-x", text: "Connect every tool", style: { size: 100 }, at: 0.2 });
const t4tw = TypewriterTrack.parse(t4.nodes[0].tracks![0]), t4chars = [..."Connect every tool"];
const times = t4chars.map((_, i) => glyphTime(t4tw, t4chars, i));
const wordStarts = [...new Set(times)], gaps = wordStarts.slice(1).map((s, i) => (s - wordStarts[i]) * 1000);
assert(wordStarts.length === 3 && gaps.every((g) => Math.abs(g - 230) < 1e-6) && times[7] === times[8] && times[6] === times[0],
  `T4: 3 words, ${gaps.map((g) => g.toFixed(0)).join(" / ")} ms apart; all glyphs of a word (and its leading space) share a reveal time`);
assert(t4.nodes[0].tracks!.filter((t: any) => t.relativeTo === "reveal").length === 2, "T4: fade + slide timed from each glyph's reveal");

// T6: full sweep enters/leaves off the ends; keyword sweep stops on the word with a window of its width
const text = "Ship faster with AI agents";
const full: any = colourSweep({ target: "b1-h", text, at: 0 }).tracks[0].track;
const key: any = colourSweep({ target: "b1-h", text, at: 0, keyword: "agents" }).tracks[0].track;
const rtl: any = colourSweep({ target: "b1-h", text, at: 0, direction: "rtl" }).tracks[0].track;
assert(full.from === -2 && full.to === 28 && full.window === 4 && full.ms === 450, "T6: 4-glyph window sweeps -2 -> 28 over 450 ms");
assert(key.window === 6 && key.to === 23, "T6: keyword hold centred on 'agents' (glyphs 20-25), window 6");
assert(rtl.from === 28 && rtl.to === -2, "T6: rtl reverses the sweep");
assert(throws(() => colourSweep({ target: "b1-h", text, at: 0, keyword: "nope" })), "T6: unknown keyword is rejected");

// T13: wordmark types in typeMs after the mark lands, un-types over 270 ms; mark follows the wordmark's left edge
const t13 = logoTypewriter({ id: "b1-logo", text: "Lumen", style: { size: 140 }, at: 0.2, untype: { at: 1.6 } });
const [wm, mark]: any[] = (t13.nodes[0] as any).children;
assert(wm.tracks[0].ms === 400 && wm.tracks[0].at === 0.4 && wm.tracks[0].out.ms === 270, "T13: types in 400 ms after a 200 ms mark lead, un-types in 270 ms");
assert(mark.type === "rect" && mark.follows.node === "b1-logo-wordmark" && mark.follows.edge === "left", "T13: mark follows the wordmark's left edge");
assert(wm.tracks[1].prop === "x" && wm.tracks[1].to === (112 + 28) / 2, "T13: wordmark offset by half the mark + gap so the finished lockup is centred");

// every fixture validates and is exactly what its scene builder produces (after schema defaults)
for (const [name, build] of Object.entries(SCENES)) {
  const file = `fixtures/${name}.graph.json`;
  if (!existsSync(file)) { assert(false, `${name}: ${file} missing — run pnpm gen:fixtures`); continue; }
  let fixture;
  try { fixture = parseGraph(JSON.parse(readFileSync(file, "utf8"))); } catch (e) { assert(false, `${name}: fixture fails validation — ${(e as Error).message.slice(0, 200)}`); continue; }
  assert(isDeepStrictEqual(parseGraph(build()), fixture), `${name}: fixture validates and == parse(build()) — regenerate with pnpm gen:fixtures`);
}
