import * as THREE from 'three';
import React, {useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useStage} from '../Stage';
import {hash, noise1, fbm1} from '../random';
import {clamp01} from '../timing';
import {radial} from '../textures/canvas';
import {drawCharacter, ARM_POSES, LEG_POSES, CW, CH, PAD, FEET_Y, FIG_H, Look, Face, ArmPose, LegPose, Fx, HeldProp, DrawState} from './draw';

export type V3 = [number, number, number];
/** A key on the character's acting timeline. Every field is optional and "sticks" until changed. */
export type CharKey = {
  f: number; face?: Face; arms?: ArmPose; armL?: ArmPose; armR?: ArmPose; legs?: LegPose;
  fx?: Fx[]; holdL?: HeldProp | null; holdR?: HeldProp | null; facing?: 'front' | 'back';
  look?: [number, number]; flush?: {color: string; amt: number} | null; lean?: number; flip?: boolean;
  /** one-shot accent: hop / nod / recoil / shake (head), plays ~10 frames */
  beat?: 'hop' | 'nod' | 'recoil' | 'shake' | 'stomp';
};
export type {PathKey} from '../blocking';
import type {PathKey} from '../blocking';

export type StickCharacterProps = {
  look: Look; seed?: number;
  /** static position, or path keys (character walks between them; walk cycle auto-plays while moving) */
  pos?: V3; path?: PathKey[];
  height?: number;            // world units, feet → top of head (default 1.7)
  keys?: CharKey[];
  talk?: [number, number][];  // frame ranges where this character's mouth flaps
  idle?: number;              // amount of always-on idle motion (default 1). NEVER 0: nobody stands still
  shadow?: boolean; tint?: string; renderOrder?: number;
  /** 'pose' (reference-measured default for 3D): pose-to-pose, 4-frame attacks with bezier(.2,0,.1,1), then HOLD (no idle sway).
   *  'bouncy': 6-frame backOut overshoot + idle sway (old 2D look). */
  motion?: 'pose' | 'bouncy';
};
/** CSS-style cubic-bezier(x1,y1,x2,y2) easing, solved by Newton iterations (deterministic). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  const dx = (t: number) => 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
  return (x: number) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (bx(t) - x) / d; t = Math.min(1, Math.max(0, t)); } return by(t); };
}
const POSE_EASE = cubicBezier(0.2, 0, 0.1, 1);

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export {posAt} from '../blocking';
import {posAt} from '../blocking';

/** Resolve the sticky state + "when did X last change" for blending. */
export function resolve(keys: CharKey[], f: number) {
  const st: Required<Pick<CharKey, 'face' | 'legs' | 'fx' | 'facing' | 'look' | 'lean' | 'flip'>> & {armL: ArmPose; armR: ArmPose; holdL: HeldProp | null; holdR: HeldProp | null; flush: CharKey['flush']} = {
    face: 'neutral', armL: 'relaxed', armR: 'relaxed', legs: 'stand', fx: [], holdL: null, holdR: null, facing: 'front', look: [0, 0], flush: null, lean: 0, flip: false,
  };
  let prevL: ArmPose = 'relaxed', prevR: ArmPose = 'relaxed', fL = -999, fR = -999, fFace = -999, fLegs = -999, prevLegs: LegPose = 'stand';
  const fxStart: Record<string, number> = {};
  let beat: {kind: NonNullable<CharKey['beat']>; f: number} | null = null;
  const sorted = [...keys].sort((a, b) => a.f - b.f);
  for (const k of sorted) {
    if (k.f > f) break;
    const L = k.armL ?? k.arms, R = k.armR ?? k.arms;
    if (L && L !== st.armL) { prevL = st.armL; st.armL = L; fL = k.f; }
    if (R && R !== st.armR) { prevR = st.armR; st.armR = R; fR = k.f; }
    if (k.face && k.face !== st.face) { st.face = k.face; fFace = k.f; }
    if (k.legs && k.legs !== st.legs) { prevLegs = st.legs; st.legs = k.legs; fLegs = k.f; }
    if (k.fx) { for (const x of k.fx) if (!st.fx.includes(x)) fxStart[x] = k.f; st.fx = k.fx; }
    if (k.holdL !== undefined) st.holdL = k.holdL;
    if (k.holdR !== undefined) st.holdR = k.holdR;
    if (k.facing) st.facing = k.facing;
    if (k.look) st.look = k.look;
    if (k.flush !== undefined) st.flush = k.flush;
    if (k.lean !== undefined) st.lean = k.lean;
    if (k.flip !== undefined) st.flip = k.flip;
    if (k.beat) beat = {kind: k.beat, f: k.f};
  }
  return {st, prevL, prevR, fL, fR, fFace, fLegs, prevLegs, fxStart, beat};
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function characterState(p: StickCharacterProps, f: number, rimColor: string, velX: number, speed: number): DrawState & {flip: boolean; hop: number} {
  const seed = p.seed ?? 1; const pose = p.motion === 'pose'; const idle = p.idle ?? (pose ? 0 : 1);
  const ATTACK = pose ? 4 : 6; const easeArm = pose ? POSE_EASE : backOut;
  const r = resolve(p.keys ?? [], f);
  const {st} = r;
  // --- arm blend with overshoot (6 frames)
  const blendArm = (prev: ArmPose, cur: ArmPose, fc: number, side: number): [number, number] => {
    const t = easeArm(clamp01((f - fc) / ATTACK)); const a = ARM_POSES[prev], b = ARM_POSES[cur];
    let s: [number, number] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    // always-on life: sway + forearm drift; wave/shake gestures oscillate
    s = [s[0] + idle * (4 * Math.sin(f * 0.07 + seed + side) + 3 * fbm1(f / 40, seed * 7 + side)), s[1] + idle * 6 * fbm1(f / 30, seed * 13 + side)];
    if (cur === 'wave') s[1] += 26 * Math.sin(f * 0.55);
    if (cur === 'fist') s[0] += 10 * Math.sin(f * 0.9);
    if (cur === 'point' && !pose) s[0] += 3 * Math.sin(f * 0.25);
    return s;
  };
  let armL = blendArm(r.prevL, st.armL, r.fL, 0), armR = blendArm(r.prevR, st.armR, r.fR, 1);
  // --- legs
  const lt = POSE_EASE(clamp01((f - r.fLegs) / ATTACK)); const L0 = LEG_POSES[r.prevLegs], L1 = LEG_POSES[st.legs];
  let legs = {lt: lerp(L0.lt, L1.lt, lt), ls: lerp(L0.ls, L1.ls, lt), rt: lerp(L0.rt, L1.rt, lt), rs: lerp(L0.rs, L1.rs, lt), thighScale: lerp(L0.thighScale, L1.thighScale, lt)};
  let bob = idle * (4 + 3 * Math.sin(f * 0.11 + seed)); // breathing (0 in 'pose' mode: references HOLD poses)
  let lean = st.lean + idle * 1.6 * fbm1(f / 55, seed * 3);
  const moving = speed > 0.004 || st.legs === 'walk' || st.legs === 'run';
  let hop = 0;
  if (moving) {
    const run = st.legs === 'run'; const ph = f * (run ? 0.75 : 0.5) + seed;
    const sL = Math.max(0, Math.sin(ph)), sR = Math.max(0, Math.sin(ph + Math.PI));
    legs = {lt: 6 + (run ? 26 : 14) * sL, ls: -(run ? 70 : 42) * sL, rt: 6 + (run ? 26 : 14) * sR, rs: -(run ? 70 : 42) * sR, thighScale: 1};
    bob += Math.abs(Math.sin(ph)) * (run ? 26 : 12);
    lean += velX * 2 + (run ? 6 : 2) * Math.sign(velX || 1);
    if (st.armL === 'relaxed' || st.armL === 'down') armL = [armL[0] + 22 * Math.sin(ph + Math.PI), armL[1] - 20];
    if (st.armR === 'relaxed' || st.armR === 'down') armR = [armR[0] + 22 * Math.sin(ph), armR[1] - 20];
  } else {
    // weight shift on the spot
    legs.lt += idle * 2 * Math.sin(f * 0.05 + seed); legs.rt -= idle * 2 * Math.sin(f * 0.05 + seed);
  }
  // --- expression pop: squash-stretch overshoot when the face changes
  const ageFace = f - r.fFace; let squash = 1;
  if (ageFace >= 0 && ageFace < 10) squash = 1 + 0.09 * Math.sin((ageFace / 10) * Math.PI * 2.2) * (1 - ageFace / 10);
  // --- beats
  if (r.beat) {
    const a = f - r.beat.f;
    if (a >= 0 && a < 12) {
      const k = 1 - a / 12;
      if (r.beat.kind === 'hop') hop = Math.sin((a / 12) * Math.PI) * 0.18;
      if (r.beat.kind === 'nod') lean += 0; // nod handled via look
      if (r.beat.kind === 'recoil') { lean -= 8 * k; squash *= 1 - 0.06 * k; }
      if (r.beat.kind === 'shake') lean += 5 * Math.sin(a * 2.2) * k;
      if (r.beat.kind === 'stomp') { squash *= 1 - 0.1 * Math.sin((a / 12) * Math.PI); }
    }
  }
  // --- blink: seeded irregular period, 4-frame blink
  const cyc = Math.floor(80 + hash(seed, 'blink') * 60);
  const ph = (f + Math.floor(hash(seed) * 500)) % cyc;
  let blink = ph < 4 ? [0.5, 1, 1, 0.4][ph] : 0;
  if (['happy', 'laugh', 'sleepy', 'dead', 'squint', 'crying', 'content'].includes(st.face)) blink = 0;
  // --- talking: mouth flap at syllable-ish rhythm (~7-9 Hz) only inside talk ranges
  const talking = (p.talk ?? []).some(([a, b]) => f >= a && f <= b);
  const talkOpen = talking && noise1(f * 0.85, seed * 17) > -0.1 && (f % 3 !== 0);
  // --- eyes drift a little toward target
  const lookX = st.look[0] + idle * 0.12 * fbm1(f / 45, seed * 5), lookY = st.look[1] + (r.beat?.kind === 'nod' && f - r.beat.f < 10 ? Math.sin((f - r.beat.f) / 10 * Math.PI) * 0.8 : 0);
  const fxAge: Record<string, number> = {};
  for (const x of st.fx) fxAge[x] = f - (r.fxStart[x] ?? 0);
  return {
    frame: f, face: st.face, lookX, lookY, blink, talkOpen, armL, armR, legs, bob, lean, squash, facing: st.facing,
    flush: st.flush ?? null, fx: st.fx, fxAge, holdL: st.holdL ?? undefined, holdR: st.holdR ?? undefined, rim: rimColor,
    behindArms: {l: st.armL === 'behind', r: st.armR === 'behind'}, flip: st.flip || (moving && velX < -0.002), hop,
  };
}

/**
 * 2D stick character drawn into a canvas each frame, shown on a Y-axis billboard inside the 3D world.
 * Lit via mood.charTint, inked rim from mood.rim, soft contact shadow.
 */
export const StickCharacter: React.FC<StickCharacterProps> = (p) => {
  const {mood, frame} = useStage();
  const H = p.height ?? 1.7;
  const planeH = (H * CH) / FIG_H, planeW = (planeH * CW) / CH;
  const feetFromBottom = ((CH - (FEET_Y + PAD)) / CH) * planeH;
  const {canvas, tex} = useMemo(() => {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return {canvas: c, tex: t};
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.08, depthWrite: true, side: THREE.DoubleSide}), [tex]);
  mat.color.set(p.tint ?? mood.charTint);
  const pos = posAt(p, frame), prev = posAt(p, frame - 1);
  const vel = [pos[0] - prev[0], pos[2] - prev[2]]; const speed = Math.hypot(vel[0], vel[1]);
  const s = characterState(p, frame, mood.rim, vel[0], speed);
  // draw synchronously during render: deterministic for this frame
  const g = canvas.getContext('2d')!;
  drawCharacter(g, p.look, s);
  tex.needsUpdate = true;
  const grp = useRef<THREE.Group>(null);
  useFrame(({camera}) => {
    if (!grp.current) return;
    const wp = grp.current.getWorldPosition(new THREE.Vector3());
    grp.current.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
  });
  const shadowTex = useMemo(() => radial('#000000', 'contact-shadow'), []);
  const scale = p.look.scale ?? 1;
  const hopY = s.hop * H;
  return (
    <group position={pos}>
      {p.shadow !== false && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012} scale={[planeW * 0.55 * scale * (1 - s.hop * 1.5), planeW * 0.22 * scale * (1 - s.hop * 1.5), 1]} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      <group ref={grp} scale={[scale * (s.flip ? -1 : 1), scale, scale]}>
        <mesh position-y={planeH / 2 - feetFromBottom + hopY} material={mat} renderOrder={p.renderOrder ?? 2}>
          <planeGeometry args={[planeW, planeH]} />
        </mesh>
      </group>
    </group>
  );
};
