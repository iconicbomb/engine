# Style pack `typographic-bw` — measured from R6 (Made by Google countdown, 31 s, 736x414 source)

## The look in words
Pure typography, two polarities. Sections are either flat black (`#000000`, no vignette, no grain, no ambient glow) or
flat white (`#FFFFFF`), and the clip flips between them with slab-driven wipes on the beat. On black, the wordmarks are
large, tight, bold geometric sans (Google Sans — mapped to Inter 700–750, tracking about −0.03 em) in pure white, or in a
single horizontal blue→violet→pink gradient (`#4E83F3` → `#A481D8` → `#D65F81`). There is no bloom and no shadow: the
background stays at black level right up to the glyph edge. The countdown numerals are 3D-extruded slabs with square
corners and hard 1–2 px edges; each slab carries its own hue gradient (white→blue, violet, pink→violet, red→pink) rather
than a lightness lift, and slabs cast no shadow and have no border. On white, the slabs are near-black ink (`#1E2022`,
flat) and the background carries a soft, slow-drifting light field: pale blue and pale pink lobes at the frame edges
(white + ~20 % `#4187FF`, white + ~17 % `#C460A7`), with a clean white centre behind the numeral. Text beats do not
crossfade: each line fades in while rising ~0.065 H, holds, and fades out still rising; numeral beats and the final
white→black are hard cuts. A designer would call it "editorial type on paper and ink, with the brand gradient as the only
colour".

## Frames measured
Black polarity: t = 0.5 (Made by), 1.5 (Google), 2.5 (gradient "Made by Google" stack), 4.0 / 4.2 (Gemini), 5.5
(Android), 6.5 (Google Pixel), 9.0 (IX), 10.5 (X with blurred slab haze), 11.5 (VIII slabs), 22.8 (II slabs), 25.8
(phone outline with I), 28.5 (Made by, end). White polarity: t = 13.3 (VII with blue V), 14.0 (VII red/blue), 15.0 (VI
drifted field), 20.8 / 21.0 / 21.3 (III). Drift tracking at 10 fps over t = 0–3 and 3.3–5.9. Cut detection: mean
frame difference over the whole clip at 184 px wide. Transition frames (12.6–13.1, 16.0–16.4, 19.9–20.4, 21.85) were
only used for the transition finding.

## Decisions the schema forced
- **One bg.** Black is `tokens.bg`. The white polarity is recorded here and in `evidence`: bg `#FFFFFF`, ink `#1E2022`
  (that ink is what `tokens.surface` holds — the clip has no cards, and the white-polarity slab black is the one flat
  neutral fill it contains). A future `polarity` / per-beat bg override would let a beat flip to white and swap text/bg.
- **`accent2` holds the pink gradient end** (`#D65F81`), because the gradient is a two-colour brand pair and the pack
  would lose it otherwise; the brief suggested `accent2` for the white polarity, which lives in `surface` + this doc instead.
- **`field.glows` is the white-polarity light field only** (t = 13.3 layout: blue lobe off the left edge, pink off the
  right, full frame height). On the black bg the field is flat (`field.glow` 0). The schema's `intensity` is "added
  luminance over bg"; for a tint over white it is stored as the mix weight of the saturated tint colour over white
  (0.20 blue, 0.17 pink; measured luminance drop 0.09–0.11). The lobes drift between beats — at t = 20.8–21.0 the pink
  sits along the top edge and the blue in the bottom-right corner — so a renderer should treat the profile as a slow
  (~1 beat) drift, which the schema cannot express.
- **`tokens.glow` / `glowColor` `#6388FF`** is the normalised colour of the only non-flat black frame (t = 10.5: a
  blurred slab reflection peaking at +19/255 behind the X). It is beat-level, not a look-level field.
- **Surfaces = slab faces.** No cards, buttons or pills appear; all three kinds are the slab: flat fill, no gradient
  lift, no border, no highlight, no shadow, no under-glow, square corners (`radius` 0 — a pill in this look is a bar).
  The slabs' per-face *hue* gradients (e.g. `#5A84F1` → `#8B86EF`, `#A583E4` → `#C76BA5`) have no schema field; only
  `TextStyle.gradient` (T7) can carry a gradient, so slab numerals would need a rect gradient fill to match.
- **Type.** Display 750 / headline 700 from stem÷cap 0.143–0.175; body and label are not in the clip, set to 600 (the
  Gemini wordmark, the lightest stroke measured, 0.131–0.141). `scale` 1.5 / 1.45 because the hero em is 0.23–0.28 H
  and the section titles 0.14 H. Tracking −0.035 / −0.03 em relative to Inter (o–o gaps of 0.01–0.02 em). textAlpha 1
  everywhere (pure `#FFFFFF`). No all-caps copy: `label.uppercase` left at the schema default.
- **Motion.** `cut`; the polarity flips are 0.3–0.4 s slab wipes (closest schema analogue: a curtain in the inverse bg
  colour, `#FFFFFF` entering a black beat and `#000000` entering a white beat). `bloom` 0. `cameraDrift` 0: the Gemini
  and Android holds keep a constant bbox width (174 / 194 px) and cap height; the hold motion is a vertical rise of
  ~2–3 px per 100 ms with a fade, which is a text-enter/exit pattern, not a camera push.

## Not expressible yet (candidates for schema fields)
- Per-beat polarity flip (bg/text swap) with the slab-wipe transition and its blue/red leading edge.
- Rect / slab gradient fills (per-slab hue gradients, direction top→bottom) and the 3D extrusion with a darker side
  face (S11 has `extrude` for text only).
- Drifting light field: lobe positions animate across a white beat.
- The phone outline at t = 24–27.5: a rounded dark body with a thin violet-to-pink gradient rim light (`radius` ≈ 0.1 of
  height) — the only rounded surface in the clip, not used for the surface spec.
- Text beat enter/exit: fade over ~0.3 s combined with a continuous upward slide of ~0.065 H per hold.
