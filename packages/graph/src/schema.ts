// @engine/graph — scene-graph schema v1 (phase 0 subset)
// Everything the renderer, the editor and the exporters agree on lives here.
import { z } from "zod";

// ---------- primitives ----------
export const Ease = z.enum(["linear", "settle", "emphasis", "bounce"]);
export type Ease = z.infer<typeof Ease>;

export const Spring = z.object({
  stiffness: z.number().positive().default(700),
  damping: z.number().positive().default(18),
  mass: z.number().positive().default(1),
});

export const Color = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^tokens\.[a-zA-Z0-9_.-]+$/, "hex or tokens.<name>");

// A track animates ONE property of its node. `at` is seconds relative to the beat start. When several tween tracks
// animate the same property, the latest started one wins; before any has started, the earliest one's `from` holds.
const TrackBase = z.object({
  prop: z.string().min(1),           // e.g. "opacity", "x", "scale", "glyph.opacity", "glyph.subst"
  at: z.number().min(0).default(0),  // start, seconds from beat start
  ms: z.number().min(0).default(400),
});

export const TweenTrack = TrackBase.extend({
  mode: z.literal("tween").default("tween"),
  from: z.union([z.number(), Color]).optional(), // omitted = current value
  to: z.union([z.number(), Color]),
  ease: Ease.default("settle"),
  spring: Spring.optional(),         // used only when ease === "bounce"
  staggerMs: z.number().min(0).default(0), // per-child / per-glyph offset
  // "reveal": per-glyph, each glyph's tween starts `at` seconds after the node's typewriter reveals it (T4 word pop)
  relativeTo: z.enum(["beat", "reveal"]).default("beat"),
  // starting while an earlier track on the same prop is still moving: inherit its velocity (springs as initial
  // velocity from the current value; tweens blend from the old motion over 80 ms). false = jump onto this track.
  carryVelocity: z.boolean().default(true),
});

// Typewriter: reveals glyphs in order; everything about "freshness" lives here.
export const TypewriterTrack = TrackBase.extend({
  mode: z.literal("typewriter"),
  cps: z.number().positive().default(26),          // chars/s at the start of the run
  ramp: z.number().positive().default(1),          // cps multiplier reached by the last char (R3 measured ~2.7)
  wordPauseMs: z.number().min(0).default(0),       // extra pause after each space
  unit: z.enum(["char", "word"]).default("char"),  // "word": a whole word (with the space before it) appears at once; cps counts words (T4)
  scramble: z.object({
    frames: z.number().int().min(0).default(0),          // 0 = plain typewriter
    symbols: z.string().default("#%*@!<>&"),
  }).default({}),
  tail: z.object({
    len: z.number().int().min(0).default(0),
    color: Color.default("tokens.accent"),
    decayMs: z.number().min(0).default(300),
    strength: z.number().min(0).max(1).default(0.35),  // how far a just-typed glyph moves toward the tail colour
  }).default({}),
  caret: z.object({
    style: z.enum(["none", "bar", "block", "glass"]).default("bar"),   // glass = translucent fill + bright edge (R3)
    blinkMs: z.number().positive().default(500),
    holdAfterMs: z.number().min(0).default(0),           // caret stays after the last glyph
    preScale: z.number().positive().default(1),          // size multiplier at beat start, settling to 1 by `at`
    color: Color.optional(),                             // defaults to the tail colour
  }).default({}),
  bloom: z.object({ radius: z.number().min(0).default(0), intensity: z.number().min(0).default(0) }).default({}),
  // un-type: glyphs disappear from the right, evenly over out.ms, starting at out.at (T13)
  out: z.object({ at: z.number().min(0), ms: z.number().positive() }).optional(),
});

// Colour sweep: a window of `window` glyphs tinted `color` whose centre moves from glyph position `from` to `to`
// (glyph-index units, may lie outside the run) and stays at `to` after the track ends (T6 keyword hold).
export const SweepTrack = TrackBase.extend({
  mode: z.literal("sweep"),
  from: z.number(),
  to: z.number(),
  window: z.number().positive().default(4),
  color: Color.default("tokens.accent"),
  ease: z.enum(["linear", "settle", "emphasis"]).default("settle"),
});

