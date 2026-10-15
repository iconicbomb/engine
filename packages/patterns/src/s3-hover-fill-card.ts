// S3 — hover-fill card (R7). A cursor (R7: a circular user avatar) enters a card; the card fills the brand colour and
// its pros/cons rows wipe in left -> right. Measured: fill 130 ms; rows 300 ms in total with a 40 ms stagger.
// Emits the card (a rect with a title and row texts as children) and the cursor's moveTo onto it, so the rows' wipe
// starts exactly when the cursor arrives. The fill is an onHover track (it reverts when the cursor moves on); the rows
// stay revealed. Uses the cursor system: moveTo, onHover, clip.
import { result, sec, type MacroResult, type NodeIn, type TextStyleIn } from "./macro";

export interface HoverFillCardParams {
  id: string;                     // card rect; children <id>-title, <id>-row-<n>
  cursor: string;                 // id of the cursor that visits it
  enterAt: number;                // the cursor starts moving toward the card
  moveMs?: number;                // spec: 400–600 ms
  w: number; h: number;
  x?: number; y?: number;         // card centre, relative to its parent
  title: string;
  rows: string[];
  titleStyle?: TextStyleIn;
  rowStyle?: TextStyleIn;
  fill?: string;                  // resting fill
  hoverFill?: string;             // brand colour on hover
  radius?: number;
  fillMs?: number;
  rowsMs?: number;                // all rows done within this
  rowStaggerMs?: number;
}

export function hoverFillCard(p: HoverFillCardParams): MacroResult {
  const moveMs = p.moveMs ?? 500, arrive = sec(p.enterAt + moveMs / 1000);
  const titleStyle = p.titleStyle ?? { size: 44, weight: 600 };
  const rowStyle = p.rowStyle ?? { size: 30, weight: 500, align: "left" as const };
  const stagger = p.rowStaggerMs ?? 40, rowsMs = p.rowsMs ?? 300;
  const wipeMs = Math.max(1, rowsMs - stagger * (p.rows.length - 1));        // each row's wipe, so the set ends in rowsMs
  const pad = Math.round(p.w * 0.1), left = -p.w / 2 + pad, rowGap = Math.round(rowStyle.size * 1.5);
  const top = -p.h / 2 + pad + titleStyle.size / 2;
  const rows: NodeIn[] = p.rows.map((text, i) => ({
    id: `${p.id}-row-${i + 1}`, type: "text", text, style: rowStyle,
    x: left, y: top + titleStyle.size * 0.9 + rowGap * (i + 1),
    // clip in the row's local space: the run starts at x 0 (left aligned); caps are centred on y 0
    clip: { x: 0, y: -rowStyle.size, w: 0, h: rowStyle.size * 2 },
    tracks: [{ mode: "tween", prop: "clip.w", at: sec(arrive + (i * stagger) / 1000), ms: wipeMs, from: 0, to: p.w - 2 * pad, ease: "settle" }],
  }));
  const card: NodeIn = {
    id: p.id, type: "rect", w: p.w, h: p.h, radius: p.radius ?? 28, fill: p.fill ?? "tokens.surface",
    ...(p.x ? { x: p.x } : {}), ...(p.y ? { y: p.y } : {}),
    tracks: [{ mode: "onHover", cursor: p.cursor, prop: "fill", to: p.hoverFill ?? "tokens.accent", ms: p.fillMs ?? 130, ease: "settle" }],
    children: [{ id: `${p.id}-title`, type: "text", text: p.title, style: { ...titleStyle, align: "left" }, x: left, y: top }, ...rows],
  };
  return result({
    nodes: [card],
    // park near the card's bottom edge, right of centre, clear of the rows (offsets are fractions of the card's box,
    // so they hold at any scale)
    tracks: [{ target: p.cursor, track: { mode: "moveTo", target: p.id, anchor: "bottom", offset: { x: 0.22, y: -0.12 },
      at: p.enterAt, ms: moveMs, ease: "emphasis" } }],
  });
}
