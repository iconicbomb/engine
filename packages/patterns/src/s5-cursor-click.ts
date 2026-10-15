// S5 — giant cursor + hover states (R5, R7). The cursor moves on an ease-in-out path to a target, pauses before the
// click; the target takes its hover background, then a pressed scale of 0.96. Measured: move 400–600 ms, pause
// 150 ms before the click, hover 100 ms, press 80 ms. R5's cursor is ~2x normal size (giantCursor).
// Emits tracks only: the cursor's moveTo + press, and on the target an onHover background plus the press dip.
import { result, sec, type CursorNodeIn, type MacroResult, type AnchorIn } from "./macro";

export interface CursorClickParams {
  cursor: string;
  target: string;
  at: number;                     // the cursor starts moving
  moveMs?: number;
  pauseMs?: number;               // between arrival and the click
  pressMs?: number;
  hover?: { prop?: "fill"; to: string; ms?: number } | false;   // the target's hover background (false = none)
  pressScale?: number;            // the target's dip (1 = no dip)
  anchor?: "center" | "left" | "right" | "top" | "bottom";
  offset?: { x: number; y: number };
}

export function cursorClick(p: CursorClickParams): MacroResult {
  const moveMs = p.moveMs ?? 500, pressMs = p.pressMs ?? 80;
  const pressAt = sec(p.at + (moveMs + (p.pauseMs ?? 150)) / 1000);
  const dip = p.pressScale ?? 0.96, half = pressMs / 2;
  const tracks: MacroResult["tracks"] = [
    { target: p.cursor, track: { mode: "moveTo", target: p.target, at: p.at, ms: moveMs, ease: "emphasis",
      ...(p.anchor ? { anchor: p.anchor } : {}), ...(p.offset ? { offset: p.offset } : {}) } },
    { target: p.cursor, track: { mode: "press", at: pressAt, ms: pressMs } },
  ];
  if (p.hover !== false && p.hover) {
    tracks.push({ target: p.target, track: { mode: "onHover", cursor: p.cursor, prop: p.hover.prop ?? "fill", to: p.hover.to, ms: p.hover.ms ?? 100, ease: "settle" } });
  }
  if (dip !== 1) {
    tracks.push(
      { target: p.target, track: { mode: "tween", prop: "scale", at: pressAt, ms: half, from: 1, to: dip, ease: "settle" } },
      { target: p.target, track: { mode: "tween", prop: "scale", at: sec(pressAt + half / 1000), ms: half, from: dip, to: 1, ease: "settle" } },
    );
  }
  return result({ tracks });
}

// R5's giant cursor: a top-level cursor node at ~2x, starting at an anchor (canvas fractions)
export function giantCursor(p: { id: string; style?: "arrow" | "hand" | "avatar"; size?: number; anchor?: AnchorIn }): CursorNodeIn {
  return { id: p.id, type: "cursor", style: p.style ?? "arrow", size: p.size ?? 2, ...(p.anchor ? { anchor: p.anchor } : {}) };
}
