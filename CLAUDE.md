# engine — script-to-SaaS-video engine (phase 0)

## What this is
A renderer for motion-graphics videos driven by a JSON scene graph. The full spec (pattern library, measured
timings, scene grammar, glow pipeline, architecture, build order) lives in the Claude Doc "Script-to-SaaS-Video
Engine Spec"; its "Phase 0 brief" tab is the source for everything in this repo.

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

## Phase 0 work remaining (in order)
1. `packages/runtime/src/shaper.ts` — implements `Shaper` with harfbuzzjs: load a font file, shape a string
   (with variable-font axes) into glyph runs with advances, and expose each glyph as an SVG path / Path2D.
2. `packages/runtime/src/layout.ts` — implements `LayoutSolver`: fit-to-width scale with `easeMs` smoothing
   (scale follows the visible glyph width, never wraps), recentre, anchor resolution for 16:9 and 9:16.
3. `packages/runtime/src/canvas2d.ts` — implements `Runtime` on Canvas 2D: walk beats -> nodes -> tracks,
   resolve every property at t (`trackProgress`, `typewriterGlyphs`), draw text as glyph paths, rects, and
   bracket nodes that follow a text node's extents; bloom is a cheap stand-in for now (fresh glyphs redrawn
   with `ctx.filter = "blur(Npx)"` and `globalCompositeOperation = "lighter"`).
4. Replace the stub in `apps/render/src/entry.tsx` with the real runtime; `pnpm render`; `pnpm compare`; iterate.

## Conventions
TypeScript strict everywhere; no default exports except the Remotion root; tests are plain tsx scripts that
print `ok:` / `FAIL:` lines and set a non-zero exit code on failure.
