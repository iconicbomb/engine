// Promo: one ~40 s product film for an invented product ("Lumen", AI agents for ops teams) composed from the pattern
// library the way the references compose — every beat stacks at least three devices (a text device + a field or
// surface change + a camera move or a UI device), real copy, type roles, the derived field, surfaces, and transitions
// between sections. This is the look-layer acceptance scene: `pnpm gen:fixtures` writes fixtures/promo.graph.json;
// `pnpm render:promo` renders it at both aspects.
import { enterDelay } from "@engine/graph";
import {
  ambientGlow, applyEdits, bracketFrame, cardRise, colourSweep, cursorClick, curtainWipe, echoTrail, fitToWidth, giantCursor, group,
  hoverFillCard, jumpCuts, logoTypewriter, mascot, pillMarquee, pressTimes, reveal, ripplePill, scrambleTypewriter, sec, slabNumeral,
  slantSettle, smearCut, tailTypewriter, trackingContraction, wireFan, wordAppend, gradientSettle,
  type MacroResult, type NodeIn, type AnchorIn,
} from "../src/index";

const TOKENS = { bg: "#07080D", text: "#F3F4F8", accent: "#7C9BFF", surface: "#141826", muted: "#8B91A7", font: "Inter" };

type BeatIn = Record<string, unknown>;
const centre = (y = 0.5, portraitScale = 0.8, py = y): AnchorIn => ({ x: 0.5, y, overrides: { "9:16": { x: 0.5, y: py, scale: portraitScale } } });

// a beat: start/duration in seconds; `transition` delays the macro enters by the macro rule (enterDelay)
function beat(id: string, type: string, start: number, duration: number, script: string, nodes: NodeIn[], results: MacroResult[],
  extra: { transition?: MacroResult; glows?: MacroResult; camera?: MacroResult[]; field?: object; background?: string } = {}): BeatIn {
  const cam = (extra.camera ?? []).flatMap((r) => r.camera);
  return {
    id, type, start: sec(start), duration: sec(duration), script,
    ...(extra.background ? { background: extra.background } : {}),
    ...(extra.transition?.transition ? { transition: extra.transition.transition } : {}),
    ...(extra.field ? { field: extra.field } : {}),
    glows: extra.glows?.glows ?? [],
    camera: { tracks: cam },
    nodes: applyEdits(nodes, results),
  };
}

