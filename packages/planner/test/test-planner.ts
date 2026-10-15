// planner: each stage pure and tested on its own; the golden brief through the recorded plan (never the network)
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseBrief, parseGraph } from "@engine/graph";
import {
  assemble, beatDuration, composeTransitions, cpsFor, emphasisOf, freezeFinal, gapAt, glowsFor, normalizeBeats, planDetail, planTiming,
  recordedSegmenter, rowFor, ruleSegment, selectPatterns, sizeFactor, staggerFor, wpm, type PlanBeat,
} from "../src/index";
import { loadEnv } from "../src/env";
import { chunks, wrapChunks } from "../src/macros";
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

const briefJson = JSON.parse(readFileSync("fixtures/briefs/demo.brief.json", "utf8"));
const brief = parseBrief(briefJson);
const PLAN = "fixtures/plans/demo.plan.json";
const beat = (type: PlanBeat["type"], text: string, extra: Partial<PlanBeat> = {}): PlanBeat => ({ id: "b1", type, text, emphasis: [], ...extra });

// ---------------- brief ----------------
{
  const min = parseBrief({ script: "Hi.", product: { name: "X" }, tokens: { bg: "#000000", fg: "#ffffff", accent: "#ff0000", muted: "#888888" } });
  assert(min.dials.energy === 0.5 && min.dials.referenceInfluence === 0.5 && isDeepStrictEqual(min.aspects, ["16:9", "9:16"]) && min.tokens.font === "Inter"
    && min.product.features.length === 0 && min.assets.length === 0, "brief: dials default 0.5, both aspects, Inter, empty features/assets");
  assert(throws(() => parseBrief({ ...briefJson, dials: { energy: 1.2 } })) && throws(() => parseBrief({ ...briefJson, tokens: { ...briefJson.tokens, accent: "red" } }))
    && throws(() => parseBrief({ ...briefJson, product: { name: "X", features: [{ name: "a", blurb: "b", kind: "table" }] } })),
    "brief: dials outside 0-1, non-hex tokens and unknown feature kinds are rejected");
}

// ---------------- stage 1: segment ----------------
{
  const beats = ruleSegment(brief);
  const types = beats.map((b) => b.type).join(" ");
  assert(types === "hook problem problem reveal feature feature feature feature feature proof cta tag", `segment(rule): grammar order on the demo script (${types})`);
  assert(beats.filter((b) => b.type === "feature").map((b) => b.featureRef).join() === "Inbox,Board,Insights,Ask Relay,Docs",
    "segment(rule): each feature beat names its feature (by name, before CTA / proof cues)");
  assert(beats.find((b) => b.featureRef === "Board")?.assetRef === "board-shot", "segment(rule): the asset goes to the feature beat its label matches");
  assert(beats.at(-1)!.text === "Relay. Work, in sync." && beats.every((b, i) => b.id === `b${i + 1}`), "segment(rule): a one-word sentence joins the next; ids b1..bN");
  assert(isDeepStrictEqual(emphasisOf(`Ship "zero downtime" deploys 40% faster with Relay`, "Relay"), ["zero downtime", "40%", "Relay"]),
    "segment(rule): emphasis = quoted phrases, numbers, capitalised (non-initial) words");
  const noTag = ruleSegment(parseBrief({ ...briefJson, script: "Tired of chaos? Meet Relay. Start today at relay.app." }));
  assert(noTag.map((b) => b.type).join() === "hook,reveal,cta,tag" && noTag.at(-1)!.text === "Work, in sync.", "segment(rule): no closing line -> the tagline becomes the tag beat");
  const n = normalizeBeats([{ id: "x", type: "feature", text: "a", emphasis: [], featureRef: "Nope", assetRef: "board-shot" }, { id: "y", type: "cta", text: "b", emphasis: [] }], brief);
  assert(n[0].id === "b1" && n[1].id === "b2" && n[0].featureRef === undefined && n[0].assetRef === "board-shot", "segment: normalise renumbers ids and drops unknown feature refs");
  assert(throws(() => normalizeBeats([{ id: "b1", type: "intro", text: "a", emphasis: [] }], brief)), "segment: an off-grammar beat type is rejected");
}

