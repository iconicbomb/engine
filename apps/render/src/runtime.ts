// The active runtime for the render app, loaded once per browser session. Imported by the harness
// (never passed as a Remotion prop: props are serialised to JSON, so functions would be stripped).
// Assets live in apps/render/public (copies of packages/runtime/{wasm,fonts}) and are fetched via staticFile.
import { staticFile } from "remotion";
import { createShaper } from "@engine/runtime/shaper";
import { createRuntime } from "@engine/runtime/canvas2d";
import type { Runtime } from "@engine/runtime";
import type { Graph } from "@engine/graph";

let pending: Promise<Runtime> | null = null;

// image assets the graph names (public/assets/<src>), decoded before the first frame
function imageNames(graph: Graph): string[] {
  const names = new Set<string>();
  const walk = (n: { type: string; src?: string | null; children?: unknown[] }) => { if (n.type === "image" && n.src) names.add(n.src); (n.children ?? []).forEach((c) => walk(c as never)); };
  for (const b of graph.beats) b.nodes.forEach((n) => walk(n as never));
  return [...names];
}

export function loadRuntime(graph: Graph): Promise<Runtime> {
  if (!pending) {
    pending = (async () => {
      const bytes = async (name: string) => new Uint8Array(await (await fetch(staticFile(name))).arrayBuffer());
      const [wasm, inter] = await Promise.all([bytes("hb.wasm"), bytes("Inter-Variable.ttf")]);
      const shaper = await createShaper({ wasm, fonts: { Inter: inter } });
      const images = Object.fromEntries(await Promise.all(imageNames(graph).map(async (n) =>
        [n, await createImageBitmap(await (await fetch(staticFile(`assets/${n}`))).blob())] as const)));
      return createRuntime({ shaper, images });
    })();
  }
  return pending;
}
