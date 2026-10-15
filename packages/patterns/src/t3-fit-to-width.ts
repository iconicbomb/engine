// T3 — fit-to-width shrink (R3, R4, R5, R7). The text node scales down as characters are added so the line always
// fits a fixed box; the camera appears to zoom out. The runtime's layout solver does the work from the node's `fit`
// field, so this macro emits a patch on the text node rather than tracks.
import { result, type MacroResult } from "./macro";

export interface FitToWidthParams {
  target: string;      // id of the text node to keep inside the box
  w: number;
  h: number;
  minScale?: number;
  recenter?: boolean;
  easeMs?: number;     // how fast the scale follows content growth
}

export function fitToWidth(p: FitToWidthParams): MacroResult {
  const fit = { w: p.w, h: p.h, minScale: p.minScale ?? 0.25, recenter: p.recenter ?? true, easeMs: p.easeMs ?? 120 };
  return result({ patches: [{ target: p.target, set: { fit } }] });
}
