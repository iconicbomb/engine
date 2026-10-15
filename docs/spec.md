<!-- Exported from the Claude Doc "Script-to-SaaS-Video Engine Spec" on 2026-10-15. The doc is the editable original;
     this copy exists so Claude Code sessions can read the spec. Re-export when the doc changes. -->

# Script-to-SaaS-Video Engine Spec

Oct 15, 2026 · @Niloy

Eleven reference clips (5.6 min of footage, analysed frame by frame at 15–30 fps, plus pixel-level glow measurements) reduce to 14 text devices, 16 shape/UI devices, one glow pipeline and one scene grammar; this spec turns them into a product that takes a client's website URL plus a script and outputs an editable, native-vector SaaS video.

## The eleven references at a glance

Only 61 hard cuts exist across 5.6 minutes of footage, and 34 of those are in the two brand films (R10, R11) that cut on the beat of a music track; in the product explainers almost everything is continuous transformation (morph, slide, camera move, cross-dissolve), which is the single biggest reason they read as premium. Clips are labelled R1–R11 in upload order.

| Ref | Product / source | Style family | Length | Hard cuts | Signature devices |
| --- | --- | --- | --- | --- | --- |
| R1 | Dala (website scroll capture) | Dark particle-web, scroll-driven | 30 s | 0 | Particle brain → lightbulb → globe morphs; section text slides in with scroll; team cards; investor logo scatter |
| R2 | Earth / climate landing page | Dark blue 3D globe, dotted map | 7 s | 0 | Globe tilt-zoom on scroll; search UI chips appear with stagger; content pushes globe down |
| R3 | "AI Agent" kinetic intro | Dark glow → white minimal | 5.4 s | 1 | Scramble typewriter; fit-to-width shrink; bracket / brace framing; 3D letter reveal; word-by-word append |
| R4 | Backboard.io explainer | Light blue, grid + ripple | 15 s | 0 | Colour-sweep wordmark; echo trail; ripple pill with live counter; word stream; icon with bezier wires; pill marquee; 3D tilted UI; sentence that shrinks as it grows |
| R5 | ElevenLabs MCP × Claude | Near-black product demo | 46 s | 0 | Ticker list; cards → floating orbs; logo-anchored typewriter; hard jump-cut zoom levels; giant cursor; tail-highlight typing; permission UI |
| R6 | Made by Google countdown | Black / white, 3D slabs | 31 s | 4 | Variable-font slant settle; gradient→white settle; glyph-anchor morph ("Pixel" → IX); roman numerals as 3D slabs; camera fly-through; light/dark flips |
| R7 | Pando.ai logistics explainer | Warm cream + deep green, mascot | 2:06 | 18 | Yellow-caret typewriter; live $ tickers; hover-fill cards; avatar-as-cursor; curtain wipe; mascot with idle life; UI tilt-and-pan; chapter titles; document stacks |
| R8 | Doks.ai chatbot | Dark teal neon glow | 7.5 s | 1 | Gradient title; perspective UI rise; motion-blur smear cut; card stack with overshoot; echo rings; glow-rect → bubble morph; grid + diamond sparkles |
| R9 | NeuraFlow dashboard | Dark blue glass, god-rays | 6.7 s | 0 | Sparkle logo; light beams + halo; dashboard rises and self-populates; segmented progress line; camera pull-back revealing watermark title |
| R10 | Framer brand film | Blue / black / white, 3D glass, grid | 16 s | 8 | Logo built on a blueprint grid; emissive light streak; white halo bloom; blue flash with afterglow; glass refraction logo; wordmark tracking; palette bars; product mockups |
| R11 | ElevenLabs Flows Agent | Orange volumetric cloud + white canvas | 49 s | 6 | Grainy cloud background; prompt box typing; agent "thinking" log; node-graph canvas with wires; gallery grid collapsing into a feathered orange disc that expands into the cloud scene; gradient text |

Two of the eleven (R1, R2) are screen recordings of live websites, not rendered videos: they show what the engine must be able to *extract* from a client's site, while the other seven show what it must be able to *render*.

## Text animation pattern library

Fourteen distinct text devices appear; every one of them is a composition of six primitives (per-glyph opacity, per-glyph transform, container scale-to-fit, colour over time, caret, and glyph substitution), so the engine needs those six primitives and a preset layer, not fourteen hand-built effects.

