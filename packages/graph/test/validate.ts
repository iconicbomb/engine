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
