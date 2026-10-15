import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseGraph, glyphTime, TypewriterTrack } from "@engine/graph";
import { ambientGlow, applyEdits, bracketFrame, cardRise, hoverFillCard, colourSweep, echoTrail, trackingContraction, fitToWidth, logoTypewriter, reveal, ripplePill, scrambleTypewriter, tailTypewriter, wordAppend } from "../src/index";
import { SCENES } from "../scenes/index";
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

// macros are pure: same params, same output, nothing shared between calls
const p = { id: "b1-t", text: "Hello world", style: { size: 100 }, at: 0.2 };
const a = scrambleTypewriter(p), b = scrambleTypewriter(p);
assert(isDeepStrictEqual(a, b) && a !== b && a.nodes[0] !== b.nodes[0], "T1: deterministic, fresh objects per call");
const tw: any = a.nodes[0].tracks![0];
assert(tw.ms === Math.round(11 / 26 * 1000), `T1: ms derived from the glyph schedule (${tw.ms} ms for 11 chars at 26 cps)`);

// T3 is a patch on the text node; T5 / T12 emit nodes; edits on unknown ids throw
const tree: any[] = applyEdits(a.nodes, [fitToWidth({ target: "b1-t", w: 800, h: 200 })]);
assert(tree[0].fit?.w === 800 && tree[0].fit.minScale === 0.25, "T3: fit applied with schema-matching defaults");
assert(bracketFrame({ id: "b1-br", follows: "b1-t", style: { size: 200 } }).nodes[0].opacity === undefined, "T5: no appear -> visible from beat start");
assert(throws(() => applyEdits(a.nodes, [reveal({ id: "b1-r", text: "X", style: { size: 10 }, at: 1, handoff: { target: "b1-nope", at: 0.5, ms: 100, scaleTo: 0.5, fadeDelayMs: 0, fadeMs: 100 } })])),
  "T12: handoff to an unknown node is rejected");

// S15: one glow per layer, each fading in from 0 to its resting intensity
const glow = ambientGlow();
assert(glow.glows.length === 2 && glow.glows.every((g: any) => g.tracks[0].from === 0 && g.tracks[0].to === g.intensity && g.color === "tokens.accent"),
  "S15: default under + top layers, intensity fade-in tracks, brand colour");

// T2: the tint covers the last N chars by decaying over N / cps; full-strength tint
const t2: any = tailTypewriter({ id: "b1-x", text: "Pick any of 17,000 models", style: { size: 100 }, at: 0 }).nodes[0].tracks![0];
assert(t2.cps === 30 && t2.tail.len === 6 && t2.tail.decayMs === 200 && t2.tail.strength === 1 && t2.ms === 833,
  `T2: R5 defaults — 30 cps, tail 6 chars decaying over ${t2.tail.decayMs} ms, typed in ${t2.ms} ms`);

// T4: words land wordGapMs apart, and each word's glyphs land within one frame of each other
const t4 = wordAppend({ id: "b1-x", text: "Connect every tool", style: { size: 100 }, at: 0.2 });
const t4tw = TypewriterTrack.parse(t4.nodes[0].tracks![0]), t4chars = [..."Connect every tool"];
const times = t4chars.map((_, i) => glyphTime(t4tw, t4chars, i));
const wordStarts = [...new Set(times)], gaps = wordStarts.slice(1).map((s, i) => (s - wordStarts[i]) * 1000);
assert(wordStarts.length === 3 && gaps.every((g) => Math.abs(g - 230) < 1e-6) && times[7] === times[8] && times[6] === times[0],
  `T4: 3 words, ${gaps.map((g) => g.toFixed(0)).join(" / ")} ms apart; all glyphs of a word (and its leading space) share a reveal time`);
assert(t4.nodes[0].tracks!.filter((t: any) => t.relativeTo === "reveal").length === 2, "T4: fade + slide timed from each glyph's reveal");
const tau = (t4.nodes[0] as any).recenterEaseMs;
assert(tau === 76 && 1 - Math.exp(-230 / tau) >= 0.95, `T4: eased recentre, tau ${tau} ms -> ${((1 - Math.exp(-230 / tau)) * 100).toFixed(1)} % settled within the 230 ms word cadence`);

