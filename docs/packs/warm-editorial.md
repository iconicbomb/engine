# warm-editorial (R7 — Pando.ai logistics explainer, 2:06)

## The look in words
A warm, print-like editorial page rather than a dark SaaS dashboard. The field is a blurred warm photograph read as
cream (#F6F1EC) with beige falling off toward the edges (strongest on the right); no grain, no grid, no colour glow
in the open field. Type is a heavy geometric sans (not Inter — single-storey g, slanted t) set in pure black on
cream and pure white on green; nothing blooms. Two greens do the structural work: hover/active cards fill with
#174C43 behind a solid pale-yellow hairline, and whole sections go full-bleed #003B31 (the curtain colour). The
brand yellow #F0C92F is reserved for the mascot, the toggle, yellow keywords on green ("All in **one**", "Relia**a**")
and yellow-outlined pills on green — and wherever it appears it carries a butter-yellow halo (#F5D21A): a soft
Gaussian one on cream (toggle knob), a stepped concentric-ring one on green (mascot intro). Orange #CF6006 is the
second accent, used only for "problem" semantics (warning triangles, the "Higher expenses" headline, cons bars).
White document cards (#FFFFFF, soft 14 % shadow) and frosted cream panels (fill ≈ bg, white hairline ≈ 0.3) are the
other surfaces. Cursor is a dark-green arrow or a circular avatar with a green ring.

## Frames measured
Cream field / tokens: t = 6, 9, 11, 22, 26, 28, 33, 34, 100, 110. Green section: t = 36, 38.5, 40, 45, 50, 120.
Cards: green hover cards t = 12.0 (un-hovered cream), 12.3, 13, 14, 15, 16.0; white document cards t = 26, 28.
Toggle pill t = 33, 34. Mascot halo t = 37 (+ 36.5, 38.5). Buttons t = 28 (white chip), 120 (outlined). Curtain
t = 35.4–36.2 at 0.1 s steps; card-to-fullscreen push t = 15.8–17.0. Holds for drift t = 5.5–8.0, 8.5–10.5, 109.5–111.5.
Section-switch scan: 4 fps colour classification over the whole clip (switches at 16.75, 19, 35.75, 41.75, 43.75,
46.25, 48.75, 52.5, 66.25, 68, 116.25 s), with frames pulled at each switch.
Source is 736×414 @ 25 fps; px figures are at 414 tall unless marked "at 1080" (×2.61).

## Decisions worth knowing
- **field.glow = 0, no explicit glows.** The cream field's lightest-30 % medians have B within 8 levels of R (no
  yellow), the brightening toward the centre is 6–13 % and is the inverse of the vignette, and the yellow halo is
  always within ~200 px of the mascot or knob and travels with them (left at t=45, right at t=110, centre at t=120).
  A field-level yellow glow would tint every text beat; the halo belongs to the object (pill glowAlpha 0.24 / 120 px)
  or to a beat (S15) behind the hero.
- **The green sections do have a field glow** that the pack cannot carry because the pack's bg is cream: at t=45/50
  a yellow-olive glow at the top centre (x 0.5, y ≈ 0.05, rx ≈ 0.4, ry ≈ 0.45, intensity ≈ 0.31: (360,10) = #5C8C3A
  over #003B31) plus a broad lift of the whole field (corners #004E40–#025E4C) and a darker bottom (#003028).
  Set it as `beat.field` with bg #003B31, glows [{x 0.5, y 0.05, rx 0.4, ry 0.45, color #F5D21A, intensity 0.3}].
- **Mascot halo on green is stepped, not Gaussian:** concentric flat bands, alpha 0.92 at the body edge, 0.50 at
  +42 px, 0.10 at +100 px, hard outer ring at r ≈ 195 px (0.47 H) — a ripple look (S2-style nested bands) rather
  than a blurred glow. The schema's glowBlur approximates it.
- **text = #000000** as measured (darkest 25 % of every headline's ink is exactly 0,0,0). The source may clip
  blacks (its green is #003B31 with R=0 too); if a near-black is wanted for the design intent, that is a choice,
  not a measurement. muted #3D3834 is the ink median of the "+$ 2.596" labels (thin strokes; the day labels at
  t=11 read lighter, ~#626B60).
- **surface = the green card (#174C43), not the section green.** The card spec describes that card: flat
  (lift +0.005), a solid 2 px pale-yellow hairline (#FCF2CC) on all four sides, no shadow, near-square corners
  (0.015). The section green #003B31 is `curtainColor`.
- **Not expressible, document here:** (1) white document cards: #FFFFFF, no border, soft black shadow (edge
  darkening 7.5 % → 0 over 30 px at 414p: ~0.14 alpha, ~70 px blur at 1080, y +8), radius ≈ 14 px (~0.06 of
  height), only the top-left corner rounded with a folded top-right "page" corner; (2) frosted cream panels
  (t=6, t=12–13 right card): fill ≈ bg (#F5F0ED), 1 px white hairline ≈ 0.3 top / 0.35 bottom, slight bg blur,
  no shadow; (3) two button variants — the pack's spec is the outlined "Book a demo" (white 0.6 border, no fill,
  radius 0.14); the filled "Calling to – Carrier" chip is flat white, radius ~0.15, no border or shadow;
  (4) the pill fill is a translucent pale yellow (#F6F1DB over cream = accent at ~0.07 + white) and its glow sits
  under the white knob, not under an accent fill — the engine's "under-glow when the fill is the accent" rule
  would need an "always" option for this look; (5) yellow-outlined pills on green (t=50 ERP/TMS…: accent border
  ~1 px, transparent fill, accent text); (6) labels on cream are set in the section green (#003B31-ish,
  "SILOED TECH") rather than in text at reduced alpha — the 0.8 label alpha comes from "Pros" on the green card.
- **Type:** the font is a geometric grotesk heavier than Inter at the same nominal weight; 700/700/500/600 are the
  Inter equivalents by stroke ÷ cap height at 414p (±1 px, so ±100). Scales: display 0.7 (hero caps 25–44 px of
  414 — "Rising freight costs" 0.083 H font, "100 % Relia" 0.146 H), headline 0.8, body 1.4 and label 1.2 — this
  look's small text is markedly larger than the role defaults. Tracking (−0.02 / 0 / +0.02 em) is by eye, not measured.
- **Motion:** the only curtain is at 35.5–35.9 s: a #003B31 panel sweeps top → bottom with a convex curved
  leading edge over ~0.4 s and *stays* as the next section's background (one-way wipe, no second half). Every other
  section change is a hard cut, and 16.3–16.6 s is a card growing to fill the frame (push), not a curtain.
  cameraDrift 0.02: text holds are static (headline bbox 317 px at t=6.0 and 6.5), but the map panel pulls *out*
  2.5 % per 0.5 s over 8.5–9.5 s — the schema cannot express a negative (pull-out) drift. bloom 0: no text glow.
- **Grain 0:** high-pass std 0.18–0.33 levels on flat cream, 0.00 on green (0.001 / 255); the field is a blur, not a
  grain plate.
