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
  // base offset from the anchor in px at refHeight (the units of x/y tracks); an x/y track replaces it while it runs
  x: z.number().default(0),
  y: z.number().default(0),
  // clip to a rect in the node's local space (after its transform); animatable as clip.x / clip.y / clip.w / clip.h
  // (clip.w 0 -> w = left-to-right wipe, S3 rows; S13 curtain wipe)
  clip: z.object({ x: z.number(), y: z.number(), w: z.number().min(0), h: z.number().min(0) }).optional(),
  tracks: z.array(Track).default([]),
});

export const TextStyle = z.object({
  font: z.string().default("tokens.font"),
  size: z.number().positive(),            // px at the canvas's reference height
  weight: z.number().int().min(100).max(900).default(500),
  tracking: z.number().default(0),        // em
  color: Color.default("tokens.text"),
  align: z.enum(["left", "center", "right"]).default("center"),
  // variable-font axes, animatable as "axis.slnt" etc.
  axes: z.record(z.string(), z.number()).default({}),
  // OpenType features passed to HarfBuzz, e.g. ["tnum"] for tabular digits (counters), ["-liga"], ["ss01"]
  features: z.array(z.string().regex(/^[+-]?[A-Za-z0-9]{4}(=\d+)?$/, "OpenType feature tag, e.g. tnum, -liga, ss01=1")).default([]),
});

export const TextNode = NodeBase.extend({
  type: z.literal("text"),
  text: z.string(),
  style: TextStyle,
  fit: Fit.optional(),
  shaping: z.enum(["harfbuzz", "browser"]).default("harfbuzz"),
  // eased recentre: time constant (ms) with which the run's centre follows a typewriter's growth; 0 = jump (T4)
  recenterEaseMs: z.number().min(0).default(0),
});

export const RectNode = NodeBase.extend({
  type: z.literal("rect"),
  w: z.number().positive(),
  h: z.number().positive(),
  radius: z.number().min(0).default(0),
  fill: Color.optional(),
  stroke: z.object({ color: Color, width: z.number().positive() }).optional(),
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

export const GroupNode: z.ZodType<any> = z.lazy(() =>
  NodeBase.extend({
    type: z.literal("group"),
    children: z.array(Node),
  })
);

// Cursor: drawn last, on top; top-level only. x/y are its start position; moveTo / press tracks drive it.
// avatar renders a circle placeholder until image nodes exist.
export const CursorNode = NodeBase.extend({
  type: z.literal("cursor"),
  style: z.enum(["arrow", "hand", "avatar"]).default("arrow"),
  size: z.number().positive().default(1),            // multiplier; R5's giant cursor is ~2
});

export const Node = z.discriminatedUnion("type", [TextNode, RectNode, BracketNode, CursorNode]).or(GroupNode);
export type Node = z.infer<typeof Node>;

// ---------- beats + document ----------
export const Beat = z.object({
  id: z.string().regex(/^b[0-9]+$/),
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
    if (sorted[i].start < sorted[i - 1].start + sorted[i - 1].duration)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `beat ${sorted[i].id} overlaps ${sorted[i - 1].id}` });
  }
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
