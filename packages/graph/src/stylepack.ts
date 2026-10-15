// @engine/graph — style packs: one measured "look" per reference family. A pack is pure data (packages/graph/packs/
// <name>.json), extracted from the clips by the reference-pattern-extraction procedure, and selected by
// `graph.style.pack`. The runtime resolves field / surface / type defaults from the pack; graph tokens and explicit
// node values always win over it. Packs never contain motion timings — those live in the macros and the timing table.
import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);

export const SurfaceSpec = z.object({
  lift: z.number(),                 // fill lightness delta at the top of the gradient (negative = darker top)
  borderTop: z.number().min(0).max(1), borderBottom: z.number().min(0).max(1),   // 1 px border alpha, in borderColor
  borderColor: Hex.default("#FFFFFF"),
  highlight: z.number().min(0).max(1),   // 1 px top highlight alpha (white)
  shadowAlpha: z.number().min(0).max(1), shadowBlur: z.number().min(0), shadowY: z.number(),
  shadowColor: Hex.default("#000000"),
  glowAlpha: z.number().min(0).max(1), glowBlur: z.number().min(0),   // under-glow when the fill is the accent
  radius: z.number().min(0).max(1),      // default corner radius as a fraction of the rect's height (0.5 = pill)
});
export type SurfaceSpec = z.infer<typeof SurfaceSpec>;

export const StylePack = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  sources: z.array(z.string()),          // clips it was measured from, e.g. ["R3", "R8", "R9"]
  summary: z.string(),                   // one line: what the look is
  tokens: z.object({ bg: Hex, text: Hex, accent: Hex, muted: Hex, surface: Hex, glow: Hex.optional(), accent2: Hex.optional() }),
  field: z.object({
    mode: z.enum(["auto", "none"]),
    glow: z.number().min(0).max(3),      // multiplier on the derived two-glow profile
    glowColor: Hex.optional(),           // measured glow colour (else the deepened accent)
    glows: z.array(z.object({ x: z.number(), y: z.number(), rx: z.number().positive(), ry: z.number().positive(), color: Hex, intensity: z.number().min(0).max(1) })).optional(), // explicit profile replacing the derived one
    vignette: z.number().min(0).max(1),
    grain: z.number().min(0).max(0.2),
    grid: z.object({ color: Hex, alpha: z.number().min(0).max(1), spacing: z.number().positive() }).optional(),   // R4 blueprint grid (px at 1080)
  }),
  surfaces: z.object({ card: SurfaceSpec, button: SurfaceSpec, pill: SurfaceSpec }),
  type: z.object({
    font: z.string().default("Inter"),
    // per role: weight and tracking (em) the look uses; sizes stay the role fractions unless scale != 1
    display: z.object({ weight: z.number(), tracking: z.number(), scale: z.number().default(1) }),
    headline: z.object({ weight: z.number(), tracking: z.number(), scale: z.number().default(1) }),
    body: z.object({ weight: z.number(), tracking: z.number(), scale: z.number().default(1) }),
    label: z.object({ weight: z.number(), tracking: z.number(), scale: z.number().default(1), uppercase: z.boolean().default(true) }),
    textAlpha: z.object({ display: z.number(), headline: z.number(), body: z.number(), label: z.number() }),
    onAccent: Hex,                       // text colour on accent surfaces (buttons, hub cards)
  }),
  motion: z.object({
    transition: z.enum(["cut", "crossfade", "curtain", "smear"]),   // the look's default between sections
    curtainColor: Hex.optional(),
    bloom: z.number().min(0).max(2),     // multiplier on typewriter / glyph bloom intensity (0 = this look has no bloom)
    cameraDrift: z.number().min(0).max(0.2),   // slow push per beat (zoom delta); 0 = static shots
  }),
  evidence: z.array(z.string()),         // what was measured where (clip, time, method), for the audit trail
});
export type StylePack = z.infer<typeof StylePack>;
