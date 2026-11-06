import * as THREE from 'three';
import {Effect, EffectAttribute, BlendFunction} from 'postprocessing';

/**
 * Camera motion blur by depth reprojection (game-engine technique).
 * For each pixel: reconstruct world pos from depth with the current inverse view-projection,
 * re-project with the PREVIOUS frame's view-projection → screen velocity → blur along it.
 * Because the camera rig is a pure function of frame, prevVP is exact & deterministic.
 */
const frag = /* glsl */ `
uniform mat4 uCurInvVP;
uniform mat4 uPrevVP;
uniform float uShutter;
uniform float uMaxLen;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 wp = uCurInvVP * ndc; wp /= wp.w;
  vec4 pp = uPrevVP * wp; pp /= pp.w;
  vec2 prevUv = pp.xy * 0.5 + 0.5;
  vec2 vel = (uv - prevUv) * uShutter;
  float len = length(vel);
  if (len < 0.0008) { outputColor = inputColor; return; }
  if (len > uMaxLen) vel *= uMaxLen / len;
  vec4 acc = vec4(0.0);
  const int N = 20;
  for (int i = 0; i < N; i++) {
    float t = float(i) / float(N - 1) - 0.5;
    acc += texture2D(inputBuffer, clamp(uv + vel * t, 0.001, 0.999));
  }
  outputColor = acc / float(N);
}`;

export class CameraMotionBlurEffect extends Effect {
  constructor() {
    super('CameraMotionBlur', frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uCurInvVP', new THREE.Uniform(new THREE.Matrix4())],
        ['uPrevVP', new THREE.Uniform(new THREE.Matrix4())],
        ['uShutter', new THREE.Uniform(0.5)],
        ['uMaxLen', new THREE.Uniform(0.12)],
      ]),
    });
  }
  setMatrices(curInvVP: THREE.Matrix4, prevVP: THREE.Matrix4, shutter: number) {
    (this.uniforms.get('uCurInvVP') as THREE.Uniform).value.copy(curInvVP);
    (this.uniforms.get('uPrevVP') as THREE.Uniform).value.copy(prevVP);
    (this.uniforms.get('uShutter') as THREE.Uniform).value = shutter;
  }
}

/** Simple colour grade: lift/gamma/gain-ish tint + saturation + subtle grain + vignette (one pass). */
const gradeFrag = /* glsl */ `
uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uVig; uniform float uGrain; uniform float uSeed;
uniform vec3 uShadowTint; uniform vec3 uHiTint; uniform float uSplit; uniform float uVibrance; uniform vec3 uLift;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * uTint;
  float l = dot(c, vec3(0.299,0.587,0.114));
  // split-toning (reference look: cool violet shadows, warm sunlit highlights)
  vec3 tone = mix(uShadowTint, uHiTint, smoothstep(0.15, 0.75, l));
  c = mix(c, c * tone * 1.6, uSplit);
  c += uLift * (1.0 - smoothstep(0.0, 0.45, l));
  l = dot(c, vec3(0.299,0.587,0.114));
  c = mix(vec3(l), c, uSat);
  // vibrance: push the dull colours harder than the already-saturated ones
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float satNow = (mx - mn) / max(mx, 1e-3);
  c = mix(vec3(l), c, 1.0 + uVibrance * (1.0 - satNow));
  c = (c - 0.5) * uContrast + 0.5;
  vec2 d = uv - 0.5; d.x *= 0.75;
  c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d) * 1.4);
  c += (h(uv * 1000.0) - 0.5) * uGrain;
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}`;
export type GradeOpts = {tint?: string; sat?: number; contrast?: number; vignette?: number; grain?: number;
  /** split-toning: shadow / highlight tints and amount 0..1 */ shadowTint?: string; hiTint?: string; split?: number;
  /** extra saturation for dull colours only */ vibrance?: number; /** colour added to the shadows (lifted blacks) */ lift?: string};
export class GradeEffect extends Effect {
  constructor() {
    super('Grade', gradeFrag, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uTint', new THREE.Uniform(new THREE.Color(1, 1, 1))], ['uSat', new THREE.Uniform(1.08)], ['uContrast', new THREE.Uniform(1.04)],
        ['uVig', new THREE.Uniform(0.3)], ['uGrain', new THREE.Uniform(0.018)], ['uSeed', new THREE.Uniform(0)],
        ['uShadowTint', new THREE.Uniform(new THREE.Color('#9C8CFF'))], ['uHiTint', new THREE.Uniform(new THREE.Color('#FFE2B8'))],
        ['uSplit', new THREE.Uniform(0)], ['uVibrance', new THREE.Uniform(0)], ['uLift', new THREE.Uniform(new THREE.Color(0, 0, 0))],
      ]),
    });
  }
  set(o: GradeOpts & {seed?: number}) {
    const u = (k: string) => this.uniforms.get(k) as THREE.Uniform;
    if (o.tint) u('uTint').value.set(o.tint);
    if (o.sat !== undefined) u('uSat').value = o.sat;
    if (o.contrast !== undefined) u('uContrast').value = o.contrast;
    if (o.vignette !== undefined) u('uVig').value = o.vignette;
    if (o.grain !== undefined) u('uGrain').value = o.grain;
    if (o.seed !== undefined) u('uSeed').value = o.seed;
    if (o.shadowTint) u('uShadowTint').value.set(o.shadowTint);
    if (o.hiTint) u('uHiTint').value.set(o.hiTint);
    if (o.split !== undefined) u('uSplit').value = o.split;
    if (o.vibrance !== undefined) u('uVibrance').value = o.vibrance;
    if (o.lift) u('uLift').value.set(o.lift);
  }
}
