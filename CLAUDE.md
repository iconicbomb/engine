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
- `pnpm gen:r3` — regenerate `fixtures/r3-hook.graph.json` from the macro calls in `packages/patterns/scenes/r3-hook.ts`

## Status (2026-10-15)
Phase 0 DONE and verified on Niloy's machine: shaper.ts (harfbuzzjs, Inter variable TTF vendored in
packages/runtime/fonts), layout.ts, canvas2d.ts, background glows, glass caret, typing ramp. `pnpm render` +
`pnpm compare` against R3: mean SSIM 0.883, min 0.758 = PASS. 9:16 renders from the same graph. Frames are
byte-identical across renders.
Phase 1 in progress: T1, T3, T5, T12 done (see below); `pnpm test` 23 ok, `pnpm typecheck` clean.
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
DONE: T1 (scramble typewriter; `ms` is derived from the runtime's glyph schedule), T3 (fit-to-width),
T5 (brackets), T12 (reveal). The R3 fixture is now generated from these four calls and renders byte-identical
to the old hand-written JSON (all 96 frame PNG hashes match via `render:local`); test-patterns.ts fails if the
committed fixture drifts from the macro output. The beat's two glows are still literal data until S15 exists.
NEXT: T2, T4, T6, T13, S1, S2 per the spec's build order.
Open: the spec's timing table lists `bounce` as spring(170, 14, 1); this file and the schema use the measured
spring(700, 18, 1), which T5 follows. Fix the spec table.

## Conventions
TypeScript strict everywhere; no default exports except the Remotion root; tests are plain tsx scripts that
print `ok:` / `FAIL:` lines and set a non-zero exit code on failure.
