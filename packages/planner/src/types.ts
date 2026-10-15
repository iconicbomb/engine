// @engine/planner — shared types. The planner turns a Brief into a Graph in five pure stages:
// segment (beats) -> select (patterns) -> timing -> compose (transitions + layout) -> assemble (macros -> Graph).
import { z } from "zod";

// the planner's seven-beat grammar: hook -> problem -> reveal -> feature x N -> proof -> CTA -> tag
export const BEAT_TYPES = ["hook", "problem", "reveal", "feature", "proof", "cta", "tag"] as const;
export type BeatType = (typeof BEAT_TYPES)[number];

export const PlanBeat = z.object({
  id: z.string().regex(/^b\d+$/),
  type: z.enum(BEAT_TYPES),
  text: z.string().min(1),
  emphasis: z.array(z.string()).default([]),
  featureRef: z.string().optional(),          // a product.features[].name
  assetRef: z.string().optional(),            // a brief.assets[].id
  durationHint: z.number().positive().optional(),   // seconds
});
export type PlanBeat = z.infer<typeof PlanBeat>;

// what a segmenter produced, as recorded in fixtures/plans/<brief>.plan.json
export const RecordedPlan = z.object({
  brief: z.string(),
  segmenter: z.enum(["llm", "rule"]),
  model: z.string().optional(),
  beats: z.array(PlanBeat).min(1),
});
export type RecordedPlan = z.infer<typeof RecordedPlan>;

// the graph's beat type for a planner beat (the spec calls "problem" pain)
export const GRAPH_BEAT_TYPE: Record<BeatType, "hook" | "pain" | "reveal" | "feature" | "proof" | "cta" | "tag"> = {
  hook: "hook", problem: "pain", reveal: "reveal", feature: "feature", proof: "proof", cta: "cta", tag: "tag",
};
