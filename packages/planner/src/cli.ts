// pnpm plan <brief.json> <out.graph.json> [--seed 7] [--refresh] [--rule] [--record]
// pnpm make <brief.json> [--seed 7] [--refresh] [--rule] [--record]   plan, then render out/<name>-16x9.mp4 / -9x16.mp4
//
// Segmentation: a recorded plan (fixtures/plans/<name>.plan.json) is replayed when it exists; --refresh ignores it.
// Without a recording: Claude when .env has a key (its response is recorded), else the rule segmenter. If the model
// can't be reached the rule segmenter plans instead. --rule forces the rules; --record writes a rule-segmented plan too.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseBrief } from "@engine/graph";
import { assemble } from "./assemble";
import { loadEnv } from "./env";
import { llmSegmenter } from "./llm";
import { recordedSegmenter, ruleSegmenter, type Segmenter } from "./segment";
import type { PlanBeat, RecordedPlan } from "./types";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (k: string) => argv.includes(k);
const opt = (k: string, d: string) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const positional = argv.slice(1).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--seed");

function writePlan(planPath: string, plan: RecordedPlan) {
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
  console.log(`recorded ${planPath} (${plan.segmenter})`);
}

async function segment(brief: ReturnType<typeof parseBrief>, name: string, planPath: string): Promise<PlanBeat[]> {
  const rule = async () => {
    const beats = await ruleSegmenter.segment(brief);
    if (flag("--record")) writePlan(planPath, { brief: name, segmenter: "rule", beats });
    return beats;
  };
  if (flag("--rule")) { console.log("segmenter: rule"); return rule(); }
  if (existsSync(planPath) && !flag("--refresh")) { console.log(`segmenter: recorded ${planPath}`); return recordedSegmenter(planPath).segment(brief); }
  const env = loadEnv();
  if (!env.apiKey) { console.log("segmenter: rule (no API key in .env)"); return rule(); }
  const llm: Segmenter = llmSegmenter({ apiKey: env.apiKey, model: env.model, workspaceId: env.workspaceId });
  console.log(`segmenter: ${llm.name}`);
  try {
    const beats = await llm.segment(brief);
    writePlan(planPath, { brief: name, segmenter: "llm", model: env.model, beats });
    return beats;
  } catch (e) {
    // the model is unreachable (network, key, workspace): plan with the rules rather than fail
    console.warn(`segmentation via ${llm.name} failed — ${e instanceof Error ? e.message : e}`);
    console.warn("falling back to the rule segmenter");
    return rule();
  }
}

async function main() {
  if (cmd !== "plan" && cmd !== "make") throw new Error("usage: cli plan <brief.json> <out.graph.json> [--seed N] | cli make <brief.json> [--seed N]");
  const [briefPath, outArg] = positional;
  if (!briefPath) throw new Error("missing brief path");
  const seed = Number(opt("--seed", "7"));
  const name = path.basename(briefPath).replace(/\.brief\.json$|\.json$/, "");
  const planPath = path.join("fixtures", "plans", `${name}.plan.json`);
  const brief = parseBrief(JSON.parse(readFileSync(briefPath, "utf8")));
  const beats = await segment(brief, name, planPath);
  const { graph, selections } = assemble(brief, beats, seed);
  console.log(`seed: ${seed}`);
  for (const s of selections) console.log(`  ${s.beatId.padEnd(4)} ${s.row.padEnd(16)} ${s.text.padEnd(4)} ${s.shapes.join("+")}`);
  const outGraph = cmd === "plan" && outArg ? outArg : `out/${name}.graph.json`;
  mkdirSync(path.dirname(outGraph), { recursive: true });
  writeFileSync(outGraph, JSON.stringify(graph, null, 2) + "\n");
  const end = graph.beats.at(-1)!;
  console.log(`wrote ${outGraph} (${graph.beats.length} beats, ${(end.start + end.duration).toFixed(1)} s)`);
  if (cmd === "make") {
    for (const aspect of brief.aspects) {
      const out = `out/${name}-${aspect.replace(":", "x")}.mp4`;
      execFileSync(process.execPath, ["tools/render-local.mjs", outGraph, out, "--aspect", aspect, "--no-frames"], { stdio: "inherit" });
    }
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
