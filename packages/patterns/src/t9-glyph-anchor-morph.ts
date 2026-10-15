// T9 — glyph-anchor morph (R6). The old string fades out glyph by glyph left -> right until only the glyphs it shares
// with the new string remain ("Pixel" -> "ix"), then those re-case / scale into the new word ("IX"). Measured: fade
// sweep 1.5 s; case morph 200 ms.
// Flat version: each word is a layout:row group of single-character text nodes (letters animate individually; kerning
// between letters is lost); shared letters = case-insensitive longest common subsequence. Non-shared old letters fade
// left -> right across the sweep; then the remaining old letters fade / grow out while the new word's letters fade /
// scale in over the morph. Not modelled yet: the remaining glyphs travelling into the new word's slots (morph solver).
import { group } from "./assemble";
import { result, sec, type AnchorIn, type MacroResult, type NodeIn, type TextStyleIn, type TweenTrackIn } from "./macro";

export interface GlyphAnchorMorphParams {
  id: string;                     // groups <id>-old / <id>-new, letters <id>-old-<n> / <id>-new-<n>
  from: string;
  to: string;
  style: TextStyleIn;
  at: number;                     // the fade sweep starts
  anchor?: AnchorIn;
  sweepMs?: number;
  morphMs?: number;
  fadeMs?: number;                // each letter's fade during the sweep
}

// indices of a case-insensitive longest common subsequence: pairs [i in a, j in b]
function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = a[i].toLowerCase() === b[j].toLowerCase() && a[i] !== " " ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].toLowerCase() === b[j].toLowerCase() && a[i] !== " ") { out.push([i, j]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return out;
}

export function glyphAnchorMorph(p: GlyphAnchorMorphParams): MacroResult {
  const A = [...p.from], B = [...p.to], shared = lcs(A, B);
  const keepA = new Set(shared.map(([i]) => i)), keepB = new Set(shared.map(([, j]) => j));
  const sweep = p.sweepMs ?? 1500, morph = p.morphMs ?? 200, fade = p.fadeMs ?? 300;
  const gone = A.map((_, i) => i).filter((i) => !keepA.has(i) && A[i] !== " ");
  const step = gone.length > 1 ? (sweep - fade) / (gone.length - 1) : 0;
  const morphAt = sec(p.at + sweep / 1000);
  const letter = (id: string, ch: string, tracks: TweenTrackIn[]): NodeIn => ({ id, type: "text", text: ch, style: p.style, tracks });
  const oldL = A.map((ch, i) => {
    const k = gone.indexOf(i);
    const tracks: TweenTrackIn[] = k >= 0
      ? [{ mode: "tween", prop: "opacity", at: sec(p.at + (k * step) / 1000), ms: fade, from: 1, to: 0, ease: "settle" }]
      : [{ mode: "tween", prop: "opacity", at: morphAt, ms: morph, from: 1, to: 0, ease: "settle" },
         { mode: "tween", prop: "scale", at: morphAt, ms: morph, from: 1, to: 1.25, ease: "emphasis" }];
    return letter(`${p.id}-old-${i + 1}`, ch, tracks);
  });
  const newL = B.map((ch, j) => letter(`${p.id}-new-${j + 1}`, ch, [
    { mode: "tween", prop: "opacity", at: 0, ms: 0, from: 0, to: 0, ease: "linear" },
    { mode: "tween", prop: "opacity", at: keepB.has(j) ? morphAt : sec(morphAt + morph / 1000), ms: morph, from: 0, to: 1, ease: "settle" },
    { mode: "tween", prop: "scale", at: keepB.has(j) ? morphAt : sec(morphAt + morph / 1000), ms: morph, from: 0.7, to: 1, ease: "emphasis" },
  ]));
  return result({ nodes: [group({ id: p.id, anchor: p.anchor }, [
    group({ id: `${p.id}-old`, layout: { type: "row", gap: 0 } }, oldL),
    group({ id: `${p.id}-new`, layout: { type: "row", gap: 0 } }, newL),
  ])] });
}