| # | Device | Seen in | Mechanics (what actually moves) | Measured timing | Engine parameters |
| --- | --- | --- | --- | --- | --- |
| T1 | Scramble typewriter | R3 | New char first appears as a random symbol (# % \* @ ! <), resolves to the real glyph 1–2 frames later; leading edge carries a soft bloom | 26 chars/s; scramble hold 33–67 ms; bloom radius \~1 em | cps, scrambleFrames, symbolSet, bloomRadius |
| T2 | Plain typewriter with tail highlight | R5, R7 | Last N chars tinted brand colour (orange R5, yellow R7) and decay to body colour as they age; blinking caret | R5: 30 cps, tail = 6 chars; R7: 15 cps, tail = 1 char; caret blink 500 ms | cps, tailLength, tailColor, tailDecayMs, caretStyle |
| T3 | Fit-to-width shrink | R3, R4, R5, R7 | Text container scales down continuously as characters are added so the line always fits a fixed box; the camera appears to "zoom out" | R3: scale 3.0 → 1.0 over 0.45 s; R4: step shrink per word (\~15 % per append) | fitBox, minScale, perWord vs perChar, easing |
| T4 | Word-by-word append | R4, R7 | Whole words pop in at the line end with fade 30 % → 100 % and a 20 px slide-left; sentence recentres on each append | 200–270 ms per word; 4 words/s | wordGapMs, slidePx, fade, recenter |
| T5 | Bracket / brace framing | R3 | \[ \] or { } bracket pair tracks the text extents; closing bracket springs outward when a word is added, then settles | Bracket settle 300 ms with \~10 % overshoot | glyphPair, padding, springDamping |
| T6 | Colour sweep | R4 | A 4-letter-wide gradient window sweeps left → right across the glyphs, then recedes; also used as "keyword highlight" when it stops on a word | 0.4–0.5 s per sweep; window = 4 glyphs | windowGlyphs, direction, sweepMs, holdOnKeyword |
| T7 | Gradient → white settle | R6 | Word enters in a 2-colour gradient (pink → purple), desaturates to white over the hold; exit drops opacity and y | Enter 270 ms, settle to white 500 ms, hold 600 ms, exit 200 ms; per-char y stagger 30 ms | enterGradient, settleMs, exitDrop |
| T8 | Variable-font slant settle | R6 | "Made by" enters italic/sheared and un-shears to upright; swap-out re-shears; reads as a font axis (slnt/ital) not a transform | Shear-in 270 ms; swap 200 ms | axis (slnt, wght, wdth), fromValue, toValue |
| T9 | Glyph-anchor morph | R6 | Old string fades out glyph by glyph left → right until only the glyphs shared with the new string remain ("Pixel" → "ix" → "IX"), then those re-case/scale into the new word | Fade sweep 1.5 s; case morph 200 ms | shared-glyph detection, sweepDirection, sweepMs |
| T10 | Echo / ghost trail | R4 | 4–5 copies of the word stack vertically at decreasing opacity as the word shrinks and recedes | 400 ms; copies at 60/40/25/15 % | copies, axis, spacing, opacityFalloff |
| T11 | Tracking contraction | R4 | Letter-spacing animates from very wide (≈ +0.6 em) to normal as the label lands | 500 ms ease-out | fromTracking, toTracking |
| T12 | 3D letter reveal | R3 | "Agent" appears instantly at 1.3× with extruded depth and slides to 1.0× while "AI" leads in from the left | 200 ms | depth, fromScale, leadWord |
| T13 | Logo-anchored typewriter | R5, R7 | Logo mark splits/widens and the wordmark types outward from it; reverses by un-typing from the right | Type 400 ms, un-type 270 ms; R7 wordmark wipe 130 ms | anchorMark, direction, reverseMs |
| T14 | Scroll-bound section text | R1, R2 | Headline + body slide in from the side and fade with scroll position; strict grid alignment to a 12-col web layout | \~400 ms per section at normal scroll speed | scrollRange, offsetPx, columnSnap |

Two rules hold across every clip. First, **one text animation at a time**: no clip ever animates two text blocks simultaneously; secondary text (sub-labels, captions) simply fades. Second, **the fresh part is always marked**: whatever just changed is brighter, coloured, bigger or glowing for 100–500 ms, then settles to the body style. That "freshness decay" is the device the eye reads as polish.

## Shape, UI and scene pattern library

Sixteen non-text devices recur; the expensive-looking ones (3D slabs, fly-through, particle morphs) appear once each, while the cheap ones (card rise, hover fill, pill, counter, cursor) carry 80 % of screen time, so the engine should be excellent at the cheap set first.

| # | Device | Seen in | Mechanics | Measured timing | Engine parameters |
| --- | --- | --- | --- | --- | --- |
| S1 | Card / panel rise | R8, R9, R7 | Element enters from below (60–120 px), ease-out, no overshoot, often in slight 3D perspective; internal content populates 100–300 ms after the frame lands | R8 stack: 600 ms expo-out, 70 ms stagger per card; R9 dashboard: 600 ms then 1.0 s of child population | fromY, perspectiveDeg, childStaggerMs |
| S2 | Ripple pill with counter | R4 | Rounded pill with 5–6 concentric opacity bands; a number inside counts up linearly then snaps; a white shockwave ring fires on the final value | Pill slide-in: spring, \~40 % overshoot, settles 330 ms; counter 1.07 s linear (133 units/frame); shockwave 400 ms | bands, counterFrom/To, countMs, pulseOnComplete |
| S3 | Hover-fill card | R7 | Cursor (here a circular user avatar) enters a card; card fills brand colour in 2 frames; pros/cons rows wipe in left → right with 40 ms stagger | Fill 130 ms; rows 300 ms total | fillColor, rowStaggerMs, cursorStyle |
| S4 | Jump-cut coverage | R5 | No zoom animation: hard cut between wide / medium / close-up framings of the same UI, cinema-style; cursor is scaled to match the shot | Cut on action (click) ; close-up holds 0.8–1.5 s | shotSizes \[wide, medium, close\], cutOnEvents |
| S5 | Giant cursor + hover states | R5, R7 | Cursor moves on an ease-in-out path, pauses 150 ms before click; target gets hover background, then pressed scale 0.96 | Move 400–600 ms; hover 100 ms; press 80 ms | cursorSize, pathEase, hoverStyle |
| S6 | Ticker list / slot scroll | R5 | Vertical list where items slide up one slot at a time and the exiting item fades | 330 ms per step, 2–3 steps | stepMs, itemHeight |
| S7 | Collapse-to-orbs | R5 | Row labels shrink to width 0 leaving the leading icon; icons break out of the list and drift apart as depth-blurred spheres | Collapse 200 ms; drift 900 ms with DOF blur ramp | collapseMs, driftRadius, dofBlur |
| S8 | Bezier wire fan | R4 | 8–12 curves draw from a node outward in both directions; small dots travel along them continuously | Draw 400 ms; dots 1.5 px/frame | wireCount, drawMs, dotSpeed |
| S9 | Pill marquee grid | R4 | 3 rows of pills pop in with scale stagger, then rows scroll in alternating directions forever | Pop-in 600 ms for all; scroll \~40 px/s | rows, direction alternation, speed |
| S10 | Tilted 3D UI with pan | R4, R7, R9 | Real UI screenshot or rebuilt UI on a plane rotated 10–25° Y, 5–10° X; slow dolly + pan; cursor clicks happen on the plane | Dolly \~2 % scale/s | rotX, rotY, dollyRate, depthOfField |
| S11 | 3D slab letters + fly-through | R6 | Each stroke is an extruded board with its own gradient; strokes rotate about Y to assemble the next numeral; camera flies between slabs to cut to a new background | Scale-up 800 ms cubic in-out; slab assembly 400 ms with 70 ms stagger; fly-through 400 ms | extrude, slabGap, cameraPath |
| S12 | Glyph-shared morph (shape) | R6 | Strokes of X become V + I; strokes are the shared unit, not the glyph | 500 ms | strokeMatching |
| S13 | Curtain / edge wipe | R7 | Scene changes behind a curved edge sweeping up or sideways, 1–2 frames of edge blur | 130 ms | edgeCurve, direction |
| S14 | Motion-blur smear cut | R8 | One frame of extreme vertical blur bridges two scenes (a directional blur transition) | 1 frame at 30 fps + 100 ms settle | axis, blurPx |
| S15 | Glow / neon environment | R8, R9 | Brand-colour bloom under UI, god-rays from top, halo arc, diamond sparkles, drifting bokeh | Continuous; bokeh drift 10–20 px/s | bloomColor, rayCount, sparkleDensity |
| S16 | Mascot with idle life | R7 | Character blinks every 2–4 s, bobs ±3 px, sparkles on emphasis; drops in with bounce; wordmark wipes out of it | Drop 200 ms + bounce; blink 100 ms | idleBob, blinkInterval, sparkleOnEmphasis |

Particle systems (R1: brain → lightbulb → globe → swirl; R7: scatter) are a separate, optional subsystem: a point cloud that interpolates between target shapes with per-point noise. It is spectacular but unnecessary for 8 of the 9 references and should be phase 3.

## Deep glow, reverse-engineered

The glow in R10 (Framer) is a plain Gaussian of an over-bright source, computed in linear light, added to the scene, clipped, and dithered; nothing exotic. It looks "deep" because of four choices that most glow setups get wrong, and every one of them is measurable in the frames.

| Measurement (R10 at 720 px) | Value | What it tells the engine |
| --- | --- | --- |
| White halo radial profile (t = 5.10 s) | Core clipped at 255 to r = 48 px; 50 % at r = 98, 10 % at r = 180, reaches 0 at r ≈ 264 | A single Gaussian with σ ≈ 83 px (11.5 % of frame height) predicts 50 % at 98 and 10 % at 178: the shape *is* a Gaussian of a source brighter than white |
| Blue flash profile (t = 6.00 s) | Flat top (lum 131–140) to r = 130, then 50 % at 170, 10 % at 206 | A large emissive disc blurred with σ ≈ 35 px: the flash is area light, not a point |
| Blue afterglow (t = 6.10 s) | 50 % at 148, 10 % at 218 | Wider than one Gaussian explains: a sum of two (σ ≈ 60 and σ ≈ 150), the classic multi-radius bloom |
| Colour along the blue falloff | R:G:B stays 1 : 6.4 : 10 from core to tail (18,162,253 → 24,92,148); core has B = 255 with R = 6 | Hue is preserved and clipping happens per channel in linear light; the glow never turns white or pastel because it is never screen-blended in sRGB |
| White halo colour | Saturation 0.00–0.02 everywhere | A white glow is white only because the source is white |
| Gradient smoothness | Plateau run length mean 1.6 px (max 8–15); 251 distinct 8-bit levels inside the halo; high-pass noise σ = 1.9–3.6 levels in the glow, 0.02 in flat black | Dither or grain of 1–2 levels was added before 8-bit quantisation; a clean 255 → 0 ramp over 260 px would otherwise show 4–5 px bands |
| Flash timing | Rises in 1–2 frames at 60 fps (≤ 33 ms); decays over \~600 ms; radius shrinks as it decays | Attack is instant, decay is exponential (half-life ≈ 150 ms); the wide layer fades first, the tight layer last |
| Light streak (t = 4.5–4.95 s) | Emissive bar with a one-directional smear ≈ 40 % of frame along its travel axis | Directional (1-D) Gaussian along motion, not radial |
| R11 orange disc edge (t = 41.3 s) | Solid to r = 70; 90 % → 10 % over r = 76 → 140 | A feathered circular mask with σ ≈ 25 px (6 % of frame height); the content inside is defocused and sharpens as the mask grows |
| R11 background grain | High-pass σ = 5.6 levels across the whole frame | Heavy film grain is a style choice here; it also makes banding impossible |

The four choices, as rules for the engine:

1. **Linear light, additive.** Convert sRGB to linear, give the emissive source an intensity of 2–8× white (that is what produces the clipped core and the long tail at the same time), blur, *add* to the scene, then tone-map with a soft shoulder and convert back. Screen or Add on 8-bit sRGB values is what produces grey, pastel, edged glows.
2. **Multi-radius, not one blur.** Sum 4–5 Gaussians at doubling radii (e.g. 1.5 %, 3 %, 6 %, 12 %, 24 % of frame height) with weights falling roughly 1 : 0.8 : 0.6 : 0.4 : 0.25. The small radii give the bright rim, the large ones give the "deep" ambient; the measured profiles are exactly this mix. Implement as a downsample/upsample mip chain (13-tap down, 3×3 tent up) so the 24 % radius costs the same as the 1.5 % one.
3. **No bounds, no ramps.** Blur on a canvas padded by at least 3σ of the largest radius so the glow is never clipped by the element's or layer's box (the "edging" that layer-bound glows produce), and let the Gaussian reach zero on its own; never cut the tail with a feather or an opacity ramp, which leaves a visible ring where the ramp ends.
4. **Dither before 8-bit.** Keep the whole chain in 16-bit float, and add ±0.5–1 LSB of blue noise (or 1–2 % film grain when the style wants texture) immediately before quantising to 8-bit. Encode at a high bitrate (CRF 16–18 or ProRes) because glow gradients are the first thing a codec bands.

Two secondary devices ride on the same machinery. The *afterglow* is the bloom's intensity on an exponential decay track with the wide layers keyed to fade before the tight ones, which reads as light "sinking back" into the object. The *ambient under-glow* seen beneath UI in R8, R9 and R10 is the same blur of the element's silhouette, tinted toward the brand colour or toward black, offset 2–4 % of frame downward, and *multiplied* rather than added; it is a shadow that borrows the glow pipeline.

After Effects translation for the `.jsx` export: a 32-bit float project with the working space set to linear (Project Settings → Color → Linearize Working Space), the emissive layers pre-composed at 1.5× the frame size so blur never meets a layer edge, four or five stacked Gaussian Blur effects at the radii above (or the commercial Deep Glow plugin, which is this exact stack in one effect) on an Add-mode duplicate, then Add Grain or Noise at 1–2 % as the last effect before a 10-bit ProRes 422 render. In the web runtime the same chain is a WebGL ping-pong blur over half-float framebuffers with a blue-noise texture sampled in the final pass.

## Timing and easing model

Three easing families cover everything measured; the engine ships these three as named presets and lets a style dial bias between them.

| Preset | Measured on | Shape of the curve | CSS / spring equivalent | Use for |
| --- | --- | --- | --- | --- |
| `settle` | R8 card stack (top edge: 210 → 158 px over 18 frames, deltas 10-8-6-4-4-3-2-2-2-1-1…) | Pure ease-out, no overshoot, long tail | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) | Cards, panels, UI entering; anything that must feel solid |
| `emphasis` | R6 "IX" scale-up (bbox 41 → 211 px over 24 frames, peak velocity at frame 9 ≈ 35 % of the move) | Cubic in-out, out-side longer than in-side | `cubic-bezier(0.5, 0, 0.1, 1)` | Hero scale-ups, numerals, logo reveals |
| `bounce` | R4 pill slide-in (width 272 → 466 overshoot → 328 rest in 10 frames) | Spring, \~40 % overshoot, one visible oscillation | spring(stiffness 170, damping 14, mass 1) | Pills, chips, brackets, mascot drop, anything playful |