export function buildPromo() {
  const beats: BeatIn[] = [];
  let t = 0;

  // ---- b1 hook (R3 grammar): scramble typewriter in brackets, caret lands, glows fade in, reveal hands off ----
  {
    const d = 3.6;
    const title = scrambleTypewriter({ id: "b1-q-title", text: "Still running ops by hand?", style: { role: "display", align: "center" },
      at: 0.3, cps: 9, ramp: 7, scrambleFrames: 1, symbolSet: "#%*@!<", tail: { len: 4, color: "#C9D6FF", decayMs: 220 },
      caret: { style: "glass", blinkMs: 500, holdAfterMs: 0, preScale: 2.4, color: "#6E7FCC" }, bloom: { radius: 50, intensity: 0.9 } });
    const fit = fitToWidth({ target: "b1-q-title", w: 1500, h: 760, minScale: 0.2, recenter: true, easeMs: 100 });
    const brackets = bracketFrame({ id: "b1-q-brackets", follows: "b1-q-title", style: { size: 400, weight: 200, color: "#3F4A6E", align: "center" },
      glyphPair: ["[", "]"], padding: 70, appear: { at: 1.1, ms: 150 } });
    const meet = reveal({ id: "b1-meet", text: "Meet Lumen.", style: { role: "display", tracking: -0.02 }, at: 2.75, ms: 260, fromScale: 1.6, leadPx: 70, glyphStaggerMs: 25, fadeMs: 67,
      handoff: { target: "b1-q", at: 2.4, ms: 350, scaleTo: 0.45, fadeDelayMs: 80, fadeMs: 260 } });
    const titleNode = { ...title.nodes[0], wrap: { maxWidth: 1600, overrides: { "9:16": { maxWidth: 600 } } } } as NodeIn;
    const q = group({ id: "b1-q", anchor: centre(0.47, 0.72, 0.45) }, [titleNode, ...brackets.nodes]);
    const glows = ambientGlow({ bloomColor: "#1B2FBF", layers: [
      { x: 0.5, y: 1.03, rx: 0.72, ry: 0.9, intensity: 0.42, fadeIn: { at: 0.9, ms: 450 } },
      { x: 0.5, y: -0.03, rx: 0.6, ry: 0.65, intensity: 0.2, fadeIn: { at: 1.05, ms: 400 } } ] });
    beats.push(beat("b1", "hook", t, d, "Still running ops by hand? Meet Lumen.", [q, ...meet.nodes], [title, fit, brackets, meet], { glows }));
    t += d;
  }

  // ---- b2 pain: word-append line, colour sweep stopping on the hurt word, camera creeping in, smear in ----
  {
    const d = 3.8, tr = smearCut({ direction: "up" }), dl = enterDelay(tr.transition as never);
    const line = wordAppend({ id: "b2-line", text: "Tickets. Follow-ups. Reports. Every single day.", style: { role: "headline" }, at: sec(0.15 + dl) });
    const fit = fitToWidth({ target: "b2-line", w: 1720, h: 760, minScale: 0.3, recenter: true, easeMs: 120 });
    const sweep = colourSweep({ target: "b2-line", text: "Tickets. Follow-ups. Reports. Every single day.", at: sec(1.9 + dl), keyword: "Every", color: "#FF6B6B" });
    const sub = trackingContraction({ id: "b2-sub", text: "THE WORK NOBODY SIGNED UP FOR", style: { role: "label", color: "tokens.muted" }, at: sec(2.3 + dl), fadeMs: 250,
      anchor: { x: 0.5, y: 0.62, overrides: { "9:16": { x: 0.5, y: 0.58 } } } });
    const nodes: NodeIn[] = [{ ...line.nodes[0], anchor: centre(0.47, 1, 0.44), wrap: { maxWidth: 1720, overrides: { "9:16": { maxWidth: 520 } } } } as NodeIn, ...sub.nodes];
    beats.push(beat("b2", "pain", t, d, "Tickets. Follow-ups. Reports. Every single day.", nodes, [line, fit, sweep, sub],
      { transition: tr, field: { mode: "auto", glow: 0.55, glowColor: "#5A1F2E", vignette: 0.26, grain: 0.03 } }));
    t += d;
  }

  // ---- b3 reveal: curtain in the accent, logo typewriter lockup, tracking label, mascot drops in beside it ----
  {
    const d = 3.8, tr = curtainWipe({ direction: "right", color: "tokens.accent" }), dl = enterDelay(tr.transition as never);
    const logo = logoTypewriter({ id: "b3-logo", text: "Lumen", style: { size: 240, weight: 800, tracking: -0.03 }, at: sec(0.1 + dl), typeMs: 420,
      anchor: { x: 0.5, y: 0.44, overrides: { "9:16": { x: 0.5, y: 0.42, scale: 0.72 } } }, mark: { color: "tokens.accent", radius: 36 } });
    const label = trackingContraction({ id: "b3-label", text: "AI AGENTS FOR OPS TEAMS", style: { role: "label", color: "tokens.muted" }, at: sec(0.7 + dl), fadeMs: 250,
      anchor: { x: 0.5, y: 0.6, overrides: { "9:16": { x: 0.5, y: 0.56 } } } });
    const buddy = mascot({ id: "b3-buddy", w: 170, h: 170, at: sec(1.2 + dl), until: d, bobPx: 4,
      anchor: { x: 0.5, y: 0.8, overrides: { "9:16": { x: 0.5, y: 0.72, scale: 0.8 } } } });
    const glows = ambientGlow({ bloomColor: "#1B2FBF", layers: [
      { x: 0.5, y: 1.03, rx: 0.72, ry: 0.9, intensity: 0.5, fadeIn: { at: sec(dl), ms: 600 } },
      { x: 0.5, y: -0.03, rx: 0.6, ry: 0.65, intensity: 0.22, fadeIn: { at: sec(dl + 0.1), ms: 600 } } ] });
    beats.push(beat("b3", "reveal", t, d, "Meet Lumen — AI agents for ops teams.", [...logo.nodes, ...label.nodes, ...buddy.nodes], [logo, label, buddy], { transition: tr, glows }));
    t += d;
  }

  // ---- b4 feature: connect every tool — headline, hub + pill columns, wires fan out, camera pushes to medium ----
  {
    const d = 5.2;
    const head = reveal({ id: "b4-head", text: "Connect every tool you already use", style: { role: "headline" }, at: 0.2, ms: 300, fromScale: 1.25, leadPx: 40, glyphStaggerMs: 12, fadeMs: 80 });
    const headNode = { ...head.nodes[0], anchor: { x: 0.5, y: 0.14, overrides: { "9:16": { x: 0.5, y: 0.12 } } }, wrap: { maxWidth: 1700, overrides: { "9:16": { maxWidth: 520 } } } } as NodeIn;
    const pill = (id: string, label: string, i: number): NodeIn => ({ id, type: "rect", w: 1, h: 1, radius: 9999, fill: "tokens.surface", opacity: 0,
      sizeToContent: { padX: 44, padY: 20 },
      tracks: [{ mode: "tween", prop: "opacity", at: sec(0.5 + i * 0.07), ms: 250, from: 0, to: 1, ease: "settle" },
               { mode: "tween", prop: "x", at: sec(0.5 + i * 0.07), ms: 500, from: id.includes("-l-") ? -60 : 60, to: 0, ease: "settle" }],
      children: [{ id: `${id}-label`, type: "text", text: label, style: { size: 50, weight: 600 } }] });
    const L = ["Slack", "Gmail", "Notion", "Google Drive", "Jira"], R = ["Stripe", "HubSpot", "GitHub", "Linear", "Zendesk"];
    const lIds = L.map((_, i) => `b4-fan-l-${i + 1}`), rIds = R.map((_, i) => `b4-fan-r-${i + 1}`);
    const hub: NodeIn = { id: "b4-fan-hub", type: "rect", w: 420, h: 210, radius: 40, fill: "tokens.accent", opacity: 0,
      tracks: [{ mode: "tween", prop: "scale", at: 0.35, ms: 500, from: 0.6, to: 1, ease: "bounce" }, { mode: "tween", prop: "opacity", at: 0.35, ms: 150, from: 0, to: 1, ease: "linear" }],
      children: [{ id: "b4-fan-hub-label", type: "text", text: "Lumen", style: { size: 66, weight: 800, color: "#0B0F24" } }] };
    const scene = group({ id: "b4-fan", anchor: { x: 0.5, y: 0.58, overrides: { "9:16": { x: 0.5, y: 0.55, scale: 0.33 } } } }, [
      { ...group({ id: "b4-fan-left", layout: { type: "column", gap: 28, align: "end" } }, L.map((s, i) => pill(lIds[i], s, i))), x: -720 } as NodeIn,
      hub,
      { ...group({ id: "b4-fan-right", layout: { type: "column", gap: 28, align: "start" } }, R.map((s, i) => pill(rIds[i], s, i))), x: 720 } as NodeIn,
    ]);
    const fan = wireFan({ id: "b4-fan", hub: "b4-fan-hub", left: lIds, right: rIds, at: 1.0, drawMs: 450, staggerMs: 60, strokeWidth: 3, glow: { radius: 10, intensity: 0.6 } });
    const cam = jumpCuts({ shots: [{ at: 0, target: "b4-fan", size: 1, ms: 0 }, { at: 2.4, target: "b4-fan", size: 1.1, ms: 2400, ease: "emphasis", offset: { x: 0, y: -0.08 } }] });
    beats.push(beat("b4", "feature", t, d, "Connect every tool you already use.", [...fan.nodes, headNode, scene], [head, fan], { camera: [cam] }));
    t += d;
  }

  // ---- b5 feature: agents that act — avatar cursor visits two cards (hover fill + rows), clicks Run, cut on action ----
  {
    const d = 6.0;
    const head = reveal({ id: "b5-head", text: "Agents that actually do the work", style: { role: "headline" }, at: 0.2, ms: 300, fromScale: 1.25, leadPx: 40, glyphStaggerMs: 12, fadeMs: 80 });
    const headNode = { ...head.nodes[0], anchor: { x: 0.5, y: 0.14, overrides: { "9:16": { x: 0.5, y: 0.12 } } }, wrap: { maxWidth: 1700, overrides: { "9:16": { maxWidth: 520 } } } } as NodeIn;
    const triage = hoverFillCard({ id: "b5-triage", cursor: "b5-avatar", enterAt: 0.6, w: 640, h: 400, x: -360,
      title: "Triage tickets", rows: ["Reads every new ticket", "Tags priority and owner", "Drafts the first reply"],
      titleStyle: { size: 48, weight: 700 }, rowStyle: { size: 32, weight: 500, align: "left", color: "tokens.muted" }, fill: "tokens.surface", hoverFill: "#2A3A7A" });
    const report = hoverFillCard({ id: "b5-report", cursor: "b5-avatar", enterAt: 2.2, w: 640, h: 400, x: 360,
      title: "Weekly report", rows: ["Pulls numbers from 6 tools", "Writes the summary", "Posts it to #leadership"],
      titleStyle: { size: 48, weight: 700 }, rowStyle: { size: 32, weight: 500, align: "left", color: "tokens.muted" }, fill: "tokens.surface", hoverFill: "#2A3A7A" });
    const run: NodeIn = { id: "b5-run", type: "rect", w: 300, h: 96, radius: 48, fill: "tokens.accent", y: 320,
      children: [{ id: "b5-run-label", type: "text", text: "Run agent", style: { size: 34, weight: 700, color: "#0B0F24" } }] };
    const click = cursorClick({ cursor: "b5-avatar", target: "b5-run", at: 3.8, hover: { to: "#A9BCFF" }, anchor: "right", offset: { x: -0.12, y: 0.3 } });
    const triageNode = { ...(triage.nodes[0] as object), x: 0, anchor: { x: 0.31, y: 0.52, overrides: { "9:16": { x: 0.5, y: 0.38, scale: 0.7 } } } } as NodeIn;
    const reportNode = { ...(report.nodes[0] as object), x: 0, anchor: { x: 0.69, y: 0.52, overrides: { "9:16": { x: 0.5, y: 0.66, scale: 0.7 } } } } as NodeIn;
    const runNode = { ...run, y: 0, anchor: { x: 0.5, y: 0.82, overrides: { "9:16": { x: 0.5, y: 0.86, scale: 0.9 } } } } as NodeIn;
    const stack = group({ id: "b5-ui" }, []);
    const avatar = giantCursor({ id: "b5-avatar", style: "avatar", size: 1.6, anchor: { x: 0.88, y: 0.9, overrides: { "9:16": { x: 0.85, y: 0.88, scale: 0.7 } } } });
    const [press] = pressTimes([click], "b5-avatar");
    const cam = jumpCuts({ shots: [{ at: 0, target: "b5-triage", size: 1 }, { at: 1.1, target: "b5-triage", size: "medium", ms: 600, ease: "emphasis" },
      { at: 2.7, target: "b5-report", size: "medium" }, { at: press, target: "b5-run", size: 2.2, ms: 0 }, { at: sec(press + 0.9), target: "b5-triage", size: 1, ms: 500 }] });
    beats.push(beat("b5", "feature", t, d, "Agents that actually do the work.", [headNode, triageNode, reportNode, runNode, avatar], [head, triage, report, click], { camera: [cam] }));
    t += d;
  }

  // ---- b6 feature: numbers — ripple counter + three stat cards rising in a row ----
  {
    const d = 4.6;
    const head = reveal({ id: "b6-head", text: "Numbers your CFO will ask about", style: { role: "headline" }, at: 0.2, ms: 300, fromScale: 1.25, leadPx: 40, glyphStaggerMs: 12, fadeMs: 80 });
    const headNode = { ...head.nodes[0], anchor: { x: 0.5, y: 0.14, overrides: { "9:16": { x: 0.5, y: 0.12 } } }, wrap: { maxWidth: 1700, overrides: { "9:16": { maxWidth: 520 } } } } as NodeIn;
    const pill = ripplePill({ id: "b6-hours", at: 0.5, to: 4200, suffix: "+", style: { size: 120, weight: 800 }, color: TOKENS.accent, countMs: 1100,
      anchor: { x: 0.5, y: 0.4, overrides: { "9:16": { x: 0.5, y: 0.36, scale: 0.8 } } } });
    const caption = trackingContraction({ id: "b6-cap", text: "HOURS SAVED EVERY MONTH", style: { role: "label", color: "tokens.muted" }, at: 1.3, fadeMs: 250,
      anchor: { x: 0.5, y: 0.54, overrides: { "9:16": { x: 0.5, y: 0.47 } } } });
    const stats: [string, string][] = [["38%", "faster resolution"], ["12", "tools connected"], ["24/7", "always on"]];
    const cards = cardRise({ id: "b6-stats", at: 2.0, layout: { type: "row", gap: 36, wrap: true, maxWidth: 1600, overrides: { "9:16": { maxWidth: 700, gap: 24 } } }, staggerMs: 90,
      anchor: { x: 0.5, y: 0.78, overrides: { "9:16": { x: 0.5, y: 0.75, scale: 0.5 } } },
      cards: stats.map(([n, l], i) => ({ id: `b6-stats-card-${i + 1}`, w: 480, h: 300, fill: "tokens.surface", radius: 36, children: [
        { id: `b6-stats-card-${i + 1}-n`, type: "text", text: n, style: { size: 104, weight: 800 }, y: -36 },
        { id: `b6-stats-card-${i + 1}-l`, type: "text", text: l, style: { size: 34, weight: 500, color: "tokens.muted" }, y: 62 },
      ] })) });
    beats.push(beat("b6", "proof", t, d, "4,200+ hours saved every month.", [headNode, ...pill.nodes, ...caption.nodes, ...cards.nodes], [head, pill, caption, cards]));
    t += d;
  }

  // ---- b7 proof: trusted-by marquee under a gradient headline, smear in ----
  {
    const d = 4.4, tr = smearCut({ direction: "left" }), dl = enterDelay(tr.transition as never);
    const head = gradientSettle({ id: "b7-head", text: "Trusted by teams that ship", style: { role: "headline" }, at: sec(0.2 + dl), gradient: { from: "#7C9BFF", to: "#FF7AD9" }, exit: false,
      anchor: { x: 0.5, y: 0.22, overrides: { "9:16": { x: 0.5, y: 0.18, scale: 0.8 } } } });
    const marquee = pillMarquee({ id: "b7-logos", at: sec(0.5 + dl), scrollMs: 3600, style: { size: 60, weight: 700 }, fill: "tokens.surface", speed: 60, padX: 44, padY: 22, rowGap: 36,
      anchor: { x: 0.5, y: 0.6, overrides: { "9:16": { x: 0.5, y: 0.56, scale: 0.62 } } },
      rows: [["Northwind", "Acme Cloud", "Orbital", "Fathom", "Kestrel", "Brightline"], ["Halcyon", "Mesa Labs", "Tidewater", "Pioneer", "Juniper", "Ravel"], ["Signal", "Atlas", "Parallel", "Lantern", "Monarch", "Verge"]] });
    beats.push(beat("b7", "proof", t, d, "Trusted by teams that ship.", [...head.nodes, ...marquee.nodes], [head, marquee], { transition: tr }));
    t += d;
  }

  // ---- b8 summary: a 3D "3" assembles, "steps" beside it, the camera flies into it ----
  {
    const d = 3.4;
    const three = slabNumeral({ id: "b8-num", value: "3", size: 640, at: 0.2, face: "tokens.accent", flyThrough: { at: 2.7, ms: 500 },
      anchor: { x: 0.33, y: 0.5, overrides: { "9:16": { x: 0.5, y: 0.38, scale: 0.9 } } } });
    const steps = slantSettle({ id: "b8-steps", text: "steps to go live", style: { role: "headline", align: "left" }, at: 0.5,
      anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.16, y: 0.72, scale: 1 } } } });
    const stepsNode = { ...steps.nodes[0], style: { ...(steps.nodes[0] as { style: object }).style, align: "left" }, wrap: { maxWidth: 800, overrides: { "9:16": { maxWidth: 420 } } } } as NodeIn;
    beats.push(beat("b8", "summary", t, d, "Three steps to your first agent.", [...three.nodes, stepsNode], [three, steps], { camera: [three] }));
    t += d;
  }

  // ---- b9 cta: the three steps rise as cards, the URL types with a tail, the button gets clicked ----
  {
    const d = 5.0, tr: MacroResult = { nodes: [], tracks: [], patches: [], glows: [], camera: [], transition: { type: "crossfade", ms: 200 } };
    const dl = enterDelay(tr.transition as never);
    const steps: [string, string][] = [["1", "Connect your tools"], ["2", "Describe the job"], ["3", "Let the agent run"]];
    const cards = cardRise({ id: "b9-steps", at: sec(0.2 + dl), layout: { type: "row", gap: 36, wrap: true, maxWidth: 1700, overrides: { "9:16": { maxWidth: 700, gap: 24 } } }, staggerMs: 110,
      anchor: { x: 0.5, y: 0.36, overrides: { "9:16": { x: 0.5, y: 0.34, scale: 0.62 } } },
      cards: steps.map(([n, l], i) => ({ id: `b9-steps-card-${i + 1}`, w: 520, h: 330, fill: "tokens.surface", radius: 36, children: [
        { id: `b9-steps-card-${i + 1}-n`, type: "rect", w: 84, h: 84, radius: 42, fill: "tokens.accent", x: -176, y: -80,
          children: [{ id: `b9-steps-card-${i + 1}-nn`, type: "text", text: n, style: { size: 42, weight: 800, color: "#0B0F24" } }] },
        { id: `b9-steps-card-${i + 1}-l`, type: "text", text: l, style: { size: 44, weight: 700, align: "left" }, x: -218, y: 50 },
      ] })) });
    const url = tailTypewriter({ id: "b9-url", text: "lumen.app/start", style: { role: "headline", color: "tokens.muted" }, at: sec(1.6 + dl), cps: 22, tailLength: 3, caretHoldMs: 900 });
    const urlNode = { ...url.nodes[0], anchor: { x: 0.5, y: 0.72, overrides: { "9:16": { x: 0.5, y: 0.66, scale: 0.8 } } } } as NodeIn;
    const btn: NodeIn = { id: "b9-btn", type: "rect", w: 460, h: 120, radius: 60, fill: "tokens.accent", opacity: 0,
      anchor: { x: 0.5, y: 0.87, overrides: { "9:16": { x: 0.5, y: 0.8, scale: 0.8 } } },
      tracks: [{ mode: "tween", prop: "opacity", at: sec(2.4 + dl), ms: 200, from: 0, to: 1, ease: "settle" }, { mode: "tween", prop: "y", at: sec(2.4 + dl), ms: 500, from: 40, to: 0, ease: "settle" }],
      children: [{ id: "b9-btn-label", type: "text", text: "Start free", style: { size: 44, weight: 800, color: "#0B0F24" } }] };
    const click = cursorClick({ cursor: "b9-cursor", target: "b9-btn", at: sec(3.0 + dl), hover: { to: "#A9BCFF" } });
    const cursor = giantCursor({ id: "b9-cursor", style: "arrow", size: 2, anchor: { x: 0.8, y: 0.95, overrides: { "9:16": { x: 0.8, y: 0.95, scale: 0.7 } } } });
    beats.push(beat("b9", "cta", t, d, "Connect, describe, run. lumen.app/start", [...cards.nodes, urlNode, btn, cursor], [cards, url, click], { transition: tr }));
    t += d;
  }

  // ---- b10 tag: the wordmark recedes with an echo trail, the mascot waves it off ----
  {
    const d = 3.0;
    const echo = echoTrail({ id: "b10-mark", text: "Lumen", style: { size: 300, weight: 800, tracking: -0.03 }, at: 0.4, toScale: 0.6, travel: 120, fadeAt: 2.2,
      anchor: centre(0.46, 0.8, 0.44) });
    const buddy = mascot({ id: "b10-buddy", w: 160, h: 160, at: 0.6, until: d, anchor: { x: 0.5, y: 0.74, overrides: { "9:16": { x: 0.5, y: 0.64, scale: 0.8 } } } });
    beats.push(beat("b10", "cta", t, d, "Lumen.", [...echo.nodes, ...buddy.nodes], [echo, buddy], { transition: curtainWipe({ direction: "up", color: "#0B0F24", ms: 400 }) }));
    t += d;
  }

  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    style: { field: { mode: "auto", glow: 1, vignette: 0.2, grain: 0.03 } },
    dials: { luminance: 0.15, glow: 0.7, kineticText: 0.8, playfulness: 0.4, tempo: 0.6, density: 0.4 },
    beats,
  };
}
