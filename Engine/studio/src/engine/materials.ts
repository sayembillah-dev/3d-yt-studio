import * as THREE from 'three';

/** 3-band toon ramp with soft-ish steps (the reference look is cel shading with gentle transitions) */
const rampCache: Record<string, THREE.DataTexture> = {};
export function toonRamp(steps: number[] = [0.42, 0.72, 1.0]): THREE.DataTexture {
  const key = steps.join(',');
  if (rampCache[key]) return rampCache[key];
  const n = 64; const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // soft-stepped: blend between bands over a narrow window
    let v = steps[0];
    for (let s = 1; s < steps.length; s++) { const edge = s / steps.length; const k = Math.min(1, Math.max(0, (t - edge + 0.06) / 0.12)); v = v + (steps[s] - v) * k; }
    const b = Math.round(v * 255); data.set([b, b, b, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  rampCache[key] = tex; return tex;
}
export type ToonOpts = {color?: string; map?: THREE.Texture | null; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side};
export function toon(o: ToonOpts = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: o.color ?? '#ffffff', map: o.map ?? null, gradientMap: toonRamp(),
    emissive: o.emissive ?? '#000000', emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
  });
}
