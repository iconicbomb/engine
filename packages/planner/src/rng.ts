// Seeded randomness: every choice the planner makes is drawn from a stream derived from (seed, key), so the same brief
// and seed give an identical graph and a different seed gives legitimate variation.
export type Rng = () => number;

function hash(s: string): number {
  let h = 2166136261 >>> 0;                         // FNV-1a
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export function rngFor(seed: number, key: string): Rng {
  let a = (hash(`${seed}:${key}`) || 1) >>> 0;      // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends { weight: number }>(rng: Rng, items: T[]): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (const i of items) { r -= Math.max(0, i.weight); if (r < 0) return i; }
  return items[items.length - 1];
}
