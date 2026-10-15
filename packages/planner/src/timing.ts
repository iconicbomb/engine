// Stage 3 — timing and the motion laws. The laws live here, not in the macros: the planner passes their results as
// macro parameters or applies them to the assembled tracks.
import type { Brief } from "@engine/graph";
import type { PlanBeat } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

// reading speed: 150 wpm, ±30 with energy
export const wpm = (energy: number) => 150 + (energy - 0.5) * 60;
export const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
// beat duration = reading time + enter 400 + exit 200 ms, clamped 1.8–5 s (a durationHint can lengthen it within that)
export function beatDuration(beat: PlanBeat, energy: number): number {
  const read = words(beat.text) / (wpm(energy) / 60);
  return clamp(Math.max(read + 0.6, beat.durationHint ?? 0), 1.8, 5);
}
// typewriter speed: 15–30 cps, higher with energy
export const cpsFor = (energy: number) => Math.round((15 + 15 * energy) * 10) / 10;
// duration scales with sqrt(element size / 100 px), clamped 0.7–1.6
export const sizeFactor = (px: number) => clamp(Math.sqrt(px / 100), 0.7, 1.6);
export const sized = (ms: number, px: number) => Math.round(ms * sizeFactor(px));
// stagger = 70 ms x (1 - 0.5 energy)
export const staggerFor = (energy: number) => Math.round(70 * (1 - 0.5 * energy));
// cursor moves bow by 15 % of their length
export const ARC = 0.15;
// anticipation (a -3 % counter-move over 3 frames) only when playfulness > 0.6
export const anticipates = (playfulness: number) => playfulness > 0.6;
export const ANTICIPATION = { fraction: 0.03, ms: 100 };

// how long the screen goes without a visible node at a beat's start: the outgoing beat stays visible through a
// crossfade / smear, and until the curtain's eased midpoint (~40 % of its ms with emphasis); a cut hides it at once
export function gapAt(lead: number, transition: { type: string; ms: number } | undefined): number {
  if (!transition) return lead;
  const covered = transition.type === "curtain" ? 0.4 * transition.ms / 1000 : transition.type === "cut" ? 0 : transition.ms / 1000;
  return Math.max(0, lead - covered);
}

export interface Timing {
  durations: number[];
  starts: number[];
  shifts: number[];        // seconds each beat's enter tracks move earlier (coverage rule)
  cps: number;
  staggerMs: number;
}

// durations (scaled to targetSeconds), then the coverage rule: no stretch without a visible node longer than 250 ms —
// enforced by extending the previous beat's hold: the boundary moves later by the excess and the new beat's elements
// keep their absolute times (they start that much earlier relative to the beat)
export function planTiming(beats: PlanBeat[], brief: Brief, leads: number[], transitions: ({ type: string; ms: number } | undefined)[]): Timing {
  const e = brief.dials.energy;
  let durations = beats.map((b) => beatDuration(b, e));
  if (brief.targetSeconds) {
    const k = brief.targetSeconds / durations.reduce((s, d) => s + d, 0);
    durations = durations.map((d) => d * k);
  }
  const shifts = beats.map(() => 0);
  for (let i = 1; i < beats.length; i++) {
    const excess = gapAt(leads[i], transitions[i]) - 0.2;
    if (excess > 0.05) { durations[i - 1] += excess; durations[i] -= excess; shifts[i] = excess; }
  }
  durations = durations.map(r6);
  const starts: number[] = [];
  durations.reduce((t, d) => { starts.push(r6(t)); return t + d; }, 0);
  return { durations, starts, shifts: shifts.map(r6), cps: cpsFor(e), staggerMs: staggerFor(e) };
}