// Counter: the text node shows a number counting from `from` to `to` (formatted) instead of its `text`, which
// holds the final string for editors and exports (S2).
export const CountTrack = TrackBase.extend({
  mode: z.literal("count"),
  from: z.number(),
  to: z.number(),
  ease: z.enum(["linear", "settle", "emphasis"]).default("linear"),   // counters read as mechanical: linear
  decimals: z.number().int().min(0).max(6).default(0),
  separator: z.string().default(","),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

// ---------- cursor (S3, S5) ----------
// moveTo: the cursor travels from where it is to a point on the target node's box (world space, from the runtime's
// measure pass), arriving at at + ms. offset is a fraction of the target's box (x * width, y * height).
export const MoveToTrack = TrackBase.extend({
  mode: z.literal("moveTo"),
  prop: z.string().min(1).default("position"),
  target: z.string(),
  anchor: z.enum(["center", "left", "right", "top", "bottom"]).default("center"),
  offset: z.object({ x: z.number().default(0), y: z.number().default(0) }).default({}),
  ms: z.number().min(0).default(500),
  ease: z.enum(["linear", "settle", "emphasis"]).default("emphasis"),
});
// press: the cursor dips to 0.96 and back over ms
export const PressTrack = TrackBase.extend({
  mode: z.literal("press"),
  prop: z.string().min(1).default("scale"),
  ms: z.number().min(0).default(80),
});
// onHover: on any node, animate `prop` to `to` while `cursor` hovers it — from the arrival of a moveTo that targets
// this node until that cursor's next moveTo starts (then it eases back). Derived from the cursor's tracks, so it
// stays a pure function of t. prop: "fill" (rects) or opacity / scale / rotation / x / y.
export const OnHoverTrack = TrackBase.extend({
  mode: z.literal("onHover"),
  cursor: z.string(),
  to: z.union([z.number(), Color]),
  ms: z.number().min(0).default(130),
  ease: z.enum(["linear", "settle", "emphasis"]).default("settle"),
});

export const Track = z.discriminatedUnion("mode", [TweenTrack, TypewriterTrack, SweepTrack, CountTrack, MoveToTrack, PressTrack, OnHoverTrack]);

// ---------- camera (S4) ----------
// frame: frame a target node. size presets are fill fractions of the frame (wide 0.5, medium 0.7, close 0.9):
// zoom = min(W*f / box.w, H*f / box.h); a number is an explicit zoom. The view centres the box anchor + offset
// (fractions of the box). follow false resolves the box once at `at`; true re-resolves it every frame.
// ms 0 = hard cut; ms > 0 interpolates zoom in log space and the centre linearly. Holds until the next frame track.
// The view is clamped to the canvas (zoom >= 1, pan within bounds).
export const FrameTrack = TrackBase.extend({
  mode: z.literal("frame"),
  prop: z.string().min(1).default("camera"),
  target: z.string(),
  size: z.union([z.enum(["wide", "medium", "close"]), z.number().positive()]).default("medium"),
  anchor: z.enum(["center", "left", "right", "top", "bottom"]).default("center"),
  offset: z.object({ x: z.number().default(0), y: z.number().default(0) }).default({}),
  ms: z.number().min(0).default(0),
  ease: z.enum(["linear", "settle", "emphasis"]).default("emphasis"),
  follow: z.boolean().default(false),
});
export const CameraTrack = z.discriminatedUnion("mode", [TweenTrack, FrameTrack]);
export type CameraTrack = z.infer<typeof CameraTrack>;
export type Track = z.infer<typeof Track>;

// ---------- layout ----------
// fitBox keeps a node inside a box by scaling the node (never by wrapping); recenter keeps it centred as it grows.
export const Fit = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
  minScale: z.number().positive().max(1).default(0.25),
  recenter: z.boolean().default(true),
  easeMs: z.number().min(0).default(120),  // how fast the scale follows content growth
});

