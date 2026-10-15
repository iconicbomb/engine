# Style pack `dark-neon` — R3 (AI Agent), R8 (Doks.ai), R9 (NeuraFlow)

Pack file: `packages/graph/packs/dark-neon.json`. Measured from 736x414 frames of the three clips; px figures below are
at that size unless marked "at 1080".

## The look in words
A near-black stage (#010519, not grey) lit from below by one deep royal-blue glow (#0A2EDC hue 229°) that peaks at the
bottom edge and a weaker echo at the top edge; the corners stay black. White type sits in the middle and blooms in a
soft light-blue (#8FBBFF) halo as it lands; R3's hero glyphs carry a faint white-to-lavender vertical gradient. UI is
dark blue glass: panels and cards in #212A5E-ish fills that are slightly lighter at the top, a hairline white edge that
is brightest along the top, no drop shadows (nothing would show on this background), fully round pills and buttons.
The brand accent is a light blue (#8FBBFF) with a cyan second accent (#4AC8FA) for filled buttons; dark hue-matched
text sits on bright accent fills. R8 proves the family takes any hue: its field, borders and buttons are neon green
(#2DF39A, glow #168165) on a navy-grey #0C0F1A, with the same structure. Section changes are hard cuts with a frame or
two of vertical motion blur (R8); R9 never cuts, it slides the next thing in and slowly pulls the camera back.

## Frames measured
- R3: t = 0.55 (typing bloom), 1.0, 1.5, 2.0 (fitted question line in brackets), 3.0, 3.5 ("AI Agent?" hold);
  contact sheet at 2 fps; per-frame luminance 3.4–3.9 s for the cut.
- R8: t = 0.5 (title), 3.0 (card stack), 4.0 (search bar), 5.5 (user pill on the grid), 6.5, 7.0 (answer card);
  per-frame tiles 4.3–5.1 s.
- R9: t = 0.5 (NeuraFlow + halo), 1.5, 2.5 (dashboard + side card), 3.5, 4.5, 5.0, 5.5, 6.0, 6.3, 6.5; per-frame
  tiles 0.9–1.5 s and 4.2–4.8 s.
- Grain and vignette from flat background patches of each; grid from column/row high-pass of R8 t=5.5/7.0 and R9 t=0.5.
- Type weights from stroke-width ÷ cap-height, calibrated by rendering Inter-Variable at the same cap height and
  running the identical metric (so antialiasing at 736 px is accounted for). Tracking from measured line width vs
  Inter's natural width at that cap.

## Things the schema cannot express (candidates for later fields)
- **R8's neon borders**: cards and pills are edged in an accent-tinted 1 px line (#60A591 over a #202020 fill) with a
  2–3 px outer accent glow at ~0.4 alpha — a border glow, not an under-glow. The pack keeps R9's white borders; a
  `borderGlow { color, alpha, blur }` on SurfaceSpec would hold R8's version.
- **R8's card fill fades out**: the answer card is #202020 at the top and dissolves to the background at the bottom —
  an alpha gradient rather than a lightness one (written as lift +0.05).
- **R8 message bubbles** are rounded rects at radius 0.14 of their height; the pack's `button` (0.5) comes from the two
  real buttons (R8/R9 "Ask AI"), so chat bubbles auto-classified as buttons will be rounder than R8.
- **Grid**: R3 has none, so the pack writes no grid. R8 draws a faint white grid (alpha ~0.06–0.10) with cells
  89 x 64 px here = 232 x 167 px at 1080 — square cells foreshortened on R8's tilted plane; R9's is 82 px = 214 px at
  1080. If a graph wants it: `{ color: #FFFFFF, alpha: 0.08, spacing: 224 }`.
- **R9's field extras**: a bright halo ring (peak #2942CD) behind the dashboard, god-rays from the top centre, a
  starfield in the ring and a blurred copy of the UI as backdrop; R8 has sparkles and a central teal blob
  (#168165 at (0.5, 0.27)) rather than edge glows. The pack's two-glow profile is R3's.
- **Camera pull-back**: R9 recedes ~3–4 %/s during holds (dashboard tracked at scale 0.97/s and 0.96/s).
  `cameraDrift` is push-only (min 0), so the pack says 0; a signed drift would carry R9.
- **R3 hero gradient**: "AI Agent?" glyphs run white at the top to ~#8790BA at the baseline (T7-style gradient fill
  on the display role), and the text recedes/shrinks during its hold before the cut.
- **R9's filled button** has a bright band near its *bottom* edge (#64D7FB inside #43CDFF) and a left-to-right
  lightness gradient (#4AC8FA → #9EDEFA); SurfaceSpec only has a vertical lift and a top highlight.
- **Shadows** are genuinely absent in all three clips; the look-layer default (45 % black) should be off for this pack.
- **R8's typeface** is not Inter (its body tracks ~0.06 em tighter than Inter at the same cap); R9's display face
  sets ~0.05 em wider. The pack's tracking follows R3 (Inter-like, +0.01–0.02 em).
