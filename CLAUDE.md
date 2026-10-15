# engine — script-to-SaaS-video engine (phase 0)

## What this is
A renderer for motion-graphics videos driven by a JSON scene graph. The full spec (pattern library T1–T14 / S1–S16,
measured timings and easing, scene grammar, glow pipeline, architecture, build order) is in `docs/spec.md` — read
the relevant section before implementing any pattern; the measured numbers there are the acceptance targets.
The editable original is the Claude Doc "Script-to-SaaS-Video Engine Spec".

## Non-negotiable rules
1. The scene graph (`packages/graph/src/schema.ts`) is the single source of truth. Animation lives in DATA
   (nodes + tracks), never in component code. If you need a new behaviour, add a node/track field to the schema
   first, then make the runtime read it.
2. `renderFrame(graph, t, target)` is a pure function: same inputs, same pixels. No Date.now(), no Math.random()
   without a seed, no state carried between frames except what the layout solver derives deterministically from t.
3. Remotion is only the render harness (`apps/render/src/harness.tsx`). Nothing in `packages/*` may import
   from `remotion` or `react`.
4. Node ids are stable slugs prefixed by their beat (`b1-question-title`). The schema enforces it; never bypass it.
5. Durations and rates come from `graph.timing` and the tracks, never from constants in runtime code.
6. Easing presets are measured, not chosen: `settle` = expo-out, `emphasis` = cubic-bezier(0.5,0,0.1,1),
   `bounce` = spring(700, 18, 1). Do not "tune" them without re-measuring against the reference clips.

## Phase 0 goal and acceptance
Render `fixtures/r3-hook.graph.json` so that
`python tools/compare_frames.py fixtures/refs/R3.mp4 apps/render/out/r3.mp4 --dur 3.2` prints PASS
(mean SSIM >= 0.85, min >= 0.70). Look at the strip it writes, not just the number.

## Commands
- `pnpm install` — workspace install
- `pnpm test` — schema fixtures + runtime core tests (must stay green; run before finishing any task)
- `pnpm typecheck` — strict TypeScript across the workspace
- `pnpm render` — Remotion render of the fixture to `apps/render/out/r3.mp4`
- `pnpm compare` — acceptance check against the reference clip
- `pnpm gen:fixtures` — regenerate every `fixtures/<name>.graph.json` from its scene in `packages/patterns/scenes/`
  (`pnpm gen:r3` = just the R3 hook)
- `pnpm test:render` — Chromium render of every fixture at 16:9 and 9:16: fails on page errors, a static clip, or
  a frame-hash mismatch against `fixtures/<name>.frames.sha256` (R3 only). Finds Chrome via CHROME_PATH, Playwright's
  download, or a system install. `--update-baseline` rewrites the hashes: only after looking at the frames in
  `out/render-check/`. Not part of `pnpm test` because it needs a browser — run it before finishing any runtime change.

## Status (2026-10-15)
Phase 0 DONE and verified on Niloy's machine: shaper.ts (harfbuzzjs, Inter variable TTF vendored in
packages/runtime/fonts), layout.ts, canvas2d.ts, background glows, glass caret, typing ramp. `pnpm render` +
`pnpm compare` against R3: mean SSIM 0.883, min 0.758 = PASS. 9:16 renders from the same graph. Frames are
byte-identical across renders.
Phase 1 macros complete: T1–T6, T10–T13, plus S1, S2, S15 (see below); cursor system, camera, row/column layout, velocity retargeting, paths + wires, beat transitions, S3–S6, S8, S9, S13 in (phase 2); `pnpm test` 115 ok, `pnpm typecheck` clean,
`pnpm test:render` green (R3 frame hashes unchanged at both aspects).
Known gap (from the strip, pre-existing in phase 0): R3 opens zoomed in (large, soft text shrinking as it types);
our render starts at final size and types ~1 char behind. Worst frames are t = 0.4–0.75 s. Tune via the T1/T3
params in the R3 scene, then `pnpm gen:r3`.

Two render paths exist and must stay in agreement:
- `pnpm render` — Remotion (apps/render). Assets are fetched from apps/render/public via staticFile.
- `pnpm render:local` — Playwright + ffmpeg (tools/render-local.mjs); needs a Chromium: set CHROME_PATH or run
  `npx playwright install chromium` once. This is the harness-independence proof and the faster iteration loop.