// Anchors are fractions of the canvas, so one graph lays out on 16:9 and 9:16.
export const Anchor = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  // per-aspect overrides; key is "16:9" | "9:16"
  overrides: z.record(z.enum(["16:9", "9:16"]), z.object({ x: z.number(), y: z.number(), scale: z.number().optional() })).optional(),
});

// ---------- nodes ----------
const NodeBase = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "stable slug: <beat>-<role>[-n]"),
  anchor: Anchor.default({}),
  opacity: z.number().min(0).max(1).default(1),
  scale: z.number().positive().default(1),
  rotation: z.number().default(0),
  // Gaussian blur in px at refHeight over the node and its children (animatable as "blur"; S7 depth of field)
  blur: z.number().min(0).default(0),
  // tilt in degrees about the X then Y axis, projected orthographically (an affine: a plane stays a parallelogram;
  // perspective foreshortening is not modelled). Animatable as "rotX" / "rotY" (S10 tilted UI plane).
  rotX: z.number().default(0),
  rotY: z.number().default(0),
  // base offset from the anchor in px at refHeight (the units of x/y tracks); an x/y track replaces it while it runs
  x: z.number().default(0),
  y: z.number().default(0),
  // clip to a rect in the node's local space (after its transform); animatable as clip.x / clip.y / clip.w / clip.h
  // (clip.w 0 -> w = left-to-right wipe, S3 rows; S13 curtain wipe)
  clip: z.object({ x: z.number(), y: z.number(), w: z.number().min(0), h: z.number().min(0) }).optional(),
  tracks: z.array(Track).default([]),
});

// Type roles (look layer): a role sets size, weight, tracking and text alpha from the canvas instead of raw numbers,
// so one graph keeps its hierarchy at 16:9 and 9:16. Fractions are of roleBase = min(H, 1.25 W).
// Explicit size / weight / tracking / color on the style always win over the role.
export const TextRole = z.enum(["display", "headline", "body", "label"]);
export type TextRole = z.infer<typeof TextRole>;
export const ROLE_SPECS: Record<TextRole, { size: number; weight: number; tracking: number; alpha: number; uppercase: boolean }> = {
  display:  { size: 0.16,  weight: 700, tracking: -0.03, alpha: 0.92, uppercase: false },
  headline: { size: 0.095, weight: 650, tracking: -0.02, alpha: 0.92, uppercase: false },
  body:     { size: 0.034, weight: 450, tracking: 0,     alpha: 0.70, uppercase: false },
  label:    { size: 0.026, weight: 500, tracking: 0.04,  alpha: 0.55, uppercase: true },
};
export function roleBase(w: number, h: number): number { return Math.min(h, 1.25 * w); }
// the numbers the renderer uses for a style on a canvas of w x h graph units
export type PackType = { display: RoleOverride; headline: RoleOverride; body: RoleOverride; label: RoleOverride & { uppercase?: boolean }; textAlpha: Record<TextRole, number> };
type RoleOverride = { weight: number; tracking: number; scale?: number };
export function resolveTextStyle(style: { role?: TextRole; size?: number; weight?: number; tracking?: number; color?: string }, w: number, h: number, pack?: PackType) {
  const r = style.role ? ROLE_SPECS[style.role] : null;
  const pr = style.role && pack ? pack[style.role] : undefined;
  return {
    size: style.size ?? (r ? r.size * (pr?.scale ?? 1) * roleBase(w, h) : 48),
    weight: style.weight ?? pr?.weight ?? r?.weight ?? 500,
    tracking: style.tracking ?? pr?.tracking ?? r?.tracking ?? 0,
    color: style.color ?? "tokens.text",
    alpha: style.color || !r ? 1 : (pack && style.role ? pack.textAlpha[style.role] : r.alpha),
    uppercase: style.role === "label" && pack ? (pack.label.uppercase ?? true) : (r?.uppercase ?? false),
  };
}

