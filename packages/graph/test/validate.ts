import { readFileSync } from "node:fs";
import { parseGraph, Graph } from "../src/schema";
const file = process.argv[2] ?? "fixtures/r3-hook.graph.json";
const g = parseGraph(JSON.parse(readFileSync(file, "utf8")));
console.log("ok: graph valid —", g.beats.length, "beat(s),", g.beats[0].nodes.length, "top-level nodes");
const bad = JSON.parse(readFileSync(file, "utf8"));
bad.beats[0].nodes[1].id = "zz-agent";
bad.beats.push({ ...bad.beats[0], id: "b2", start: 1.0 });
const r = Graph.safeParse(bad);
if (r.success) { console.error("FAIL: schema accepted a broken graph"); process.exit(1); }
console.log("ok: schema rejects broken graphs —", r.error.issues.length, "issues found");
// cursor references: moveTo targets and onHover cursors must exist in the beat; cursors must be top-level
const cur = (nodes: unknown[]) => Graph.safeParse({ version: 1, canvas: {}, tokens: {}, beats: [{ id: "b1", type: "hook", start: 0, duration: 1, nodes }] });
const okCur = cur([{ id: "b1-r", type: "rect", w: 10, h: 10, tracks: [{ mode: "onHover", cursor: "b1-c", prop: "fill", to: "#FFFFFF" }] },
  { id: "b1-c", type: "cursor", tracks: [{ mode: "moveTo", target: "b1-r", at: 0 }, { mode: "press", at: 0.6 }] }]);
const badCur = cur([{ id: "b1-r", type: "rect", w: 10, h: 10, tracks: [{ mode: "onHover", cursor: "b1-nope", prop: "fill", to: "#FFFFFF" }] },
  { id: "b1-g", type: "group", children: [{ id: "b1-c", type: "cursor", tracks: [{ mode: "moveTo", target: "b1-missing", at: 0 }] }] }]);
if (!okCur.success || badCur.success || badCur.error.issues.length !== 3) { console.error("FAIL: cursor reference validation", okCur.success, badCur.success ? 0 : badCur.error.issues.map(i => i.message)); process.exit(1); }
console.log("ok: cursor refs validated — unknown moveTo target, unknown onHover cursor, nested cursor all rejected");
// wires: both ends must exist in the beat; wires are top-level
const wire = (nodes: unknown[]) => Graph.safeParse({ version: 1, canvas: {}, tokens: {}, beats: [{ id: "b1", type: "hook", start: 0, duration: 1, nodes }] });
const okWire = wire([{ id: "b1-a", type: "rect", w: 10, h: 10 }, { id: "b1-b", type: "rect", w: 10, h: 10 }, { id: "b1-w", type: "wire", from: { target: "b1-a" }, to: { target: "b1-b" } }]);
const badWire = wire([{ id: "b1-a", type: "rect", w: 10, h: 10 }, { id: "b1-g", type: "group", children: [{ id: "b1-w", type: "wire", from: { target: "b1-a" }, to: { target: "b1-nope" } }] }]);
if (!okWire.success || badWire.success || badWire.error.issues.length !== 2) { console.error("FAIL: wire validation", okWire.success, badWire.success ? 0 : badWire.error.issues.map(i => i.message)); process.exit(1); }
console.log("ok: wires validated — unknown end and nested wire rejected");
