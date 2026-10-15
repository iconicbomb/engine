#!/usr/bin/env python3
"""Phase-0 acceptance check: compare a rendered clip against a reference clip frame by frame.

usage: compare_frames.py REFERENCE.mp4 RENDER.mp4 [--start S] [--dur D] [--fps F] [--out strip.png]

Prints per-frame SSIM (on luminance, 8x8 windows, both clips scaled to 480px wide),
the mean, the worst frame, and writes a side-by-side strip (reference top, render bottom)
of the worst N frames so you can see *what* differs, not just that it does.
Pass criterion for phase 0: mean SSIM >= 0.85 and no frame below 0.70.
Requires: ffmpeg on PATH, numpy, pillow.
"""
import argparse, glob, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw

def extract(path, start, dur, fps, width, outdir):
    os.makedirs(outdir, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(dur), "-i", path,
                    "-vf", f"fps={fps},scale={width}:-2", f"{outdir}/%05d.png"], check=True)
    files = sorted(glob.glob(f"{outdir}/*.png"))
    return [np.asarray(Image.open(f).convert("L"), dtype=np.float64) for f in files]

def ssim(a, b, win=8):
    # mean SSIM over non-overlapping win x win windows (Wang et al. constants for 8-bit)
    h = min(a.shape[0], b.shape[0]) // win * win
    w = min(a.shape[1], b.shape[1]) // win * win
    a = a[:h, :w].reshape(h // win, win, w // win, win).transpose(0, 2, 1, 3).reshape(-1, win * win)
    b = b[:h, :w].reshape(h // win, win, w // win, win).transpose(0, 2, 1, 3).reshape(-1, win * win)
    mu_a, mu_b = a.mean(1), b.mean(1)
    va, vb = a.var(1), b.var(1)
    cov = ((a - mu_a[:, None]) * (b - mu_b[:, None])).mean(1)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    s = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (va + vb + c2))
    return float(s.mean())

def strip(ref, ren, idxs, scores, start, fps, out):
    if not idxs or not out.lower().endswith((".png", ".jpg", ".jpeg")): return
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    w, h = ref[0].shape[1], ref[0].shape[0]
    canvas = Image.new("L", (w * len(idxs), h * 2 + 18), 0)
    d = ImageDraw.Draw(canvas)
    for k, i in enumerate(idxs):
        canvas.paste(Image.fromarray(ref[i].astype(np.uint8)), (k * w, 18))
        canvas.paste(Image.fromarray(ren[i].astype(np.uint8)), (k * w, 18 + h))
        d.text((k * w + 4, 2), f"t={start + i / fps:.2f}s ssim={scores[i]:.2f}", fill=255)
    canvas.save(out)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("reference"); p.add_argument("render")
    p.add_argument("--start", type=float, default=0.0); p.add_argument("--dur", type=float, default=3.2)
    p.add_argument("--fps", type=int, default=15); p.add_argument("--width", type=int, default=480)
    p.add_argument("--render-start", type=float, default=None, help="offset into RENDER (default: same as --start)")
    p.add_argument("--worst", type=int, default=6); p.add_argument("--out", default="compare_strip.png")
    a = p.parse_args()
    tmp = tempfile.mkdtemp(prefix="cmp_")
    try:
        ref = extract(a.reference, a.start, a.dur, a.fps, a.width, f"{tmp}/ref")
        ren = extract(a.render, a.start if a.render_start is None else a.render_start, a.dur, a.fps, a.width, f"{tmp}/ren")
        n = min(len(ref), len(ren))
        if n == 0: sys.exit("no frames extracted")
        scores = [ssim(ref[i], ren[i]) for i in range(n)]
        mean, worst = float(np.mean(scores)), int(np.argmin(scores))
        print(f"frames={n} mean_ssim={mean:.3f} min_ssim={scores[worst]:.3f} at t={a.start + worst / a.fps:.2f}s")
        print("per-frame:", " ".join(f"{s:.2f}" for s in scores))
        order = sorted(range(n), key=lambda i: scores[i])[: a.worst]
        strip(ref, ren, sorted(order), scores, a.start, a.fps, a.out)
        print(f"strip of worst {len(order)} frames -> {a.out}")
        ok = mean >= 0.85 and min(scores) >= 0.70
        print("PASS" if ok else "FAIL", "(criterion: mean >= 0.85, min >= 0.70)")
        sys.exit(0 if ok else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
