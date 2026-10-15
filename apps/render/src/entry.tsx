// Remotion entry: parse the fixture graph and register the root. The runtime lives in ./runtime.ts.
import { registerRoot, makeRoot } from "./harness";
import { parseGraph } from "@engine/graph";
import graphJson from "../../../fixtures/r3-hook.graph.json";

registerRoot(makeRoot(parseGraph(graphJson)));
