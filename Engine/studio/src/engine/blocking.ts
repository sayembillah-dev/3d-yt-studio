/* PURE blocking maths (no React/three): used by characters AND by Node QA (cam_dump → cam_qa G16-G17). */
export type V3 = [number, number, number];
export type PathKey = {f: number; pos: V3; ease?: 'inOut' | 'linear'};
/** Actor blocking: where a character stands / walks. Keep these in scenes/blocking.ts and pass to the character. */
export type Actor = {id: string; pos?: V3; path?: PathKey[]; radius?: number; enter?: number; exit?: number};
/** Static obstacle the camera must not fly through and actors must not walk through. */
export type Obstacle = {id: string; pos: V3; radius: number; height?: number};
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export function posAt(p: {pos?: V3; path?: PathKey[]}, f: number): V3 {
  if (!p.path || p.path.length === 0) return p.pos ?? [0, 0, 0];
  const ks = p.path;
  if (f <= ks[0].f) return ks[0].pos;
  if (f >= ks[ks.length - 1].f) return ks[ks.length - 1].pos;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (f >= a.f && f <= b.f) {
      const t0 = clamp01((f - a.f) / Math.max(1, b.f - a.f)); const t = b.ease === 'linear' ? t0 : inOut(t0);
      return [a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t];
    }
  }
  return ks[0].pos;
}
