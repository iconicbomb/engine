// @engine/planner — brief in, graph out. plan(brief, seed, segmenter) composes the five stages; never imports the runtime.
import { parseBrief, type Brief, type Graph } from "@engine/graph";
import { assemble, type PlanDetail } from "./assemble";
import { ruleSegmenter, type Segmenter } from "./segment";

export async function plan(brief: unknown, seed = 7, segmenter: Segmenter = ruleSegmenter): Promise<Graph> {
  return (await planDetail(brief, seed, segmenter)).graph;
}
export async function planDetail(brief: unknown, seed = 7, segmenter: Segmenter = ruleSegmenter): Promise<PlanDetail> {
  const b: Brief = parseBrief(brief);
  return assemble(b, await segmenter.segment(b), seed);
}

export { assemble, freezeFinal } from "./assemble";
export { ruleSegment, ruleSegmenter, recordedSegmenter, normalizeBeats, emphasisOf, type Segmenter } from "./segment";
export { selectPatterns, rowFor, TABLE, type Selection } from "./select";
export { planTiming, beatDuration, cpsFor, sizeFactor, staggerFor, wpm, gapAt, ARC, ANTICIPATION } from "./timing";
export { composeTransitions, glowsFor } from "./compose";
export { BEAT_TYPES, PlanBeat, RecordedPlan, type BeatType } from "./types";
