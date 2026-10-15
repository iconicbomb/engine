# Reference segments per macro (gate H)

Each macro is gated against the clip it was measured from: cut the segment, build a fixture that reproduces the
segment's content at the reference's layout, render, and `python tools/compare_frames.py <ref segment> <render>`.
Floors: mean SSIM >= 0.80, min >= 0.65 (R3 keeps 0.85 / 0.70). Times are seconds in the uploaded clips
(`fixtures/refs/R<n>.mp4`; R3 is committed, the others live in Niloy's reference folder — copy them in, they are not
committed). A macro row gets its number in the table at the bottom; a macro is not done until it has one.

| Macro | Clip | Segment | What the segment contains | Notes for the fixture |
|---|---|---|---|---|
| T1 scramble typewriter | R3 | 0.3 – 2.0 | "What does it take to build an" typed with scramble, glass caret, bloom | the R3 fixture already is this (0.883 / 0.758) |
| T2 tail typewriter | R5 | 15.0 – 17.0 | "What's new in our support conversations?" with the orange 6-char tail | dark input field behind the text (a `card` rect) |
| T2 (slow, 1-char tail) | R7 | 4.0 – 6.5 | "Rising freight costs" at ~15 cps, yellow caret | cream background, counters ticking beside it |
| T3 fit-to-width | R4 | 12.5 – 15.0 | "Backboard.io powers best-in-class RAG" shrinking per word | step shrink ~15 % per append |
| T4 word append | R4 | 3.0 – 4.5 | "with portable …" words popping in beside the pill | 200–270 ms per word |
| T4 word append | R7 | 24.0 – 25.0 | "Leaves you with less control" | over the globe line chart |
| T5 brackets | R3 | 1.1 – 2.3 | [ ] pair springing with the growing line | in the R3 fixture |
| T6 colour sweep | R4 | 0.0 – 0.5 | "Connect" blue window sweeping | white background |
| T7 gradient settle | R6 | 2.0 – 3.5 | "Made by Google" pink→purple gradient stacked, settling to white, dropping out | black background |
| T8 slant settle | R6 | 0.0 – 2.0 | "Made by" (sheared → upright) swapping to "Google" | black background |
| T9 glyph-anchor morph | R6 | 7.0 – 10.0 | "Google Pixel" fading to "ix" then re-casing to "IX" | ends as the slab numeral enters |
| T10 echo trail | R4 | 0.5 – 1.0 | "Connect" copies stacking vertically as it recedes | white background, blueprint grid |
| T11 tracking contraction | R4 | 7.8 – 8.5 | "production-ready" tracking in | white background |
| T12 3D reveal | R3 | 2.4 – 3.2 | "AI Agent?" popping in | in the R3 fixture |
| T13 logo-anchored typewriter | R5 | 5.0 – 7.0 | "ElevenLabs MCP — Claude" lockup typing out of the marks | black background |
| T13 wordmark wipe | R7 | 36.5 – 37.5 | "pando" wiping out of the mascot | green background |
| T14 scroll sections | R1 | 8.0 – 14.0 | section headline + body sliding in with the scroll | screen capture; the grid is the site's |
| S1 card rise (perspective) | R8 | 1.0 – 3.0 | chat window rising in perspective, content populating | neon field behind it (S15) |
| S1 card stack (overshoot) | R8 | 4.0 – 5.5 | message bubbles stacking | the glow rect → bubble morph at 4.5 is not modelled |
| S1 dashboard | R9 | 1.0 – 3.5 | dashboard rising, children populating over 1 s | god-rays (S15) behind |
| S2 ripple pill + counter | R4 | 1.0 – 3.0 | "15,267+ LLMs" counting to 17,000 inside the banded pill, shockwave | blue bands on white |
| S3 hover-fill card | R7 | 12.0 – 16.0 | avatar cursor entering Outsourcing / In-House cards, fill + row wipes | cream background, green fill |
| S4 jump cuts | R5 | 9.0 – 13.0 | wide → close hard cuts around the "+" and "Browse connectors" | cursor scaled with the shot |
| S5 giant cursor | R5 | 9.5 – 14.5 | cursor path, pause, click; hover background; press dip | 2× cursor |
| S5 toggle click | R7 | 32.0 – 35.0 | cursor clicking the In-house / Outsourcing toggle | yellow glow behind |
| S6 ticker list | R5 | 0.0 – 1.5 | agent list stepping up one slot | black background |
| S7 collapse-to-orbs | R5 | 1.5 – 4.0 | labels collapsing, icons drifting apart as blurred spheres | ends in the orange cloud |
| S8 wire fan | R4 | 4.5 – 6.0 | wires fanning from the logo to the pill rows, dots travelling | dots not modelled yet |
| S9 pill marquee | R4 | 5.5 – 8.0 | three rows of question pills popping and scrolling | white background |
| S10 tilted UI | R4 | 8.5 – 12.0 | model picker on a tilted plane, dolly + pan, cursor clicks | blue background |
| S10 tilted UI | R7 | 53.0 – 55.0 | dashboard screens tilting and panning | cream background |
| S11 slab numerals | R6 | 10.0 – 13.0 | "IX" → "VIII" slabs assembling, fly-through at 12.3 | per-slab gradients not modelled |
| S12 stroke morph | R6 | 14.3 – 15.0 | VII → VI strokes | light background |
| S13 curtain wipe | R7 | 16.5 – 17.5 | green curved edge sweeping to the globe scene | the curved edge is not modelled (straight panel) |
| S14 smear cut | R8 | 3.3 – 3.8 | one-frame vertical smear into the next scene | neon field |
| S15 glow / neon | R8 | 0.0 – 1.0 | "AI chatbot" title in the neon arc with sparkles | phase 6 real glow pipeline |
| S16 mascot | R7 | 36.0 – 39.0 | Pi dropping in, bobbing, blinking, wordmark wiping out | yellow glow behind |

## Per-macro SSIM (fill in as each fixture lands)

| Macro | Fixture | Segment | mean SSIM | min SSIM | Status |
|---|---|---|---|---|---|
| T1 + T3 + T5 + T12 + S15 | r3-hook | R3 0.0 – 3.2 | 0.883 | 0.758 | PASS |
| (all others) | — | — | — | — | not yet gated: the demo fixtures were built from the spec rows, not against the clips |
