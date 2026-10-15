import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseGraph } from "@engine/graph";
import { applyEdits, bracketFrame, fitToWidth, reveal, scrambleTypewriter } from "../src/index";
import { buildR3Hook } from "../scenes/r3-hook";
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

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
let threw = false;
try { applyEdits(a.nodes, [reveal({ id: "b1-r", text: "X", style: { size: 10 }, at: 1, handoff: { target: "b1-nope", at: 0.5, ms: 100, scaleTo: 0.5, fadeDelayMs: 0, fadeMs: 100 } })]); } catch { threw = true; }
assert(threw, "T12: handoff to an unknown node is rejected");

// the R3 fixture is exactly what the four macro calls produce (after schema defaults)
const fixture = parseGraph(JSON.parse(readFileSync("fixtures/r3-hook.graph.json", "utf8")));
assert(isDeepStrictEqual(parseGraph(buildR3Hook()), fixture), "R3: fixture == parse(buildR3Hook()) — regenerate with tsx tools/gen-r3.ts");
