// S2 — ripple pill with counter (R4). A rounded pill ringed by 5–6 concentric bands of falling opacity slides in on
// a spring; a number inside counts up linearly, then a white shockwave ring fires on the final value.
// Measured: slide-in spring ~40 % overshoot settling in 330 ms (the `bounce` preset, spring(700, 18, 1), overshoots
// ~32 % and settles in ~0.34 s — kept, per CLAUDE.md); counter 1.07 s linear; shockwave 400 ms.
// Runtime: the counter is a `count` track (added for this device). Not modelled: R4's pill *width* spring
// (272 → 466 → 328 px) — the pill slides instead; tabular digits (the shaper has no OpenType features yet).
import { CountTrack, formatCount } from "@engine/graph";
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn } from "./macro";

export interface RipplePillParams {
  id: string;                     // lockup group; children <id>-band-<n>, <id>-pill, <id>-value, <id>-pulse
  at: number;
  to: number;
  from?: number;
  decimals?: number; separator?: string; prefix?: string; suffix?: string;
  style: TextStyleIn;
  anchor?: AnchorIn;
  w?: number; h?: number;         // pill core; default sized from the final string
  color?: string;
  bands?: number;
  bandStep?: number;              // px each band extends past the previous one
  slidePx?: number;
  countDelayMs?: number;          // after the slide starts (default: the spring's ~330 ms settle)
  countMs?: number;
  pulse?: boolean;
  pulseMs?: number;
  pulseScale?: number;
  pulseColor?: string;
}

export function ripplePill(p: RipplePillParams): MacroResult {
  const fmt = { decimals: p.decimals ?? 0, separator: p.separator ?? ",", prefix: p.prefix ?? "", suffix: p.suffix ?? "" };
  const final = formatCount(CountTrack.parse({ mode: "count", prop: "text", from: 0, to: p.to, ...fmt }), p.to);
  const size = p.style.size;
  const h = p.h ?? Math.round(size * 1.6);
  const w = p.w ?? Math.round([...final].length * size * 0.62 + size * 1.4);   // estimate: Inter digits ≈ 0.6 em
  const color = p.color ?? "tokens.accent", bands = p.bands ?? 5, step = p.bandStep ?? 16;
  const countAt = sec(p.at + (p.countDelayMs ?? 330) / 1000), countMs = p.countMs ?? 1070;
  const pulseAt = sec(countAt + countMs / 1000), pulseMs = p.pulseMs ?? 400;

  const children: NodeIn[] = [];
  for (let i = bands; i >= 1; i--) {             // outermost first, so inner bands draw over outer ones
    const bw = w + 2 * i * step, bh = h + 2 * i * step;
    children.push({ id: `${p.id}-band-${i}`, type: "rect", w: bw, h: bh, radius: bh / 2, fill: color,
      opacity: Math.round(0.3 * (bands + 1 - i) / bands * 1000) / 1000 });
  }
  children.push({ id: `${p.id}-pill`, type: "rect", w, h, radius: h / 2, fill: color });
  children.push({ id: `${p.id}-value`, type: "text", text: final, style: p.style,
    tracks: [{ mode: "count", prop: "text", at: countAt, ms: countMs, from: p.from ?? 0, to: p.to, ease: "linear", ...fmt }] });
  if (p.pulse ?? true) {
    children.push({ id: `${p.id}-pulse`, type: "rect", w, h, radius: h / 2,
      stroke: { color: p.pulseColor ?? "#FFFFFF", width: 4 }, opacity: 0,
      tracks: [
        // hidden until the final value lands (an earlier track holds 0), then flashes out and fades
        { mode: "tween", prop: "opacity", at: 0, ms: 0, from: 0, to: 0, ease: "linear" },
        { mode: "tween", prop: "opacity", at: pulseAt, ms: pulseMs, from: 1, to: 0, ease: "settle" },
        { mode: "tween", prop: "scale", at: pulseAt, ms: pulseMs, from: 1, to: p.pulseScale ?? 1.5, ease: "settle" },
      ] });
  }
  return result({ nodes: [group({
    id: p.id, anchor: p.anchor,
    tracks: [
      { mode: "tween", prop: "x", at: p.at, ms: 400, from: -(p.slidePx ?? 160), to: 0, ease: "bounce" },
      { mode: "tween", prop: "opacity", at: p.at, ms: 100, from: 0, to: 1, ease: "linear" },
    ],
  }, children)] });
}
