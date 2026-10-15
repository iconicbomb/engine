// Regenerates fixtures from macro calls. usage: tsx tools/gen-fixtures.ts [name ...]   (no names = all)
import { writeFileSync } from "node:fs";
import { parseGraph } from "@engine/graph";
import { SCENES } from "../packages/patterns/scenes/index";
import { buildShowcase } from "../packages/patterns/scenes/showcase";

const names = process.argv.slice(2);
for (const name of names.length ? names.filter((n) => n !== "showcase") : Object.keys(SCENES)) {
  const build = SCENES[name];
  if (!build) throw new Error(`unknown scene ${name}; known: ${Object.keys(SCENES).join(", ")}`);
  const graph = build();
  parseGraph(graph); // refuse to write a graph the schema rejects
  const out = `fixtures/${name}.graph.json`;
  writeFileSync(out, JSON.stringify(graph, null, 2) + "\n");
  console.log("wrote", out);
}
// the showcase concatenates every scene: regenerate it whenever all fixtures are (or when named)
if (!names.length || names.includes("showcase")) {
  const graph = buildShowcase();
  parseGraph(graph);
  writeFileSync("fixtures/showcase.graph.json", JSON.stringify(graph) + "\n");
  console.log("wrote fixtures/showcase.graph.json", `(${graph.beats.length} beats)`);
}
