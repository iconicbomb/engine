// One small scene per phase-1 macro, each isolating its device. `pnpm gen:fixtures` writes them to fixtures/;
// tools/render-check.mjs renders them at 16:9 and 9:16.
import { enterDelay } from "@engine/graph";
import { ambientGlow, applyEdits, cardRise, curtainWipe, group, wireFan, colourSweep, echoTrail, pillMarquee, tickerList, logoTypewriter, ripplePill, tailTypewriter, trackingContraction, wordAppend, type GlowIn, type MacroResult, type NodeIn } from "../src/index";

const DEMO_TOKENS = { bg: "#0B0D12", text: "#FFFFFF", accent: "#FF8A3D", font: "Inter" };

function demo(script: string, duration: number, nodes: NodeIn[], results: MacroResult[], glows: GlowIn[] = []) {
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: DEMO_TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration, script, nodes: applyEdits(nodes, results), glows }],
  };
}

export function buildS15Demo() {
  const glow = ambientGlow({ bloomColor: "#3D5AFE", fadeIn: { at: 0.2, ms: 600 } });
  const label: NodeIn = { id: "b1-label", type: "text", text: "Ambient glow", style: { size: 120, weight: 600 } };
  return demo("Ambient glow", 2.0, [label], [], glow.glows);
}

export function buildT2Demo() {
  const title = tailTypewriter({ id: "b1-title", text: "Pick any of 17,000 models", style: { size: 120, weight: 600 }, at: 0.2 });
  return demo("Pick any of 17,000 models", 2.4, title.nodes, [title]);
}

export function buildT4Demo() {
  const line = wordAppend({ id: "b1-line", text: "Connect every tool in one click", style: { size: 110, weight: 600 }, at: 0.2 });
  return demo("Connect every tool in one click", 2.2, line.nodes, [line]);
}

export function buildT6Demo() {
  const text = "Ship faster with AI agents";
  const headline: NodeIn = { id: "b1-headline", type: "text", text, style: { size: 120, weight: 600 } };
  const pass = colourSweep({ target: "b1-headline", text, at: 0.3 });
  const hold = colourSweep({ target: "b1-headline", text, at: 1.1, keyword: "agents" });
  return demo(text, 2.4, [headline], [pass, hold]);
}

export function buildT13Demo() {
  const logo = logoTypewriter({ id: "b1-logo", text: "Lumen", style: { size: 140, weight: 700 }, at: 0.2, untype: { at: 1.6 } });
  return demo("Lumen", 2.3, logo.nodes, [logo]);
}

export function buildS1Demo() {
  const rows = [["Ingest", 380], ["Plan", 300], ["Render", 340]] as const;
  const stack = cardRise({
    id: "b1-stack", at: 0.2,
    anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.72 } } },
    layout: { type: "column", gap: 40 },
    cards: rows.map(([label, bar], i) => ({
      id: `b1-stack-card-${i + 1}`, w: 760, h: 150, fill: "#1A1D26", radius: 28,
      children: [
        { id: `b1-stack-card-${i + 1}-icon`, type: "rect", w: 72, h: 72, radius: 36, fill: "tokens.accent", x: -300 },
        { id: `b1-stack-card-${i + 1}-label`, type: "text", text: label, style: { size: 40, weight: 600, align: "left" }, x: -230, y: -22 },
        { id: `b1-stack-card-${i + 1}-bar`, type: "rect", w: bar, h: 18, radius: 9, fill: "#2C3140", x: -230 + bar / 2, y: 30 },
      ],
    })),
  });
  return demo("Ingest, plan, render", 2.4, stack.nodes, [stack]);
}

export function buildS2Demo() {
  const pill = ripplePill({
    id: "b1-models", at: 0.2, to: 17000, suffix: "+", style: { size: 90, weight: 700 }, color: DEMO_TOKENS.accent,
    anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.8 } } },
  });
  return demo("17,000+ models", 2.4, pill.nodes, [pill]);
}

export function buildT10Demo() {
  const echo = echoTrail({
    id: "b1-scale", text: "Scale", style: { size: 200, weight: 700 }, at: 0.4, toScale: 0.55, travel: 140, fadeAt: 1.3,
    anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.8 } } },
  });
  return demo("Scale", 2.0, echo.nodes, [echo]);
}

