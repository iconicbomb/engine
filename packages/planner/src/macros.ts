// Macro adapters: a selected macro + the beat's content -> pattern-library calls. Timing parameters come from the
// motion laws in timing.ts (size-scaled durations, energy staggers, cps) and the selection's perturbation.
import type { Brief } from "@engine/graph";
import {
  bracketFrame, cardRise, colourSweep, cursorClick, fitToWidth, giantCursor, gradientSettle, group, hoverFillCard, logoTypewriter,
  pillMarquee, reveal, ripplePill, scrambleTypewriter, slantSettle, tailTypewriter, tiltedPlane, trackingContraction, wireFan, wordAppend,
  type MacroResult, type NodeIn, type TextStyleIn,
} from "@engine/patterns";
import type { Rng } from "./rng";
import type { Selection, ShapeMacro, TextMacro } from "./select";
import { sized } from "./timing";
import type { PlanBeat } from "./types";

export interface Ctx {
  beat: PlanBeat;
  brief: Brief;
  sel: Selection;
  feature?: Brief["product"]["features"][number];
  at: number;                 // entry time within the beat (after the transition delay and coverage shift)
  duration: number;
  titleSize: number;
  cps: number;
  staggerMs: number;
  rng: Rng;
}
export interface Built {
  title: NodeIn[];            // laid out at the top of the stage
  visuals: { node: NodeIn; width: number }[];
  top: NodeIn[];              // top-level nodes: cursors, wires, background marquees
  results: MacroResult[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const per = (c: Ctx, ms: number) => Math.round(ms * c.sel.perturb);   // referenceInfluence perturbation of a measured default
const hex = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const titleStyle = (c: Ctx, scale = 1): TextStyleIn => ({ size: Math.round(c.titleSize * scale * 10) / 10, weight: 700, color: c.brief.tokens.fg });

// ---------------- text macros: the beat's title device ----------------
type TextOut = { nodes: NodeIn[]; results: MacroResult[]; typedAt: number; width?: { "16:9": number; "9:16": number } };
// devices that work chunk by chunk: a long title (multi-line text isn't modelled in the runtime) becomes word chunks
// of <= 18 chars, each its own macro run (each starts when the one before has landed), in a wrapping row whose
// maxWidth differs per aspect — ~36 chars a line at 16:9, one chunk a line at 9:16 — so the title reflows instead of
// shrinking the portrait stage.
const SPLITTABLE = new Set<TextMacro>(["T2", "T4", "T6", "T7", "T8", "T11"]);
export const LINE_CHARS = 22, CHUNK_CHARS = 18, LANDSCAPE_LINE = 36;
export const EM = 0.62;      // average advance of Inter bold, em per char, with margin (an estimate; the runtime measures)
export function chunks(text: string, max = CHUNK_CHARS): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = out.at(-1);
    if (last !== undefined && (last + " " + word).length <= max) out[out.length - 1] = last + " " + word; else out.push(word);
  }
  return out;
}
// the lines a chunked title wraps into at a given line length (for estimates and tests; the runtime does the real wrap)
export function wrapChunks(cs: string[], lineChars: number): string[] {
  const lines: string[] = [];
  for (const c of cs) { const l = lines.at(-1); if (l !== undefined && (l + " " + c).length <= lineChars) lines[lines.length - 1] = l + " " + c; else lines.push(c); }
  return lines;
}
// T13: the wordmark (1.3x, plus its mark); the 0.45x line under it is left to the runtime's fit
const logoWidth = (c: Ctx, size: number) => Math.round([...c.brief.product.name].length * EM * size * 1.3 + size * 1.5);
// the runtime caps every text node's *local* width at 90 % of the canvas (547 px at 9:16), whatever its ancestors'
// scale — so a title the portrait stage will scale down anyway would also be shrunk node by node. Titles wider than
// that are set at size / k inside a group with static scale k: same look at both aspects, no per-node shrink.
export const LOCAL_SAFE = 480;
export function textMacro(m: TextMacro, c: Ctx): TextOut {
  const plain = textBlock(m, c), k = m === "T3" ? 1 : Math.max(1, (plain.width?.["9:16"] ?? 0) / LOCAL_SAFE);   // T3 fits its own box
  if (k === 1) return plain;
  const scaled = textBlock(m, { ...c, titleSize: c.titleSize / k });
  return { ...scaled, nodes: [{ ...group({ id: `${c.beat.id}-titlebox`, layout: { type: "column", gap: Math.round(c.titleSize * 0.45 / k) } }, scaled.nodes), scale: Math.round(k * 1000) / 1000 } as NodeIn], width: plain.width };
}
function textBlock(m: TextMacro, c: Ctx): TextOut {
  const id = `${c.beat.id}-title`;
  const size = titleStyle(c, c.beat.type === "hook" ? 1.25 : c.beat.type === "tag" ? 1.15 : 1).size ?? c.titleSize;
  const px = (t: string) => Math.round([...t].length * EM * size * (m === "T3" ? 1.5 : 1));
  if (c.beat.text.length <= LINE_CHARS || !SPLITTABLE.has(m) || chunks(c.beat.text).length < 2) {
    const w = m === "T3" ? 1500 : m === "T13" ? logoWidth(c, size) : px(c.beat.text);
    return { ...textLine(m, c, id, c.beat.text, c.at, true), width: { "16:9": w, "9:16": w } };
  }
  const cs = chunks(c.beat.text), gap = Math.round(size * 0.28);
  const landscapeLines = wrapChunks(cs, Math.max(LANDSCAPE_LINE, Math.ceil(c.beat.text.length / Math.ceil(c.beat.text.length / LANDSCAPE_LINE))));
  const wide = Math.max(...landscapeLines.map(px)) + gap, narrow = Math.max(...cs.map(px)) + gap;
  const outs: TextOut[] = [];
  cs.forEach((chunk, k) => {
    const at = k === 0 ? c.at : m === "T2" ? outs[k - 1].typedAt : r3(c.at + 0.12 * k);
    outs.push(textLine(m, c, `${id}-l${k + 1}`, chunk, at, k === cs.length - 1));
  });
  return {
    nodes: [group({ id, layout: { type: "row", wrap: true, gap, maxWidth: wide, overrides: { "9:16": { maxWidth: narrow } } } }, outs.flatMap((o) => o.nodes))],
    results: outs.flatMap((o) => o.results), typedAt: Math.max(...outs.map((o) => o.typedAt)), width: { "16:9": wide, "9:16": narrow },
  };
}
function textLine(m: TextMacro, c: Ctx, id: string, text: string, at: number, last: boolean): TextOut {
  const style = titleStyle(c, c.beat.type === "hook" ? 1.25 : c.beat.type === "tag" ? 1.15 : 1);
  const typed = r3(at + [...text].length / c.cps);
  const accent = c.brief.tokens.accent;
  switch (m) {
    case "T1": { const r = scrambleTypewriter({ id, text, style, at, cps: c.cps, tail: { len: 4, color: hex(accent, "#ffffff", 0.5), decayMs: 220 } }); return { nodes: r.nodes, results: [r], typedAt: typed }; }
    case "T2": { const r = tailTypewriter({ id, text, style, at, cps: c.cps, tailColor: accent, ...(last ? { caretHoldMs: 600 } : { caretStyle: "none" }) }); return { nodes: r.nodes, results: [r], typedAt: typed }; }
    case "T3": {
      const big = { ...style, size: Math.round(style.size * 1.5) };
      const r = tailTypewriter({ id, text, style: big, at, cps: c.cps, tailColor: accent, caretStyle: "none" });
      const f = fitToWidth({ target: id, w: 1500, h: Math.round(style.size * 1.4), minScale: 0.3 });
      return { nodes: r.nodes, results: [r, f], typedAt: typed };
    }
    case "T4": { const r = wordAppend({ id, text, style, at, wordGapMs: per(c, 230) }); return { nodes: r.nodes, results: [r], typedAt: r3(at + text.split(/\s+/).length * 0.23) }; }
    case "T5": {
      const r = tailTypewriter({ id, text, style, at, cps: c.cps, tailColor: accent, caretStyle: "none" });
      const b = bracketFrame({ id: `${c.beat.id}-brackets`, follows: id, style: { size: Math.round(style.size * 2.2), weight: 200, color: c.brief.tokens.muted },
        padding: Math.round(style.size * 0.5), appear: { at: typed, ms: 150 } });
      return { nodes: [{ ...group({ id: `${c.beat.id}-framed` }, [...r.nodes, ...b.nodes]) }], results: [r, b], typedAt: typed };
    }
    case "T6": {
      const node: NodeIn = { id, type: "text", text, style, tracks: [{ mode: "tween", prop: "opacity", at, ms: 250, from: 0, to: 1, ease: "settle" }] };
      const keyword = c.beat.emphasis.find((w) => text.includes(w));
      if (!keyword && !last) return { nodes: [node], results: [], typedAt: r3(at + 0.25) };
      const s = colourSweep({ target: id, text, at: r3(at + 0.35), color: accent, ...(keyword ? { keyword } : {}), sweepMs: per(c, 450) });
      return { nodes: [node], results: [s], typedAt: r3(at + 0.25) };
    }
    case "T7": { const r = gradientSettle({ id, text, style, at, exit: false, gradient: { from: accent, to: hex(accent, c.brief.tokens.fg, 0.55) } }); return { nodes: r.nodes, results: [r], typedAt: r3(at + 0.6) }; }
    case "T8": { const r = slantSettle({ id, text, style, at, ms: per(c, 270) }); return { nodes: r.nodes, results: [r], typedAt: r3(at + 0.3) }; }
    case "T11": { const r = trackingContraction({ id, text, style, at, ms: per(c, 500) }); return { nodes: r.nodes, results: [r], typedAt: r3(at + 0.5) }; }
    case "T12": { const r = reveal({ id, text, style, at, ms: per(c, 200), fromScale: 1.3 }); return { nodes: r.nodes, results: [r], typedAt: r3(at + 0.2) }; }
    case "T13": {
      // the logo moment: wordmark typed out of its mark, the beat's line under it once the wordmark lands
      const logo = logoTypewriter({ id: `${c.beat.id}-logo`, text: c.brief.product.name, style: { ...style, size: Math.round(style.size * 1.3), weight: 800 }, at, mark: { color: accent } });
      const subAt = r3(at + 0.7);
      const sub: NodeIn = { id, type: "text", text, style: { ...style, size: Math.round(style.size * 0.45), weight: 500, color: c.brief.tokens.muted },
        tracks: [{ mode: "tween", prop: "opacity", at: subAt, ms: 300, from: 0, to: 1, ease: "settle" }] };
      return { nodes: [...logo.nodes, sub], results: [logo], typedAt: subAt };
    }
  }
}

