// R3 hook, built from five macro calls (T1, T3, T5, T12, S15). `pnpm gen:fixtures` writes it to
// fixtures/r3-hook.graph.json; packages/patterns/test/test-patterns.ts checks it matches the committed fixture.
import { ambientGlow, applyEdits, bracketFrame, fitToWidth, group, reveal, scrambleTypewriter } from "../src/index";

export function buildR3Hook() {
  const title = scrambleTypewriter({
    id: "b1-question-title",
    text: "What does it take to build an",
    style: { size: 180, weight: 500, color: "tokens.text", align: "center" },
    at: 0.33, cps: 8.0, ramp: 8.5, scrambleFrames: 1, symbolSet: "#%*@!<",
    tail: { len: 4, color: "#BFD8FF", decayMs: 220 },
    caret: { style: "glass", blinkMs: 500, holdAfterMs: 0, preScale: 2.6, color: "#6E7FCC" },
    bloom: { radius: 60, intensity: 1.0 },
  });
  const fit = fitToWidth({ target: "b1-question-title", w: 1060, h: 220, minScale: 0.2, recenter: true, easeMs: 100 });
  const brackets = bracketFrame({
    id: "b1-question-brackets",
    follows: "b1-question-title",
    style: { size: 420, weight: 200, color: "tokens.bracket", align: "center" },
    glyphPair: ["[", "]"], padding: 120,
    appear: { at: 1.2, ms: 150 },
  });
  const agent = reveal({
    id: "b1-agent",
    text: "AI Agent?",
    style: { size: 150, weight: 500, color: "tokens.text", align: "center", tracking: 0.03 },
    at: 2.4, ms: 260, fromScale: 1.7, leadPx: 70, glyphStaggerMs: 25, fadeMs: 67,
    handoff: { target: "b1-question", at: 2.0, ms: 350, scaleTo: 0.45, fadeDelayMs: 80, fadeMs: 260 },
  });

  const question = group(
    { id: "b1-question", anchor: { x: 0.5, y: 0.47, overrides: { "9:16": { x: 0.5, y: 0.45, scale: 0.8 } } } },
    [...title.nodes, ...brackets.nodes],
  );
  const nodes = applyEdits([question, ...agent.nodes], [title, fit, brackets, agent]);
  const glow = ambientGlow({
    bloomColor: "#0A2EDC",
    layers: [
      { x: 0.5, y: 1.03, rx: 0.72, ry: 0.9, intensity: 0.39, fadeIn: { at: 1.0, ms: 450 } },
      { x: 0.5, y: -0.03, rx: 0.6, ry: 0.65, intensity: 0.2, fadeIn: { at: 1.15, ms: 400 } },
    ],
  });

  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: { bg: "#010415", text: "#FFFFFF", accent: "#8FBBFF", bracket: "#4A5A8A", font: "Inter" },
    timing: { cps: 26, enterMs: 400, exitMs: 200, staggerMs: 70, glyphStaggerMs: 30, freshDecayMs: 300 },
    dials: { luminance: 0.1, glow: 0.6, kineticText: 1.0, playfulness: 0.3, tempo: 0.7, density: 0.1 },
    beats: [{
      id: "b1", type: "hook", start: 0, duration: 3.2,
      script: "What does it take to build an AI Agent?",
      background: "tokens.bg",
      nodes,
      glows: glow.glows,
    }],
  };
}
