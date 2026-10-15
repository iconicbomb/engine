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

## Phase 0 status (2026-10-15)
DONE in the sandbox: shaper.ts (harfbuzzjs, Inter variable TTF vendored in packages/runtime/fonts), layout.ts,
canvas2d.ts, background glows, glass caret, typing ramp. `tools/compare_frames.py` against R3: mean SSIM 0.883,
min 0.757 = PASS. 9:16 renders from the same graph. Frames are byte-identical across renders.
Pending on Niloy's machine: `pnpm install` (new deps: harfbuzzjs, esbuild, playwright), `pnpm test` (17 ok),
`pnpm render`, `pnpm compare`.

Two render paths exist and must stay in agreement:
- `pnpm render` — Remotion (apps/render). Assets are fetched from apps/render/public via staticFile.
- `pnpm render:local` — Playwright + ffmpeg (tools/render-local.mjs); needs a Chromium: set CHROME_PATH or run
  `npx playwright install chromium` once. This is the harness-independence proof and the faster iteration loop.

## Phase 1 (next): pattern macros
`packages/patterns`: functions that expand a pattern id + params into nodes/tracks. Start with T1 (scramble
typewriter), T3 (fit-to-width), T5 (brackets), T12 (3D-ish reveal) so the R3 fixture can be regenerated from
four macro calls instead of hand-written JSON; then T2, T4, T6, T13, S1, S2 per the spec's build order.

## Conventions
TypeScript strict everywhere; no default exports except the Remotion root; tests are plain tsx scripts that
print `ok:` / `FAIL:` lines and set a non-zero exit code on failure.
