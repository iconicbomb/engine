// S16 — mascot with idle life (R7). The character drops in with a bounce, then bobs ±3 px and blinks every 2–4 s
// (100 ms); the wordmark wipes out of it. Measured: drop 200 ms + bounce; blink 100 ms.
// An image node (runtime: image, src from the renderer's assets): the body bobs as a deterministic list of y tweens
// across the beat; a blink is the eyes-closed image shown for blinkMs (0 ms holds, latest started wins); the wordmark is
// a text node revealed left -> right with clip.w. Not modelled yet: sparkles on emphasis.
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn, sizeOf } from "./macro";

export interface MascotParams {
  id: string;                     // group; children <id>-body, <id>-blink, <id>-wordmark
  src?: string;                   // eyes open; omitted = the built-in vector mascot (rounded body, eyes, mouth)
  blinkSrc?: string;              // eyes closed (image mascots only; the vector mascot blinks with lids)
  fill?: string;                  // vector mascot body colour (default tokens.accent)
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
  const children: NodeIn[] = [];
  // visible only during blinks (closed = true) or only between them (closed = false): 0 ms holds, latest started wins
  const blinkTracks = (closed = true): TweenTrackIn[] => {
    const on = closed ? 1 : 0, off = closed ? 0 : 1;
    const blinks: TweenTrackIn[] = [{ mode: "tween", prop: "opacity", at: 0, ms: 0, from: off, to: off, ease: "linear" }];
    for (let t = sec(landed + 0.7); t + blinkMs / 1000 <= p.until; t = sec(t + every / 1000)) {
      blinks.push({ mode: "tween", prop: "opacity", at: t, ms: 0, from: on, to: on, ease: "linear" },
        { mode: "tween", prop: "opacity", at: sec(t + blinkMs / 1000), ms: 0, from: off, to: off, ease: "linear" });
    }
    return blinks;
  };
  if (p.src) children.push({ id: `${p.id}-body`, type: "image", src: p.src, w: p.w, h: p.h, fit: "contain", tracks: bobs });
  else {
    // vector mascot: a rounded body (surface treatment gives it light and an under-glow), two eyes with pupils looking
    // slightly to one side, a small smile; blinks are lids in the body colour over the eyes
    const W = p.w, H = p.h, fill = p.fill ?? "tokens.accent", eyeW = Math.round(W * 0.17), eyeH = Math.round(H * 0.22);
    const eyeY = Math.round(-H * 0.08), eyeX = Math.round(W * 0.2), pupil = Math.round(eyeW * 0.5);
    const eye = (n: number, x: number): NodeIn[] => [
      { id: `${p.id}-eye-${n}`, type: "rect", w: eyeW, h: eyeH, radius: eyeW, fill: "#FFFFFF", surface: "flat", x, y: eyeY, tracks: blinkTracks(false) },
      { id: `${p.id}-pupil-${n}`, type: "rect", w: pupil, h: pupil, radius: pupil, fill: "#14161C", surface: "flat", x: x + Math.round(eyeW * 0.12), y: eyeY + Math.round(eyeH * 0.1), tracks: blinkTracks(false) },
      // closed eye: a short dark line where the eye was
      { id: `${p.id}-lid-${n}`, type: "rect", w: eyeW, h: Math.max(4, Math.round(eyeH * 0.12)), radius: 4, fill: "#14161C", surface: "flat", x, y: eyeY + Math.round(eyeH * 0.15), tracks: blinkTracks(true) },
    ];
    children.push({ id: `${p.id}-body`, type: "rect", w: W, h: H, radius: Math.round(H * 0.32), fill, surface: "card", tracks: bobs,
      children: [
        ...eye(1, -eyeX), ...eye(2, eyeX),
        { id: `${p.id}-mouth`, type: "path", d: `M ${-Math.round(W * 0.12)} 0 Q 0 ${Math.round(H * 0.1)} ${Math.round(W * 0.12)} 0`, stroke: "#14161C", strokeWidth: Math.max(3, Math.round(H * 0.035)), y: Math.round(H * 0.22) },
      ] });
  }
  if (p.src && p.blinkSrc) {
    // the closed-eyes image rides the same bob as the body
    children.push({ id: `${p.id}-blink`, type: "image", src: p.blinkSrc, w: p.w, h: p.h, fit: "contain", tracks: [...blinkTracks(), ...bobs.map((b) => ({ ...b }))] });
  }
  if (p.wordmark) {
    const wm = p.wordmark, at = wm.at ?? sec(p.at + 0.45), span = [...wm.text].length * sizeOf(wm.style) * 0.7;
    children.push({ id: `${p.id}-wordmark`, type: "text", text: wm.text, style: { ...wm.style, align: "left" }, x: p.w / 2 + (wm.gap ?? Math.round(sizeOf(wm.style) * 0.4)),
      clip: { x: 0, y: -sizeOf(wm.style), w: 0, h: sizeOf(wm.style) * 2 },
      tracks: [{ mode: "tween", prop: "clip.w", at, ms: wm.ms ?? 300, from: 0, to: span, ease: "settle" }] });
  }
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, tracks: [
    { mode: "tween", prop: "y", at: p.at, ms: 200, from: -drop, to: 0, ease: "bounce" },
    { mode: "tween", prop: "opacity", at: p.at, ms: 100, from: 0, to: 1, ease: "linear" },
  ] }, children)] });
}
