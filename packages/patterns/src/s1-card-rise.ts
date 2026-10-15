// S1 — card / panel rise (R8, R9, R7). Each card enters from below (60–120 px) with an expo-out ease and no
// overshoot, cards staggered; its content populates after the frame lands. Measured: R8 stack 600 ms expo-out,
// 70 ms per card; R9 dashboard 600 ms, then 1.0 s of child population; content lands 100–300 ms after the frame.
// An expo-out rise is visually landed at about half its duration (settle(0.5) ≈ 0.97), so children start
// childDelayMs after that point. Not modelled yet: the slight 3D perspective (perspectiveDeg) — needs the phase-6
// plane layer.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type LayoutIn, type MacroResult, type NodeIn, type TrackIn } from "./macro";

export interface CardSpec {
  id: string;                    // the card group's slug; the panel is <id>-panel
  w: number; h: number;
  x?: number; y?: number;        // card centre, px from the stack's anchor
  fill?: string; radius?: number;
  stroke?: { color: string; width: number };
  children?: NodeIn[];           // content, positioned by base x/y relative to the card centre
}

export interface CardRiseParams {
  id: string;                    // wrapper group holding every card
  cards: CardSpec[];
  at: number;
  anchor?: AnchorIn;
  layout?: LayoutIn;             // lay the cards out as a row / column (then omit their x / y)
  fromY?: number;                // rise distance
  ms?: number;
  staggerMs?: number;            // per card
  childDelayMs?: number;         // after the card visibly lands
  childStaggerMs?: number;       // per child inside a card
  childRisePx?: number;          // children drift up this much as they fade in
}

export function cardRise(p: CardRiseParams): MacroResult {
  const ms = p.ms ?? 600, fromY = p.fromY ?? 80, stagger = p.staggerMs ?? 70;
  const childDelay = p.childDelayMs ?? 150, childStagger = p.childStaggerMs ?? 70, childRise = p.childRisePx ?? 12;
  const cards = p.cards.map((c, i): NodeIn => {
    const at = sec(p.at + (i * stagger) / 1000), y = c.y ?? 0;
    const childAt = at + (ms / 2 + childDelay) / 1000;
    const panel: NodeIn = {
      id: `${c.id}-panel`, type: "rect", w: c.w, h: c.h, radius: c.radius ?? 24, fill: c.fill ?? "tokens.surface",
      ...(c.stroke ? { stroke: c.stroke } : {}),
    };
    const content = (c.children ?? []).map((n, j): NodeIn => {
      const cat = sec(childAt + (j * childStagger) / 1000), cy = n.y ?? 0;
      const tracks: TrackIn[] = [
        ...(n.tracks ?? []),
        { mode: "tween", prop: "opacity", at: cat, ms: 300, from: 0, to: n.opacity ?? 1, ease: "settle" },
        { mode: "tween", prop: "y", at: cat, ms: 300, from: cy + childRise, to: cy, ease: "settle" },
      ];
      return { ...n, tracks } as NodeIn;
    });
    return group({
      id: c.id, x: c.x, y,
      tracks: [
        { mode: "tween", prop: "y", at, ms, from: y + fromY, to: y, ease: "settle" },
        { mode: "tween", prop: "opacity", at, ms: Math.round(ms / 3), from: 0, to: 1, ease: "settle" },
      ],
    }, [panel, ...content]);
  });
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, layout: p.layout }, cards)] });
}
