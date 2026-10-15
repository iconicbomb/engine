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
Phase 1 in progress: T1–T6, T12, T13, S1, S2, S15 done (see below); `pnpm test` 54 ok, `pnpm typecheck` clean,
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
completion pulse; `color` must be hex because nested opacity multiplies).
The R3 fixture is generated from five calls (T1, T3, T5, T12, S15) and is byte-identical to the old hand-written
JSON; each other macro has a demo fixture (`fixtures/{s1,s2,s15,t2,t4,t6,t13}-*.graph.json`). test-patterns.ts fails if
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
NEXT: T10, T11 per the spec's build order.
Open: the spec's timing table lists `bounce` as spring(170, 14, 1); this file and the schema use the measured
spring(700, 18, 1), which T5 follows. Fix the spec table.

## Conventions
TypeScript strict everywhere; no default exports except the Remotion root; tests are plain tsx scripts that
print `ok:` / `FAIL:` lines and set a non-zero exit code on failure.
