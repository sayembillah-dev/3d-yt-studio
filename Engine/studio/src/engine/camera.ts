/* PURE camera maths (no React/three/remotion): imported by Stage AND by Node QA (scripts/cam_dump.mjs). */
import {fbm1} from './random';
import {clamp01} from './words';

export type V3 = [number, number, number];
export type CamKey = {f: number; pos: V3; look: V3; fov?: number; roll?: number; ease?: 'flow' | 'inOut' | 'out' | 'in' | 'linear' | 'whip'};
export type Shake = {f: number; amp: number; dur: number};
/** pulse (0..0.8): speed swells to (1+pulse)× AT each waypoint and eases to (1-pulse)× between them — the reference rhythm
 *  (a framing change = a camera surge, then a glide). Never stops; waypoints become the measured beats. 0 = uniform flow. */
export type CameraSpec = {keys: CamKey[]; drift?: number; shakes?: Shake[]; pulse?: number};

const EASES: Record<string, (t: number) => number> = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  linear: (t) => t,
  whip: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2), // slow-fast-slow, very peaky = motion-blur streak
};
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

type Track = {f: number; v: number[]}[];
/** Non-uniform Catmull-Rom/Hermite in TIME: velocity is continuous through every waypoint (the camera never stops). */
function flowAt(tr: Track, f: number): number[] {
  const n = tr.length; const dim = tr[0].v.length;
  const tan = (j: number) => { const a = tr[Math.max(0, j - 1)], b = tr[Math.min(n - 1, j + 1)]; const dt = Math.max(1, b.f - a.f); return a.v.map((x, d) => (b.v[d] - x) / dt); };
  if (n === 1) return tr[0].v;
  if (f <= tr[0].f) { const m = tan(0); return tr[0].v.map((x, d) => x + m[d] * (f - tr[0].f) * 0.5); }        // already moving before first key
  if (f >= tr[n - 1].f) { const m = tan(n - 1); const t = f - tr[n - 1].f; const k = 30 * (1 - Math.exp(-t / 30)); return tr[n - 1].v.map((x, d) => x + m[d] * k); } // glide on, decaying
  let i = 0; while (i < n - 2 && f > tr[i + 1].f) i++;
  const a = tr[i], b = tr[i + 1]; const dt = Math.max(1, b.f - a.f); const u = (f - a.f) / dt;
  const ma = tan(i), mb = tan(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return Array.from({length: dim}, (_, d) => h00 * a.v[d] + h10 * dt * ma[d] + h01 * b.v[d] + h11 * dt * mb[d]);
}

/**
 * Pure function of frame → camera state. Used for the rig AND the motion-blur previous-frame matrix.
 * ONE camera for the whole video (style-bible §4): keys are waypoints of a single continuous flight.
 * Default interpolation is 'flow' (continuous velocity). A key may set ease ('whip' | 'inOut' | ...) to make
 * the segment arriving at it a deliberate eased move instead (use sparingly: an eased stop is a stop).
 */
export function cameraAt(spec: CameraSpec, frameIn: number) {
  const ks = spec.keys;
  let frame = frameIn;
  const p = spec.pulse ?? 0;
  if (p > 0 && ks.length > 1) {   // time-warp inside each flow segment: u' = u + p/2π·sin(2πu) → speed 1 + p·cos(2πu)
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i].f, b = ks[i + 1].f;
      if (frameIn >= a && frameIn < b && (!ks[i + 1].ease || ks[i + 1].ease === 'flow')) {
        const u = (frameIn - a) / Math.max(1, b - a); frame = a + (b - a) * (u + (p / (2 * Math.PI)) * Math.sin(2 * Math.PI * u)); break;
      }
    }
  }
  const tr: Track = ks.map((k) => ({f: k.f, v: [...k.pos, ...k.look, k.fov ?? 40, k.roll ?? 0]}));
  let v = flowAt(tr, frame);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (b.ease && b.ease !== 'flow' && frame >= a.f && frame <= b.f) {
      const t = EASES[b.ease](clamp01((frame - a.f) / Math.max(1, b.f - a.f)));
      v = tr[i].v.map((x, d) => x + (tr[i + 1].v[d] - x) * t);
    }
  }
  let pos: V3 = [v[0], v[1], v[2]], look: V3 = [v[3], v[4], v[5]]; const fov = v[6]; let roll = v[7];
  // always-on "breathing" handheld drift on top of the flight
  const d = spec.drift ?? 0.06;
  pos = [pos[0] + fbm1(frameIn / 70, 11) * d, pos[1] + fbm1(frameIn / 80, 23) * d * 0.6, pos[2] + fbm1(frameIn / 90, 37) * d * 0.5];
  look = [look[0] + fbm1(frameIn / 75, 41) * d * 0.5, look[1] + fbm1(frameIn / 85, 53) * d * 0.4, look[2]];
  for (const s of spec.shakes ?? []) {
    const age = frameIn - s.f;
    if (age >= 0 && age < s.dur) {
      const k = s.amp * Math.pow(1 - age / s.dur, 2);
      pos = [pos[0] + Math.sin(age * 2.7) * k, pos[1] + Math.cos(age * 3.3) * k * 0.8, pos[2]];
      roll += Math.sin(age * 2.1) * k * 0.05;
    }
  }
  return {pos, look, fov, roll};
}


/* ---------------------------------------------------------------- multi-set projects: one camera TRACK per set
 * A project may export `CAMERAS: CameraTrack[]` (instead of / besides `camera`). Each track is a continuous flight that
 * keeps moving through its dissolve windows; the edit swaps tracks at `from` (the dissolve midpoint) — the dissolve hides
 * the swap, both sides are moving (style-bible §5). QA tools read a project via projectCameraAt / projectKeys / projectSwaps. */
export type CameraTrack = {from: number; to: number; spec: CameraSpec};
export function cameraAtTracks(tracks: CameraTrack[], frame: number) {
  let t = tracks[0]; for (const k of tracks) if (frame >= k.from) t = k;
  return cameraAt(t.spec, frame);
}
type CamModule = {camera?: CameraSpec; CAMERAS?: CameraTrack[]};
export const projectCameraAt = (m: CamModule, f: number) => (m.CAMERAS && m.CAMERAS.length ? cameraAtTracks(m.CAMERAS, f) : cameraAt(m.camera!, f));
export const projectKeys = (m: CamModule): CamKey[] => (m.CAMERAS && m.CAMERAS.length ? m.CAMERAS.flatMap((t) => t.spec.keys.filter((k) => k.f >= t.from && k.f <= t.to)) : m.camera!.keys);
export const projectShakes = (m: CamModule): Shake[] => (m.CAMERAS && m.CAMERAS.length ? m.CAMERAS.flatMap((t) => (t.spec.shakes ?? []).filter((k) => k.f >= t.from && k.f < t.to)) : m.camera!.shakes ?? []);
/** frames where the edit switches camera track (excluded from continuity gates like a cut, but not counted as a cut) */
export const projectSwaps = (m: CamModule): number[] => (m.CAMERAS && m.CAMERAS.length ? m.CAMERAS.slice(1).map((t) => t.from) : []);
