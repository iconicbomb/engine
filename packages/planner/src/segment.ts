// Stage 1 — beats. A Segmenter splits the script into beats of the seven-beat grammar
// (hook -> problem -> reveal -> feature x N -> proof -> CTA -> tag). Implementations: ruleSegmenter (here; pure, the
// fallback when there is no API key), llmSegmenter (llm.ts; Claude, recorded to fixtures/plans/) and recordedSegmenter
// (replays a recorded plan — what tests and CI use; never the network).
import { readFileSync } from "node:fs";
import type { Brief } from "@engine/graph";
import { BEAT_TYPES, PlanBeat, RecordedPlan, type BeatType } from "./types";

export interface Segmenter {
  name: string;
  segment(brief: Brief): Promise<PlanBeat[]>;
}

const ORDER: Record<BeatType, number> = Object.fromEntries(BEAT_TYPES.map((t, i) => [t, i])) as Record<BeatType, number>;
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "your", "you", "it", "is", "are", "that", "this", "every", "into", "from", "at", "by", "as", "be", "can", "all", "its", "our", "we"]);
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];

const CUE = {
  problem: /\b(spend|spent|waste[sd]?|slow|manual(ly)?|chaos|messy|lost|stuck|struggl\w*|pain\w*|too many|hours|drown\w*|scattered|juggl\w*|tedious|broken|copy|paste)\b/i,
  reveal: /\b(introducing|meet)\b/i,
  proof: /(\d|%|\b\d+x\b|\btimes faster\b)/i,
  cta: /\b(start|try|book|get started|sign up|visit|join|request a demo|download)\b|https?:\/\/|\.\w{2,}\b\/?$/i,
};

// capitalised words (not sentence-initial), quoted phrases and numbers, verbatim from the sentence
export function emphasisOf(text: string, productName: string): string[] {
  const out: string[] = [];
  for (const q of text.matchAll(/["“]([^"”]+)["”]/g)) out.push(q[1]);
  const toks = text.split(/\s+/);
  toks.forEach((tok, i) => {
    const w = tok.replace(/^[^\w$]+|[^\w%+]+$/g, "");
    if (!w) return;
    if (/\d/.test(w)) out.push(w);
    else if (i > 0 && /^[A-Z][A-Za-z-]+$/.test(w) && !out.includes(w)) out.push(w);
  });
  if (text.includes(productName) && !out.includes(productName)) out.push(productName);
  return [...new Set(out)];
}

export function ruleSegment(brief: Brief): PlanBeat[] {
  const sentences = brief.script.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const name = brief.product.name, features = brief.product.features;
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = (s: string) => features.find((f) => new RegExp(`\\b${esc(f.name)}\\b`, "i").test(s))?.name;
  const featureOf = (s: string) => {
    const sw = new Set(words(s));
    let best: { name: string; score: number } | null = null;
    for (const f of features) {
      const score = words(`${f.name} ${f.blurb}`).filter((w) => sw.has(w)).length;
      if (score >= 2 && (!best || score > best.score)) best = { name: f.name, score };
    }
    return best?.name;
  };
  // a one-word sentence ("Relay.") joins the next one; everything after the CTA is the closing tag
  const merged: string[] = [];
  sentences.forEach((t) => { if (merged.length && words(merged.at(-1)!).length <= 1 && merged.at(-1)!.split(/\s+/).length <= 1) merged[merged.length - 1] += " " + t; else merged.push(t); });
  let stage = 0;
  const beats: PlanBeat[] = [];
  merged.forEach((text, i) => {
    let type: BeatType, featureRef: string | undefined;
    if (i === 0) type = "hook";
    else if (stage >= ORDER.cta) type = "tag";
    else if ((featureRef = named(text)) && stage >= ORDER.reveal) type = "feature";
    else if (CUE.proof.test(text) && stage >= ORDER.feature) type = "proof";
    else if (CUE.cta.test(text) && stage >= ORDER.reveal) type = "cta";
    else if ((featureRef = featureOf(text)) && stage >= ORDER.reveal) type = "feature";
    else if ((text.includes(name) || CUE.reveal.test(text)) && stage <= ORDER.reveal) type = "reveal";
    else type = stage >= ORDER.reveal ? "feature" : "problem";
    if (ORDER[type] < stage && type !== "feature") type = stage >= ORDER.feature ? "feature" : "problem";   // the grammar only moves forward
    if (type === "feature" && stage > ORDER.feature) type = "proof";
    stage = Math.max(stage, ORDER[type]);
    const prev = beats.at(-1);
    if (type === "tag" && prev?.type === "tag") { prev.text += " " + text; prev.emphasis = emphasisOf(prev.text, name); return; }
    beats.push({ id: `b${beats.length + 1}`, type, text, emphasis: emphasisOf(text, name), ...(type === "feature" && featureRef ? { featureRef } : {}) });
  });
  if (beats.at(-1)!.type !== "tag" && brief.product.tagline) {
    beats.push({ id: `b${beats.length + 1}`, type: "tag", text: brief.product.tagline, emphasis: emphasisOf(brief.product.tagline, name) });
  }
  return assignAssets(beats, brief);
}

// assets go to the feature beat whose words match their label best, then to feature beats without one, in order
function assignAssets(beats: PlanBeat[], brief: Brief): PlanBeat[] {
  const taken = new Set(beats.map((b) => b.assetRef).filter(Boolean));
  for (const a of brief.assets) {
    if (taken.has(a.id)) continue;
    const lw = new Set(words(a.label));
    const match = beats.find((b) => b.type === "feature" && !b.assetRef && words(b.text).some((w) => lw.has(w)))
      ?? beats.find((b) => b.type === "feature" && !b.assetRef);
    if (match) { match.assetRef = a.id; taken.add(a.id); }
  }
  return beats;
}

// every segmenter's output goes through here: ids renumbered b1..bN, references checked against the brief
export function normalizeBeats(raw: unknown[], brief: Brief): PlanBeat[] {
  const featureNames = new Set(brief.product.features.map((f) => f.name)), assetIds = new Set(brief.assets.map((a) => a.id));
  return raw.map((r, i) => {
    const b = PlanBeat.parse({ ...(r as object), id: `b${i + 1}` });
    if (b.featureRef && !featureNames.has(b.featureRef)) delete b.featureRef;
    if (b.assetRef && !assetIds.has(b.assetRef)) delete b.assetRef;
    return b;
  });
}

export const ruleSegmenter: Segmenter = { name: "rule", segment: async (brief) => ruleSegment(brief) };

export function recordedSegmenter(planPath: string): Segmenter {
  return {
    name: "recorded",
    segment: async (brief) => normalizeBeats(RecordedPlan.parse(JSON.parse(readFileSync(planPath, "utf8"))).beats, brief),
  };
}