export function buildT11Demo() {
  const label = trackingContraction({ id: "b1-label", text: "INTEGRATIONS", style: { size: 110, weight: 600 }, at: 0.3 });
  return demo("Integrations", 1.6, label.nodes, [label]);
}

export function buildS6Demo() {
  const ticker = tickerList({
    id: "b1-ticker", items: ["Salesforce", "HubSpot", "Notion", "Linear", "Stripe", "Zendesk"],
    style: { size: 80, weight: 600 }, at: 0.4, steps: 3, visible: 3,
    anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.8 } } },
  });
  return demo("Every tool you use", 2.6, ticker.nodes, [ticker]);
}

export function buildS9Demo() {
  const marquee = pillMarquee({
    id: "b1-pills", at: 0.2, scrollMs: 2400, style: { size: 40, weight: 600 },
    fill: "#1A1D26", stroke: { color: "#2C3140", width: 2 },
    rows: [
      ["Slack", "Notion", "GitHub", "Linear", "Figma"],
      ["Stripe", "HubSpot", "Zendesk", "Airtable", "Jira"],
      ["Gmail", "Salesforce", "Intercom", "Asana", "Dropbox"],
    ],
  });
  return demo("Connects to everything", 2.8, marquee.nodes, [marquee]);
}

// Row / column layout fixture: a column of a title, a wrapped row of pills (wraps narrower at 9:16) and a row of
// cards (wraps to two per line at 9:16). Pills pop in and cards rise with tracks applied after layout.
export function buildLayoutDemo() {
  const names = ["Slack", "Notion", "GitHub", "Linear", "Figma", "Stripe", "HubSpot", "Zendesk", "Airtable", "Jira"];
  const pills: NodeIn[] = names.map((t, i) => ({
    id: `b1-layout-pill-${i + 1}`, type: "rect", w: 1, h: 1, radius: 9999, fill: "#1A1D26", stroke: { color: "#2C3140", width: 2 },
    sizeToContent: { padX: 26, padY: 12 },
    tracks: [{ mode: "tween", prop: "scale", at: Math.round((0.3 + i * 0.07) * 1000) / 1000, ms: 300, from: 0, to: 1, ease: "bounce" }],
    children: [{ id: `b1-layout-pill-${i + 1}-label`, type: "text", text: t, style: { size: 36, weight: 600 } }],
  }));
  const cards: NodeIn[] = ["Plan", "Build", "Ship"].map((t, i) => ({
    id: `b1-layout-card-${i + 1}`, type: "rect", w: 260, h: 150, radius: 24, fill: "#1A1D26", opacity: 0,
    tracks: [
      { mode: "tween", prop: "y", at: Math.round((1.1 + i * 0.07) * 1000) / 1000, ms: 600, from: 60, to: 0, ease: "settle" },
      { mode: "tween", prop: "opacity", at: Math.round((1.1 + i * 0.07) * 1000) / 1000, ms: 200, from: 0, to: 1, ease: "settle" },
    ],
    children: [{ id: `b1-layout-card-${i + 1}-label`, type: "text", text: t, style: { size: 44, weight: 700 } }],
  }));
  const root = group({ id: "b1-layout", layout: { type: "column", gap: 56 } }, [
    { id: "b1-layout-title", type: "text", text: "Works with your stack", style: { size: 72, weight: 700 } },
    group({ id: "b1-layout-pills", layout: { type: "row", gap: 18, wrap: true, maxWidth: 1300, overrides: { "9:16": { maxWidth: 520, gap: 12 } } } }, pills),
    group({ id: "b1-layout-cards", layout: { type: "row", gap: 32, wrap: true, maxWidth: 1400, overrides: { "9:16": { maxWidth: 560, gap: 16 } } } }, cards),
  ]);
  return demo("Works with your stack", 2.4, [root], []);
}