Durations cluster tightly, which is why the clips feel like one genre even though they come from six studios:

| Thing | Typical | Range seen |
| --- | --- | --- |
| Element enter | 400 ms | 200–600 ms |
| Element exit | 200 ms | 130–300 ms |
| Hold on a headline | 1.2 s | 0.6–2.0 s |
| Hold on a UI close-up | 1.0 s | 0.8–1.5 s |
| Per-item stagger (cards, rows, pills) | 70 ms | 40–130 ms |
| Per-character stagger (kinetic text) | 30 ms | 20–40 ms |
| Typing speed | 26 cps | 15 cps (R7, deliberate) – 30 cps (R5, fast) |
| Word append cadence | 230 ms | 200–270 ms |
| Freshness highlight decay | 300 ms | 100–500 ms |
| Scene / beat length (explainer) | 3.0 s | 2–4 s (R6 numerals 3.0 s each; R7 chapters 2–4 s) |
| Cross-dissolve between scenes | 100 ms | 1 frame – 150 ms |
| Camera dolly / pan on a held UI | continuous | 1–2 % scale per second |

Three timing rules fall out of the data. Exits are always faster than enters (roughly half). Nothing animates linearly except counters and marquees, which are *supposed* to read as mechanical. Idle motion never stops: a held frame still has a dolly, bokeh drift, mascot bob or ticker running, so no frame is ever static for more than \~500 ms.

