# glass-brand — premium brand film (R10 Framer, R11 ElevenLabs Flows)

## The look in words
A black stage lit by one colour. The base is true black (R10 measures #000000, not "near-black"), and everything
that matters is emissive: the brand blue (#0054FE) flashes to a lighter #0599FC fill and leaves a soft afterglow
that dies out within ~150 px at 1080; white elements bloom with a halo almost twice their own size. Surfaces are
glass — translucent navy slabs (#132948 over black) with bright 1 px rims on every edge (the rim is the light,
not a stroke) and a wide soft shadow underneath when they sit on a lit background. Film grain sits over the whole
frame (R11's orange clouds measure ~5 levels of high-pass noise; R10's black is compression-clean, so the grain is
a choice taken from R11). Cuts land on the beat — R10 cuts every ~0.5 s — and holds are static after a settle; the
only motion inside a hold is the object itself turning in 3D, never a camera push. Type is a single heavy
grotesk: bold wordmark-weight display, bold uppercase labels with wide tracking on buttons, body copy regular.
Secondary colour is a warm marker yellow (#F3BE0B, the cursor triangle on R10's blueprint stage).

R11 proves the hue is free: the same recipe runs on orange (clouds #EB6223 at their most saturated, text gradient
and caret #F4803F) with white canvas UI on top. Tokens here are R10's blue family; swapping `accent` / `glow` /
`glowColor` to the orange triple gives the ElevenLabs version.

## Frames measured
R10 (720x720, 60 fps): 0.5, 1.5 (blueprint grid), 3.0, 3.5, 4.0 (menu card + LAUNCH button), 4.5 (blue wash),
4.7–5.3 at 0.1 s (white halo bloom), 5.5, 6.0 (blue flash afterglow), 6.5 (glass logo), 7.0, 8.5 (wordmark),
12.5 (glass on blue), plus 5 fps bbox tracks over 6.2–7.8, 8.0–9.8, 12.0–13.6 for camera drift.
R11 (736x414, 30 fps): 0.5, 2.5, 4.5 (white card), 7.0 (gradient display text), 24.0 (translucent card over the
purple panel), 28.0 (pills, body, muted), 41.0, 44.0, 47.0 (wordmark on clouds). Frame-difference runs over both
full clips for the transition classification.

## What the schema cannot express (candidates for later fields)
- **Flash + afterglow** on accent fills: the fill itself brightens (#0054FE -> #0599FC) for a beat while the
  under-glow spikes (edge L 110/255) and decays; the schema has only a static `glowAlpha`.
- **Refraction / dispersion** on glass: R10 12.5 shows a rainbow (cyan-magenta-yellow) caustic band inside the
  slab and a near-white refracted upper face; the pack only has the rim and the tinted fill.
- **Volumetric cloud field** (R11): the background is a moving, grainy nebula with purple corners, not a radial
  glow pair; `glows` approximates its brightness distribution only.
- **Dotted grid lines with limited extent**: R10's blueprint grid is 60 % duty dotted and only ~3 lines each way
  around the logo, fading outward; `grid` is a full-frame solid-line grid at the measured 120 px / alpha 0.2.
- **Light streak**: the white diagonal emissive band that sweeps across R10 at 3.5–5.0 s (a transition device).
- **Gradient text** (R11 7.0: black -> orange across the last word, with an orange caret) — T7 covers the gradient,
  not the caret colour.
- **Translucent white card** (R11 24.0): white at ~85 % alpha over an image panel; the card spec is opaque.
- **Dark menu card** (R10 4.0): #1C1C1C top fading to black with no rim — a second, non-glass card kind on black.
- Grain is R11's number; R10's black background has none. Vignette (0.1) is weak and mostly the glow falloff.
- Pill border is measured on R11's white canvas (dark 1 px, 0.10 / 0.04) and will be invisible on this pack's
  black `bg`; a dark-canvas pill would need a white rim like the card's.
