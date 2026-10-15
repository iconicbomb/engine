import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseGraph, glyphTime, TypewriterTrack } from "@engine/graph";
import { ambientGlow, applyEdits, bracketFrame, cardRise, cursorClick, hoverFillCard, jumpCuts, pillMarquee, pressTimes, tickerList, wireFan, curtainWipe, smearCut, enterDelay, mascot, collapseToOrbs, tiltedPlane, colourSweep, echoTrail, trackingContraction, fitToWidth, logoTypewriter, reveal, ripplePill, scrambleTypewriter, tailTypewriter, wordAppend } from "../src/index";
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

// S5: move 500 ms, pause 150 ms, press 80 ms; target hover background (100 ms) and a 0.96 dip with the press
const s5 = cursorClick({ cursor: "b1-cur", target: "b1-btn", at: 0.3, hover: { to: "#3A4152" } }).tracks;
const s5press: any = s5[1].track, s5hover: any = s5[2].track, s5dip: any[] = s5.slice(3).map((t) => t.track);
assert(s5[0].track.mode === "moveTo" && (s5[0].track as any).ms === 500 && s5press.mode === "press" && s5press.at === 0.95 && s5press.ms === 80,
  "S5: cursor moves 500 ms, pauses 150 ms, presses for 80 ms at 0.95 s");
assert(s5[2].target === "b1-btn" && s5hover.mode === "onHover" && s5hover.ms === 100 && s5dip[0].to === 0.96 && s5dip[0].at === 0.95 && s5dip[1].at === 0.99 && s5dip[1].to === 1,
  "S5: target hover background over 100 ms; dips to 0.96 and back across the press");

// S4: shots become camera frame tracks (hard cuts by default); pressTimes reads cut-on-action points
const s4 = jumpCuts({ shots: [{ at: 0, target: "b1-a", size: "wide" }, { at: 0.95, target: "b1-b", size: "close", ms: 300 }] });
const clicks = [cursorClick({ cursor: "b1-cur", target: "b1-a", at: 1.2 }), cursorClick({ cursor: "b1-cur", target: "b1-b", at: 0.3 })];
assert(s4.camera.length === 2 && s4.camera[0].mode === "frame" && s4.camera[0].ms === 0 && s4.camera[1].ms === 300 && s4.camera[1].size === "close"
  && pressTimes(clicks, "b1-cur").join() === "0.95,1.85", "S4: frame tracks (hard cut default, one 300 ms push); press times sorted for cut on action");

// S6: a clipped 3-slot window; the list steps up one slot per step (330 ms), the exiting item fading
const s6: any = tickerList({ id: "b1-t", items: ["a", "b", "c", "d", "e"], style: { size: 50 }, at: 0.4, steps: 2 }).nodes[0];
const s6list = s6.children[0], ih = 80;
assert(s6.clip.h === 3 * ih && s6list.tracks.length === 2 && s6list.tracks[0].from === -ih && s6list.tracks[0].to === -2 * ih
  && s6list.tracks[1].at === 1.23 && s6list.tracks.every((t: any) => t.ms === 330),
  "S6: 3-slot clip window; list steps up one 80 px slot per step, 330 ms each, 500 ms hold between");
assert(s6list.children[0].tracks[0].to === 0 && s6list.children[1].tracks[0].at === 1.23 && s6list.children[2].tracks.length === 0
  && throws(() => tickerList({ id: "b1-t", items: ["a"], style: { size: 50 }, at: 0 })),
  "S6: item n fades as it leaves on step n; too few items rejected");

// S9: all pills popped within 600 ms; rows scroll linearly in alternating directions at 40 px/s; rows cover the travel
const s9: any = pillMarquee({ id: "b1-m", at: 0.2, scrollMs: 2000, style: { size: 40 }, rows: [["a", "bb"], ["ccc"], ["dd", "e"]] }).nodes[0];
const pops = s9.children.flatMap((r: any) => r.children.map((c: any) => c.tracks[0]));
const lastPopEnd = Math.max(...pops.map((t: any) => t.at + t.ms / 1000));
const scrolls = s9.children.map((r: any) => r.tracks[0]);
const estW = (r: any) => r.children.reduce((s: number, c: any) => s + [...c.children[0].text].length * 40 * 0.58 + 2 * 28 + 24, 0);
const firstPop = Math.min(...pops.map((t: any) => t.at));   // the pills nearest the centre pop first
assert(Math.abs(lastPopEnd - 0.8) < 1e-9 && firstPop < 0.25 && pops.every((t: any) => t.ease === "bounce" && t.from === 0)
  && scrolls.map((t: any) => Math.sign(t.to)).join() === "-1,1,-1" && scrolls.every((t: any) => t.ease === "linear" && Math.abs(t.to) === 80 && t.at === 0.8)
  && s9.layout.type === "column" && s9.children.every((r: any) => r.layout.type === "row" && estW(r) > 1920 + 160),
  "S9: pop-in cascades from the centre, done in 600 ms; rows alternate, 40 px/s linear from 0.8 s; row layouts cover canvas + travel");

