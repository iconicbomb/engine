// @app/render — the ONLY Remotion-specific file. Swappable for a Playwright + ffmpeg loop (tools/render-local.mjs)
// without touching the runtime. Only JSON-serialisable data goes through Remotion props (the graph).
import React, { useEffect, useRef, useState } from "react";
import { Composition, useCurrentFrame, useVideoConfig, registerRoot, delayRender, continueRender, cancelRender } from "remotion";
import type { Graph } from "@engine/graph";
import type { Runtime } from "@engine/runtime";
import { loadRuntime } from "./runtime";

type Props = { graph: Graph };

const Frame: React.FC<Props> = ({ graph }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [rt, setRt] = useState<Runtime | null>(null);
  const [handle] = useState(() => delayRender("loading HarfBuzz + fonts"));
  useEffect(() => {
    loadRuntime(graph).then((r) => { setRt(r); continueRender(handle); }, (e) => cancelRender(e));
  }, [handle]);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !rt) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    rt.renderFrame(graph, frame / fps, { width, height, ctx });   // pure: same (graph, t) -> same pixels
  }, [rt, frame, fps, width, height, graph]);
  return <canvas ref={ref} width={width} height={height} style={{ width, height }} />;
};

export function makeRoot(graph: Graph) {
  const last = graph.beats[graph.beats.length - 1];
  const durationSec = last.start + last.duration;
  const height = graph.canvas.refHeight;
  const width = graph.canvas.aspect === "16:9" ? Math.round(height * 16 / 9) : Math.round(height * 9 / 16);
  const Root: React.FC = () => (
    <Composition
      id="engine"
      component={Frame as React.FC<Record<string, unknown>>}
      defaultProps={{ graph }}
      durationInFrames={Math.ceil(durationSec * graph.canvas.fps)}
      fps={graph.canvas.fps}
      width={width}
      height={height}
    />
  );
  return Root;
}
export { registerRoot };
