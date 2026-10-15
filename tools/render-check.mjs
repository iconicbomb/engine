// Browser render check: renders fixtures at 16:9 and 9:16 in Chromium and fails on page errors, on a clip that never
// changes, or on a frame-hash mismatch against a committed baseline (fixtures/<name>.frames.sha256).
// usage: node tools/render-check.mjs [fixtures/x.graph.json ...] [--update-baseline] [--chrome PATH]
//   no files = every fixtures/*.graph.json. Frames land in out/render-check/<name>/<aspect>/ for inspection.
//   --update-baseline rewrites the baseline of each fixture checked; only do it after looking at the frames.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const files = argv.filter((a, i) => a.endsWith(".json") && argv[i - 1] !== "--chrome");
// default: every fixture except the long ones — the showcase (render with tools/render-local.mjs --aspect ... --no-frames)
// and the planner's golden demo (pnpm make fixtures/briefs/demo.brief.json)
const LONG = new Set(["showcase.graph.json", "demo.graph.json"]);
const fixtures = files.length ? files : readdirSync("fixtures").filter((f) => f.endsWith(".graph.json") && !LONG.has(f)).sort().map((f) => `fixtures/${f}`);
const ASPECTS = ["16:9", "9:16"];
const height = 1080;

// Chromium: --chrome, CHROME_PATH, Playwright's own download, then a system Chrome.
function findChrome() {
  const explicit = arg("--chrome") ?? process.env.CHROME_PATH;
  if (explicit) return explicit;
  if (existsSync(chromium.executablePath())) return undefined;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("no Chromium: set CHROME_PATH or run `npx playwright install chromium`");
  return hit;
}

mkdirSync("out", { recursive: true });
// empty a frame directory; if it can't be removed (Windows: a shell's cwd is inside it), delete its files instead
function clearDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }); }
  catch { for (const f of readdirSync(dir)) rmSync(path.join(dir, f), { force: true }); }
  mkdirSync(dir, { recursive: true });
}
execSync("npx esbuild tools/browser-entry.ts --bundle --format=iife --global-name=Engine --platform=browser --target=es2020 --outfile=out/engine.browser.js --external:fs --external:path --external:module --external:crypto --external:url --external:worker_threads --log-level=warning", { stdio: "inherit" });
const bundle = readFileSync("out/engine.browser.js", "utf8");
const b64 = (p) => readFileSync(p).toString("base64");
// image assets a graph names, read from <graph dir>/assets/<src> (base64 for the page to decode)
function imageAssets(graph, graphFile) {
  const names = new Set();
  const walk = (n) => { if (n.type === "image" && n.src) names.add(n.src); (n.children ?? []).forEach(walk); };
  for (const b of graph.beats) b.nodes.forEach(walk);
  return Object.fromEntries([...names].map((n) => [n, readFileSync(path.join(path.dirname(graphFile), "assets", n)).toString("base64")]));
}
const assets = { wasm: b64("packages/runtime/wasm/hb.wasm"), fonts: { Inter: b64("packages/runtime/fonts/Inter-Variable.ttf") } };

const browser = await chromium.launch({ executablePath: findChrome(), args: ["--no-sandbox"] });
let failed = 0;
const report = (ok, msg) => { console.log(`${ok ? "ok" : "FAIL"}: ${msg}`); if (!ok) failed++; };

for (const file of fixtures) {
  const name = path.basename(file, ".graph.json");
  const source = JSON.parse(readFileSync(file, "utf8"));
  const baselinePath = `fixtures/${name}.frames.sha256`;
  const baseline = existsSync(baselinePath) ? readFileSync(baselinePath, "utf8").trim().split("\n") : null;
  const lines = [];
  for (const aspect of ASPECTS) {
    const graph = { ...source, canvas: { ...source.canvas, aspect } };
    const fps = graph.canvas.fps ?? 30;
    const last = graph.beats[graph.beats.length - 1];
    const frames = Math.ceil((last.start + last.duration) * fps);
    const width = Math.round(aspect === "16:9" ? height * 16 / 9 : height * 9 / 16);
    const dir = path.join("out", "render-check", name, aspect.replace(":", "x"));
    clearDir(dir);

    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.setContent(`<html><body style="margin:0;background:#000"><canvas id="c" width="${width}" height="${height}"></canvas></body></html>`);
    await page.addScriptTag({ content: bundle });
    try {
      const images = imageAssets(graph, file);
      await page.evaluate(async ({ assets, graph, images }) => {
        const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        const shaper = await Engine.createShaper({ wasm: dec(assets.wasm), fonts: Object.fromEntries(Object.entries(assets.fonts).map(([k, v]) => [k, dec(v)])) });
        const decoded = Object.fromEntries(await Promise.all(Object.entries(images).map(async ([k, v]) => [k, await createImageBitmap(new Blob([dec(v)]))])));
        window.__rt = Engine.createRuntime({ shaper, images: decoded });
        window.__graph = Engine.parseGraph(graph);
        window.__ctx = document.getElementById("c").getContext("2d");
      }, { assets, graph, images });
      const hashes = [];
      for (let f = 0; f < frames; f++) {
        const dataUrl = await page.evaluate(({ f, fps, width, height }) => {
          window.__rt.renderFrame(window.__graph, f / fps, { width, height, ctx: window.__ctx });
          return document.getElementById("c").toDataURL("image/png");
        }, { f, fps, width, height });
        const png = Buffer.from(dataUrl.split(",")[1], "base64");
        writeFileSync(path.join(dir, `${String(f).padStart(5, "0")}.png`), png);
        hashes.push(createHash("sha256").update(png).digest("hex"));
      }
      hashes.forEach((h, f) => lines.push(`${aspect} ${String(f).padStart(5, "0")} ${h}`));
      report(errors.length === 0, `${name} ${aspect}: ${frames} frames, no page errors${errors.length ? ` — ${errors[0]}` : ""}`);
      report(new Set(hashes).size > 1, `${name} ${aspect}: animates (${new Set(hashes).size} distinct frames)`);
    } catch (e) {
      report(false, `${name} ${aspect}: render threw — ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
  if (flag("--update-baseline")) {
    writeFileSync(baselinePath, lines.join("\n") + "\n");
    console.log(`wrote ${baselinePath} (${lines.length} frames)`);
  } else if (baseline) {
    const diff = lines.filter((l, i) => l !== baseline[i]).length + Math.abs(lines.length - baseline.length);
    report(diff === 0, `${name}: frame hashes match ${baselinePath}${diff ? ` (${diff} frames differ)` : ` (${lines.length} frames)`}`);
  }
}
await browser.close();
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
