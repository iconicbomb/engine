# light-blueprint — measured from R4 (Backboard.io explainer, 15 s, 736×414 source)

## The look in words
A near-white page (#FDFDFD) with one flat primary blue (#007BFA) and pure black type. Nothing glows and nothing
blooms: emphasis is colour, not light — black headlines with a blue colour-sweep over a word, a blue pill with white
text, a black→blue gradient wordmark. Surfaces are white on white; what makes them read is a soft blue-grey shadow
(≈#285AC8 at 15–20 %) that sits to the bottom-right, with the top and left edges almost invisible, like a sheet lit
from the top-left. Pills are rounded (radius ≈ 0.4 of height) with a faint white→light-blue vertical gradient; the
accent pill is perfectly flat with a faint blue halo. Two soft accent hazes bleed in from the top-right and
bottom-left corners (the only "field" element), breathing slightly from beat to beat. Grey-grid texture is
barely there. Transitions are hard cuts; the camera never drifts during holds. The "accent background" used for the
UI-mockup section (8.5–12 s) is the accent itself, graded diagonally from #007BFA (top-left) to about #0D45BD
(bottom-right); the mockup floats on it as a white, slightly translucent, tilted plane.

## Frames measured
Extracted with ffmpeg at t = 0.0, 0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 5.5, 6.0, 6.3, 6.5, 6.7, 7.0, 7.3, 7.5,
8.0, 9.0, 10.0, 11.0, 11.9, 12.0, 12.1, 12.2, 12.3, 12.5, 13.0, 13.3, 13.5, 13.6, 14.0, 14.3, 14.5, 14.6, 14.8, plus
one-frame steps around 7.9–8.07 and 11.90–12.03 for the transitions. White-section measurements come from 0.2, 1.0,
4.0, 6.0–7.5, 12.2, 13.0, 14.0, 14.8; 8.0 and 12.0–12.1 are transition frames and were used only to time the cuts.
All px values in the pack are scaled ×2.609 to 1080 tall; the evidence strings quote source-frame px.

## What the schema cannot express (add later)
- **Light-mode glows are tints, not light.** The corner hazes darken the white toward the accent (luminance 253→176
  at the corner). The runtime's additive glow would clip to white on this bg; they need a multiply / "tint toward
  colour" compositing mode. The numbers in `field.glows` are the measured extents and strength (0.30 = 77/255).
- **The intro "blueprint guide" grid is a device, not a field grid.** 0–1.5 s: dark (#2F2F2F) 1 px lines with small
  crosshair ticks at the intersections frame the hero word and tighten around it as the camera zooms out (cells
  496×212 px at t=0.2 → 264×60 px at t=1.0 in the 736-wide frame). Not square, not static. The pack's `field.grid`
  is the faint resting grid seen in the wire-fan beat (116 px, grey at ~6 %); the brief expected a grid at t=12.2 but
  none is present there (column/row profiles flat within ±0.5 level) — honest reading: the grid is a hook-beat
  device plus a near-invisible texture, not a constant.
- **Shadow x-offset.** Card and pill shadows sit bottom-right (≈+4 px x, +4 px y at 1080); the schema has only
  `shadowY`. The top/left edge is ≈0.02 alpha, the bottom/right ≈0.25 — encoded as borderTop/borderBottom, but the
  left/right asymmetry is lost.
- **Tinted gradient.** White pills grade white → light blue (252,252,252 → 236,244,252), i.e. hue shifts, not just
  lightness; `lift` only models the +0.03 L.
- **Accent background section.** Diagonal gradient #007BFA → #0D45BD (accent2) behind the tilted UI plane; the plane
  is white at ~90 % with the blue showing through its body (card top-left sampled (227,235,249)); dark navy
  "Apply" button (≈#1E2A3A, white text) and light-grey "Reset" button inside the mockup. No schema slot for a per-
  section bg or translucency.
- **Ripple pill bands** (S2): core #007BFA, then accent at alpha 0.86 / 0.72 / 0.57 / 0.35 / 0.14 over white — a
  decaying-alpha series, not the current nested-band defaults.
- **Hero gradient text.** "Connect" / "Backboard.io" are black→accent gradients across the run, reading
  left-to-right (black→blue on "Connect", blue→black on "Backboard.io"); T7's `gradient` can take #000000→#007BFA.
- **Wires**: thin grey-lavender lines (≈#92929F) with accent dots, converging on the hub card — a wire stroke
  colour that is neither text nor accent.
- **Section-change behaviour.** Hard cut (1 frame) from the blue section to white; the mockup's entry fills the
  frame with accent from the bottom as the plane rises (~4 frames), closer to a curtain in `accent` moving up than
  to a crossfade; the pack's default stays `cut` because that is what the other two section changes are.
- **Type**: font is a geometric grotesk close to Inter (double-storey a, flat-cut t); measured weights are mid
  (display/headline ≈600, body/label ≈500), tracking ≈default, labels sentence-case. Hero sizes vary a lot
  (Connect 0.136 H settled, wordmark 0.236 H) so `scale` is left at 1. Text alpha for the small pill labels is
  ≈0.85 of black (dark slate (36,44,54)); `muted` (#8A93A6) comes from the mockup's sub-label and is approximate.
- **Camera**: no drift during holds, but the hook has a dramatic 2× zoom-out over the first second (hero cap
  height 86 → 42 px) and the wire-fan beat slides its contents up ~14 px/s — layout motion, left to macros.
