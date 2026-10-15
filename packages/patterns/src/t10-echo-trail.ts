// T10 — echo / ghost trail (R4). As the word shrinks and recedes, 4–5 copies of it fan out behind it along one axis
// at falling opacity. Measured: 400 ms; copies at 60 / 40 / 25 / 15 %.
// Built from primitives: a group (the word on top, copies drawn faintest-first beneath it) whose scale and position
// carry the recede; each copy tweens out to its slot and opacity, then the trail fades on `fadeAt`.
import { group } from "./assemble";
import { result, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn, sizeOf } from "./macro";

export interface EchoTrailParams {
  id: string;                     // group; children <id>-echo-<n> (n = 1 nearest) and <id>-word
  text: string;
  style: TextStyleIn;
  at: number;
  anchor?: AnchorIn;
  ms?: number;
  opacities?: number[];           // nearest copy first; its length is the copy count
  axis?: "x" | "y";
  spacing?: number;               // px between copies at full scale (default 0.4 em), signed: + = down / right
  toScale?: number;               // the word shrinks to this
  travel?: number;                // and recedes this far along the axis, opposite the trail (px)
  fadeAt?: number;                // the trail fades out from here over exitMs (omit = trail holds)
  exitMs?: number;
}

export function echoTrail(p: EchoTrailParams): MacroResult {
  const ms = p.ms ?? 400, axis = p.axis ?? "y";
  const ops = p.opacities ?? [0.6, 0.4, 0.25, 0.15];
  const spacing = p.spacing ?? Math.round(sizeOf(p.style) * 0.4);
  const copies: NodeIn[] = ops.map((op, k) => ({ i: k + 1, op })).reverse().map(({ i, op }) => {
    const tracks: TweenTrackIn[] = [
      { mode: "tween", prop: axis, at: p.at, ms, from: 0, to: i * spacing, ease: "settle" },
      { mode: "tween", prop: "opacity", at: p.at, ms, from: 0, to: op, ease: "settle" },
    ];
    if (p.fadeAt !== undefined) tracks.push({ mode: "tween", prop: "opacity", at: p.fadeAt, ms: p.exitMs ?? 200, from: op, to: 0, ease: "settle" });
    return { id: `${p.id}-echo-${i}`, type: "text", text: p.text, style: p.style, tracks };
  });
  const word: NodeIn = { id: `${p.id}-word`, type: "text", text: p.text, style: p.style };
  const recede: TweenTrackIn[] = [{ mode: "tween", prop: "scale", at: p.at, ms, from: 1, to: p.toScale ?? 0.6, ease: "emphasis" }];
  if (p.travel) recede.push({ mode: "tween", prop: axis, at: p.at, ms, from: 0, to: -Math.sign(spacing) * p.travel, ease: "emphasis" });
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, tracks: recede }, [...copies, word])] });
}
