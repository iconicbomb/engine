// T14 — scroll-bound section text (R1, R2). Headline + body slide in from the side and fade with scroll position,
// strictly aligned to a 12-column web grid. Measured: ~400 ms per section at normal scroll speed.
// A page group scrolls up linearly; each section's headline / body slide in (offsetPx -> 0) and fade in over 400 ms
// centred on the moment the scroll brings the section to the viewport centre, then fade as it scrolls on. Text snaps
// to the left edge of a grid column. Not modelled yet: multi-line body copy (text nodes are single-line).
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn , sizeOf } from "./macro";

export interface ScrollSectionsParams {
  id: string;                     // page <id>; sections <id>-s<n> with <id>-s<n>-head / <id>-s<n>-body
  sections: { headline: string; body: string; column?: number }[];   // column: 1-based start column (default 2)
  headStyle: TextStyleIn;
  bodyStyle: TextStyleIn;
  at: number;                     // the scroll starts (section 1 is centred here)
  sectionMs?: number;             // scroll time per section
  sectionHeight?: number;         // px between sections
  offsetPx?: number;              // slide-in distance
  enterMs?: number;
  grid?: { columns?: number; width?: number; gutter?: number };
  anchor?: AnchorIn;
}

export function scrollSections(p: ScrollSectionsParams): MacroResult {
  const per = (p.sectionMs ?? 900) / 1000, hgt = p.sectionHeight ?? 420, off = p.offsetPx ?? 120, enter = p.enterMs ?? 400;
  const cols = p.grid?.columns ?? 12, W = p.grid?.width ?? 1200, g = p.grid?.gutter ?? 24, cw = (W - (cols - 1) * g) / cols;
  const colX = (c: number) => Math.round(-W / 2 + (Math.max(1, Math.min(cols, c)) - 1) * (cw + g));
  const n = p.sections.length;
  const sections: NodeIn[] = p.sections.map((s, i) => {
    const centred = p.at + i * per, inAt = sec(centred - enter / 2000), outAt = sec(centred + per / 2);
    const x = colX(s.column ?? 2);
    const piece = (id: string, text: string, style: TextStyleIn, y: number, delay: number): NodeIn => {
      const a = sec(inAt + delay);
      const tracks: TweenTrackIn[] = [
        { mode: "tween", prop: "x", at: a, ms: enter, from: x + off, to: x, ease: "settle" },
        { mode: "tween", prop: "opacity", at: a, ms: enter, from: 0, to: 1, ease: "settle" },
      ];
      if (i < n - 1) tracks.push({ mode: "tween", prop: "opacity", at: outAt, ms: Math.round(per * 500), from: 1, to: 0, ease: "settle" });
      return { id, type: "text", text, style: { ...style, align: "left" }, x, y, tracks };
    };
    return group({ id: `${p.id}-s${i + 1}`, y: i * hgt }, [
      piece(`${p.id}-s${i + 1}-head`, s.headline, p.headStyle, -Math.round(sizeOf(p.headStyle) * 0.45), 0),
      piece(`${p.id}-s${i + 1}-body`, s.body, p.bodyStyle, Math.round(sizeOf(p.headStyle) * 0.55), 0.07),
    ]);
  });
  const scroll: TweenTrackIn = { mode: "tween", prop: "y", at: p.at, ms: Math.round((n - 1) * per * 1000), from: 0, to: -(n - 1) * hgt, ease: "linear" };
  return result({ nodes: [group({ id: p.id, anchor: p.anchor, tracks: n > 1 ? [scroll] : [] }, sections)] });
}
