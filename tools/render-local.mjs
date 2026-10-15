// Local render loop: Chromium (Playwright) + ffmpeg, no Remotion. Same runtime, same graph, same pixels.
// usage: node tools/render-local.mjs fixtures/r3-hook.graph.json out/r3-local.mp4 [--fps 30] [--height 1080] [--chrome PATH]
//        [--aspect 16:9|9:16]  render at this aspect whatever the graph says
//        [--no-frames]         pipe PNGs straight into ffmpeg (no out/frames-local; for long graphs like the showcase)
//        [--times 1.2,3.4]     render only these seconds as PNGs (<outPath> is then a directory) — the look-layer loop
//        [--pack name]         render the graph in a style pack: sets style.pack, drops the graph's own tokens (except
//                              font) and field overrides so the pack's measured look applies (look comparisons)
import { chromium } from "playwright";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import path from "node:path";

const [graphPath, outPath] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const height = Number(arg("--height", "1080"));
// Chromium: --chrome, CHROME_PATH, Playwright's own download, then a system Chrome (as render-check)
function findChrome() {
  const explicit = arg("--chrome", process.env.CHROME_PATH);
  if (explicit) return explicit;
  if (existsSync(chromium.executablePath())) return undefined;
  return ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p));
}
const chromePath = findChrome();
mkdirSync("out", { recursive: true });
execSync("npx esbuild tools/browser-entry.ts --bundle --format=iife --global-name=Engine --platform=browser --target=es2020 --outfile=out/engine.browser.js --external:fs --external:path --external:module --external:crypto --external:url --external:worker_threads --log-level=warning", { stdio: "inherit" });
const bundle = readFileSync("out/engine.browser.js", "utf8");
const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const aspect = arg("--aspect", undefined);
if (aspect) { if (aspect !== "16:9" && aspect !== "9:16") throw new Error(`--aspect must be 16:9 or 9:16, got ${aspect}`); graph.canvas = { ...graph.canvas, aspect }; }
const times = arg("--times", undefined)?.split(",").map(Number);
const pack = arg("--pack", undefined);
if (pack) {
  graph.style = { pack };
  graph.tokens = { font: graph.tokens?.font ?? "Inter" };
  for (const b of graph.beats) { delete b.field; if (b.background && !b.background.startsWith("tokens.")) b.background = "tokens.bg"; }
}
const keepFrames = !process.argv.includes("--no-frames") && !times;
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
if (keepFrames) {
  // a folder a shell's cwd is in can't be removed on Windows: delete its files instead
  try { rmSync(dir, { recursive: true, force: true }); } catch { for (const f of readdirSync(dir)) rmSync(path.join(dir, f), { force: true }); }
  mkdirSync(dir, { recursive: true });
}
const ffmpegArgs = ["-v", "error", "-y", "-framerate", String(fps)];
const pipe = keepFrames || times ? null : spawn("ffmpeg", [...ffmpegArgs, "-f", "image2pipe", "-i", "-", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", outPath], { stdio: ["pipe", "inherit", "inherit"] });
const piped = pipe ? new Promise((res, rej) => { pipe.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); }) : null;

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
if (times) {
  mkdirSync(outPath, { recursive: true });
  const stem = path.basename(graphPath).replace(/\.graph\.json$/, "");
  for (const tSec of times) {
    const dataUrl = await page.evaluate(({ tSec, width, height }) => {
      const c = document.getElementById("c");
      window.__rt.renderFrame(window.__graph, tSec, { width, height, ctx: window.__ctx });
      return c.toDataURL("image/png");
    }, { tSec, width, height });
    writeFileSync(path.join(outPath, `${stem}${pack ? "-" + pack : ""}-${graph.canvas.aspect.replace(":", "x")}-${tSec.toFixed(2)}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  await browser.close();
  console.log(`rendered ${times.length} frames to ${outPath}`);
  process.exit(0);
}
for (let f = 0; f < frames; f++) {
  const dataUrl = await page.evaluate(({ f, fps, width, height }) => {
    const c = document.getElementById("c");
    window.__rt.renderFrame(window.__graph, f / fps, { width, height, ctx: window.__ctx });
    return c.toDataURL("image/png");
  }, { f, fps, width, height });
  const png = Buffer.from(dataUrl.split(",")[1], "base64");
  if (pipe) { if (!pipe.stdin.write(png)) await new Promise((r) => pipe.stdin.once("drain", r)); }
  else writeFileSync(path.join(dir, `${String(f).padStart(5, "0")}.png`), png);
  if (f % 300 === 299) console.log(`  ${f + 1}/${frames} frames`);
}
await browser.close();
console.log(`rendered ${frames} frames (${graph.canvas.aspect}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (pipe) { pipe.stdin.end(); await piped; }
else execSync(`ffmpeg ${ffmpegArgs.join(" ")} -i ${dir}/%05d.png -c:v libx264 -crf 16 -pix_fmt yuv420p ${outPath}`, { stdio: "inherit" });
console.log("wrote", outPath);
