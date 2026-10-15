// Local render loop: Chromium (Playwright) + ffmpeg, no Remotion. Same runtime, same graph, same pixels.
// usage: node tools/render-local.mjs fixtures/r3-hook.graph.json out/r3-local.mp4 [--fps 30] [--height 1080] [--chrome PATH]
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const [graphPath, outPath] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const height = Number(arg("--height", "1080"));
const chromePath = arg("--chrome", process.env.CHROME_PATH);
mkdirSync("out", { recursive: true });
execSync("npx esbuild tools/browser-entry.ts --bundle --format=iife --global-name=Engine --platform=browser --target=es2020 --outfile=out/engine.browser.js --external:fs --external:path --external:module --external:crypto --external:url --external:worker_threads --log-level=warning", { stdio: "inherit" });
const bundle = readFileSync("out/engine.browser.js", "utf8");
const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const fps = graph.canvas?.fps ?? 30;
const last = graph.beats[graph.beats.length - 1];
const frames = Math.ceil((last.start + last.duration) * fps);
const width = Math.round(graph.canvas.aspect === "16:9" ? height * 16 / 9 : height * 9 / 16);
const b64 = (p) => readFileSync(p).toString("base64");
// image assets a graph names, read from <graph dir>/assets/<src> (base64 for the page to decode)
function imageAssets(graph, graphFile) {
  const names = new Set();
  const walk = (n) => { if (n.type === "image" && n.src) names.add(n.src); (n.children ?? []).forEach(walk); };
  for (const b of graph.beats) b.nodes.forEach(walk);
  return Object.fromEntries([...names].map((n) => [n, readFileSync(path.join(path.dirname(graphFile), "assets", n)).toString("base64")]));
}
const assets = { wasm: b64("packages/runtime/wasm/hb.wasm"), fonts: { Inter: b64("packages/runtime/fonts/Inter-Variable.ttf") } };

const dir = path.join("out", "frames-local");
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width, height } });
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id="c" width="${width}" height="${height}"></canvas></body></html>`);
await page.addScriptTag({ content: bundle });
const images = imageAssets(graph, graphPath);
await page.evaluate(async ({ assets, graph, images }) => {
  const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const shaper = await Engine.createShaper({ wasm: dec(assets.wasm), fonts: Object.fromEntries(Object.entries(assets.fonts).map(([k, v]) => [k, dec(v)])) });
  const decoded = Object.fromEntries(await Promise.all(Object.entries(images).map(async ([k, v]) => [k, await createImageBitmap(new Blob([dec(v)]))])));
  window.__rt = Engine.createRuntime({ shaper, images: decoded });
  window.__graph = Engine.parseGraph(graph);
  window.__ctx = document.getElementById("c").getContext("2d");
}, { assets, graph, images });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const dataUrl = await page.evaluate(({ f, fps, width, height }) => {
    const c = document.getElementById("c");
    window.__rt.renderFrame(window.__graph, f / fps, { width, height, ctx: window.__ctx });
    return c.toDataURL("image/png");
  }, { f, fps, width, height });
  writeFileSync(path.join(dir, `${String(f).padStart(5, "0")}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
console.log(`rendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
execSync(`ffmpeg -v error -y -framerate ${fps} -i ${dir}/%05d.png -c:v libx264 -crf 16 -pix_fmt yuv420p ${outPath}`, { stdio: "inherit" });
console.log("wrote", outPath);
