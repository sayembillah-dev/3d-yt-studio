import {Easing, interpolate} from 'remotion';
export {FPS, sec, wordAt, clamp01} from './words';
export type {Word} from './words';
import {clamp01} from './words';
export const ease = Easing.bezier(0.45, 0, 0.55, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const backOut = Easing.back(1.7);
/** 0→1 ramp between frames a and b with easing */
export function ramp(frame: number, a: number, b: number, fn = ease) {
  return interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: fn});
}
/** Keyframe track: [[frame, value], ...] eased between keys (numbers or number arrays) */
export function track<T extends number | number[]>(frame: number, keys: [number, T][], fn = ease): T {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [fa, va] = keys[i], [fb, vb] = keys[i + 1];
    if (frame <= fb) {
      const t = fn(clamp01((frame - fa) / Math.max(1, fb - fa)));
      if (typeof va === 'number') return (va + ((vb as number) - va) * t) as T;
      return (va as number[]).map((v, k) => v + ((vb as number[])[k] - v) * t) as T;
    }
  }
  return keys[keys.length - 1][1];
}
/** Step track (instant swaps, e.g. expressions): returns value of last key <= frame */
export function step<T>(frame: number, keys: [number, T][]): T {
  let v = keys[0][1];
  for (const [f, val] of keys) if (frame >= f) v = val;
  return v;
}