export const TextStyle = z.object({
  font: z.string().default("tokens.font"),
  role: TextRole.optional(),
  size: z.number().positive().optional(), // px at the canvas's reference height; required unless a role is set
  weight: z.number().int().min(100).max(900).optional(),   // default 500, or the role's
  tracking: z.number().optional(),        // em; default 0, or the role's
  color: Color.optional(),                // default tokens.text (at the role's alpha when a role is set)
  align: z.enum(["left", "center", "right"]).default("center"),
  // variable-font axes, animatable as "axis.slnt" etc.
  axes: z.record(z.string(), z.number()).default({}),
  // OpenType features passed to HarfBuzz, e.g. ["tnum"] for tabular digits (counters), ["-liga"], ["ss01"]
  features: z.array(z.string().regex(/^[+-]?[A-Za-z0-9]{4}(=\d+)?$/, "OpenType feature tag, e.g. tnum, -liga, ss01=1")).default([]),
  // horizontal gradient across the run (from -> to), mixed over the body colour by `amount` (animatable as
  // "gradient.amount": 1 = full gradient, 0 = body colour; T7 gradient -> white settle). Hex colours or tokens.
  gradient: z.object({ from: Color, to: Color, amount: z.number().min(0).max(1).default(1) }).optional(),
  // 3D extrusion (S11 slab numerals, R6): `depth` copies of each glyph stacked along (dx, dy) px per unit depth behind
  // the face in `color` (default: the body colour at -40 % lightness); animatable as "extrude.depth".
  extrude: z.object({ depth: z.number().min(0).default(24), dx: z.number().default(0.6), dy: z.number().default(0.6), color: Color.optional() }).optional(),
}).refine((s) => s.size !== undefined || s.role !== undefined, { message: "text style needs a size or a role" });

export const TextNode = NodeBase.extend({
  type: z.literal("text"),
  text: z.string(),
  style: TextStyle,
  fit: Fit.optional(),
  shaping: z.enum(["harfbuzz", "browser"]).default("harfbuzz"),
  // eased recentre: time constant (ms) with which the run's centre follows a typewriter's growth; 0 = jump (T4)
  recenterEaseMs: z.number().min(0).default(0),
  // word wrap (look layer): lines break greedily at spaces so the block stays within maxWidth (px, graph units; also
  // clamped to the 90 % safe width); lineHeight in em; maxWidth can be overridden per aspect (9:16 wraps narrower).
  // The block is centred vertically on the anchor; each line is aligned by style.align. Omitted = one line (fit scales).
  wrap: z.object({
    maxWidth: z.number().positive(),
    lineHeight: z.number().positive().default(1.15),
    overrides: z.record(z.enum(["16:9", "9:16"]), z.object({ maxWidth: z.number().positive() })).optional(),
  }).optional(),
});

export const RectNode = NodeBase.extend({
  type: z.literal("rect"),
  w: z.number().positive(),
  h: z.number().positive(),
  radius: z.number().min(0).default(0),
  fill: Color.optional(),
  stroke: z.object({ color: Color, width: z.number().positive() }).optional(),
  // Surface treatment (look layer): card / pill / button = gradient fill, 1 px light border, top highlight, shadow,
  // and an under-glow when the fill is the accent. auto picks by size (card >= 120 px tall, pill <= 48, button
  // between, flat under 20 px or for translucent / missing fills). flat = the bare fill + stroke.
  surface: z.enum(["auto", "card", "pill", "button", "flat"]).default("auto"),
  // sit beside an earlier sibling text node's edge, scaled with its fit (T13 logo mark); anchor is ignored
  follows: z.object({ node: z.string(), edge: z.enum(["left", "right"]), gap: z.number().default(0) }).optional(),
  // children draw on top of the rect, positioned relative to its centre (like a group's)
  children: z.array(z.lazy((): z.ZodTypeAny => Node)).default([]),
  // wrap the children's measured extents (at time t, ignoring their opacity) plus padding; w/h become the minimum
  // size, grown symmetrically (S2 pill around its counter)
  sizeToContent: z.object({ padX: z.number().min(0).default(0), padY: z.number().min(0).default(0) }).optional(),
});

