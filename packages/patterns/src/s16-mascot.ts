// S16 — mascot with idle life (R7). The character drops in with a bounce, then bobs ±3 px and blinks every 2–4 s
// (100 ms); the wordmark wipes out of it. Measured: drop 200 ms + bounce; blink 100 ms.
// An image node (runtime: image, src from the renderer's assets): the body bobs as a deterministic list of y tweens
// across the beat; a blink is the eyes-closed image shown for blinkMs (0 ms holds, latest started wins); the wordmark is
// a text node revealed left -> right with clip.w. Not modelled yet: sparkles on emphasis.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface MascotParams {
  id: string;                     // group; children <id>-body, <id>-blink, <id>-wordmark
  src: string;                    // eyes open
  blinkSrc?: string;              // eyes closed (no blinks without it)
  w: number; h: number;
  at: number;                     // drop starts
  until: number;                  // idle life runs until (beat-local s), e.g. the beat's duration
  anchor?: AnchorIn;
  dropPx?: number;
  bobPx?: number;
  bobPeriodMs?: number;
  blinkEveryMs?: number;
  blinkMs?: number;
  wordmark?: { text: string; style: TextStyleIn; gap?: number; at?: number; ms?: number };
}

export function mascot(p: MascotParams): MacroResult {
  const drop = p.dropPx ?? 320, bob = p.bobPx ?? 3;
  const half = (p.bobPeriodMs ?? 1200) / 2;      // bob period: unmeasured (the spec gives only the ±3 px amplitude)
  const every = p.blinkEveryMs ?? 3000, blinkMs = p.blinkMs ?? 100;   // every 3 s: the middle of the measured 2–4 s
  const landed = sec(p.at + 0.5);                // the bounce has settled (spring ~0.34 s after the 200 ms fall)
  // bob: half-periods alternating 0 -> -bob -> +bob -> -bob ..., each an in-out (emphasis) tween ending at rest
  const bobs: TweenTrackIn[] = [];
  for (let t = landed, k = 0; t + half / 1000 <= p.until; t = sec(t + half / 1000), k++) {
    const up = k % 2 === 0;
    bobs.push({ mode: "tween", prop: "y", at: t, ms: half, from: k === 0 ? 0 : up ? bob : -bob, to: up ? -bob : bob, ease: "emphasis" });
  }
  const children: NodeIn[] = [{ id: `${p.id}-body`, type: "image", src: p.src, w: p.w, h: p.h, fit: "contain", tracks: bobs }];
  if (p.blinkSrc) {
    const blinks: TweenTrackIn[] = [{ mode: "tween", prop: "opacity", at: 0, ms: 0, from: 0, to: 0, ease: "linear" }];
    for (let t = sec(landed + 0.7); t + blinkMs / 1000 <= p.until; t = sec(t + every / 1000)) {
      blinks.push({ mode: "tween", prop: "opacity", at: t, ms: 0, from: 1, to: 1, ease: "linear" },
        { mode: "tween", prop: "opacity", at: sec(t + blinkMs / 1000), ms: 0, from: 0, to: 0, ease: "linear" });
    }
    // the closed-eyes image rides the same bob as the body
    children.push({ id: `${p.id}-blink`, type: "image", src: p.blinkSrc, w: p.w, h: p.h, fit: "contain", tracks: [...blinks, ...bobs.map((b) => ({ ...b }))] });
  }
  if (p.wordmark) {
    const wm = p.wordmark, at = wm.at ?? sec(p.at + 0.45), span = [...wm.text].length * wm.style.size * 0.7;
    children.push({ id: `${p.id}-wordmark`, type: "text", text: wm.text, style: { ...wm.style, align: "left" }, x: p.w / 2 + (wm.gap ?? Math.round(wm.style.size * 0.4)),
      clip: { x: 0, y: -wm.style.size, w: 0, h: wm.style.size * 2 },
      tracks: [{ mode: "tween", prop: "clip.w", at, ms: wm.ms ?? 300, from: 0, to: span, ease: "settle" }] });
  }
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, tracks: [
    { mode: "tween", prop: "y", at: p.at, ms: 200, from: -drop, to: 0, ease: "bounce" },
    { mode: "tween", prop: "opacity", at: p.at, ms: 100, from: 0, to: 1, ease: "linear" },
  ] }, children)] });
}