## Scene grammar

Every rendered reference follows the same seven-beat skeleton, so the script compiler can classify each script sentence into one of seven beat types and pick patterns from that beat's allowed set.

| Beat | Purpose | Allowed text devices | Allowed shape devices | Length | Example from refs |
| --- | --- | --- | --- | --- | --- |
| 1 Hook | Pose the question or name the product | T1 scramble, T7 gradient, T12 3D reveal, T8 slant | S15 glow, S11 slabs, S1 rise | 3–5 s | R3 "What does it take to build an AI Agent?"; R8 "AI chatbot" |
| 2 Pain | Show the mess | T2 typewriter, T4 word append | S1 card collage, S9 marquee, document stacks, scatter | 6–15 s | R7 collage + "Rising freight costs"; R1 "This is your workplace today" |
| 3 Reveal | Logo / mascot moment | T13 logo-anchored, T11 tracking | S16 mascot, S13 curtain wipe, S2 ripple pill | 2–4 s | R7 "Introducing Pi"; R6 "Made by Google" |
| 4 Feature loop (× N) | One capability per loop: title → UI → interaction → result | T2, T4, T6 keyword highlight | S10 tilted UI, S4 jump-cut coverage, S5 cursor, S3 hover-fill | 6–12 s each | R5 connectors flow; R7 invoices → overpayments; R4 model picker |
| 5 Proof | Number or comparison | T2 with counter, T6 | S2 counter, pros/cons cards, line chart draw | 3–5 s | R7 "100% Reliable"; R4 "17,000+ LLMs" |
| 6 Summary | Stack the benefits | T4 word append (list build) | S1 list rise with stagger | 3–5 s | R7 "Smarter decisions / Significant control / Customer experience" |
| 7 CTA | Tagline + logo + button | T3 fit-to-width, T9 glyph morph | S16 mascot → wordmark, S2 pulse rings | 3–5 s | R7 "Making logistics remarkable" → pando.AI + Book a demo |