// Bracket pair that tracks another node's extents (R3's [ ] and { }).
export const BracketNode = NodeBase.extend({
  type: z.literal("bracket"),
  follows: z.string(),                    // id of the text node it frames
  glyphs: z.tuple([z.string(), z.string()]).default(["[", "]"]),
  padding: z.number().default(24),
  style: TextStyle,
  spring: Spring.default({}),             // how the closing glyph settles after the text grows
});

// Row / column layout: children are placed one after another from their rest boxes (text at its full run, rects at
// their size or sizeToContent, nested groups at their union), ignoring their own anchors; their base x/y and tracks
// still apply on top of the slot. `gap` px between children; `align` places children across a line and lines along the
// block (start | center | end); with `wrap`, a line breaks when the next child would pass `maxWidth` (main-axis
// length). The block is centred on the group's origin. gap / maxWidth can be overridden per aspect.
export const Layout = z.object({
  type: z.enum(["row", "column"]),
  gap: z.number().min(0).default(0),
  align: z.enum(["start", "center", "end"]).default("center"),
  wrap: z.boolean().default(false),
  maxWidth: z.number().positive().optional(),
  overrides: z.record(z.enum(["16:9", "9:16"]), z.object({ gap: z.number().min(0).optional(), maxWidth: z.number().positive().optional() })).optional(),
});

export const GroupNode: z.ZodType<any> = z.lazy(() =>
  NodeBase.extend({
    type: z.literal("group"),
    children: z.array(Node),
    layout: Layout.optional(),
  })
);

// Trim: the visible part of a stroke as fractions of its length; animatable as trim.start / trim.end (draw-on).
export const Trim = z.object({ start: z.number().min(0).max(1).default(0), end: z.number().min(0).max(1).default(1) });

// Path: an SVG path in local px (y-down), stroked and/or filled. A (elliptical arc) segments are drawn exactly by the
// canvas but measured as straight chords (length / bounds / trim).
export const PathNode = NodeBase.extend({
  type: z.literal("path"),
  d: z.string().min(1),
  stroke: Color.optional(),
  strokeWidth: z.number().positive().default(2),
  fill: Color.optional(),
  lineCap: z.enum(["round", "butt", "square"]).default("round"),
  trim: Trim.default({}),
});

// Wire: a stroke between points on two nodes' boxes (world space, from the measure pass, so it survives 9:16).
// curve s: cubic with control points from + (dx*bend, 0) and to - (dx*bend, 0); line; arc: bows perpendicular by
// bend*|d|. Top-level only; drawn before every other node of the beat (under its targets). Its own x/y/scale are
// ignored; opacity and trim apply.
export const WireEnd = z.object({
  target: z.string(),
  anchor: z.enum(["center", "left", "right", "top", "bottom"]).default("center"),
  offset: z.object({ x: z.number().default(0), y: z.number().default(0) }).default({}),   // fractions of the box
});
export const WireNode = NodeBase.extend({
  type: z.literal("wire"),
  from: WireEnd,
  to: WireEnd,
  curve: z.enum(["s", "line", "arc"]).default("s"),
  bend: z.number().default(0.5),
  stroke: Color.default("tokens.accent"),
  strokeWidth: z.number().positive().default(2),
  trim: Trim.default({}),
  glow: z.object({ radius: z.number().min(0), intensity: z.number().min(0).max(1) }).optional(),
});

// Image: a decoded asset by name (supplied to createRuntime as `images`, loaded by the harness / local renderers
// before the first frame, so renderFrame stays synchronous), fitted into w x h (contain | cover) with rounded corners.
// src null = an editable client-asset slot: a dashed accent placeholder with a glyph and its label (kind video renders
// the same slot for now; video frames are a later harness concern).
export const ImageNode = NodeBase.extend({
  type: z.literal("image"),
  src: z.string().min(1).nullable(),
  placeholder: z.object({ kind: z.enum(["image", "video"]).default("image"), label: z.string().default("") }).optional(),
  w: z.number().positive(),
  h: z.number().positive(),
  fit: z.enum(["contain", "cover"]).default("cover"),
  radius: z.number().min(0).default(0),
});