// Velocity-preserving retargeting: three dots fly right (emphasis), each retargeted mid-flight at 0.8 s back to the
// left — a tween that inherits the velocity (80 ms blend), a spring that takes it as initial velocity, and a tween
// with carryVelocity: false (visible kink) for comparison.
export function buildRetargetDemo() {
  const dot = (n: number, y: number, label: string, retarget: object): NodeIn => ({
    id: `b1-dots-${n}`, type: "group", y, children: [
      { id: `b1-dots-${n}-label`, type: "text", text: label, style: { size: 30, weight: 600, align: "left", color: "#8A90A0" }, x: -780 },
      { id: `b1-dots-${n}-dot`, type: "rect", w: 48, h: 48, radius: 24, fill: "tokens.accent", x: -560,
        tracks: [{ mode: "tween", prop: "x", at: 0.2, ms: 1200, from: -560, to: 640, ease: "emphasis" }, { mode: "tween", prop: "x", at: 0.8, ...retarget }] },
    ] } as NodeIn);
  const root = group({ id: "b1-dots", anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.36 } } } }, [
    dot(1, -160, "carry", { ms: 500, to: -300, ease: "settle" }),
    dot(2, 0, "spring", { ms: 500, to: -300, ease: "bounce" }),
    dot(3, 160, "no carry", { ms: 500, to: -300, ease: "settle", carryVelocity: false }),
  ]);
  return demo("Retargeting keeps momentum", 2.0, [root], []);
}

// Paths + wires (B): a checkmark drawing on, a comet (trim start chasing trim end) along a curve, and two cards joined
// by an s-wire and an arc-wire that draw on with glow — wire geometry follows the cards' measured boxes at 9:16.
export function buildPathsWiresDemo() {
  const card = (id: string, x: number, label: string): NodeIn => ({ id, type: "rect", w: 300, h: 160, radius: 24, fill: "#1A1D26", x, y: 160,
    children: [{ id: `${id}-label`, type: "text", text: label, style: { size: 44, weight: 600 } }] });
  const check: NodeIn = { id: "b1-art-check", type: "path", d: "M -60 0 L -15 45 L 70 -55", stroke: "tokens.accent", strokeWidth: 18, x: -420, y: -160,
    trim: { start: 0, end: 0 }, tracks: [{ mode: "tween", prop: "trim.end", at: 0.2, ms: 400, from: 0, to: 1, ease: "settle" }] };
  const comet: NodeIn = { id: "b1-art-comet", type: "path", d: "M -260 0 C -130 -120 -20 120 120 0 S 330 -110 380 0", stroke: "#FFFFFF", strokeWidth: 6, x: 140, y: -160,
    trim: { start: 0, end: 0 }, tracks: [
      { mode: "tween", prop: "trim.end", at: 0.3, ms: 900, from: 0, to: 1, ease: "emphasis" },
      { mode: "tween", prop: "trim.start", at: 0.55, ms: 900, from: 0, to: 1, ease: "emphasis" }] };
  const art = group({ id: "b1-art", anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.55 } } } },
    [check, comet, card("b1-art-src", -330, "Source"), card("b1-art-dst", 330, "Destination")]);
  const wire = (id: string, curve: "s" | "arc", at: number, fromA: "right" | "bottom", toA: "left" | "bottom"): NodeIn => ({
    id, type: "wire", from: { target: "b1-art-src", anchor: fromA }, to: { target: "b1-art-dst", anchor: toA }, curve, bend: curve === "arc" ? 0.18 : 0.5,
    stroke: "tokens.accent", strokeWidth: 4, glow: { radius: 10, intensity: 0.6 }, trim: { start: 0, end: 0 },
    tracks: [{ mode: "tween", prop: "trim.end", at, ms: 400, from: 0, to: 1, ease: "settle" }] });
  return demo("Connect anything", 2.0, [wire("b1-wire-s", "s", 0.8, "right", "left"), wire("b1-wire-arc", "arc", 0.87, "bottom", "bottom"), art], []);
}