// T6: full sweep enters/leaves off the ends; keyword sweep stops on the word with a window of its width
const text = "Ship faster with AI agents";
const full: any = colourSweep({ target: "b1-h", text, at: 0 }).tracks[0].track;
const key: any = colourSweep({ target: "b1-h", text, at: 0, keyword: "agents" }).tracks[0].track;
const rtl: any = colourSweep({ target: "b1-h", text, at: 0, direction: "rtl" }).tracks[0].track;
assert(full.from === -2 && full.to === 28 && full.window === 4 && full.ms === 450, "T6: 4-glyph window sweeps -2 -> 28 over 450 ms");
assert(key.window === 6 && key.to === 23, "T6: keyword hold centred on 'agents' (glyphs 20-25), window 6");
assert(rtl.from === 28 && rtl.to === -2, "T6: rtl reverses the sweep");
assert(throws(() => colourSweep({ target: "b1-h", text, at: 0, keyword: "nope" })), "T6: unknown keyword is rejected");

// T13: wordmark types in typeMs after the mark lands, un-types over 270 ms; mark follows the wordmark's left edge
const t13 = logoTypewriter({ id: "b1-logo", text: "Lumen", style: { size: 140 }, at: 0.2, untype: { at: 1.6 } });
const [wm, mark]: any[] = (t13.nodes[0] as any).children;
assert(wm.tracks[0].ms === 400 && wm.tracks[0].at === 0.4 && wm.tracks[0].out.ms === 270, "T13: types in 400 ms after a 200 ms mark lead, un-types in 270 ms");
assert(mark.type === "rect" && mark.follows.node === "b1-logo-wordmark" && mark.follows.edge === "left", "T13: mark follows the wordmark's left edge");
assert(wm.x === (112 + 28) / 2 && wm.tracks.length === 1, "T13: wordmark base x = half the mark + gap (finished lockup centred), no offset tween");

// S1: cards rise 80 px over 600 ms expo-out, 70 ms apart; children start 150 ms after the card visibly lands
const s1: any = cardRise({ id: "b1-s", at: 0.2, cards: [
  { id: "b1-s-a", w: 100, h: 50, y: -60, children: [{ id: "b1-s-a-t", type: "text", text: "A", style: { size: 20 }, y: 5 }] },
  { id: "b1-s-b", w: 100, h: 50, y: 60 },
] }).nodes[0];
const [ca, cb] = s1.children;
assert(ca.tracks[0].from === 20 && ca.tracks[0].to === -60 && ca.tracks[0].ms === 600 && ca.tracks[0].ease === "settle" && cb.tracks[0].at === 0.27,
  "S1: rise from y+80 to y (600 ms settle, no overshoot), 70 ms card stagger");
const child = ca.children[1];
assert(child.tracks[0].at === 0.65 && child.tracks[1].from === 17 && child.tracks[1].to === 5 && ca.children[0].type === "rect",
  "S1: panel first; content fades in at land (300 ms) + 150 ms, drifting up 12 px to its base y");

// S2: counter 1.07 s linear after the 330 ms spring settle; pulse fires on the final value; bands fade outward
const s2: any = ripplePill({ id: "b1-p", at: 0.2, to: 17000, suffix: "+", style: { size: 90 }, color: "#FF8A3D" }).nodes[0];
const all: any[] = []; const walk = (n: any) => { all.push(n); (n.children ?? []).forEach(walk); }; walk(s2);
const byId = (id: string) => all.find((c: any) => c.id === id);
const count = byId("b1-p-value").tracks[0], pulse = byId("b1-p-pulse");
assert(byId("b1-p-value").text === "17,000+" && count.mode === "count" && count.at === 0.53 && count.ms === 1070 && count.ease === "linear",
  "S2: value node holds the final string; counts 0 -> 17,000 over 1.07 s linear from 0.53 s");
assert(pulse.tracks[1].at === 1.6 && pulse.tracks[1].ms === 400 && pulse.tracks[0].at === 0 && pulse.tracks[0].to === 0,
  "S2: pulse ring held hidden, then fires at count end (1.6 s) for 400 ms");
const bandAlpha = [5, 4, 3, 2, 1].map((i) => parseInt(byId(`b1-p-band-${i}`).fill.slice(7), 16));
assert(bandAlpha.every((o: number, i: number) => i === 0 || o > bandAlpha[i - 1]) && s2.tracks[0].ease === "bounce",
  `S2: 5 bands, fill alpha rising inward (${bandAlpha.join(", ")}/255); spring slide-in`);
