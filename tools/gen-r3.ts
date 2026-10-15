// Regenerates the R3 fixture from macro calls. usage: tsx tools/gen-r3.ts [out=fixtures/r3-hook.graph.json]
import { writeFileSync } from "node:fs";
import { parseGraph } from "@engine/graph";
import { buildR3Hook } from "../packages/patterns/scenes/r3-hook";

const out = process.argv[2] ?? "fixtures/r3-hook.graph.json";
const graph = buildR3Hook();
parseGraph(graph); // refuse to write a graph the schema rejects
writeFileSync(out, JSON.stringify(graph, null, 2) + "\n");
console.log("wrote", out);
