// T7 — gradient -> white settle (R6). A word enters in a two-colour gradient (pink -> purple), desaturates to the body
// colour (white) over the hold, and exits by dropping opacity and y. Measured: enter 270 ms, settle to white 500 ms,
// hold 600 ms, exit 200 ms; per-char y stagger 30 ms.
// Text gradient (TextStyle.gradient, added for this device) whose amount tweens 1 -> 0; per-glyph enter / exit are
// staggered tweens (two tracks per prop; the latest started wins per glyph).
import { result, sec, type AnchorIn, type MacroResult, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface GradientSettleParams {
  id: string;
  text: string;
  style: TextStyleIn;             // its colour is what the gradient settles to
  at: number;
  anchor?: AnchorIn;
  gradient?: { from: string; to: string };
  enterMs?: number;
  settleMs?: number;
  holdMs?: number;
  exitMs?: number;
  staggerMs?: number;
  risePx?: number;                // glyphs rise into place from this far below
  exitDrop?: number;              // and drop this far on exit
  exit?: boolean;                 // default true
}

export function gradientSettle(p: GradientSettleParams): MacroResult {
  const enter = p.enterMs ?? 270, settle = p.settleMs ?? 500, hold = p.holdMs ?? 600, exitMs = p.exitMs ?? 200, stagger = p.staggerMs ?? 30;
  const n = [...p.text].length, entered = sec(p.at + (enter + stagger * (n - 1)) / 1000);
  const exitAt = sec(entered + hold / 1000);
  const tracks: TweenTrackIn[] = [
    { mode: "tween", prop: "opacity", at: p.at, ms: enter, from: 0, to: 1, ease: "settle", staggerMs: stagger },
    { mode: "tween", prop: "y", at: p.at, ms: enter, from: p.risePx ?? 30, to: 0, ease: "settle", staggerMs: stagger },
    { mode: "tween", prop: "gradient.amount", at: entered, ms: settle, from: 1, to: 0, ease: "settle" },
  ];
  if (p.exit ?? true) tracks.push(
    { mode: "tween", prop: "opacity", at: exitAt, ms: exitMs, from: 1, to: 0, ease: "settle", staggerMs: stagger },
    { mode: "tween", prop: "y", at: exitAt, ms: exitMs, from: 0, to: p.exitDrop ?? 40, ease: "settle", staggerMs: stagger },
  );
  const gradient = { ...(p.gradient ?? { from: "#FF5FA2", to: "#8B5CF6" }), amount: 1 };
  return result({ nodes: [{ id: p.id, type: "text", text: p.text, style: { ...p.style, gradient }, ...(p.anchor ? { anchor: p.anchor } : {}), tracks }] });
}