The feature loop is where UI lives, and it obeys a **coverage rule** borrowed from film editing (clearest in R5 and R7): wide shot of the whole screen (establish) → cut or dolly to a medium shot of the relevant panel → cut to a close-up of the control being used → cut back wide to show the result. Cuts land on the action (the click, the send), never between actions. A feature loop that skips the close-up reads as a screen recording; one that has it reads as a produced video.

Continuity between beats is handled by **object hand-off**, not by cuts: the ship/plane/truck of R7's pain beat shrink into map nodes for the next beat; R5's list icons become the orbs of the next; R6's X strokes become V and I. The compiler should look for any object shared between consecutive beats and morph it rather than cutting.

## Style influence model

"Adjustable influence" works if each reference is decomposed into the same eight dials; a style is then a vector of eight numbers, and blending two references is a weighted average of their vectors plus a pick of which device sets to enable. Values below are the reference's position on each dial (0–1).

| Dial | What it controls | R3 | R4 | R5 | R6 | R7 | R8 | R9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Luminance | Dark ↔ light canvas | 0.3 | 0.95 | 0.05 | 0.5 | 0.85 | 0.1 | 0.1 |
| Glow | Flat ↔ neon bloom and god-rays | 0.6 | 0.2 | 0.0 | 0.5 | 0.3 | 1.0 | 1.0 |
| Dimensionality | Flat 2D ↔ 3D slabs, tilted planes, fly-throughs | 0.4 | 0.6 | 0.1 | 1.0 | 0.5 | 0.6 | 0.6 |
| Playfulness | Settle easing ↔ spring/bounce, mascots | 0.3 | 0.7 | 0.1 | 0.4 | 0.9 | 0.5 | 0.3 |
| Kinetic text | Static labels ↔ scramble, morph, slant, sweep | 1.0 | 0.8 | 0.4 | 1.0 | 0.5 | 0.3 | 0.2 |
| Product realism | Abstract shapes ↔ real rebuilt UI with cursor | 0.0 | 0.5 | 1.0 | 0.0 | 0.8 | 0.6 | 0.7 |
| Tempo | Slow holds ↔ rapid beats | 0.7 | 0.8 | 0.5 | 0.4 | 0.6 | 0.7 | 0.5 |
| Density | One element per frame ↔ collages and marquees | 0.1 | 0.6 | 0.3 | 0.1 | 0.8 | 0.5 | 0.7 |

How the dials bind to the engine:

- **Luminance** picks the canvas tokens (background, text, surface) from the client's own site palette; the crawler extracts both the light and dark variants where the site has them.
- **Glow** enables S15 and sets bloom intensity; above 0.5 it also adds an under-UI colour wash.
- **Dimensionality** sets default `rotY` on UI planes (0 → 0°, 1 → 25°), enables S11 slabs for numerals and big words, and enables the fly-through transition.
- **Playfulness** biases easing selection: below 0.4 everything uses `settle`; above 0.6 chips, pills and logos use `bounce`.
- **Kinetic text** gates T1, T6, T7, T8, T9 and T10; at 0 only T2, T3, T4 remain (typewriter and fit-to-width are always safe).
- **Product realism** decides how much of each feature loop is rebuilt UI versus abstract metaphor; at 1.0 the loop is UI only with jump-cut coverage.
- **Tempo** scales every duration in the timing table (0.5 → ×1.0, 1.0 → ×0.7, 0 → ×1.5).
- **Density** caps simultaneous on-screen elements per beat (1 → up to 12, 0 → 1–2).

A client preset is therefore: `weights over R1–R9` (sums to 1) → blended dial vector → overridden per dial if the client wants. Two useful house presets fall straight out of the data: **"Pando"** (R7 0.6, R4 0.4: warm, playful, dense, real UI) for product-led SMB explainers, and **"Neon"** (R8 0.5, R9 0.5: dark, glowing, 3D) for AI/dev-tool launches.

## Product pipeline

The client gives two things, a website URL and a script; the product gives back a finished video in which every element is still editable. Six stages sit between, and the scene planner is the one that encodes everything above (patterns, timing, grammar, style dials).

```
Website URL ──> Crawler (Playwright, DOM, CSS) ──> Site model (tokens · UI · copy) ──┐
                                                                                    │ which UI to show
Script (+VO/timing) ──> Beat compiler (7 beat types) ──> Scene planner (pattern+layout) <── Media slots (client image+video)
                                                               │ beats × patterns × style dials
                                                               v
                                   Anim compiler (scene-graph JSON) ──> Renderer (canvas/WebGL → MP4) ──> Editor + export (edit all · AE .jsx)
```