// S8 demo: a hub card fans wires out to five integrations on each side (columns laid out with layout: column)
export function buildS8Demo() {
  const pill = (id: string, t: string): NodeIn => ({ id, type: "rect", w: 1, h: 1, radius: 9999, fill: "#1A1D26", stroke: { color: "#2C3140", width: 2 },
    sizeToContent: { padX: 24, padY: 12 }, children: [{ id: `${id}-label`, type: "text", text: t, style: { size: 34, weight: 600 } }] });
  const L = ["Slack", "Gmail", "Notion", "Drive", "Jira"], R = ["Stripe", "HubSpot", "GitHub", "Linear", "Figma"];
  const leftIds = L.map((_, i) => `b1-fan-l-${i + 1}`), rightIds = R.map((_, i) => `b1-fan-r-${i + 1}`);
  const hub: NodeIn = { id: "b1-fan-hub", type: "rect", w: 300, h: 140, radius: 28, fill: "tokens.accent",
    children: [{ id: "b1-fan-hub-label", type: "text", text: "Your app", style: { size: 44, weight: 700 } }] };
  const scene = group({ id: "b1-fan", anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.5, scale: 0.42 } } } }, [
    { ...group({ id: "b1-fan-left", layout: { type: "column", gap: 34 } }, L.map((t, i) => pill(leftIds[i], t))), x: -620 } as NodeIn,
    hub,
    { ...group({ id: "b1-fan-right", layout: { type: "column", gap: 34 } }, R.map((t, i) => pill(rightIds[i], t))), x: 620 } as NodeIn,
  ]);
  const fan = wireFan({ id: "b1-fan", hub: "b1-fan-hub", left: leftIds, right: rightIds, at: 0.3, glow: { radius: 8, intensity: 0.5 } });
  return demo("Your app, connected", 2.0, [...fan.nodes, scene], []);
}

// Beat transitions (C): five beats chained by crossfade, curtain, smear and cut; each beat's title enters after the
// macro-rule delay so nothing lands under the transition.
export function buildTransitionsDemo() {
  const specs: [string, string, object | undefined][] = [
    ["One", "#0B0D12", undefined], ["Crossfade", "#10213A", { type: "crossfade" }], ["Curtain", "#2A1338", { type: "curtain" }],
    ["Smear", "#0F2E24", { type: "smear" }], ["Cut", "#3A1E0E", { type: "cut" }],
  ];
  const beats = specs.map(([title, bg, transition], i) => {
    const id = `b${i + 1}`, at = Math.round((0.05 + enterDelay(transition as never)) * 1000) / 1000;
    return { id, type: "feature", start: i * 1.2, duration: 1.2, script: title, background: bg, ...(transition ? { transition } : {}),
      glows: [{ x: 0.5, y: 1.05, rx: 0.7, ry: 0.8, color: "#3D5AFE", intensity: 0.3 }],
      nodes: [{ id: `${id}-title`, type: "text", text: title, style: { size: 140, weight: 700 },
        tracks: [{ mode: "tween", prop: "opacity", at, ms: 200, from: 0, to: 1, ease: "settle" }, { mode: "tween", prop: "y", at, ms: 400, from: 40, to: 0, ease: "settle" }] }] };
  });
  return { version: 1, canvas: { aspect: "16:9", refHeight: 1080, fps: 30 }, tokens: DEMO_TOKENS, beats };
}

// two beats joined by a transition macro; the second beat's title enters after enterDelay (the macro rule)
function twoBeat(a: [string, string], b: [string, string], tr: MacroResult) {
  const beat = (id: string, start: number, [title, bg]: [string, string], transition?: object) => {
    const at = Math.round((0.1 + enterDelay(transition as never)) * 1000) / 1000;
    return { id, type: "feature", start, duration: 1.2, script: title, background: bg, ...(transition ? { transition } : {}), glows: [],
      nodes: [{ id: `${id}-title`, type: "text", text: title, style: { size: 140, weight: 700 },
        tracks: [{ mode: "tween", prop: "opacity", at, ms: 200, from: 0, to: 1, ease: "settle" }, { mode: "tween", prop: "y", at, ms: 400, from: 40, to: 0, ease: "settle" }] }] };
  };
  return { version: 1, canvas: { aspect: "16:9", refHeight: 1080, fps: 30 }, tokens: DEMO_TOKENS, beats: [beat("b1", 0, a), beat("b2", 1.2, b, tr.transition)] };
}
export function buildS13Demo() { return twoBeat(["Before", "#0B0D12"], ["After", "#10213A"], curtainWipe()); }