// items a feature's visuals list: the blurb's clauses, as many as the density dial allows (2–5)
function itemsOf(c: Ctx, n?: number): string[] {
  const src = c.feature?.blurb ?? c.beat.text;
  const parts = src.split(/,|;|\band\b|\./).map((s) => s.trim()).filter((s) => s.length > 2).map((s) => s[0].toUpperCase() + s.slice(1));
  const want = n ?? 2 + Math.round(c.brief.dials.density * 3);
  return parts.slice(0, want).length ? parts.slice(0, want) : [src];
}
const cursorId = (c: Ctx) => `${c.beat.id}-cursor`;
const cursorNode = (c: Ctx) => giantCursor({ id: cursorId(c), style: "arrow", size: 1.6, anchor: { x: 0.86, y: 0.9, overrides: { "9:16": { x: 0.8, y: 0.88, scale: 0.7 } } } });

// ---------------- shape macros: the beat's visuals ----------------
export function shapeMacro(m: ShapeMacro, c: Ctx, out: Built, typedAt: number): void {
  const b = c.beat.id, accent = c.brief.tokens.accent, surface = hex(c.brief.tokens.bg, c.brief.tokens.fg, 0.08);
  const vAt = r3(Math.max(c.at + 0.3, Math.min(typedAt, c.at + 0.8)));     // visuals follow the title (one text animation at a time)
  const ensureCursor = () => { if (!out.top.some((n) => n.id === cursorId(c))) out.top.push(cursorNode(c)); };
  switch (m) {
    case "S1": {
      const items = itemsOf(c);
      const r = cardRise({ id: `${b}-list`, at: vAt, ms: sized(per(c, 600), 110), staggerMs: c.staggerMs, layout: { type: "column", gap: 18 },
        cards: items.map((t, i) => ({ id: `${b}-list-${i + 1}`, w: 720, h: 104, fill: surface, radius: 22, children: [
          { id: `${b}-list-${i + 1}-dot`, type: "rect", w: 36, h: 36, radius: 18, fill: accent, x: -310 },
          { id: `${b}-list-${i + 1}-label`, type: "text", text: t, style: { size: 34, weight: 600, align: "left", color: c.brief.tokens.fg }, x: -270 },
        ] })) });
      out.visuals.push({ node: r.nodes[0], width: 720 }); out.results.push(r); return;
    }
    case "S2": {
      const m2 = /(\d[\d,]*(?:\.\d+)?)\s*(%|x|×|\+)?/i.exec(c.beat.text);
      if (!m2) return;
      const value = Number(m2[1].replace(/,/g, "")), decimals = (m2[1].split(".")[1] ?? "").length;
      const suffix = m2[2] ? (m2[2].toLowerCase() === "x" ? "×" : m2[2]) : "";
      const r = ripplePill({ id: `${b}-stat`, at: vAt, to: value, decimals, suffix, style: { size: Math.round(c.titleSize * 0.85), weight: 700, color: "#FFFFFF" },
        color: accent, countMs: per(c, 1070) });
      out.visuals.push({ node: r.nodes[0], width: 640 }); out.results.push(r); return;
    }
    case "S3": {
      ensureCursor();
      const r = hoverFillCard({ id: `${b}-card`, cursor: cursorId(c), enterAt: r3(vAt + 0.2), moveMs: sized(per(c, 500), 300), w: 520, h: 320,
        title: c.feature?.name ?? c.beat.emphasis[0] ?? "Feature", rows: itemsOf(c, 3), fill: surface, hoverFill: accent,
        titleStyle: { size: 40, weight: 700, color: c.brief.tokens.fg }, rowStyle: { size: 26, weight: 500, align: "left", color: c.brief.tokens.fg } });
      out.visuals.push({ node: r.nodes[0], width: 520 }); out.results.push(r); return;
    }
    case "S5": {
      ensureCursor();
      const label = c.beat.type === "cta" ? (c.brief.product.url ?? "Get started") : "Try it";
      const id = `${b}-button`;
      out.visuals.push({ node: { id, type: "rect", w: 200, h: 84, radius: 42, fill: surface, stroke: { color: accent, width: 3 }, sizeToContent: { padX: 44, padY: 18 },
        children: [{ id: `${id}-label`, type: "text", text: label, style: { size: 36, weight: 700, color: c.brief.tokens.fg } }] }, width: 380 });
      out.results.push(cursorClick({ cursor: cursorId(c), target: id, at: r3(vAt + 0.6), moveMs: sized(per(c, 500), 300), hover: { to: accent } }));
      return;
    }
    case "S8": {
      const items = itemsOf(c, 6);
      const leftN = Math.ceil(items.length / 2);
      const pill = (id: string, t: string): NodeIn => ({ id, type: "rect", w: 1, h: 1, radius: 9999, fill: surface, stroke: { color: hex(surface, accent, 0.3), width: 2 },
        sizeToContent: { padX: 22, padY: 12 }, children: [{ id: `${id}-label`, type: "text", text: t.split(/\s+/).slice(0, 3).join(" "), style: { size: 28, weight: 600, color: c.brief.tokens.fg } }] });
      const L = items.slice(0, leftN).map((t, i) => pill(`${b}-fan-l${i + 1}`, t)), R = items.slice(leftN).map((t, i) => pill(`${b}-fan-r${i + 1}`, t));
      const hub: NodeIn = { id: `${b}-fan-hub`, type: "rect", w: 260, h: 120, radius: 28, fill: accent,
        children: [{ id: `${b}-fan-hub-label`, type: "text", text: c.feature?.name ?? c.brief.product.name, style: { size: 34, weight: 700, color: "#FFFFFF" } }] };
      const fanStage = group({ id: `${b}-fan` }, [
        { ...group({ id: `${b}-fan-left`, layout: { type: "column", gap: 24 } }, L), x: -520 } as NodeIn, hub,
        { ...group({ id: `${b}-fan-right`, layout: { type: "column", gap: 24 } }, R), x: 520 } as NodeIn,
      ]);
      const fan = wireFan({ id: `${b}-fan`, hub: hub.id, left: L.map((n) => n.id), right: R.map((n) => n.id), at: vAt, drawMs: sized(per(c, 400), 260), staggerMs: c.staggerMs,
        stroke: accent, glow: { radius: 8, intensity: 0.4 } });
      out.visuals.push({ node: fanStage, width: 1400 }); out.top.unshift(...fan.nodes); out.results.push(fan); return;
    }
    case "S9": {
      // a background marquee of the beat's phrases (the mess, or the messages), behind the stage
      const phrases = [...new Set([...c.beat.emphasis, ...itemsOf(c, 5), ...c.beat.text.split(/[,.;]/).map((s) => s.trim()).filter((s) => s.split(" ").length <= 4 && s.length > 2)])].slice(0, 9);
      const rows = [0, 1, 2].map((r) => phrases.filter((_, i) => i % 3 === r)).filter((r) => r.length);
      const mq = pillMarquee({ id: `${b}-marquee`, rows: rows.length ? rows : [[c.beat.text]], style: { size: 30, weight: 600, color: c.brief.tokens.fg }, at: c.at,
        scrollMs: Math.max(400, Math.round((c.duration - c.at) * 1000)), fill: surface, anchor: { x: 0.5, y: 0.8 } });
      out.top.unshift({ ...(mq.nodes[0] as object), opacity: 0.45 } as NodeIn); out.results.push(mq); return;
    }
    case "S10": {
      const editor = c.feature?.kind === "editor";
      const panel: NodeIn[] = [
        { id: `${b}-ui-panel`, type: "rect", w: 1040, h: 560, radius: 32, fill: surface, stroke: { color: hex(surface, c.brief.tokens.fg, 0.12), width: 2 } },
        { id: `${b}-ui-head`, type: "text", text: c.feature?.name ?? "Overview", style: { size: 40, weight: 700, align: "left", color: c.brief.tokens.fg }, x: -470, y: -220 },
      ];
      if (editor) {
        const widths = [520, 380, 640, 300, 560, 420];
        widths.forEach((w, i) => panel.push({ id: `${b}-ui-line-${i + 1}`, type: "rect", w, h: 22, radius: 11, fill: i === 2 ? accent : hex(surface, c.brief.tokens.fg, 0.25),
          x: -470 + w / 2, y: -140 + i * 56, clip: { x: -w / 2, y: -11, w: 0, h: 22 },
          tracks: [{ mode: "tween", prop: "clip.w", at: r3(vAt + 0.3 + (i * c.staggerMs) / 1000), ms: sized(per(c, 300), 22), from: 0, to: w, ease: "settle" }] }));
      } else {
        panel.push({ id: `${b}-ui-chart`, type: "path", d: "M -460 180 C -350 120 -280 160 -170 90 S 30 60 130 -20 S 330 -60 470 -150", stroke: accent, strokeWidth: 8,
          trim: { start: 0, end: 0 }, tracks: [{ mode: "tween", prop: "trim.end", at: r3(vAt + 0.3), ms: sized(per(c, 900), 560), from: 0, to: 1, ease: "settle" }] });
        [0, 1, 2, 3].forEach((i) => panel.push({ id: `${b}-ui-grid-${i + 1}`, type: "rect", w: 940, h: 2, fill: hex(surface, c.brief.tokens.fg, 0.1), y: -130 + i * 100 }));
      }
      const plane = tiltedPlane({ id: `${b}-ui`, children: panel, at: vAt, until: c.duration, rotY: 12, rotX: 6, enterMs: sized(per(c, 600), 560) });
      out.visuals.push({ node: plane.nodes[0], width: 1040 }); out.results.push(plane); return;
    }
  }
}