// Cursor: drawn last, on top; top-level only. x/y are its start position; moveTo / press tracks drive it.
// avatar renders a circle placeholder until image nodes exist.
export const CursorNode = NodeBase.extend({
  type: z.literal("cursor"),
  style: z.enum(["arrow", "hand", "avatar"]).default("arrow"),
  size: z.number().positive().default(1),            // multiplier; R5's giant cursor is ~2
});

export const Node = z.discriminatedUnion("type", [TextNode, RectNode, BracketNode, CursorNode, PathNode, WireNode, ImageNode]).or(GroupNode);
export type Node = z.infer<typeof Node>;

// ---------- beats + document ----------
// Transition into this beat from the previous one, composited over [start, start + ms). The beat timeline is unchanged
// (beats still may not overlap): the outgoing beat is evaluated at the real t, its finished tracks holding.
// cut: ms 0. crossfade: linear alpha (default 100 ms, the timing table's cross-dissolve). curtain: a canvas-sized
// `color` panel (default tokens.accent) crosses in `direction` (default right) over ms (default 600) with emphasis,
// covering the frame at the midpoint — outgoing before it, incoming after. smear: outgoing slides 0 -> -0.3 W in
// `direction` (default left) with emphasis while incoming slides +0.3 W -> 0 with settle and fades in linearly; each is
// drawn as 8 taps spread along its own instantaneous velocity x 1/60 s (default 160 ms).
export const Transition = z.object({
  type: z.enum(["cut", "curtain", "smear", "crossfade"]),
  ms: z.number().min(0).optional(),
  ease: z.enum(["linear", "settle", "emphasis"]).optional(),
  direction: z.enum(["left", "right", "up", "down"]).optional(),
  color: Color.optional(),
});
export type Transition = z.infer<typeof Transition>;

// Background field (look layer). auto: when a beat has no explicit glows, two radial glows derived from the glow
// colour (tokens.glow, else tokens.accent) at the R3-measured profile (bottom 0.39, top 0.2, scaled by `glow`), then a
// vignette (edge darkening) over the background and a deterministic grain over the finished frame. none: flat.
export const Field = z.object({
  mode: z.enum(["auto", "none"]).default("auto"),
  glow: z.number().min(0).max(3).default(1),
  glowColor: Color.optional(),
  vignette: z.number().min(0).max(1).default(0.18),
  grain: z.number().min(0).max(0.2).default(0.025),
});
export type Field = z.infer<typeof Field>;
// field: explicit per-graph field; when omitted the pack's field (or the built-in default) applies
export const Style = z.object({ pack: z.string().regex(/^[a-z0-9-]+$/).optional(), field: Field.optional() });

export const Beat = z.object({
  id: z.string().regex(/^b[0-9]+$/),
  field: Field.optional(),                // overrides graph.style.field for this beat
  type: z.enum(["hook", "pain", "reveal", "feature", "proof", "summary", "cta"]),
  start: z.number().min(0),
  duration: z.number().positive(),
  script: z.string().default(""),
  background: Color.default("tokens.bg"),
  // soft elliptical glows added over the background (S15 ambient glow): positions and radii are canvas fractions
  glows: z.array(z.object({
    x: z.number().default(0.5), y: z.number().default(1),
    rx: z.number().positive().default(0.5), ry: z.number().positive().default(0.8),
    color: Color.default("tokens.accent"), intensity: z.number().min(0).max(1).default(0.6),
    tracks: z.array(Track).default([]),
  })).default([]),
  // camera over the nodes and cursors (not the background or glows): zoom about the frame centre, x/y = pan in px
  camera: z.object({ zoom: z.number().positive().default(1), x: z.number().default(0), y: z.number().default(0), tracks: z.array(CameraTrack).default([]) }).default({}),
  nodes: z.array(Node),
  transition: Transition.optional(),
});

export type Beat = z.infer<typeof Beat>;

