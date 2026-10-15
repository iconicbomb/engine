// Stage 5 — assemble: the selections, timing and composition become macro calls (packages/patterns), nodes get
// beat-prefixed ids, the motion-law post-passes run (cursor arcs, anticipation, object hand-off), and the graph is
// validated with parseGraph. A validation failure is re-thrown naming the beat id and the rule that failed.
import { parseGraph, type Brief, type Graph } from "@engine/graph";
import { applyEdits, group, type MacroResult, type NodeIn, type TrackIn, type TransitionIn } from "@engine/patterns";
import { composeTransitions, entryDelay, glowsFor, placeholder, resolved, stage } from "./compose";
import { shapeMacro, textMacro, type Built, type Ctx } from "./macros";
import { rngFor } from "./rng";
import { selectPatterns, type Selection } from "./select";
import { ANTICIPATION, ARC, anticipates, planTiming } from "./timing";
import { GRAPH_BEAT_TYPE, type PlanBeat } from "./types";

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const hex = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");

export interface PlanDetail { graph: Graph; selections: Selection[]; transitions: (TransitionIn | undefined)[] }

export function assemble(brief: Brief, beats: PlanBeat[], seed: number): PlanDetail {
  const d = brief.dials;
  const selections = selectPatterns(beats, brief, seed);
  const transitions = composeTransitions(beats, brief);
  const leads = transitions.map((t) => r6(0.1 + entryDelay(t)));
  const timing = planTiming(beats, brief, leads, transitions.map(resolved));
  const titleSize = Math.round(64 + 72 * d.typeScale);
  const graphBeats: Record<string, unknown>[] = [];
  let prevVisual: { featureRef?: string; node?: NodeIn } = {};

  beats.forEach((beat, i) => {
    const sel = selections[i];
    const feature = brief.product.features.find((f) => f.name === beat.featureRef);
    const ctx: Ctx = { beat, brief, sel, feature, at: r6(leads[i] - timing.shifts[i]), duration: timing.durations[i], titleSize,
      cps: timing.cps, staggerMs: timing.staggerMs, rng: rngFor(seed, `beat:${beat.id}`) };
    const built: Built = { title: [], visuals: [], top: [], results: [] };
    const t = textMacro(sel.text, ctx);
    built.title.push(...t.nodes); built.results.push(...t.results);
    // object hand-off: a feature continuing from the previous beat keeps its visual (same id, final state)
    const handoff = beat.type === "feature" && beat.featureRef && prevVisual.featureRef === beat.featureRef && prevVisual.node;
    if (handoff) built.visuals.push({ node: freezeFinal(prevVisual.node!), width: 1040 });
    else for (const m of sel.shapes) shapeMacro(m, ctx, built, t.typedAt);
    const asset = brief.assets.find((a) => a.id === beat.assetRef);
    if (asset) built.visuals.push({ node: placeholder(beat.id, asset), width: 640 });

    const st = stage(beat.id, built.title, built.visuals.map((v) => v.node), built.visuals.map((v) => v.width), titleSize, t.width);
    let nodes = applyEdits([...built.top.filter((n) => n.type === "wire"), ...built.top.filter((n) => n.type !== "wire" && n.type !== "cursor"), st,
      ...built.top.filter((n) => n.type === "cursor")], built.results);
    nodes = nodes.map((n) => lawPass(n, d.playfulness));
    const visual = built.visuals[0]?.node;
    prevVisual = { featureRef: beat.featureRef, node: visual ? findNode(nodes, visual.id) : undefined };
    const camera = built.results.flatMap((r) => r.camera);
    graphBeats.push({
      id: beat.id, type: GRAPH_BEAT_TYPE[beat.type], start: timing.starts[i], duration: timing.durations[i], script: beat.text,
      background: brief.tokens.bg, glows: glowsFor(brief, i === 0), nodes,
      ...(camera.length ? { camera: { tracks: camera } } : {}), ...(transitions[i] ? { transition: transitions[i] } : {}),
    });
  });

  const graph = {
    version: 1,
    canvas: { aspect: brief.aspects[0], refHeight: 1080, fps: 30 },
    tokens: { bg: brief.tokens.bg, text: brief.tokens.fg, accent: brief.tokens.accent, muted: brief.tokens.muted,
      surface: hex(brief.tokens.bg, brief.tokens.fg, 0.08), font: brief.tokens.font },
    dials: { glow: d.glow, playfulness: d.playfulness, realism: d.uiRealism, tempo: d.energy, density: d.density },
    beats: graphBeats,
  };
  return { graph: validate(graph, beats, selections), selections, transitions };
}

