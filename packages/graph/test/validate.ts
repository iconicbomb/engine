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
// transitions: need a previous beat and must fit in their beat; defaults and the macro enter delay
{
  const { transitionParams, enterDelay } = require("../src/schedule");
  const beat = (id: string, start: number, transition?: object) => ({ id, type: "hook", start, duration: 1, nodes: [], ...(transition ? { transition } : {}) });
  const tg = (beats: object[]) => Graph.safeParse({ version: 1, canvas: {}, tokens: {}, beats });
  const okT = tg([beat("b1", 0), beat("b2", 1, { type: "curtain" })]);
  const badT = tg([beat("b1", 0, { type: "smear" }), beat("b2", 1, { type: "crossfade", ms: 1500 })]);
  const c = transitionParams({ type: "curtain" }), sm = transitionParams({ type: "smear" }), cf = transitionParams({ type: "crossfade" });
  if (!okT.success || badT.success || badT.error.issues.length !== 2 || c.ms !== 600 || c.direction !== "right" || sm.ms !== 160 || sm.direction !== "left"
    || cf.ms !== 100 || cf.ease !== "linear" || enterDelay({ type: "curtain" }) !== 0.3 || enterDelay({ type: "smear", ms: 200 }) !== 0.2 || enterDelay(undefined) !== 0) {
    console.error("FAIL: transitions", okT.success, badT.success ? 0 : badT.error.issues.map((i: any) => i.message)); process.exit(1);
  }
  console.log("ok: transitions validated (first beat / too long rejected); defaults curtain 600 right, smear 160 left, crossfade 100 linear; enter delays ms/2, ms");
}
// image nodes: named asset or null slot (with placeholder kind / label)
{
  const ig = (n: object) => Graph.safeParse({ version: 1, canvas: {}, tokens: {}, beats: [{ id: "b1", type: "hook", start: 0, duration: 1, nodes: [n] }] });
  const a = ig({ id: "b1-i", type: "image", src: "a.png", w: 10, h: 10 }), b = ig({ id: "b1-j", type: "image", src: null, placeholder: { kind: "video", label: "Demo" }, w: 10, h: 10 });
  const bad = ig({ id: "b1-k", type: "image", src: "", w: 10, h: 10 });
  if (!a.success || !b.success || bad.success || (a.data.beats[0].nodes[0] as any).fit !== "cover") { console.error("FAIL: image nodes"); process.exit(1); }
  console.log("ok: image nodes — named asset (fit cover default), null slot with placeholder, empty src rejected");
}
// object hand-off: a node may reappear (same id) in the immediately following beat only; "tag" is a beat type
{
  const two = (second: string, third?: string) => Graph.safeParse({ version: 1, canvas: {}, tokens: {}, beats: [
    { id: "b1", type: "feature", start: 0, duration: 1, nodes: [{ id: "b1-ui", type: "rect", w: 10, h: 10 }] },
    { id: "b2", type: "feature", start: 1, duration: 1, nodes: [{ id: second, type: "rect", w: 10, h: 10 }] },
    { id: "b3", type: "tag", start: 2, duration: 1, nodes: third ? [{ id: third, type: "rect", w: 10, h: 10 }] : [] }] });
  const handoff = two("b1-ui"), chained = two("b1-ui", "b1-ui"), skipped = two("b2-x", "b1-ui"), stray = two("b9-x");
  if (!handoff.success || !chained.success || skipped.success || stray.success) { console.error("FAIL: hand-off ids", handoff.success, chained.success, skipped.success, stray.success); process.exit(1); }
  console.log("ok: hand-off ids continue into the next beat (and onward beat by beat); skipping a beat or a foreign prefix is rejected; tag beats parse");
}
