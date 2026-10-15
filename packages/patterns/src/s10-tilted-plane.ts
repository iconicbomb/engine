// S10 — tilted 3D UI with pan (R4, R7, R9). A real screenshot or rebuilt UI sits on a plane rotated 10–25° about Y and
// 5–10° about X, with a slow dolly and pan; cursor clicks happen on the plane. Measured: dolly ~2 % scale / s.
// A group with rotY / rotX (node tilt, added for this device: an orthographic affine, so the measure pass — and a
// cursor's moveTo — see the tilted geometry). The plane eases in from a steeper angle, then dollies (linear scale)
// and pans (linear x / y) until `until`. Not modelled yet: perspective foreshortening and depth of field (WebGL plane
// layer, phase 6).
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TweenTrackIn } from "./macro";

export interface TiltedPlaneParams {
  id: string;
  children: NodeIn[];             // the UI on the plane
  at: number;
  until: number;                  // the dolly / pan run until here (beat-local s)
  anchor?: AnchorIn;
  rotY?: number;                  // degrees, 10–25
  rotX?: number;                  // degrees, 5–10
  enterFromRotY?: number;         // the plane eases in from this
  enterMs?: number;
  dollyRate?: number;             // scale per second
  pan?: { x?: number; y?: number };   // px over the whole run
}

export function tiltedPlane(p: TiltedPlaneParams): MacroResult {
  const rotY = p.rotY ?? 14, rotX = p.rotX ?? 6, enter = p.enterMs ?? 600, run = Math.max(0, p.until - p.at);   // 14 / 6: the spec's example plane
  const tracks: TweenTrackIn[] = [
    { mode: "tween", prop: "rotY", at: p.at, ms: enter, from: p.enterFromRotY ?? rotY + 20, to: rotY, ease: "settle" },
    { mode: "tween", prop: "opacity", at: p.at, ms: Math.round(enter / 3), from: 0, to: 1, ease: "settle" },
    { mode: "tween", prop: "scale", at: p.at, ms: Math.round(run * 1000), from: 1, to: sec(1 + (p.dollyRate ?? 0.02) * run), ease: "linear" },
  ];
  if (p.pan?.x) tracks.push({ mode: "tween", prop: "x", at: p.at, ms: Math.round(run * 1000), from: 0, to: p.pan.x, ease: "linear" });
  if (p.pan?.y) tracks.push({ mode: "tween", prop: "y", at: p.at, ms: Math.round(run * 1000), from: 0, to: p.pan.y, ease: "linear" });
  const plane = { ...group({ id: p.id, anchor: p.anchor, tracks }, p.children), rotX, rotY } as NodeIn;
  return result({ nodes: [plane] });
}