export const Timing = z.object({
  enterMs: z.number().default(400),
  exitMs: z.number().default(200),
  staggerMs: z.number().default(70),
  glyphStaggerMs: z.number().default(30),
  cps: z.number().default(26),
  freshDecayMs: z.number().default(300),
});

export const Graph = z.object({
  version: z.literal(1),
  canvas: z.object({
    aspect: z.enum(["16:9", "9:16"]).default("16:9"),
    refHeight: z.number().positive().default(1080), // sizes in the graph are px at this height
    fps: z.number().positive().default(30),
  }),
  tokens: z.record(z.string(), z.string()),
  style: Style.default({}),
  timing: Timing.default({}),
  dials: z.object({
    luminance: z.number().min(0).max(1), glow: z.number().min(0).max(1), dimensionality: z.number().min(0).max(1),
    playfulness: z.number().min(0).max(1), kineticText: z.number().min(0).max(1), realism: z.number().min(0).max(1),
    tempo: z.number().min(0).max(1), density: z.number().min(0).max(1),
  }).partial().default({}),
  beats: z.array(Beat).min(1),
}).superRefine((g, ctx) => {
  // beats must not overlap and ids must be unique across the document
  const sorted = [...g.beats].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    // 1 µs tolerance: timings are authored to the µs and float sums (5.8 + 2.4 = 8.200000000000001) overshoot
    if (sorted[i].start < sorted[i - 1].start + sorted[i - 1].duration - 1e-6)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `beat ${sorted[i].id} overlaps ${sorted[i - 1].id}` });
  }
  // a transition needs a previous beat and must fit inside its beat
  sorted.forEach((b, i) => {
    if (!b.transition) return;
    if (i === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `beat ${b.id}: transition on the first beat has nothing to come from` });
    if ((b.transition.ms ?? 0) / 1000 > b.duration) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `beat ${b.id}: transition longer than the beat` });
  });
  const ids = new Set<string>();
  const walk = (n: any, beat: string) => {
    if (ids.has(n.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate node id ${n.id}` });
    ids.add(n.id);
    if (!n.id.startsWith(beat + "-")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `node ${n.id} must be prefixed with its beat id ${beat}-` });
    (n.children ?? []).forEach((c: any) => walk(c, beat));
  };
  g.beats.forEach((b) => b.nodes.forEach((n) => walk(n, b.id)));
  // follows / moveTo targets / onHover cursors must resolve inside the same beat; cursors are top-level
  g.beats.forEach((b) => {
    const local = new Set<string>();
    const collect = (n: any) => { local.add(n.id); (n.children ?? []).forEach(collect); };
    b.nodes.forEach(collect);
    const cursors = new Set(b.nodes.filter((n: any) => n.type === "cursor").map((n: any) => n.id));
    const check = (n: any, top: boolean) => {
      const target = n.type === "bracket" ? n.follows : n.type === "rect" ? n.follows?.node : undefined;
      if (target !== undefined && !local.has(target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${n.type} ${n.id} follows unknown node ${target}` });
      if (n.type === "cursor" && !top) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `cursor ${n.id} must be a top-level node of its beat` });
      if (n.type === "wire") {
        if (!top) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `wire ${n.id} must be a top-level node of its beat` });
        for (const end of [n.from, n.to]) if (!local.has(end.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `wire ${n.id} connects unknown node ${end.target}` });
      }
      for (const t of n.tracks ?? []) {
        if (t.mode === "moveTo" && !local.has(t.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${n.id}: moveTo targets unknown node ${t.target}` });
        if (t.mode === "onHover" && !cursors.has(t.cursor)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${n.id}: onHover names unknown cursor ${t.cursor}` });
      }
      (n.children ?? []).forEach((c: any) => check(c, false));
    };
    b.nodes.forEach((n: any) => check(n, true));
    for (const t of b.camera.tracks) if (t.mode === "frame" && !local.has(t.target))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${b.id}: camera frame targets unknown node ${t.target}` });
  });
});
export type Graph = z.infer<typeof Graph>;

export function parseGraph(json: unknown): Graph {
  return Graph.parse(json);
}