The crawler and the beat compiler run in parallel; the scene planner joins them, deciding for each beat which rebuilt UI (if any) to show, which text and shape devices to use, and where the client's own media slots belong. The animation compiler turns that plan into a scene-graph JSON (section below) that both the renderer and the editor read, so an edit never has to go back through the planner.

## Website ingestion and native UI recreation

The crawler's job is to leave the planner with a *site model*, not a folder of screenshots: design tokens, a component library rebuilt as vector/DOM primitives, the product's real copy and feature list, and the client's existing media. R1 and R2 show exactly what this looks like from the outside (a live site being scrolled); the engine has to get the same information from the inside.

| Stage | What it does | Output | Tooling |
| --- | --- | --- | --- |
| 1 Crawl | Headless browser loads the home page plus every nav link (depth 2), at desktop and mobile widths, light and dark if the site offers both; scrolls each page fully so lazy content and scroll animations fire | Rendered DOM + computed styles per page; full-page screenshots as ground truth only | Playwright (Chromium) |
| 2 Token extraction | Clusters computed styles into a palette (background, surface, text, accent, semantic), a type scale (family, weights, sizes, line-heights), radii, shadows, spacing steps, border styles; pulls fonts from @font-face or Google Fonts links | `tokens.json` (same shape the renderer consumes) | CSS parsing + k-means on colour, histogram on font sizes |
| 3 Component harvest | Detects repeating UI patterns by DOM/ARIA role and style signature: nav bar, hero, buttons, inputs, cards, tables, tabs, toggles, modals, charts, pricing grids, testimonials, footers; records each with its box geometry, children and text | `components.json`: a tree of boxes with tokens applied, plus states captured by hovering/focusing (hover, active, focus) | DOM walk + heuristics; an LLM pass labels ambiguous blocks |
| 4 Native rebuild | Each harvested component is re-expressed as engine primitives (rect, rounded-rect, text run, icon path, image slot) so it renders crisp at any resolution and every property is animatable; SVG icons and logos are copied as paths, raster images become media slots | Editable component library in the scene-graph format | Engine primitive set; SVG path import (TrimForge-style tracing for icons) |
| 5 Feature mining | Reads headings, feature grids, pricing tables, docs and screenshots to produce a list of features with: name, one-line claim, the UI that shows it, the component states involved (e.g. "Model picker: open dropdown, pick provider, apply") | `features.json` used by the planner to match script lines to UI | LLM extraction over the harvested copy |
| 6 Media harvest | Collects product screenshots, app-store images, videos, logos, team photos with source URL and licence hint; anything not clearly owned is marked as a placeholder to be replaced | `media.json` + slot suggestions | Asset fetch + dedupe |

Three constraints keep the rebuild honest. Pixel truth: every rebuilt component is diffed against its screenshot (SSIM) and anything under 0.85 falls back to a masked screenshot plane until a human fixes it, so a client never sees a broken rebuild. Interaction truth: hover, press and open states come from real DOM events during the crawl, not guesses, so S3/S5 interactions look like the product. Scope: the crawler rebuilds what the script needs plus the nav, hero and one card type, not the whole site; the feature list drives what gets rebuilt in depth.

Sites that are app-gated (login walls) need either a client-provided screen recording or screenshots; those become media slots and get the jump-cut coverage treatment (S4) over the real pixels rather than a native rebuild.

## Script-to-beats compiler

A script sentence carries three things the compiler needs: its *beat type* (which of the seven), its *claim type* (what kind of thing it asserts), and its *referents* (which product feature or object it names). The compiler tags each sentence, then the scene planner maps tags to patterns.

| Claim type in the sentence | Signal words / shape | Default text device | Default shape device | Example |
| --- | --- | --- | --- | --- |
| Question / hook | "What if…", "Why does…", ends in ? | T1 scramble or T7 gradient | S15 glow, slabs if 3D dial > 0.6 | "What does it take to build an AI agent?" |
| Pain / list of problems | Negative adjectives, "spent", "wasted", enumerations | T2 typewriter, T4 word append per item | Document stack, S9 marquee, scatter | "Rising freight costs. Complex operations." |
| Product name / reveal | Brand name first appears | T13 logo-anchored, T11 tracking | S16 mascot, S13 curtain | "Introducing Pi." |
| Feature + action | Verb + object that matches `features.json` | T2 title, T6 keyword highlight | S10 tilted UI + S4 coverage + S5 cursor | "Pick any of 17,000 models." |
| Number / proof | Digits, %, "x faster", comparatives | T2 with S2 counter | S2 ripple pill, pros/cons cards, chart draw | "100 % reliable." |
| Benefit list / summary | Three parallel nouns or short clauses | T4 list build | S1 rows with stagger | "Smarter decisions. Significant control." |
| CTA / tagline | Imperative, URL, "today", brand | T3 fit-to-width, T9 glyph morph | Pulse rings, button hover | "Book a demo." |

Timing comes from the script in one of three ways, in priority order: a voice-over file (word timestamps from forced alignment set every beat's length), explicit timing marks in the script (`[3s]`), or the reading-speed default (2.5 words/s plus the timing table's holds). Each beat is then given a length, and the planner fits patterns whose summed durations match it, stretching holds rather than animations when there is slack.

Two compiler rules come straight from the references. One idea per beat: a sentence with two claims becomes two beats, never one busy frame. Reuse before new: if a beat's referent (an object, a UI panel, a number) appeared in the previous beat, the planner schedules an object hand-off morph instead of a new entrance.

## Client media placeholders and editability

