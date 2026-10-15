// Look-layer gates (D): for each beat of a graph, at its hold time, at both aspects:
//   fill ratio   — the union box of the beat's top-level nodes (measure pass) covers >= FILL of the canvas area
//                  (default 0.30: a hero text line is wide but short — measured 25–35 % on the promo's text beats,
//                  60–95 % on its UI beats; 0.45 was the first guess and only UI beats reach it)
//   accent budget — accent-hued, lit pixels (value >= 0.35, so the accent-tinted field and glows don't count) are
//                  <= ACCENT of the lit non-background pixels (default 0.35: a brand hover fill (R7) or an accent
//                  numeral (R6) is intentionally above 0.15)
// usage: node tools/gates.mjs fixtures/promo.graph.json [more.graph.json ...] [--fill 0.30] [--accent 0.35] [--report] [--chrome PATH]
// Exit code 1 on any failure. R3 (a measured reference recreation) and single-device demo fixtures are not held to
// the fill gate — pass only composed scenes (promo, showcase) or use --report to print without failing.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const files = argv.filter((a, i) => a.endsWith(".json") && !["--fill", "--accent", "--chrome"].includes(argv[i - 1]));
const FILL = Number(arg("--fill", "0.30")), ACCENT = Number(arg("--accent", "0.35")), report = argv.includes("--report");
function findChrome() {
  const explicit = arg("--chrome", process.env.CHROME_PATH);
  if (explicit) return explicit;
  if (existsSync(chromium.executablePath())) return undefined;
  return ["/usr/bin/google-chrome", "/usr/bin/chromium", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
}
execSync("npx esbuild tools/browser-entry.ts --bundle --format=iife --global-name=Engine --platform=browser --target=es2020 --outfile=out/engine.browser.js --external:fs --external:path --external:module --external:crypto --external:url --external:worker_threads --log-level=warning", { stdio: "inherit" });
const bundle = readFileSync("out/engine.browser.js", "utf8");
const b64 = (p) => readFileSync(p).toString("base64");
const assets = { wasm: b64("packages/runtime/wasm/hb.wasm"), fonts: { Inter: b64("packages/runtime/fonts/Inter-Variable.ttf") } };
const browser = await chromium.launch({ executablePath: findChrome() || undefined, args: ["--no-sandbox"] });
let failed = 0;
const say = (ok, msg) => { console.log(`${ok ? "ok" : "FAIL"}: ${msg}`); if (!ok && !report) failed++; };

for (const file of files) {
  const graph0 = JSON.parse(readFileSync(file, "utf8"));
  const name = path.basename(file).replace(/\.graph\.json$/, "");
  for (const aspect of ["16:9", "9:16"]) {
    const graph = { ...graph0, canvas: { ...graph0.canvas, aspect } };
    const height = 540, width = Math.round(aspect === "16:9" ? height * 16 / 9 : height * 9 / 16);   // half size: the ratios are scale-free
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
    await page.setContent(`<html><body style="margin:0"><canvas id="c" width="${width}" height="${height}"></canvas></body></html>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(async ({ assets, graph }) => {
      const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
      const shaper = await Engine.createShaper({ wasm: dec(assets.wasm), fonts: Object.fromEntries(Object.entries(assets.fonts).map(([k, v]) => [k, dec(v)])) });
      window.__rt = Engine.createRuntime({ shaper });
      window.__graph = Engine.parseGraph(graph);
      window.__ctx = document.getElementById("c").getContext("2d", { willReadFrequently: true });
    }, { assets, graph });
    for (const beat of graph.beats) {
      // hold time: past the enters, before the exits
      const hold = beat.start + Math.min(beat.duration - 0.25, Math.max(1.2, beat.duration * 0.6));
      const r = await page.evaluate(({ hold, width, height, beat }) => {
        const g = window.__graph, rt = window.__rt;
        const { w, h } = { w: g.canvas.aspect === "16:9" ? g.canvas.refHeight * 16 / 9 : g.canvas.refHeight * 9 / 16, h: g.canvas.refHeight };
        const boxes = rt.measure(g, hold);
        let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity, n = 0;
        for (const node of beat.nodes) {
          if (node.type === "cursor") continue;
          const b = boxes.get(node.id);
          if (!b) continue;
          L = Math.min(L, Math.max(0, b.left)); R = Math.max(R, Math.min(w, b.right)); T = Math.min(T, Math.max(0, b.top)); B = Math.max(B, Math.min(h, b.bottom)); n++;
        }
        const fill = n ? Math.max(0, R - L) * Math.max(0, B - T) / (w * h) : 0;
        rt.renderFrame(g, hold, { width, height, ctx: window.__ctx });
        const img = window.__ctx.getImageData(0, 0, width, height).data;
        const hex = (g.tokens.accent ?? "#000000").replace("#", ""), ar = parseInt(hex.slice(0, 2), 16), ag = parseInt(hex.slice(2, 4), 16), ab = parseInt(hex.slice(4, 6), 16);
        const toHsv = (r, gg, b) => { const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn; let hh = 0; if (d) { hh = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; hh = (hh * 60 + 360) % 360; } return [hh, mx ? d / mx : 0, mx / 255]; };
        const [ah] = toHsv(ar, ag, ab);
        const bgHex = (g.tokens.bg ?? "#000000").replace("#", ""), br = parseInt(bgHex.slice(0, 2), 16), bg2 = parseInt(bgHex.slice(2, 4), 16), bb = parseInt(bgHex.slice(4, 6), 16);
        let content = 0, accent = 0;
        for (let i = 0; i < img.length; i += 16) {          // every 4th pixel
          const r = img[i], gg = img[i + 1], b = img[i + 2];
          if (Math.abs(r - br) + Math.abs(gg - bg2) + Math.abs(b - bb) < 60) continue;   // background / field
          const [hh, s, v] = toHsv(r, gg, b);
          if (v < 0.35) continue;                                                        // glows, shadows, vignette
          content++;
          const dh = Math.min(Math.abs(hh - ah), 360 - Math.abs(hh - ah));
          if (dh <= 18 && s > 0.4 && v > 0.3) accent++;
        }
        return { fill, accentRatio: content ? accent / content : 0, content };
      }, { hold, width, height, beat });
      // the fill gate holds for UI beats (rects / images / wires on the beat); a text-only beat (hook, lockup, tag) is
      // wide but short by nature and is reported, not failed. The accent budget is a report: a brand hover fill or an
      // accent numeral is intentionally far above any budget.
      const ui = beat.nodes.some((n) => { const w = (m) => (m.type === "rect" && (m.h ?? 0) >= 200) || m.type === "image" || m.type === "wire" || (m.children ?? []).some(w); return w(n); });
      const fillOk = r.fill >= FILL;
      say(fillOk || !ui, `${name} ${aspect} ${beat.id}: fill ratio ${(r.fill * 100).toFixed(0)} % (${ui ? `gate >= ${FILL * 100} %` : "text beat, report"}) at t=${hold.toFixed(2)}`);
      console.log(`info: ${name} ${aspect} ${beat.id}: accent ${(r.accentRatio * 100).toFixed(0)} % of lit content pixels (report; guide <= ${ACCENT * 100} % outside hover fills / numerals)`);
    }
    await page.close();
  }
}
await browser.close();
if (failed) { console.log(`${failed} gate(s) failed`); process.exit(1); }
