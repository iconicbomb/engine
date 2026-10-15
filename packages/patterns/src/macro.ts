// @engine/patterns — the macro contract. A macro is a pure function (params) -> MacroResult that expands one
// pattern of the spec's library (T1–T14, S1–S16) into plain scene-graph data. The runtime never sees pattern ids;
// it only sees the nodes and tracks emitted here (spec: "Engine architecture and scene-graph format").
import type { z } from "zod";
import type { TextNode, RectNode, BracketNode, TextStyle, Fit, Anchor, Spring, TweenTrack, TypewriterTrack, SweepTrack, CountTrack, MoveToTrack, PressTrack, OnHoverTrack, CursorNode, Beat } from "@engine/graph";

// Macros emit the graph's *input* form (defaults may be omitted), exactly what a hand-written fixture contains.
export type TextNodeIn = z.input<typeof TextNode>;
export type RectNodeIn = z.input<typeof RectNode>;
export type BracketNodeIn = z.input<typeof BracketNode>;
export type GroupNodeIn = {
  id: string; type: "group"; anchor?: AnchorIn; x?: number; y?: number; opacity?: number; scale?: number; rotation?: number;
  tracks?: TrackIn[]; children: NodeIn[];
};
export type CursorNodeIn = z.input<typeof CursorNode>;
export type NodeIn = TextNodeIn | RectNodeIn | BracketNodeIn | CursorNodeIn | GroupNodeIn;
export type TweenTrackIn = z.input<typeof TweenTrack>;
export type TypewriterTrackIn = z.input<typeof TypewriterTrack>;
export type SweepTrackIn = z.input<typeof SweepTrack>;
export type CountTrackIn = z.input<typeof CountTrack>;
export type MoveToTrackIn = z.input<typeof MoveToTrack>;
export type PressTrackIn = z.input<typeof PressTrack>;
export type OnHoverTrackIn = z.input<typeof OnHoverTrack>;
export type TrackIn = TweenTrackIn | TypewriterTrackIn | SweepTrackIn | CountTrackIn | MoveToTrackIn | PressTrackIn | OnHoverTrackIn;
export type GlowIn = NonNullable<z.input<typeof Beat>["glows"]>[number];
export type TextStyleIn = z.input<typeof TextStyle>;
export type FitIn = z.input<typeof Fit>;
export type AnchorIn = z.input<typeof Anchor>;
export type SpringIn = z.input<typeof Spring>;

export interface MacroResult {
  /** New nodes. Where they go (beat root or a group) is the caller's choice. */
  nodes: NodeIn[];
  /** Tracks appended, in order, to nodes that already exist (e.g. T12 driving the exit of the text it replaces). */
  tracks: { target: string; track: TrackIn }[];
  /** Node fields set on existing nodes, for patterns that are layout rather than motion (T3 sets `fit`). */
  patches: { target: string; set: Partial<TextNodeIn> }[];
  /** Beat-level background glows (S15); the caller puts them on the beat. */
  glows: GlowIn[];
}

export const result = (r: Partial<MacroResult>): MacroResult => ({ nodes: r.nodes ?? [], tracks: r.tracks ?? [], patches: r.patches ?? [], glows: r.glows ?? [] });

/** Beat-local seconds, rounded to the microsecond so `2.0 + 80ms` serialises as 2.08, not 2.0799999999999996. */
export const sec = (s: number) => Math.round(s * 1e6) / 1e6;
