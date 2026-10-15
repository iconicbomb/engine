// Regenerates fixtures from macro calls. usage: tsx tools/gen-fixtures.ts [name ...]   (no names = all)
import { writeFileSync } from "node:fs";
import { parseGraph } from "@engine/graph";
import { SCENES } from "../packages/patterns/scenes/index";

const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(SCENES)) {
  const build = SCENES[name];
  if (!build) throw new Error(`unknown scene ${name}; known: ${Object.keys(SCENES).join(", ")}`);
  const graph = build();
  parseGraph(graph); // refuse to write a graph the schema rejects
  const out = `fixtures/${name}.graph.json`;
  writeFileSync(out, JSON.stringify(graph, null, 2) + "\n");
  console.log("wrote", out);
}
