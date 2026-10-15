// S9 — pill marquee grid (R4). Rows of pills pop in with a scale stagger, then the rows scroll in alternating
// directions for the rest of the beat. Measured: pop-in 600 ms for all; scroll ~40 px/s (linear — marquees are
// supposed to read as mechanical).
// Each pill is a rect sized to its label (sizeToContent). Pill positions along a row use an estimated label width
// (~0.58 em per char) because macros can't measure text and the runtime has no row/flex layout yet; the gap absorbs
// the estimate's error. Rows repeat their items until they cover the canvas plus the scroll travel on both sides.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn } from "./macro";

export interface PillMarqueeParams {
  id: string;                     // group; rows <id>-row-<r>, pills <id>-row-<r>-pill-<n>
  rows: string[][];
  style: TextStyleIn;
  at: number;
  scrollMs: number;               // how long the rows scroll (typically to the end of the beat)
  anchor?: AnchorIn;
  speed?: number;                 // px/s
  popTotalMs?: number;            // every pill has popped within this
  popMs?: number;                 // each pill's pop
  rowGap?: number;
  gap?: number;                   // between pills
  padX?: number; padY?: number;
  fill?: string;
  stroke?: { color: string; width: number };
  coverWidth?: number;            // canvas width to cover (px)
}

export function pillMarquee(p: PillMarqueeParams): MacroResult {
  const size = p.style.size, speed = p.speed ?? 40, popTotal = p.popTotalMs ?? 600, popMs = p.popMs ?? 300;
  const padX = p.padX ?? Math.round(size * 0.7), padY = p.padY ?? Math.round(size * 0.35);
  const gap = p.gap ?? Math.round(size * 0.6), rowGap = p.rowGap ?? Math.round(size * 2.6);
  const travel = (speed * p.scrollMs) / 1000, cover = (p.coverWidth ?? 1920) + 2 * travel + 400;
  const est = (t: string) => [...t].length * size * 0.58 + 2 * padX;
  // lay each row out (repeating its items) until it spans `cover`, centred on 0
  const laid = p.rows.map((items) => {
    const pills: { text: string; x: number }[] = [];
    let x = 0;
    for (let i = 0; x < cover; i = (i + 1) % items.length) { const w = est(items[i]); pills.push({ text: items[i], x: x + w / 2 }); x += w + gap; }
    return pills.map((q) => ({ ...q, x: Math.round(q.x - (x - gap) / 2) }));
  });
  // pop-in cascades out from the centre: delay grows with distance across the visible half-width, so on-screen pills
  // stagger visibly and every pill (off-screen repeats included) has popped within popTotal
  const half = (p.coverWidth ?? 1920) / 2;
  const delay = (x: number) => (Math.min(1, Math.abs(x) / half) * (popTotal - popMs)) / 1000;
  const scrollAt = sec(p.at + popTotal / 1000);
  const rows: NodeIn[] = laid.map((pills, r) => group({
    id: `${p.id}-row-${r + 1}`, y: Math.round((r - (laid.length - 1) / 2) * rowGap),
    // alternate directions: even rows scroll left, odd rows right
    tracks: [{ mode: "tween", prop: "x", at: scrollAt, ms: p.scrollMs, from: 0, to: (r % 2 ? 1 : -1) * travel, ease: "linear" }],
  }, pills.map((q, n): NodeIn => ({
    id: `${p.id}-row-${r + 1}-pill-${n + 1}`, type: "rect", w: 1, h: 1, radius: 9999, fill: p.fill ?? "tokens.surface",
    ...(p.stroke ? { stroke: p.stroke } : {}), sizeToContent: { padX, padY }, ...(q.x ? { x: q.x } : {}),
    tracks: [{ mode: "tween", prop: "scale", at: sec(p.at + delay(q.x)), ms: popMs, from: 0, to: 1, ease: "bounce" }],
    children: [{ id: `${p.id}-row-${r + 1}-pill-${n + 1}-label`, type: "text", text: q.text, style: p.style }],
  }))));
  return result({ nodes: [group({ id: p.id, anchor: p.anchor }, rows)] });
}