// S8: wires from the hub's facing edge to each target, drawing on over 400 ms, 70 ms apart, sides interleaved
const s8: any[] = wireFan({ id: "b1-f", hub: "b1-h", left: ["b1-l1", "b1-l2"], right: ["b1-r1"], at: 0.3 }).nodes;
assert(s8.map((w) => w.to.target).join() === "b1-l1,b1-r1,b1-l2" && s8[0].from.anchor === "left" && s8[0].to.anchor === "right" && s8[1].from.anchor === "right"
  && s8.map((w) => w.tracks[0].at).join() === "0.3,0.37,0.44" && s8.every((w) => w.type === "wire" && w.tracks[0].prop === "trim.end" && w.tracks[0].ms === 400),
  "S8: fan wires interleave sides, leave the hub's facing edge, draw on 400 ms with a 70 ms stagger");

// S13: a curtain transition with the measured 130 ms, sweeping up; enter tracks delayed by ms/2
const s13t = curtainWipe().transition!;
assert(s13t.type === "curtain" && s13t.ms === 130 && s13t.direction === "up" && enterDelay(s13t as never) === 0.065, "S13: curtain 130 ms up; enter delay 65 ms");
// S14: a vertical smear with the measured 1 frame + 100 ms; enter tracks delayed by ms
const s14t = smearCut().transition!;
assert(s14t.type === "smear" && s14t.ms === 133 && s14t.direction === "up" && enterDelay(s14t as never) === 0.133, "S14: smear 133 ms up; enter delay 133 ms");

// S16: bounce drop; bob ±3 px half-periods to the end; 100 ms blinks every 3 s; wordmark wipes in with clip.w
const s16: any = mascot({ id: "b1-m", src: "m.png", blinkSrc: "mb.png", w: 200, h: 200, at: 0.2, until: 6, wordmark: { text: "Lumi", style: { size: 100 } } }).nodes[0];
const [mb, mk, mw] = s16.children;
const ys = mb.tracks.map((t: any) => t.to);
const opens = mk.tracks.filter((t: any) => t.to === 1).map((t: any) => t.at);
const closes = mk.tracks.filter((t: any) => t.prop === "opacity" && t.to === 0 && t.at > 0).map((t: any) => t.at);
assert(s16.tracks[0].ease === "bounce" && s16.tracks[0].ms === 200 && ys.every((y: number) => Math.abs(y) === 3) && ys[0] === -3 && ys[1] === 3
  && mb.tracks.at(-1).at + mb.tracks.at(-1).ms / 1000 <= 6 && opens.join() === "1.4,4.4" && closes.every((c: number, i: number) => Math.abs(c - opens[i] - 0.1) < 1e-9)
  && mw.tracks[0].prop === "clip.w" && mw.clip.w === 0, "S16: bounce drop, ±3 px bob list to the end, 100 ms blinks every 3 s, wordmark clip wipe");

// S7: labels collapse (clip.w -> 0, 200 ms); orbs then drift 900 ms with depth scale and blur, deterministically
const s7a: any = collapseToOrbs({ id: "b1-o", at: 0.5, style: { size: 40 }, rows: [{ label: "A", color: "#FF0000" }, { label: "Bb", color: "#00FF00" }, { label: "Ccc", color: "#0000FF" }] }).nodes[0];
const s7b: any = collapseToOrbs({ id: "b1-o", at: 0.5, style: { size: 40 }, rows: [{ label: "A", color: "#FF0000" }, { label: "Bb", color: "#00FF00" }, { label: "Ccc", color: "#0000FF" }] }).nodes[0];
const orbT = s7a.children.map((r: any) => r.children[0].tracks), labT = s7a.children.map((r: any) => r.children[1].tracks[0]);
assert(isDeepStrictEqual(s7a, s7b) && labT.every((t: any) => t.prop === "clip.w" && t.to === 0 && t.ms === 200 && t.at === 0.5)
  && orbT.every((ts: any[]) => ts.map((t) => t.prop).join() === "x,y,scale,blur" && ts.every((t) => t.at === 0.7 && t.ms === 900))
  && new Set(orbT.map((ts: any[]) => ts[0].to)).size === 3 && orbT.some((ts: any[]) => ts[3].to > 0),
  "S7: labels collapse in 200 ms; orbs drift apart over 900 ms with depth scale + blur (deterministic)");

// S10: tilt 14 / 6 degrees, eases in from a steeper Y angle, dollies 2 %/s linearly, pans
const s10: any = tiltedPlane({ id: "b1-p", children: [], at: 0.5, until: 3.5, pan: { x: -60 } }).nodes[0];
assert(s10.rotY === 14 && s10.rotX === 6 && s10.tracks[0].prop === "rotY" && s10.tracks[0].from === 34 && s10.tracks[2].prop === "scale"
  && s10.tracks[2].to === 1.06 && s10.tracks[2].ease === "linear" && s10.tracks[2].ms === 3000 && s10.tracks[3].to === -60,
  "S10: plane tilted 14 / 6 deg, enters from 34 deg, dolly 2 %/s (1 -> 1.06 over 3 s), linear pan");

// every fixture validates and is exactly what its scene builder produces (after schema defaults)
for (const [name, build] of Object.entries(SCENES)) {
  const file = `fixtures/${name}.graph.json`;
  if (!existsSync(file)) { assert(false, `${name}: ${file} missing — run pnpm gen:fixtures`); continue; }
  let fixture;
  try { fixture = parseGraph(JSON.parse(readFileSync(file, "utf8"))); } catch (e) { assert(false, `${name}: fixture fails validation — ${(e as Error).message.slice(0, 200)}`); continue; }
  assert(isDeepStrictEqual(parseGraph(build()), fixture), `${name}: fixture validates and == parse(build()) — regenerate with pnpm gen:fixtures`);
}
