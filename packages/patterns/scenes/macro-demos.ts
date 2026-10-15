// One small scene per phase-1 macro, each isolating its device. `pnpm gen:fixtures` writes them to fixtures/;
// tools/render-check.mjs renders them at 16:9 and 9:16.
import { ambientGlow, applyEdits, cardRise, colourSweep, echoTrail, logoTypewriter, ripplePill, tailTypewriter, wordAppend, type GlowIn, type MacroResult, type NodeIn } from "../src/index";

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
    cards: rows.map(([label, bar], i) => ({
      id: `b1-stack-card-${i + 1}`, w: 760, h: 150, y: (i - 1) * 190, fill: "#1A1D26", radius: 28,
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
