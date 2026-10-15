// Stage 2 — pattern selection. Rules, not LLM: a table beatType x contentKind -> candidates built from the spec's
// pattern rows; dials reweight it; choices are seeded. Each beat gets one text macro (the title device) and the shape
// macros its row includes.
import type { Brief, FeatureKind } from "@engine/graph";
import { pickWeighted, rngFor } from "./rng";
import type { PlanBeat } from "./types";

export type TextMacro = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T11" | "T12" | "T13";
export type ShapeMacro = "S1" | "S2" | "S3" | "S5" | "S8" | "S9" | "S10";
type Entry<M> = { macro: M; weight: number; requires?: (b: PlanBeat, brief: Brief) => boolean; rule: string };

const hasNumber = (b: PlanBeat) => /\d/.test(b.text);
const dense = (_b: PlanBeat, brief: Brief) => brief.dials.density >= 0.4;
const T = (macro: TextMacro, weight: number, rule: string): Entry<TextMacro> => ({ macro, weight, rule });
const S = (macro: ShapeMacro, weight: number, rule: string, requires?: Entry<ShapeMacro>["requires"]): Entry<ShapeMacro> => ({ macro, weight, rule, requires });
const FEATURE_TEXT = [T("T2", 1, "feature title: typewriter"), T("T4", 0.8, "feature title: word append"), T("T6", 0.6, "feature title: keyword highlight")];

// the selection table (spec: scene grammar + script-to-beats compiler rows)
export const TABLE: Record<string, { text: Entry<TextMacro>[]; shapes: Entry<ShapeMacro>[] }> = {
  hook: { text: [T("T1", 1, "hook: scramble"), T("T12", 1, "hook: 3D reveal"), T("T2", 0.7, "hook: typewriter"), T("T7", 0.6, "hook: gradient"), T("T8", 0.4, "hook: slant")], shapes: [] },
  problem: { text: [T("T2", 1, "problem: typewriter"), T("T4", 1, "problem: word append")], shapes: [S("S9", 0.6, "problem: marquee of the mess", dense)] },
  reveal: { text: [T("T13", 1, "reveal: logo typewriter"), T("T11", 0.8, "reveal: tracking")], shapes: [] },
  "feature.list": { text: FEATURE_TEXT, shapes: [S("S1", 1, "feature.list: list rise"), S("S3", 1, "feature.list: hover-fill card")] },
  "feature.card": { text: FEATURE_TEXT, shapes: [S("S3", 1, "feature.card: hover-fill card"), S("S5", 0.7, "feature.card: cursor click")] },
  "feature.chart": { text: FEATURE_TEXT, shapes: [S("S10", 1, "feature.chart: tilted UI with chart draw")] },
  "feature.chat": { text: FEATURE_TEXT, shapes: [S("S9", 1, "feature.chat: message marquee"), S("S8", 1, "feature.chat: wire fan")] },
  "feature.editor": { text: FEATURE_TEXT, shapes: [S("S10", 1, "feature.editor: tilted editor"), S("S5", 0.8, "feature.editor: cursor click")] },
  "feature.generic": { text: FEATURE_TEXT, shapes: [S("S1", 1, "feature.generic: list rise")] },
  proof: { text: [T("T2", 1, "proof: typewriter"), T("T6", 0.7, "proof: keyword highlight")], shapes: [S("S2", 1, "proof: ripple pill counter", hasNumber)] },
  cta: { text: [T("T5", 1, "cta: bracket frame")], shapes: [S("S5", 1, "cta: cursor click")] },
  tag: { text: [T("T3", 1, "tag: fit-to-width"), T("T7", 0.5, "tag: gradient settle")], shapes: [] },
};

const KINETIC = new Set<TextMacro>(["T1", "T6", "T7", "T8", "T12"]);

export interface Selection {
  beatId: string;
  row: string;                    // TABLE key used
  kind: FeatureKind | "none";
  text: TextMacro;
  textRule: string;
  shapes: ShapeMacro[];
  shapeRules: string[];
  ease: "settle" | "bounce";      // playfulness: bounce springs for chips / pills / logos above 0.6
  perturb: number;                // referenceInfluence: multiplier for measured defaults (0 -> exactly 1, 1 -> 0.6–1.4)
}

export function rowFor(beat: PlanBeat, brief: Brief): { row: string; kind: FeatureKind | "none" } {
  if (beat.type !== "feature") return { row: beat.type, kind: "none" };
  const kind = brief.product.features.find((f) => f.name === beat.featureRef)?.kind ?? "generic";
  return { row: `feature.${kind}`, kind };
}

export function selectPatterns(beats: PlanBeat[], brief: Brief, seed: number): Selection[] {
  const d = brief.dials, out: Selection[] = [];
  for (const beat of beats) {
    const rng = rngFor(seed, `select:${beat.id}`);
    const { row, kind } = rowFor(beat, brief);
    const entry = TABLE[row];
    // dials reweight: playfulness favours T11; uiRealism favours S rows over kinetic T rows
    const weighted = entry.text.map((t) => ({ ...t,
      weight: t.weight * (t.macro === "T11" ? 1 + 2 * d.playfulness : 1) * (KINETIC.has(t.macro) ? 1.5 - d.uiRealism : 1) }));
    const prev = out.at(-1)?.text;
    const pool = weighted.length > 1 && prev ? weighted.filter((t) => t.macro !== prev) : weighted;   // no two consecutive alike
    const text = pickWeighted(rng, pool.length ? pool : weighted);
    const shapes = entry.shapes.filter((s) => (!s.requires || s.requires(beat, brief)) && rng() < Math.min(1, s.weight * (0.5 + d.uiRealism)));
    out.push({
      beatId: beat.id, row, kind, text: text.macro, textRule: text.rule,
      shapes: shapes.map((s) => s.macro), shapeRules: shapes.map((s) => s.rule),
      ease: d.playfulness > 0.6 ? "bounce" : "settle",
      perturb: Math.round((1 + 0.4 * d.referenceInfluence * (2 * rng() - 1)) * 1000) / 1000,
    });
  }
  return out;
}
