// Remotion entry. Phase 0: the runtime is a stub until packages/runtime/src/canvas2d.ts exists.
import { registerRoot, makeRoot } from "./harness";
import { parseGraph } from "@engine/graph";
import type { Runtime } from "@engine/runtime";
import graphJson from "../../../fixtures/r3-hook.graph.json";

const graph = parseGraph(graphJson);

// TODO(phase 0, step 2): replace with `import { createRuntime } from "@engine/runtime/canvas2d"`.
const stubRuntime: Runtime = {
  renderFrame(g, t, { ctx, width, height }) {
    ctx.fillStyle = "#070C1E"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#FFFFFF"; ctx.font = "48px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`stub runtime — t=${t.toFixed(2)}s — ${g.beats[0].script}`, width / 2, height / 2);
  },
};
registerRoot(makeRoot(graph, stubRuntime));