## Phase 1 (in progress): pattern macros
`packages/patterns`: each macro is a pure function `(params) -> { nodes, tracks, patches }` (src/macro.ts).
`nodes` are placed by the caller; `tracks` are appended to existing nodes by id (T12's `handoff` drives the exit
of the text it replaces); `patches` set node fields where the schema models a pattern as layout, not motion
(T3 sets `fit`). `applyEdits` (src/assemble.ts) applies them and throws on unknown ids.
`glows` carries beat-level glows (S15). Patterns depend only on `@engine/graph`; the typewriter schedule
(`glyphTime`, `typewriterEnd`, `glyphHideTime`) lives there in schedule.ts and the runtime imports it.
DONE: T1 (scramble typewriter; `ms` derived from the glyph schedule), T3 (fit-to-width), T5 (brackets),
T12 (reveal), S15 (ambient glows with fade-in), T2 (tail typewriter; "last N chars" = tint decaying over N/cps),
T4 (word append, eased recentre settling within the 230 ms word cadence), T6 (colour sweep / keyword hold),
T13 (logo-anchored typewriter, emits a lockup group), S1 (card/panel rise + child population),
S2 (ripple pill: sized to its tnum counter, nested bands with alpha fills, spring slide-in, linear counter,
completion pulse; `color` must be hex because nested opacity multiplies), T10 (echo trail: copies at 60/40/25/15 %
fan out over 400 ms as the word shrinks and recedes; primitives only), T11 (tracking contraction: +0.6 em -> normal
over 500 ms ease-out; the runtime reads a node-level `tracking` tween in em).
The R3 fixture is generated from five calls (T1, T3, T5, T12, S15) and is byte-identical to the old hand-written
JSON; each other macro has a demo fixture (`fixtures/{s1,s2,s15,t2,t4,t6,t10,t11,t13}-*.graph.json`). test-patterns.ts fails if
any committed fixture drifts from its scene builder.
Runtime/schema additions made for these devices (all optional or defaulting to the old behaviour):
typewriter `tail.strength` (T2; was a hard-coded 0.35), `unit: "word"` (T4), `out` un-type (T13);
tween `relativeTo: "reveal"` (T4 per-word pop); `sweep` track mode (T6); rect `follows` a text edge (T13 mark);
nodes at scale 0 are skipped (followers divide by it); base `x`/`y` on every node (px, the units of x/y tracks;
a running x/y track replaces it); text `recenterEaseMs` (T4: the run's centre follows growth via smoothedSteps);
`count` track mode + `formatCount` (S2 counter); TextStyle `features` (OpenType tags passed to HarfBuzz, e.g.
["tnum"]); rect `children` (drawn on top, positioned like a group's) and `sizeToContent: { padX, padY }` (a layout
pass measures the children at time t, ignoring opacity, and the rect wraps them; w/h become the minimum size).
Text layout is a pure `layoutText` that both painting and measuring use.
Track rule: when several tween tracks animate one property, the latest started wins; before any has started, the
earliest one's `from` holds (S2's pulse ring: a 0 ms hold at 0, then a flash at count end). Pixel-neutral for every
earlier fixture (all had one track per property).
Not modelled yet: T13's mark split/widen and R7's wordmark wipe; S15's god-rays, sparkles and bokeh; a lockup-level
fit (text + mark) — T13 and S1/S2 demos scale down at 9:16 via anchor overrides instead; S1's 3D perspective
(phase-6 plane layer); S2's pill *width* spring (it slides instead). S2's pulse ring wraps an invisible copy of the
counter, since a rect can only size to its own children.
DONE (phase 2): S3 hover-fill card (emits the cursor's moveTo onto the card; 130 ms onHover fill; rows wipe in via
clip.w from the arrival, 40 ms apart, done in 300 ms; fixture s3-hover-fill-card with an avatar cursor);
S5 cursorClick + giantCursor (move 500 ms, pause 150 ms, press 80 ms; target onHover background 100 ms and a 0.96
dip across the press; fixture s5-cursor-click); S4 jumpCuts + pressTimes (camera frame tracks, cut on the cursor's
press times; fixture s4-jump-cut: wide -> 300 ms push to a close-up on a card -> hard cut back to wide);
S6 tickerList (clip window of `visible` slots; list steps up one slot per 330 ms step, exiting item fades;
primitives only); S9 pillMarquee (pills sized to their labels in `layout: row` groups inside a `layout: column`
group, centre-out pop cascade within 600 ms, rows scroll linearly at 40 px/s in alternating directions; rows repeat
to cover canvas + travel — repeat count and cascade timing use an estimated label width, ~0.58 em/char).

