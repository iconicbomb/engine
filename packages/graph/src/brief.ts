// @engine/graph — the planner's input: a brief (script + product + tokens + dials). Validated here so the planner, the
// CLI and future editors agree on one shape.
import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB");
const Dial = z.number().min(0).max(1).default(0.5);

export const FeatureKind = z.enum(["list", "card", "chart", "chat", "editor", "generic"]);
export type FeatureKind = z.infer<typeof FeatureKind>;

export const Brief = z.object({
  script: z.string().min(1),
  product: z.object({
    name: z.string().min(1),
    tagline: z.string().optional(),
    url: z.string().optional(),
    features: z.array(z.object({ name: z.string().min(1), blurb: z.string().min(1), kind: FeatureKind })).default([]),
  }),
  tokens: z.object({ bg: Hex, fg: Hex, accent: Hex, muted: Hex, font: z.string().default("Inter") }),
  dials: z.object({
    energy: Dial, density: Dial, playfulness: Dial, contrast: Dial, typeScale: Dial, glow: Dial, uiRealism: Dial, referenceInfluence: Dial,
  }).default({}),
  aspects: z.array(z.enum(["16:9", "9:16"])).min(1).default(["16:9", "9:16"]),
  targetSeconds: z.number().positive().optional(),
  assets: z.array(z.object({ id: z.string().min(1), kind: z.enum(["image", "video"]), label: z.string() })).default([]),
});
export type Brief = z.infer<typeof Brief>;
export type BriefIn = z.input<typeof Brief>;

export function parseBrief(json: unknown): Brief {
  return Brief.parse(json);
}
