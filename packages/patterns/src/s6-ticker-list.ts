// S6 — ticker list / slot scroll (R5). A vertical list shown through a window of `visible` slots; it slides up one
// slot at a time and the item leaving the top fades. Measured: 330 ms per step, 2–3 steps.
// Built from primitives: an outer group clipped to the window, an inner list group whose y steps up one slot per
// step (one tween per step; the latest started wins), and an opacity fade on each exiting item.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn, sizeOf } from "./macro";

export interface TickerListParams {
  id: string;                     // outer (clipped) group; <id>-list holds <id>-item-<n>
  items: string[];
  style: TextStyleIn;
  at: number;                     // first step starts here
  steps?: number;                 // default 2
  stepMs?: number;
  holdMs?: number;                // pause between steps
  visible?: number;               // slots in the window
  itemHeight?: number;            // slot pitch (default 1.6 em)
  width?: number;                 // window width (px)
  anchor?: AnchorIn;
}

export function tickerList(p: TickerListParams): MacroResult {
  const steps = p.steps ?? 2, stepMs = p.stepMs ?? 330, hold = p.holdMs ?? 500;
  const visible = p.visible ?? 3, ih = p.itemHeight ?? Math.round(sizeOf(p.style) * 1.6), width = p.width ?? 1200;
  if (p.items.length < visible + steps) throw new Error(`S6: need at least visible + steps = ${visible + steps} items`);
  const stepAt = (s: number) => sec(p.at + (s * (stepMs + hold)) / 1000);
  const top = -((visible - 1) * ih) / 2;                     // slot 0 sits here so the window is centred on the anchor
  const listTracks: TweenTrackIn[] = Array.from({ length: steps }, (_, s) => (
    { mode: "tween", prop: "y", at: stepAt(s), ms: stepMs, from: top - s * ih, to: top - (s + 1) * ih, ease: "settle" }));
  const items: NodeIn[] = p.items.map((text, i) => ({
    id: `${p.id}-item-${i + 1}`, type: "text", text, style: p.style, ...(i ? { y: i * ih } : {}),
    // item i leaves the top slot on step i: it fades as it slides out
    tracks: i < steps ? [{ mode: "tween", prop: "opacity", at: stepAt(i), ms: stepMs, from: 1, to: 0, ease: "settle" }] : [],
  }));
  const list = group({ id: `${p.id}-list`, y: top, tracks: listTracks }, items);
  const window: NodeIn = { ...group({ id: p.id, anchor: p.anchor }, [list]),
    clip: { x: -width / 2, y: top - ih / 2, w: width, h: visible * ih } } as NodeIn;
  return result({ nodes: [window] });
}