## Standing order (Niloy, 2026-10-15) — run unattended, one commit per item
A row/column layout (done) -> velocity-preserving retargeting (done) -> B path + wire nodes (done) -> S8 (done) -> C beat transitions (done) ->
S13 (done), S14 -> D image nodes -> S16 -> every remaining S and T row in order -> fixtures/showcase.graph.json at both
aspects, rendered to out/showcase-16x9.mp4 and out/showcase-9x16.mp4.
Per item: pnpm test, typecheck, R3 checksum unchanged at both aspects, render + compare numbers in the commit, a
fixture at both aspects, CLAUDE.md updated. Decide alone on plain schema extensions, missing measurements (timing
table, mark // unmeasured), costly cosmetics (ship flat, log under "not modelled yet"), broken tooling. Stop only
when R3 / an existing fixture's pixels would change for a reason other than exact-maths re-baselining, a schema
shape could reasonably go two ways, or the spec contradicts itself.

## Row / column layout (A)
- Group `layout: { type: row | column, gap, align: start | center | end, wrap, maxWidth, overrides: { "9:16": { gap,
  maxWidth } } }`. Children are placed one after another from their rest boxes (text: full run at its fully-typed fit
  scale; rects: size or sizeToContent; groups: union) — tracks are ignored for placement, so a pill popping from
  scale 0 never moves its neighbours. A laid-out child ignores its anchor; its base x/y and tracks apply on top of
  the slot. `align` places children across a line and lines along the block; the block is centred on the group's
  origin. With `wrap`, a line breaks when the next child would pass `maxWidth` (main-axis length, also for columns).
- One pure `layoutSlots` feeds the draw pass, the measure pass and sizeToContent. Fixture: layout-row-column.
- S1 uses `layout: column` for its card stack (byte-identical to the explicit y offsets it replaced).

## Velocity-preserving retargeting
No fuller written spec existed in the repo; implemented from Niloy's summary ("same-prop tracks inherit instantaneous
velocity, springs as initial velocity, tweens blend over 80 ms, carryVelocity:false opt-out, from-rest tracks
byte-identical") — review this reading:
- Applies wherever tween tracks are resolved (`resolveTracks` in runtime-core: node props, per-glyph props, clip,
  tracking, camera zoom/x/y). Not to fill colour tweens.
- When the winning track starts at t0 while the track that was winning just before is still moving, its velocity
  at t0 (backward difference, 1 ms) is inherited. Springs (`bounce`) start from the current value with it as initial
  velocity (closed-form damped spring with v0, `springOffset`). Tweens blend from the extrapolated old motion
  (x0 + v·dt) into their own curve over 80 ms with a smoothstep weight, so position and velocity stay continuous.
- From rest — the earlier track has finished (within 1 µs: authored timings are µs-rounded, and float sums like
  1.85 + 0.04 overshoot) or never moved — the value is exactly the plain track value: every pre-existing fixture is
  byte-identical. `carryVelocity: false` opts a track out.
- An omitted `from` now means the current value as documented (the value handed over at t0) when earlier tracks
  exist; previously the runtime used the node's base value. No existing fixture omits `from`.
- Fixture retarget-velocity: carry / spring / opt-out dots retargeted mid-flight.

## Paths + wires (B)
- `path`: SVG `d` in local px (y-down), stroke / strokeWidth / fill / lineCap, `trim { start, end }` animatable as
  trim.start / trim.end (draw-on, comets). Length and bounds come from a pure flattener in runtime-core (M L H V C S Q
  T Z, absolute + relative; cubics 24 steps, quadratics 16); trim renders with setLineDash.
- `wire`: from / to { target, anchor, offset (box fractions) }, curve s | line | arc, bend, stroke, strokeWidth,
  trim, glow { radius, intensity }. Geometry from the measure pass (world space), so it follows its targets at 9:16
  and under the camera. Wires are top-level only (validated, like cursors) and drawn before every other node of the
  beat; their own x/y/scale are ignored. The measure pass records each wire's bounds (camera can frame a wire).
- Not modelled yet: SVG arc (A) segments are measured as straight chords (drawn exactly by the canvas, so trim /
  length are approximate on arcs).
- Fixture paths-wires.
- S8 wireFan: top-level wires from the hub's facing edge to each target (s-curves), drawing on over 400 ms with a
  70 ms stagger, sides interleaved from the top. Fixture s8-wire-fan (targets in layout:column groups).
  Not modelled yet: S8's travelling dots (1.5 px/frame) — open question: a wire `dots { count, speed, radius }`
  field (recommended) vs follower nodes positioned along a path.

## Beat transitions (C)
- `Beat.transition { type cut | crossfade | curtain | smear, ms, ease, direction, color }` on the incoming beat; the
  timeline is unchanged (beats never overlap). Inside [start, start + ms) the runtime composites the previous beat
  (evaluated at the real t; finished tracks hold) and this one; outside it draws one beat exactly as before, so every
  single-beat fixture is byte-identical. Validation: no transition on the first beat; ms <= the beat's duration.
- Defaults (`transitionParams` in @engine/graph): crossfade 100 ms linear (timing table's cross-dissolve); curtain
  600 ms emphasis, direction right, colour tokens.accent; smear 160 ms, direction left; cut 0.
- crossfade: incoming rendered offscreen, drawn at alpha p. curtain: a canvas-sized colour panel crosses (-1 -> +1
  frame along `direction`), covering the frame at the eased midpoint; outgoing before, incoming after.
- smear: background + glows crossfade once (repeated 8-bit blending of smooth gradients bands them); the content of
  each beat slides (outgoing 0 -> 0.3 W along `direction`, emphasis; incoming from 0.3 W behind -> 0, settle) as 8
  taps spread along its own instantaneous velocity x 1/60 s, rendered on transparent layers and summed additively
  at weight/8 (premultiplied mean, outgoing weight 1-p, incoming p) — the blur is the motion itself.
- Offscreen buffers: OffscreenCanvas (or a DOM canvas), fully overwritten before each use, so frames stay pure.
- Macro rule: a beat with a transition delays its enter tracks by `enterDelay(transition)` — curtain ms/2, smear ms,
  crossfade / cut 0 — so nothing lands under the transition.
- Fixture transitions: five beats chained by crossfade, curtain, smear, cut.
- S13 curtainWipe: a curtain transition with the measured 130 ms, direction up (spec: "sweeping up or sideways");
  the bare curtain type keeps Niloy's runtime default of 600 ms (open question: spec 130 ms vs default 600 ms).
  Fixture s13-curtain-wipe. Not modelled yet: the curved edge and 1–2 frames of edge blur (straight panel edge).
- render-check: frame directories are cleared file-by-file when the folder itself is locked (Windows: a shell's
  cwd inside it aborted a run).

## Cursor system (designed with Niloy, 2026-10-15)
- `cursor` node: style arrow | hand | avatar (circle placeholder until image nodes), `size` multiplier (R5 ~2), base
  x/y = start position. Top-level only; the runtime draws cursors after every other node.
- `moveTo` track: travels to a point on a target node's box (anchor center/left/right/top/bottom + offset as
  fractions of the box), arriving at at + ms (default 500, emphasis). Targets come from the measure pass below.
  The cursor position is a replay of its moveTo tracks from its start position: a pure function of (graph, t).
- `press` track: cursor scale dips to 0.96 and back over ms (80). Pause 150 ms before a press (spec) is the macro's job;
  a pressed target's own dip is explicit tracks on the target.
- `onHover` track (any node): prop `fill` or opacity/scale/rotation/x/y eases to `to` from the arrival of a moveTo that
  targets the node until the cursor's next moveTo starts, then eases back — derived purely from the cursor's tracks.
- Rect `fill` tweens lerp in sRGB (#RRGGBB[AA]); OKLab interpolation is a later improvement.
- `clip { x, y, w, h }` on any node, local space after its transform, animatable as clip.x/y/w/h (S3 row wipe via
  clip.w; S13 curtain wipe later).
- Fixture: `cursor-hover` (two cards, hover fill in/out, press dip, clip-wipe rows) at both aspects.
- The avatar placeholder is neutral grey (#C9CED6) with a white ring so it reads on brand-filled cards.
- Scale a cursor for portrait with its anchor override `scale`.

## Measure pass + camera (designed with Niloy, 2026-10-15)
- Two passes per frame, both pure: `measure(graph, t)` -> world-space boxes (graph units, before the camera) for every
  node, including opacity-0 nodes; text uses its full laid-out run at its fully-typed fit scale (shots don't drift
  while a typewriter runs). Then draw. The measure pass only runs when a beat has cursors or camera frame tracks, so
  scenes without them render exactly as before. The bracket/follows `extents` map stays per-group in parent space.
- Beat camera: zoom about the frame centre + pan, applied to nodes and cursors (cursors scale with the shot), not to
  the background or glows. Camera tracks: tweens on zoom/x/y, and `frame` tracks { at, ms (0 = hard cut), ease
  (emphasis), target, size wide|medium|close|<zoom>, anchor, offset (box fractions), follow }.
- size presets are fill fractions: zoom = min(W*f/box.w, H*f/box.h), f = 0.5 / 0.7 / 0.9. View = translate(frame
  centre) . scale(zoom) . translate(-target point). follow false resolves the box at `at` (measure(graph, at)); true
  every frame. ms > 0: zoom interpolates in log space, centre linearly, from the replayed camera state at the track's
  `at`. Clamped: zoom >= 1, viewport inside the canvas. A transition can land on a wide framing slightly above zoom 1
  (e.g. 1.04 on a wide card row at 16:9) — that is the fill formula, not drift.
- `runtime.measure(graph, t)` and `runtime.camera(graph, t)` are on the Runtime interface; test-core uses them in Node
  (shaper + runtime, no canvas) to assert the framed card stays fully inside the canvas at 9:16 and 16:9.
Open: the spec's timing table lists `bounce` as spring(170, 14, 1); this file and the schema use the measured
spring(700, 18, 1), which T5 follows. Fix the spec table.

## Conventions
TypeScript strict everywhere; no default exports except the Remotion root; tests are plain tsx scripts that
print `ok:` / `FAIL:` lines and set a non-zero exit code on failure.