Anything the engine cannot generate natively (a founder photo, a real screen recording, a product video, a customer logo) becomes a **media slot**: a first-class node in the scene graph with geometry, timing, a fit rule and a styled placeholder, so the video renders completely before the client uploads anything and the slot animates exactly like the final asset will.

| Slot property | Meaning | Default |
| --- | --- | --- |
| `kind` | image, video, logo, avatar, screen-recording | from the planner |
| `aspect` / `fit` | target aspect and cover / contain / smart-crop (face- or UI-aware) | cover, smart-crop |
| `duration` | for video: the beat length it must fill; trims or loops the upload | beat length |
| `placeholder` | what renders until filled: brand-tinted frame, label ("Founder photo, 1:1"), optional AI-generated stand-in marked as such | tinted frame + label |
| `mask` | rounded-rect, circle, device frame (laptop / phone), card | from the component it sits in |
| `treatment` | overlay colour wash, blur, glow, 3D tilt inherited from the parent | inherited |
| `source` | upload, URL, or a harvested asset from the crawl (with licence flag) | empty |
| `required` | whether the video can be delivered with the placeholder still showing | true |

The client sees slots as a checklist ("3 images, 1 video still needed") and drops files in from the editor or a share link; nothing else in the video changes when they do.

Editability is a property of the format, not a feature bolted on. Every visible thing is a node with named, typed properties; every animation is a track on a property; nothing is baked into pixels except media slots. That gives four editing levels, each cheaper than the one below it:

1. **Text and asset edits**: change a word, swap a logo, upload into a slot. The layout engine reflows (fit-to-width, recentre) automatically.
2. **Timing edits**: drag a beat longer or shorter; holds stretch first, animations keep their measured durations unless the user explicitly scales them.
3. **Pattern edits**: swap T1 for T2 on a title, change `settle` to `bounce`, move a style dial. The planner re-emits only that beat.
4. **Structural edits**: reorder beats, add a feature loop, change which UI component a beat shows. The planner re-runs for the affected beats and preserves every manual edit it can match by node id.

Exports keep editability where the target format allows it: an After Effects `.jsx` build (each beat its own comp, shapes as shape layers, text as text layers, slots as footage placeholders, keyframes with the same easing), a Lottie/Rive export for web, and MP4/WebM at up to 4K for delivery. The AE export is the one that matters for a team that already works in Premiere and After Effects: it means a client video can be handed to an editor without re-creating anything.

## Engine architecture and scene-graph format

Six layers, with one JSON document in the middle that everything else reads and writes; the planner and the editor are the only writers, and every export is a pure function of the graph.

```
Editor        — React timeline + canvas: edit text, timing, patterns, dials, media slots; reads and writes the graph directly
Planner       — crawler, beat compiler, scene planner: LLM for tagging and matching, rules for pattern choice and timing
Scene graph   — (JSON, THE CONTRACT) beats, nodes, property tracks, easing presets, tokens, media slots, style dials
Runtime       — timeline, easing and springs, stagger, layout (fit-to-width, recentre), camera, morph solver, text shaping
Primitives    — text run, glyph, rect, path, image/video slot, group, 3D plane, slab, particle cloud, glow, camera
Backends      — WebGL preview in the editor; headless render to MP4/WebM up to 4K; After Effects .jsx; Lottie/Rive
The editor and the planner both write the graph; nothing below the graph is ever edited by hand.
```

The scene-graph format is deliberately small. A beat holds nodes; a node has a type, properties, children and tracks; a track animates one property with an easing preset or a spring. Patterns (T1–T14, S1–S16) are *macros* that expand into nodes and tracks at compile time, so the renderer never knows what a "scramble typewriter" is; it only knows glyph opacity and glyph substitution tracks. That keeps the runtime stable while the pattern library grows.

```json
{
  "version": 1,
  "canvas": { "w": 1920, "h": 1080, "fps": 30 },
  "tokens": { "bg": "#0B3B2E", "accent": "#F2C94C", "font": "Inter" },
  "dials": { "luminance": 0.15, "glow": 0.4, "dimensionality": 0.5, "playfulness": 0.8, "kineticText": 0.6, "realism": 0.8, "tempo": 0.6, "density": 0.5 },
  "beats": [
    {
      "id": "b3", "type": "feature", "start": 12.0, "duration": 8.0,
      "script": "Pick any of 17,000 models.",
      "pattern": { "text": "T2", "shape": ["S10", "S4", "S5"] },
      "nodes": [
        { "id": "title", "type": "text", "props": { "text": "Pick any of 17,000 models", "style": "h1", "fitBox": [1200, 140] },
          "tracks": [ { "prop": "glyph.opacity", "mode": "typewriter", "cps": 26, "tail": { "len": 1, "color": "accent", "decayMs": 300 } } ] },
        { "id": "ui", "type": "plane", "ref": "components/model-picker", "props": { "rotY": 14, "rotX": 6 },
          "tracks": [ { "prop": "y", "from": 120, "to": 0, "ms": 600, "ease": "settle" }, { "prop": "scale", "from": 1.0, "to": 1.04, "ms": 8000, "ease": "linear" } ],
          "shots": [ { "at": 1.2, "size": "close", "focus": "#provider-list" }, { "at": 3.0, "size": "medium", "focus": "#apply", "onEvent": "click" } ] },
        { "id": "cursor", "type": "cursor", "props": { "size": 2.0 },
          "tracks": [ { "prop": "path", "to": "#apply", "ms": 500, "ease": "emphasis" }, { "prop": "press", "at": 3.0 } ] },
        { "id": "slot1", "type": "media", "kind": "screen-recording", "aspect": "16:9", "required": false, "source": null }
      ]
    }
  ]
}
```

