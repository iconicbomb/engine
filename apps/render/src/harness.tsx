// @app/render — the ONLY Remotion-specific file. Swappable for a Playwright + ffmpeg loop without touching the runtime.
import React, { useEffect, useRef } from "react";
import { Composition, useCurrentFrame, useVideoConfig, registerRoot } from "remotion";
import type { Graph } from "@engine/graph";
import type { Runtime } from "@engine/runtime";

type Props = { graph: Graph; runtime: Runtime };

const Frame: React.FC<Props> = ({ graph, runtime }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    runtime.renderFrame(graph, frame / fps, { width, height, ctx });   // pure: same (graph, t) -> same pixels
  }, [frame, fps, width, height, graph, runtime]);
  return <canvas ref={ref} width={width} height={height} style={{ width, height }} />;
};

export function makeRoot(graph: Graph, runtime: Runtime) {
  const last = graph.beats[graph.beats.length - 1];
  const durationSec = last.start + last.duration;
  const height = graph.canvas.refHeight;
  const width = graph.canvas.aspect === "16:9" ? Math.round(height * 16 / 9) : Math.round(height * 9 / 16);
  const Root: React.FC = () => (
    <Composition
      id="engine"
      component={Frame as React.FC<Record<string, unknown>>}
      defaultProps={{ graph, runtime }}
      durationInFrames={Math.ceil(durationSec * graph.canvas.fps)}
      fps={graph.canvas.fps}
      width={width}
      height={height}
    />
  );
  return Root;
}
// in the entry file:  registerRoot(makeRoot(graph, runtime));
export { registerRoot };
