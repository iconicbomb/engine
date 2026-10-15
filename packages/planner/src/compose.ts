// Stage 4 — transitions and layout. Transitions: cut by default; curtain at section changes (problem -> reveal, last
// feature -> proof); smear when energy > 0.7; crossfade into the tag. Layout: every beat is a stage group anchored on
// the canvas with a 9:16 override that scales it to the portrait safe width; feature rows are layout:row at 16:9 and
// wrap at 9:16; glows come from the tokens (two radial accent glows at R3's measured 0.39 / 0.2, scaled by the glow
// dial); asset placeholders become image nodes with src null and the brief's label.
import { enterDelay, transitionParams, type Brief } from "@engine/graph";
import { curtainWipe, group, smearCut, type GlowIn, type NodeIn, type TransitionIn } from "@engine/patterns";
import type { PlanBeat } from "./types";

export function composeTransitions(beats: PlanBeat[], brief: Brief): (TransitionIn | undefined)[] {
  const lastFeature = beats.map((b) => b.type).lastIndexOf("feature");
  return beats.map((b, i) => {
    if (i === 0) return undefined;
    const prev = beats[i - 1];
    if (b.type === "tag") return { type: "crossfade" };
    if ((prev.type === "problem" && b.type === "reveal") || (i - 1 === lastFeature && b.type === "proof")) return curtainWipe({ color: brief.tokens.accent }).transition;
    if (brief.dials.energy > 0.7) return smearCut().transition;
    return { type: "cut" };
  });
}

// the resolved transition (ms + type) for timing, and the delay before a beat's elements enter (the macro rule)
export const resolved = (t: TransitionIn | undefined) => (t ? transitionParams(t as never) : undefined);
export const entryDelay = (t: TransitionIn | undefined) => enterDelay(t as never);

// R3's measured glows (accent at 0.39 / 0.2), scaled by the glow dial (0.5 -> as measured); fade in on the first beat
export function glowsFor(brief: Brief, first: boolean): GlowIn[] {
  const k = brief.dials.glow * 2;
  const layer = (y: number, rx: number, ry: number, intensity: number): GlowIn => ({
    x: 0.5, y, rx, ry, color: brief.tokens.accent, intensity: Math.round(intensity * k * 1000) / 1000,
    tracks: first ? [{ mode: "tween", prop: "intensity", at: 0, ms: 400, from: 0, to: Math.round(intensity * k * 1000) / 1000, ease: "settle" }] : [],
  });
  return k > 0 ? [layer(1.03, 0.72, 0.9, 0.39), layer(-0.03, 0.6, 0.65, 0.2)] : [];
}

const PORTRAIT_SAFE = 0.9 * Math.round(1080 * 9 / 16);   // 90 % of the 9:16 width at refHeight 1080
const LANDSCAPE_SAFE = 0.9 * Math.round(1080 * 16 / 9);

// a beat's stage: title + visuals in a column, centred; scaled down to the safe width at either aspect. Visual rows wrap
// at 9:16 (local px, so the wrap width is the portrait safe width divided by the stage's portrait scale).
// titleW (an estimate of the title's width) takes part so a long title scales with its stage instead of each line being
// shrunk to fit on its own
export function stage(beatId: string, title: NodeIn[], visuals: NodeIn[], visualWidths: number[], titleH: number, titleW = { "16:9": 0, "9:16": 0 }): NodeIn {
  const rowW = Math.max(titleW["16:9"], visualWidths.reduce((s, w) => s + w, 0) + 40 * Math.max(0, visualWidths.length - 1));
  const widest = Math.max(titleW["9:16"], ...visualWidths);
  const landscape = Math.min(1, LANDSCAPE_SAFE / Math.max(1, rowW));
  const portrait = Math.min(1, PORTRAIT_SAFE / Math.max(1, widest));
  const children: NodeIn[] = [...title];
  if (visuals.length) children.push(group({ id: `${beatId}-visuals`, layout: { type: "row", gap: 40, wrap: true, maxWidth: LANDSCAPE_SAFE / landscape,
    overrides: { "9:16": { maxWidth: Math.round(PORTRAIT_SAFE / portrait), gap: 28 } } } }, visuals));
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return group({ id: `${beatId}-stage`, layout: { type: "column", gap: Math.round(titleH * 0.45) },
    anchor: { x: 0.5, y: 0.5, overrides: { "16:9": { x: 0.5, y: 0.5, scale: r3(landscape) }, "9:16": { x: 0.5, y: 0.5, scale: r3(portrait) } } } }, children);
}

export function placeholder(beatId: string, asset: Brief["assets"][number]): NodeIn {
  return { id: `${beatId}-asset`, type: "image", src: null, placeholder: { kind: asset.kind, label: asset.label }, w: 640, h: 360, radius: 24 };
}