The runtime's hard parts, in order of difficulty: (1) text shaping with per-glyph control and variable-font axes (HarfBuzz via a WASM build, or the browser's own layout read back through `getBoundingClientRect` per glyph); (2) the layout solver that keeps fit-to-width, recentre and bracket tracking consistent while text animates; (3) the morph solver for glyph-anchor and stroke-shared morphs (path interpolation with correspondence, Flubber-class); (4) the 2.5D camera with depth-of-field for tilted planes and slabs; (5) particles, last.

Stack recommendation: TypeScript throughout; a React editor; the runtime as a framework-free package rendering to Canvas 2D for text and shapes and to WebGL (Three.js or regl) only for the 3D plane/slab layer and glow; headless rendering through Playwright/Chromium frame capture piped to ffmpeg, which is exactly how Remotion renders and is proven at scale. Remotion itself is a reasonable base for the timeline and render pipeline if you prefer not to own that layer, but the pattern runtime and layout solver must be your own code.

## Build order and stack

Build the runtime before the planner: a planner with nothing to emit into is unverifiable, while a runtime with hand-written scene graphs produces sellable videos on day one (it is how R3–R9 were made, by hand, in After Effects). Each phase ends in a video you could ship.

| Phase | Weeks | Deliverable | Scope | Model to use |
| --- | --- | --- | --- | --- |
| 0 Format + runtime core | 1–2 | A JSON scene graph renders to MP4 | Timeline, `settle` / `emphasis` / `bounce`, stagger, text runs with per-glyph tracks, rect/path, group, camera 2D; Chromium + ffmpeg render | Fable 5.1 for the format and solver design; Opus 5.5 in Claude Code for implementation |
| 1 Text pattern library | 2 | T1–T6, T10, T11, T13 as macros; a demo video reproducing R3, R4's wordmark and R7's typewriter | Fit-to-width layout solver; tail highlight; brackets; colour sweep | Opus 5.5 for macros; Sonnet 5.5 for the demo scene graphs |
| 2 Shape + UI library | 2–3 | S1–S6, S8, S9, S13–S16; cursor system; jump-cut coverage; a demo reproducing R5's connector flow | Hand-authored UI components first (no crawler yet); media slots with placeholders | Opus 5.5 |
| 3 Editor | 3 | React timeline + canvas; text/timing/pattern/dial edits; slot upload; AE `.jsx` export | Editing levels 1–3; export verified by the mock-API harness before any script ships | Opus 5.5; Sonnet 5.5 for UI polish |
| 4 Crawler + native rebuild | 3–4 | Drop a URL → tokens, components, features; rebuilt nav/hero/card/button/input/table with real hover states | Playwright crawl, token clustering, component harvest, SSIM fallback | Fable 5.1 for the harvest heuristics; Opus 5.5 for the crawler |
| 5 Script → beats → scenes | 2–3 | Script in, draft video out, every element editable | Beat tagging, feature matching, pattern selection by dials, object hand-off | Fable 5.1 designs the planner rules; the planner itself calls Sonnet 5.5 at runtime for tagging (cheap, fast) |
| 6 3D + morph + particles | 3+ | T7–T9, T12, S7, S10–S12, particles | WebGL layer, slabs, fly-through, glyph morph, DOF | Opus 5.5 |

Two things to do in phase 0 that are easy to skip and expensive to retrofit: give every node a stable id generated from its beat and role (not an index), so edits survive re-planning; and record the measured duration table as data the runtime reads, not constants in code, so the tempo dial and per-client overrides are trivial.

Stack: TypeScript monorepo (pnpm workspaces): `@engine/graph` (schema + validation, zod), `@engine/runtime` (framework-free), `@engine/patterns` (macros), `@engine/render` (Playwright + ffmpeg), `@engine/export-ae` (ExtendScript emitter with the mock-API harness), `@app/editor` (React + Vite), `@app/planner` (Node service: Playwright crawler, LLM calls, rules), Postgres for projects, S3-compatible storage for media.

Phase 0 is specified in full, with verified code, in Phase 0 brief.

## Open decisions

- [x] Decided 2026-10-15: hybrid. The scene graph is the single source of truth and the runtime is a pure function of time; Remotion is used only as the render harness (one composition that calls \`runtime.renderFrame(t)\`), replaceable by a Playwright + ffmpeg loop if licence or WebGL friction appears. Team is one person (Niloy) as of Oct 2026, which falls under Remotion's free tier; the harness stays a single swappable module so a paid licence or a Playwright + ffmpeg replacement is a drop-in when the team grows.
- [x] Decided 2026-10-15: HarfBuzz WASM (harfbuzzjs) for shaping from phase 0, with the browser read-back path kept only as a dev fallback; complex scripts and exact AE glyph parity are in scope.
- [ ] Crawl depth and gated apps: is a client-provided screen recording acceptable as the fallback for login-walled products, or must v1 support authenticated crawling with client credentials?
- [ ] Dial exposure: expose all eight dials to clients, or only presets ("Pando", "Neon", plus two more) with dials reserved for your team?
- [ ] Voice-over: generate VO from the script (ElevenLabs) so timing is always alignment-driven, or accept text-only timing in v1?
- [x] Decided 2026-10-15: 16:9 and 9:16 from one graph; the layout solver is written for both from day one, with 16:9 as the only phase-0 acceptance target.
- [ ] Particle system: cut from v1 entirely (recommended) or keep a minimal point-cloud morph for hero beats?