const pill = byId("b1-p-pill");
assert(pill.sizeToContent && pill.children[0].id === "b1-p-value" && byId("b1-p-band-1").children[0] === pill && s2.children[0].id === "b1-p-band-5",
  "S2: pill sizes to its counter; each band wraps the next one in (band-5 outermost)");
assert(byId("b1-p-value").style.features.includes("tnum") && byId("b1-p-pulse").sizeToContent && byId("b1-p-pulse-measure").opacity === 0,
  "S2: tabular digits; pulse ring sized to an invisible copy of the counter");
assert(throws(() => ripplePill({ id: "b1-p", at: 0, to: 1, style: { size: 10 }, color: "tokens.accent" })), "S2: token colour rejected (bands need hex + alpha)");

// T10: 4 copies at 60/40/25/15 %, fanning out over 400 ms behind a word that shrinks; faintest drawn first
const t10: any = echoTrail({ id: "b1-e", text: "Scale", style: { size: 200 }, at: 0.4, travel: 100, fadeAt: 1.2 }).nodes[0];
const ech = t10.children.slice(0, -1);
assert(ech.map((c: any) => c.id).join() === "b1-e-echo-4,b1-e-echo-3,b1-e-echo-2,b1-e-echo-1" && t10.children.at(-1).id === "b1-e-word",
  "T10: copies drawn faintest-first beneath the word");
assert(ech.map((c: any) => c.tracks[1].to).join() === "0.15,0.25,0.4,0.6" && ech[3].tracks[0].to === 80 && ech[0].tracks[0].to === 320 && ech[0].tracks[0].ms === 400,
  "T10: opacities 60/40/25/15 %, copies spaced 0.4 em (80 px) along y over 400 ms");
assert(t10.tracks[0].to === 0.6 && t10.tracks[1].to === -100 && ech[0].tracks[2].at === 1.2,
  "T10: word shrinks to 0.6 and recedes opposite the trail; trail fades at fadeAt");

// T11: tracking contracts from +0.6 em to the style's tracking over 500 ms ease-out, label fading in
const t11: any = trackingContraction({ id: "b1-l", text: "LABEL", style: { size: 100, tracking: 0.02 }, at: 0.3 }).nodes[0];
assert(t11.tracks[0].prop === "tracking" && t11.tracks[0].from === 0.6 && t11.tracks[0].to === 0.02 && t11.tracks[0].ms === 500 && t11.tracks[0].ease === "settle"
  && t11.tracks[1].prop === "opacity", "T11: tracking +0.6 em -> style tracking over 500 ms ease-out, with a fade-in");

// S3: the macro moves the cursor onto the card; fill on hover (130 ms); rows wipe from arrival, 40 ms apart, done in 300 ms
const s3 = hoverFillCard({ id: "b1-c", cursor: "b1-cur", enterAt: 0.3, w: 500, h: 300, title: "Pros", rows: ["a", "b", "c"] });
const s3card: any = s3.nodes[0], mv: any = s3.tracks[0];
assert(mv.target === "b1-cur" && mv.track.mode === "moveTo" && mv.track.target === "b1-c" && mv.track.at === 0.3 && mv.track.ms === 500,
  "S3: emits the cursor's moveTo onto the card (500 ms)");
const wipes = s3card.children.slice(1).map((r: any) => r.tracks[0]);
assert(s3card.tracks[0].mode === "onHover" && s3card.tracks[0].ms === 130 && wipes.map((w: any) => w.at).join() === "0.8,0.84,0.88"
  && wipes.every((w: any) => w.prop === "clip.w" && w.ms === 220) && wipes[2].at + wipes[2].ms / 1000 === 1.1,
  "S3: 130 ms hover fill; rows wipe from arrival (0.8 s), 40 ms apart, all done 300 ms later");

// every fixture validates and is exactly what its scene builder produces (after schema defaults)
for (const [name, build] of Object.entries(SCENES)) {
  const file = `fixtures/${name}.graph.json`;
  if (!existsSync(file)) { assert(false, `${name}: ${file} missing — run pnpm gen:fixtures`); continue; }
  let fixture;
  try { fixture = parseGraph(JSON.parse(readFileSync(file, "utf8"))); } catch (e) { assert(false, `${name}: fixture fails validation — ${(e as Error).message.slice(0, 200)}`); continue; }
  assert(isDeepStrictEqual(parseGraph(build()), fixture), `${name}: fixture validates and == parse(build()) — regenerate with pnpm gen:fixtures`);
}
