// S2 — ripple pill with counter (R4). A rounded pill ringed by 5–6 concentric bands of falling opacity slides in on
// a spring; a number inside counts up linearly, then a white shockwave ring fires on the final value.
// Measured: slide-in spring ~40 % overshoot settling in 330 ms (the `bounce` preset, spring(700, 18, 1), overshoots
// ~32 % and settles in ~0.34 s — kept, per CLAUDE.md); counter 1.07 s linear; shockwave 400 ms.
// Layout: the pill is a rect sized to its counter (sizeToContent) with tabular digits (tnum), so it grows with the
// number without jitter. Each band wraps the next one in (nested rects); because opacity multiplies down a tree,
// band transparency lives in the fill colour, so `color` must be a hex colour. The pulse ring wraps an invisible
// copy of the counter (layout ignores opacity) to stay exactly pill-sized. Not modelled: R4's pill *width* spring
// (272 → 466 → 328 px) — the pill slides in instead.
import { CountTrack, formatCount } from "@engine/graph";
import { group } from "./assemble";
import { result, sec, type AnchorIn, type CountTrackIn, type MacroResult, type NodeIn, type TextStyleIn } from "./macro";

export interface RipplePillParams {
  id: string;                     // lockup group; <id>-band-<n> > … > <id>-pill > <id>-value, and <id>-pulse
  at: number;
  to: number;
  from?: number;
  decimals?: number; separator?: string; prefix?: string; suffix?: string;
  style: TextStyleIn;
  color: string;                  // hex #RRGGBB: bands use it with falling alpha
  anchor?: AnchorIn;
  padX?: number; padY?: number;   // pill padding around the counter
  bands?: number;
  bandStep?: number;              // px each band extends past the one inside it
  slidePx?: number;
  countDelayMs?: number;          // after the slide starts (default: the spring's ~330 ms settle)
  countMs?: number;
  tabular?: boolean;              // tnum digits (default true)
  pulse?: boolean;
  pulseMs?: number;
  pulseScale?: number;
  pulseColor?: string;
}

export function ripplePill(p: RipplePillParams): MacroResult {
  if (!/^#[0-9a-fA-F]{6}$/.test(p.color)) throw new Error(`S2: color must be #RRGGBB (bands add alpha), got ${p.color}`);
  const fmt = { decimals: p.decimals ?? 0, separator: p.separator ?? ",", prefix: p.prefix ?? "", suffix: p.suffix ?? "" };
  const final = formatCount(CountTrack.parse({ mode: "count", prop: "text", from: 0, to: p.to, ...fmt }), p.to);
  const size = p.style.size;
  const minH = Math.round(size * 1.6);
  const pad = { padX: p.padX ?? Math.round(size * 0.45), padY: p.padY ?? Math.round(size * 0.2) };
  const bands = p.bands ?? 5, step = p.bandStep ?? 16;
  const countAt = sec(p.at + (p.countDelayMs ?? 330) / 1000), countMs = p.countMs ?? 1070;
  const pulseAt = sec(countAt + countMs / 1000), pulseMs = p.pulseMs ?? 400;
  const style: TextStyleIn = (p.tabular ?? true) ? { ...p.style, features: [...(p.style.features ?? []), "tnum"] } : p.style;
  const count: CountTrackIn = { mode: "count", prop: "text", at: countAt, ms: countMs, from: p.from ?? 0, to: p.to, ease: "linear", ...fmt };

  const value: NodeIn = { id: `${p.id}-value`, type: "text", text: final, style, tracks: [count] };
  let inner: NodeIn = { id: `${p.id}-pill`, type: "rect", w: minH, h: minH, radius: 9999, fill: p.color, sizeToContent: pad, children: [value] };
  for (let i = 1; i <= bands; i++) {             // band-1 wraps the pill, band-n wraps band-(n-1); outermost draws first
    const alpha = Math.round(0.3 * (bands + 1 - i) / bands * 255).toString(16).padStart(2, "0");
    inner = { id: `${p.id}-band-${i}`, type: "rect", w: 1, h: 1, radius: 9999, fill: `${p.color}${alpha}`,
      sizeToContent: { padX: step, padY: step }, children: [inner] };
  }
  const children: NodeIn[] = [inner];
  if (p.pulse ?? true) {
    children.push({ id: `${p.id}-pulse`, type: "rect", w: minH, h: minH, radius: 9999,
      stroke: { color: p.pulseColor ?? "#FFFFFF", width: 4 }, opacity: 0, sizeToContent: pad,
      children: [{ id: `${p.id}-pulse-measure`, type: "text", text: final, style, opacity: 0, tracks: [{ ...count }] }],
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