// ---------------- stage 2: select ----------------
void (async () => {
  const beats = await recordedSegmenter(PLAN).segment(brief);
  const sel = selectPatterns(beats, brief, 7);
  assert(isDeepStrictEqual(sel, selectPatterns(beats, brief, 7)), "select: same beats + seed -> identical selection");
  assert(sel.every((s, i) => i === 0 || s.text !== sel[i - 1].text || ["cta", "reveal"].includes(s.row)), "select: no two consecutive beats share a text macro (unless the only candidate)");
  const row = (kind: string) => sel.find((s) => s.row === `feature.${kind}`)!;
  assert(row("chart").shapes.includes("S10") && row("chat").shapes.some((m) => m === "S8" || m === "S9") && row("list").shapes.some((m) => m === "S1" || m === "S3"),
    "select: feature rows use their spec patterns (chart -> S10, chat -> S9 / S8, list -> S1 / S3)");
  assert(sel.find((s) => s.row === "proof")!.shapes.includes("S2") && sel.find((s) => s.row === "cta")!.text === "T5", "select: proof with a number -> S2; CTA -> T5");
  assert(rowFor(beat("feature", "x", { featureRef: "Nope" }), brief).row === "feature.generic", "select: an unknown feature falls back to the generic row");
  const variety = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => selectPatterns(beats, brief, s).map((x) => x.text + x.shapes.join("")).join()));
  assert(variety.size >= 4, `select: different seeds vary the choices (${variety.size} distinct of 8)`);
  const exact = selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, referenceInfluence: 0 } }), 7);
  const free = selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, referenceInfluence: 1 } }), 7);
  assert(exact.every((s) => s.perturb === 1) && free.every((s) => s.perturb >= 0.6 && s.perturb <= 1.4) && free.some((s) => Math.abs(s.perturb - 1) > 0.05),
    "select: referenceInfluence 0 -> measured defaults exactly; 1 -> free within ±40%");
  const playful = selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, playfulness: 0.9 } }), 7);
  assert(playful.every((s) => s.ease === "bounce") && sel.every((s) => s.ease === "settle"), "select: playfulness > 0.6 favours bounce springs");
  const reveals = (p: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((s) => selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, playfulness: p } }), s)
    .find((x) => x.row === "reveal")!.text === "T11").length;
  assert(reveals(1) > reveals(0), `select: playfulness favours T11 (${reveals(0)} -> ${reveals(1)} of 12 seeds)`);
  const kinetic = (u: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((n, s) => n + selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, uiRealism: u } }), s)
    .filter((x) => ["T1", "T6", "T7", "T8", "T12"].includes(x.text)).length, 0);
  const shapes = (u: number) => [1, 2, 3, 4, 5, 6].reduce((n, s) => n + selectPatterns(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, uiRealism: u } }), s)
    .reduce((m, x) => m + x.shapes.length, 0), 0);
  assert(kinetic(1) < kinetic(0) && shapes(1) > shapes(0), `select: uiRealism favours S rows over kinetic T rows (kinetic ${kinetic(0)} -> ${kinetic(1)}, shapes ${shapes(0)} -> ${shapes(1)})`);

  // ---------------- stage 3: timing ----------------
  assert(wpm(0.5) === 150 && wpm(0) === 120 && wpm(1) === 180 && cpsFor(0) === 15 && cpsFor(1) === 30, "timing: 150 wpm ±30 with energy; typewriter 15-30 cps");
  const words20 = Array(20).fill("word").join(" ");    // 8 s of reading
  assert(Math.abs(beatDuration(beat("feature", "one two three four five"), 0.5) - 2.6) < 1e-9 && beatDuration(beat("hook", "Hi"), 0.5) === 1.8
    && beatDuration(beat("hook", Array(40).fill("w").join(" ")), 0.5) === 5 && beatDuration(beat("hook", "Hi", { durationHint: 4.5 }), 0.5) === 4.5 && beatDuration(beat("hook", words20, { durationHint: 2 }), 0.5) === 5,
    "timing: reading time + 400 + 200 ms, clamped 1.8-5 s; a durationHint can lengthen it");
  assert(sizeFactor(100) === 1 && sizeFactor(400) === 1.6 && sizeFactor(4) === 0.7 && Math.abs(sizeFactor(196) - 1.4) < 1e-9, "timing: duration x sqrt(size / 100 px), clamped 0.7-1.6");
  assert(staggerFor(0) === 70 && staggerFor(1) === 35 && staggerFor(0.5) === 53, "timing: stagger = 70 ms x (1 - 0.5 energy)");
  const tm = planTiming(beats, brief, beats.map(() => 0.1), beats.map(() => ({ type: "cut", ms: 0 })));
  assert(Math.abs(tm.durations.reduce((s, d) => s + d, 0) - 60) < 1e-4 && tm.starts[0] === 0 && tm.starts.every((s, i) => i === 0 || Math.abs(s - tm.starts[i - 1] - tm.durations[i - 1]) < 1e-5),
    "timing: durations scale to targetSeconds (60 s) and starts are contiguous");
  assert(gapAt(0.5, { type: "cut", ms: 0 }) === 0.5 && gapAt(0.5, { type: "crossfade", ms: 600 }) === 0 && Math.abs(gapAt(0.5, { type: "curtain", ms: 500 }) - 0.3) < 1e-9,
    "timing: the blank lead after a cut is the full entry delay; crossfades cover it; a curtain covers ~40 % of its ms");
  const slow = planTiming(beats.slice(0, 3), brief, [0.1, 0.6, 0.1], [undefined, { type: "cut", ms: 0 }, { type: "cut", ms: 0 }]);
  const plain = planTiming(beats.slice(0, 3), brief, [0.1, 0.1, 0.1], [undefined, { type: "cut", ms: 0 }, { type: "cut", ms: 0 }]);
  assert(Math.abs(slow.shifts[1] - 0.4) < 1e-6 && Math.abs(slow.durations[0] - plain.durations[0] - 0.4) < 1e-6 && Math.abs(slow.durations[1] - plain.durations[1] + 0.4) < 1e-6,
    "timing: coverage rule — a 600 ms blank lead after a cut extends the previous beat's hold by 400 ms (gap kept <= 200 ms)");

  // ---------------- stage 4: compose ----------------
  const tr = composeTransitions(beats, brief);
  const at = (t: string) => beats.findIndex((b) => b.type === t);
  assert(tr[0] === undefined && tr[at("reveal")]!.type === "curtain" && tr[at("proof")]!.type === "curtain" && tr[at("tag")]!.type === "crossfade"
    && tr.filter((t) => t?.type === "cut").length === beats.length - 4, "compose: cut by default; curtain at problem -> reveal and last feature -> proof; crossfade into the tag");
  assert(composeTransitions(beats, parseBrief({ ...briefJson, dials: { ...briefJson.dials, energy: 0.8 } })).filter((t) => t?.type === "smear").length === beats.length - 4,
    "compose: energy > 0.7 turns the cuts into smears");
  const glows = glowsFor(brief, true);
  assert(glows.length === 2 && glows[0].intensity === 0.39 && glows[1].intensity === 0.2 && glows.every((g) => g.color === brief.tokens.accent),
    "compose: two radial accent glows at R3's 0.39 / 0.2 (glow dial 0.5)");
  assert(glowsFor(parseBrief({ ...briefJson, dials: { glow: 1 } }), false)[0].intensity === 0.78 && glowsFor(parseBrief({ ...briefJson, dials: { glow: 0 } }), false).length === 0,
    "compose: the glow dial scales them (1 -> double, 0 -> none)");
  const proofChunks = chunks("Teams on Relay ship 40% faster and spend 6 fewer hours a week in meetings.");
  assert(proofChunks.every((c) => c.length <= 18) && proofChunks.join(" ") === "Teams on Relay ship 40% faster and spend 6 fewer hours a week in meetings."
    && wrapChunks(proofChunks, 36).length === 3 && isDeepStrictEqual(chunks("Short line"), ["Short line"]),
    `compose: long titles become <= 18-char chunks that wrap ~36 chars a line at 16:9, one chunk a line at 9:16 (${proofChunks.length} chunks)`);

  // ---------------- stage 5: assemble + plan ----------------
  const d = assemble(brief, beats, 7);
  const g: any = d.graph;
  const ids: string[] = [];
  const walk = (n: any) => { ids.push(n.id); (n.children ?? []).forEach(walk); };
  g.beats.forEach((b: any) => b.nodes.forEach(walk));
  assert(g.beats.every((b: any) => b.nodes.every((n: any) => n.id.startsWith(b.id + "-"))), "assemble: every node id is prefixed with its beat id");
  const graphTypes = g.beats.map((b: any) => b.type).join(" ");
  assert(graphTypes.startsWith("hook pain pain reveal feature") && graphTypes.endsWith("proof cta tag"), "assemble: planner beats map to graph types (problem -> pain, tag)");
  const asset = ids.includes("b6-asset") && JSON.stringify(g.beats[5]).includes('"Board screenshot"') && JSON.stringify(g.beats[5]).includes('"src":null');
  assert(asset, "assemble: the asset placeholder is an image node with src null and the brief's label");
  const stage: any = g.beats[4].nodes.find((n: any) => n.id === "b5-stage");
  const visuals = stage.children.find((c: any) => c.id === "b5-visuals");
  assert(stage.anchor.overrides["16:9"] && stage.anchor.overrides["9:16"] && visuals.layout.type === "row" && visuals.layout.wrap && visuals.layout.overrides["9:16"].maxWidth,
    "assemble: per-aspect anchors on every stage; feature rows are rows at 16:9 and wrap at 9:16");
  const moves = JSON.stringify(g).match(/"mode":"moveTo"[^}]*?/g) ?? [];
  const allMoves: any[] = [];
  const walkT = (n: any) => { (n.tracks ?? []).forEach((t: any) => t.mode === "moveTo" && allMoves.push(t)); (n.children ?? []).forEach(walkT); };
  g.beats.forEach((b: any) => b.nodes.forEach(walkT));
  assert(moves.length > 0 && allMoves.length > 0 && allMoves.every((t) => t.arc === 0.15), `assemble: every cursor moveTo gets arc 0.15 (${allMoves.length} moves)`);
  const anticip = (p: number) => { let n = 0; const w = (x: any) => { (x.tracks ?? []).forEach((t: any) => { if (t.ms === 100 && t.ease === "settle" && ["x", "y", "scale"].includes(t.prop)) n++; }); (x.children ?? []).forEach(w); };
    assemble(parseBrief({ ...briefJson, dials: { ...briefJson.dials, playfulness: p } }), beats, 7).graph.beats.forEach((b: any) => b.nodes.forEach(w)); return n; };
  assert(anticip(0.4) === 0 && anticip(0.9) > 0, `assemble: anticipation counter-moves only when playfulness > 0.6 (${anticip(0.4)} -> ${anticip(0.9)})`);
  const bad = beats.map((b) => b.id === "b8" ? { ...b, id: "b5" } : b);     // b5 again three beats later -> duplicate node ids
  let msg = "";
  try { assemble(brief, bad as PlanBeat[], 7); } catch (e) { msg = (e as Error).message; }
  assert(/beat b5/.test(msg) && /rule:/.test(msg), `assemble: a graph that fails validation throws with the beat id and rule (${msg.slice(0, 90)}…)`);

  // object hand-off: a feature continuing into the next beat keeps its node id, starting from its final state
  const two = [beat("hook", "Meet Relay."), { ...beat("feature", "Insights charts your velocity.", { featureRef: "Insights" }), id: "b2" }, { ...beat("feature", "Insights catches slowdowns early.", { featureRef: "Insights" }), id: "b3" }];
  const h: any = assemble(brief, two, 7).graph;
  const find = (nodes: any[], id: string): any => { for (const n of nodes) { if (n.id === id) return n; const c = find(n.children ?? [], id); if (c) return c; } };
  const first = find(h.beats[1].nodes, "b2-ui"), second = find(h.beats[2].nodes, "b2-ui");
  assert(!!first && !!second && second.tracks.length === 0 && first.tracks.length > 0, "assemble: hand-off — the shared node keeps its id (b2-ui) in the next beat, without its entrance");
  const frozen: any = freezeFinal({ id: "x", type: "rect", w: 1, h: 1, tracks: [{ mode: "tween", prop: "opacity", at: 0, ms: 100, from: 0, to: 1 }, { mode: "tween", prop: "y", at: 0.2, ms: 100, from: 40, to: 0 }] } as any);
  assert(frozen.opacity === 1 && frozen.y === 0 && frozen.tracks.length === 0, "assemble: freezeFinal sets each tweened prop to its last value");

  // ---------------- plan(): golden graph, determinism ----------------
  const golden = await planDetail(briefJson, 7, recordedSegmenter(PLAN));
  if (process.env.UPDATE_GOLDEN) writeFileSync("fixtures/demo.graph.json", JSON.stringify(golden.graph, null, 2) + "\n");
  const committed = parseGraph(JSON.parse(readFileSync("fixtures/demo.graph.json", "utf8")));
  assert(isDeepStrictEqual(golden.graph, committed), "plan: golden brief + recorded plan + seed 7 matches fixtures/demo.graph.json (snapshot)");
  const again = await planDetail(briefJson, 7, recordedSegmenter(PLAN)), other = await planDetail(briefJson, 3, recordedSegmenter(PLAN));
  assert(JSON.stringify(again.graph) === JSON.stringify(golden.graph), "plan: same brief + seed -> byte-identical graph");
  const changed = other.selections.filter((s, i) => s.text !== golden.selections[i].text || s.shapes.join() !== golden.selections[i].shapes.join()).length;
  assert(JSON.stringify(other.graph) !== JSON.stringify(golden.graph) && changed > 0, `plan: a different seed -> different macro choices (${changed} beats differ)`);
  const total = golden.graph.beats.at(-1)!.start + golden.graph.beats.at(-1)!.duration;
  assert(Math.abs(total - 60) < 1e-3, `plan: golden graph lasts targetSeconds (${total.toFixed(3)} s)`);

  // ---------------- env ----------------
  const tmp = "out/test.env";
  writeFileSync(tmp, "sk-ant-test-0000\n");
  const bare = loadEnv(tmp, {});
  writeFileSync(tmp, "ANTHROPIC_API_KEY=sk-ant-x\nPLANNER_MODEL=claude-opus-5-5\n");
  const named = loadEnv(tmp, {});
  assert(bare.apiKey === "sk-ant-test-0000" && bare.model === "claude-sonnet-5-5" && named.model === "claude-opus-5-5" && loadEnv("out/none.env", {}).apiKey === undefined,
    "env: a bare key line or NAME=value; model defaults to claude-sonnet-5-5, PLANNER_MODEL overrides; no file -> no key");
})();