// parseGraph, re-thrown with the beat id and the rule (selection row / failed check) at fault
function validate(graph: unknown, beats: PlanBeat[], selections: Selection[]): Graph {
  try { return parseGraph(graph); }
  catch (e) {
    const issue = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues?.[0];
    const fromPath = issue && issue.path[0] === "beats" ? beats[issue.path[1] as number]?.id : undefined;
    const fromMsg = issue?.message.match(/\b(b\d+)-/)?.[1] ?? issue?.message.match(/beat (b\d+)/)?.[1];
    const beatId = fromPath ?? fromMsg ?? "?";
    const sel = selections.find((s) => s.beatId === beatId);
    throw new Error(`plan validation failed at beat ${beatId} (rule: ${sel ? `${sel.textRule}; ${sel.shapeRules.join(", ") || "no shapes"}` : "graph"}): ${issue?.message ?? (e as Error).message}`);
  }
}

function findNode(nodes: NodeIn[], id: string): NodeIn | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(((n as { children?: NodeIn[] }).children) ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

// motion-law post-pass: cursor moves arc; with playfulness > 0.6, entrance moves (x / y / scale tweens) get a -3 %
// counter-move over 3 frames before the main move (which then starts from rest)
function lawPass(n: NodeIn, playfulness: number): NodeIn {
  const tracks: TrackIn[] = [];
  for (const t of ((n as { tracks?: TrackIn[] }).tracks ?? [])) {
    if (t.mode === "moveTo") { tracks.push({ ...t, arc: ARC }); continue; }
    const tw = t as Extract<TrackIn, { prop: string; from?: unknown }> & { mode?: string; from?: number; to?: number; ms?: number; at?: number; staggerMs?: number; relativeTo?: string };
    if (anticipates(playfulness) && (tw.mode ?? "tween") === "tween" && ["x", "y", "scale"].includes(tw.prop) && typeof tw.from === "number" && typeof tw.to === "number"
      && tw.from !== tw.to && (tw.ms ?? 400) >= 200 && !tw.staggerMs && tw.relativeTo !== "reveal") {
      const counter = r6(tw.from - ANTICIPATION.fraction * (tw.to - tw.from)), at = tw.at ?? 0;
      tracks.push({ ...(tw as TrackIn), at, ms: ANTICIPATION.ms, from: tw.from, to: counter, ease: "settle" } as TrackIn);
      tracks.push({ ...(tw as TrackIn), at: r6(at + ANTICIPATION.ms / 1000), from: counter } as TrackIn);
      continue;
    }
    tracks.push(t);
  }
  const children = (n as { children?: NodeIn[] }).children;
  return { ...n, ...(tracks.length || (n as { tracks?: unknown }).tracks ? { tracks } : {}), ...(children ? { children: children.map((c) => lawPass(c, playfulness)) } : {}) } as NodeIn;
}

// a node at its final state: every tweened prop set to its last value, animation tracks removed (object hand-off)
export function freezeFinal(n: NodeIn): NodeIn {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(n));
  const tracks = (out.tracks as TrackIn[] | undefined) ?? [];
  const last = new Map<string, { at: number; to: unknown }>();
  for (const t of tracks) {
    const tw = t as { mode?: string; prop?: string; at?: number; to?: unknown };
    if ((tw.mode ?? "tween") !== "tween" || !tw.prop) continue;
    const prev = last.get(tw.prop);
    if (!prev || (tw.at ?? 0) >= prev.at) last.set(tw.prop, { at: tw.at ?? 0, to: tw.to });
  }
  for (const [prop, { to }] of last) {
    if (["opacity", "scale", "rotation", "x", "y", "blur", "rotX", "rotY", "fill"].includes(prop)) out[prop] = to;
    else if (prop.startsWith("clip.") && out.clip) (out.clip as Record<string, unknown>)[prop.slice(5)] = to;
    else if (prop.startsWith("trim.")) out.trim = { ...((out.trim as object) ?? {}), [prop.slice(5)]: to };
    else if (prop === "tracking") out.style = { ...((out.style as object) ?? {}), tracking: to };
  }
  out.tracks = [];
  if (Array.isArray(out.children)) out.children = (out.children as NodeIn[]).map(freezeFinal);
  return out as unknown as NodeIn;
}

export { group };
export type { MacroResult };
