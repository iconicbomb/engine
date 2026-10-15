// The active runtime for the render app, loaded once per browser session. Imported by the harness
// (never passed as a Remotion prop: props are serialised to JSON, so functions would be stripped).
// Assets live in apps/render/public (copies of packages/runtime/{wasm,fonts}) and are fetched via staticFile.
import { staticFile } from "remotion";
import { createShaper } from "@engine/runtime/shaper";
import { createRuntime } from "@engine/runtime/canvas2d";
import type { Runtime } from "@engine/runtime";

let pending: Promise<Runtime> | null = null;

export function loadRuntime(): Promise<Runtime> {
  if (!pending) {
    pending = (async () => {
      const bytes = async (name: string) => new Uint8Array(await (await fetch(staticFile(name))).arrayBuffer());
      const [wasm, inter] = await Promise.all([bytes("hb.wasm"), bytes("Inter-Variable.ttf")]);
      const shaper = await createShaper({ wasm, fonts: { Inter: inter } });
      return createRuntime({ shaper });
    })();
  }
  return pending;
}
