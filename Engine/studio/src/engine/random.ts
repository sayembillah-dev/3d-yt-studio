// Deterministic randomness. NEVER use Math.random / Date in scenes.
export function hash(...n: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    const s = String(v);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507);
  }
  return (h >>> 0) / 4294967296;
}
export function rng(seed: number | string) {
  let a = Math.floor(hash(seed) * 4294967296) >>> 0;
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}
/** smooth 1D value noise in [-1,1] */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f);
  const a = hash(i, seed) * 2 - 1, b = hash(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}
export function fbm1(x: number, seed = 0, oct = 3): number {
  let s = 0, amp = 0.5, fr = 1;
  for (let o = 0; o < oct; o++) { s += amp * noise1(x * fr, seed + o * 17); amp *= 0.5; fr *= 2; }
  return s;
}
