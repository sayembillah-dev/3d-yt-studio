/* WORLD PROPS — generic, reusable set pieces for any story (first used by 01_dutch-water-line):
 *  Crowd (instanced marching/standing army or crowd, inked), FloodSheet (water spreading over land), IceSheet (freezes,
 *  cracks, breaks into floes), WaterArc (pumped/poured water), Snow, CrackedGround (drought mud), Fish, Backdrop
 *  (hills + tree line + clouds in one line — the "never an empty horizon" layer). */
import * as THREE from 'three';
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {Ink} from './basic';
import {toon} from '../materials';
import {inkHullMaterial} from '../ink';
import {useStage} from '../Stage';
import {canvasTexture, INK, shade} from '../textures/canvas';
import {rng, fbm1} from '../random';
import {Clouds} from '../world/Sky';
import {Hills, TreeLine} from './nature';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};

// ---------------------------------------------------------------- Crowd: instanced toon figures (body, head, hat), inked
export type CrowdProps = {
  center?: V3; rows?: number; cols?: number; spacing?: [number, number]; seed?: number;
  /** march direction (unit-ish, world xz) and speed (units/frame); start/stop frames of the march */
  dir?: [number, number]; speed?: number; start?: number; stop?: number;
  body?: string[]; hat?: string; scale?: number; jitter?: number; y?: number; facing?: number;
  /** extra y offset over time (e.g. sinking into thawing ice) */ sink?: (f: number) => number;
};
export const Crowd: React.FC<CrowdProps> = ({center = [0, 0, 0], rows = 6, cols = 12, spacing = [0.9, 0.9], seed = 1, dir = [1, 0], speed = 0, start = -1e9, stop = 1e9, body = ['#3E5BA9', '#36509A', '#4565B5'], hat = '#1E2A55', scale = 1, jitter = 0.25, y = 0, facing, sink}) => {
  const {frame} = useStage();
  const n = rows * cols;
  const pts = useMemo(() => { const r = rng(seed); return Array.from({length: n}, (_, i) => ({x: (i % cols - (cols - 1) / 2) * spacing[0] + r.range(-jitter, jitter), z: (Math.floor(i / cols) - (rows - 1) / 2) * spacing[1] + r.range(-jitter, jitter), ph: r.range(0, 6.3), s: r.range(0.92, 1.08), c: Math.floor(r.next() * body.length)})); }, [n, cols, rows, spacing, seed, jitter, body.length]);
  const geos = useMemo(() => {
    const b = new THREE.CapsuleGeometry(0.2, 0.42, 4, 8); b.translate(0, 0.6, 0);
    const h = new THREE.SphereGeometry(0.21, 12, 8); h.scale(1, 0.93, 1); h.translate(0, 1.17, 0);
    const t = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 3); t.translate(0, 1.36, 0); const tc = new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8); tc.translate(0, 1.44, 0);
    const legs = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5); legs.translate(0, 0.2, 0);
    return {b, h, t, tc, legs};
  }, []);
  const mats = useMemo(() => ({b: new THREE.MeshToonMaterial({color: '#ffffff'}), h: new THREE.MeshToonMaterial({color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.12}), hat: new THREE.MeshToonMaterial({color: hat}), ink: inkHullMaterial(0.02, 2), legs: new THREE.MeshBasicMaterial({color: INK})}), [hat]);
  const refs = {b: useRef<THREE.InstancedMesh>(null), bi: useRef<THREE.InstancedMesh>(null), h: useRef<THREE.InstancedMesh>(null), hi: useRef<THREE.InstancedMesh>(null), t: useRef<THREE.InstancedMesh>(null), tc: useRef<THREE.InstancedMesh>(null), l: useRef<THREE.InstancedMesh>(null)};
  useLayoutEffect(() => { const im = refs.b.current; if (!im) return; const c = new THREE.Color(); pts.forEach((p, i) => { c.set(body[p.c]); im.setColorAt(i, c); }); if (im.instanceColor) im.instanceColor.needsUpdate = true; }, [pts, body]); // eslint-disable-line react-hooks/exhaustive-deps
  const tm = Math.max(0, Math.min(frame, stop) - start);
  const walking = frame > start && frame < stop && speed > 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const yaw = facing ?? Math.atan2(dir[0], dir[1]);
  const dy = sink ? sink(frame) : 0;
  pts.forEach((p, i) => {
    const bob = walking ? Math.abs(Math.sin(frame * 0.32 + p.ph)) * 0.06 : 0;
    const sway = walking ? Math.sin(frame * 0.32 + p.ph) * 0.06 : 0;
    v.set(center[0] + p.x + dir[0] * speed * tm, center[1] + y + bob + dy, center[2] + p.z + dir[1] * speed * tm);
    e.set(0, yaw, sway); q.setFromEuler(e); s.setScalar(p.s * scale); m.compose(v, q, s);
    for (const k of ['b', 'bi', 'h', 'hi', 't', 'tc', 'l'] as const) refs[k].current?.setMatrixAt(i, m);
  });
  for (const k of ['b', 'bi', 'h', 'hi', 't', 'tc', 'l'] as const) { const r = refs[k].current; if (r) r.instanceMatrix.needsUpdate = true; }
  return (
    <group>
      <instancedMesh ref={refs.b} args={[geos.b, mats.b, n]} frustumCulled={false} />
      <instancedMesh ref={refs.bi} args={[geos.b, mats.ink, n]} frustumCulled={false} />
      <instancedMesh ref={refs.h} args={[geos.h, mats.h, n]} frustumCulled={false} />
      <instancedMesh ref={refs.hi} args={[geos.h, mats.ink, n]} frustumCulled={false} />
      <instancedMesh ref={refs.t} args={[geos.t, mats.hat, n]} frustumCulled={false} />
      <instancedMesh ref={refs.tc} args={[geos.tc, mats.hat, n]} frustumCulled={false} />
      <instancedMesh ref={refs.l} args={[geos.legs, mats.legs, n]} frustumCulled={false} />
    </group>
  );
};

// ---------------------------------------------------------------- FloodSheet: shallow water spreading over land from a point
/** radius(f) → current radius; rim of foam; ticks. Use for breaches, rising floods, spills. */
export const FloodSheet: React.FC<{center?: V3; radius: number | ((f: number) => number); color?: string; y?: number; stretch?: [number, number]}> = ({center = [0, 0, 0], radius, color = '#5FB4DA', y = 0.04, stretch = [1, 1]}) => {
  const {frame} = useStage();
  const R = typeof radius === 'function' ? radius(frame) : radius;
  const mat = useMemo(() => new THREE.MeshToonMaterial({color, transparent: true, opacity: 0.86, depthWrite: false}), [color]);
  const tick = useMemo(() => { const t = canvasTexture('floodticks', 512, 512, (g, W, H) => { const r = rng('ft'); g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round'; for (let i = 0; i < 40; i++) { const x = r.range(0, W), yy = r.range(0, H); g.lineWidth = r.range(3, 5); g.beginPath(); g.ellipse(x, yy, r.range(14, 30), 7, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return new THREE.MeshBasicMaterial({map: t, transparent: true, opacity: 0.6, depthWrite: false}); }, []);
  if (R <= 0.01) return null;
  tick.map!.repeat.set(R / 2, R / 2); tick.map!.offset.set(frame * 0.003, frame * 0.002);
  return (
    <group position={[center[0], center[1] + y, center[2]]} scale={[stretch[0], 1, stretch[1]]}>
      <mesh rotation-x={-Math.PI / 2} material={mat} renderOrder={3} userData={{noShadow: true}}><circleGeometry args={[R, 64]} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} material={tick} renderOrder={4}><circleGeometry args={[R, 64]} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={4}><ringGeometry args={[Math.max(0, R - 0.18), R, 64]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} depthWrite={false} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- IceSheet: freeze (0→1), crack (0→1), break into floes (0→1)
function iceTex(seed = 3) {
  return canvasTexture(`ice:${seed}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#EAF6FF'); gr.addColorStop(1, '#C9E4F5'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r.range(0.3, 0.7)})`; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(40, 140), r.range(10, 30), r.range(0, 3), 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(120,170,210,0.55)'; g.lineWidth = 3; for (let i = 0; i < 30; i++) { let x = r.range(0, W), y = r.range(0, H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += r.range(-60, 60); y += r.range(-60, 60); g.lineTo(x, y); } g.stroke(); }
  }, [1, 1]);
}
function crackTex(seed = 5) {
  return canvasTexture(`crack:${seed}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); g.clearRect(0, 0, W, H); g.strokeStyle = INK; g.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => { if (d > 5 || len < 20) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a + r.range(-0.6, 0.6), len * 0.75, w * 0.75, d + 1); if (r.next() < 0.6) branch(x2, y2, a + r.range(0.6, 1.4) * (r.next() < 0.5 ? -1 : 1), len * 0.6, w * 0.6, d + 1); };
    for (let i = 0; i < 6; i++) branch(W / 2, H / 2, (i / 6) * Math.PI * 2 + r.range(-0.2, 0.2), 150, 9, 0);
  }, [1, 1]);
}
export const IceSheet: React.FC<{center?: V3; size?: [number, number]; y?: number; freeze?: number; crack?: number; brk?: number; seed?: number}> = ({center = [0, 0, 0], size = [30, 30], y = 0.27, freeze = 1, crack = 0, brk = 0, seed = 3}) => {
  const {frame} = useStage();
  const ice = useMemo(() => { const t = iceTex(seed).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size[0] / 10, size[1] / 10); t.needsUpdate = true; return new THREE.MeshToonMaterial({map: t, transparent: true, depthWrite: true}); }, [seed, size]);
  const cr = useMemo(() => new THREE.MeshBasicMaterial({map: crackTex(seed + 2), transparent: true, depthWrite: false}), [seed]);
  const floes = useMemo(() => { const r = rng(seed + 9); return Array.from({length: 26}, () => ({x: r.range(-0.45, 0.45) * size[0], z: r.range(-0.45, 0.45) * size[1], w: r.range(0.8, 2.2), d: r.range(0.6, 1.8), a: r.range(0, 3), dx: r.range(-1, 1), dz: r.range(-1, 1)})); }, [seed, size]);
  const floeMat = useMemo(() => toon({map: iceTex(seed + 1)}), [seed]);
  ice.opacity = Math.max(0, Math.min(1, freeze)) * (1 - Math.min(1, brk * 1.6));
  cr.opacity = Math.max(0, Math.min(1, crack));
  return (
    <group position={[center[0], center[1] + y, center[2]]}>
      {ice.opacity > 0.01 && <mesh rotation-x={-Math.PI / 2} material={ice} renderOrder={4}><planeGeometry args={size} /></mesh>}
      {crack > 0.01 && <mesh rotation-x={-Math.PI / 2} position-y={0.01} scale={0.3 + crack * 1.2} material={cr} renderOrder={5}><planeGeometry args={[8, 8]} /></mesh>}
      {brk > 0.01 && floes.map((f, i) => (
        <mesh key={i} position={[f.x + f.dx * brk * 0.8, 0.04 + Math.sin(frame * 0.1 + i) * 0.008, f.z + f.dz * brk * 0.8]} rotation={[Math.sin(frame * 0.07 + i) * 0.06, f.a + brk * 0.3, 0]} material={floeMat}>
          <boxGeometry args={[f.w, 0.12, f.d]} /><Ink t={0.02} />
        </mesh>))}
    </group>
  );
};

// ---------------------------------------------------------------- WaterArc: droplets along a parabola (pump spout, bucket pour)
export const WaterArc: React.FC<{from: V3; vel: V3; on?: [number, number]; count?: number; color?: string; spread?: number}> = ({from, vel, on = [-1e9, 1e9], count = 70, color = '#9ADCF5', spread = 0.012}) => {
  const {frame} = useStage();
  const mat = useMemo(() => new THREE.MeshToonMaterial({color, transparent: true, opacity: 0.9}), [color]);
  if (frame < on[0] || frame > on[1] + 30) return null;
  const G = 0.012;
  return (<group>{Array.from({length: count}, (_, i) => {
    const age = ((frame - on[0]) + i * (30 / count)) % 30; const born = frame - age; if (born < on[0] || born > on[1]) return null;
    const jx = Math.sin(i * 12.9898) * spread, jz = Math.cos(i * 78.233) * spread * 0.6;   // fan out: spray, not a string of beads
    const p: V3 = [from[0] + (vel[0] + jx) * age, from[1] + vel[1] * age - 0.5 * G * age * age, from[2] + (vel[2] + jz) * age];
    return <mesh key={i} position={p} material={mat} scale={0.025 + (i % 4) * 0.009}><sphereGeometry args={[1, 6, 4]} /></mesh>;
  })}</group>);
};

// ---------------------------------------------------------------- Snow: falling flakes in a box around a centre
export const Snow: React.FC<{center?: V3; size?: V3; count?: number; seed?: number; on?: number}> = ({center = [0, 4, 0], size = [16, 8, 16], count = 220, seed = 4, on = -1e9}) => {
  const {frame} = useStage();
  const ref = useRef<THREE.InstancedMesh>(null);
  const pts = useMemo(() => { const r = rng(seed); return Array.from({length: count}, () => [r.next(), r.next(), r.next(), r.range(0.5, 1.2), r.range(0, 6)]); }, [count, seed]);
  const geo = useMemo(() => new THREE.SphereGeometry(0.035, 5, 4), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({color: '#FFFFFF', transparent: true, opacity: 0.9, depthWrite: false}), []);
  const m = new THREE.Matrix4();
  if (ref.current) {
    pts.forEach((p, i) => { const y = ((p[1] - (frame - on) * 0.006 * p[3]) % 1 + 1) % 1; m.makeTranslation(center[0] + (p[0] - 0.5) * size[0] + Math.sin(frame * 0.03 + p[4]) * 0.2, center[1] + (y - 0.5) * size[1], center[2] + (p[2] - 0.5) * size[2]); ref.current!.setMatrixAt(i, m); });
    ref.current.instanceMatrix.needsUpdate = true;
  }
  if (frame < on) return null;
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} renderOrder={9} />;
};

// ---------------------------------------------------------------- CrackedGround: drought mud plates with inked cracks
export const CrackedGround: React.FC<{pos?: V3; size?: [number, number]; color?: string; tile?: number}> = ({pos = [0, 0, 0], size = [60, 60], color = '#C99A62', tile = 6}) => {
  const mat = useMemo(() => {
    const t = canvasTexture(`cracked:${color}`, 1024, 1024, (g, W, H) => {
      const r = rng('cracked'); g.fillStyle = color; g.fillRect(0, 0, W, H);
      const cells = 26; const pts = Array.from({length: cells}, () => [r.range(0, W), r.range(0, H)]);
      const img = g.getImageData(0, 0, W, H); void img;
      for (let i = 0; i < cells; i++) { g.fillStyle = shade(color, r.range(-0.1, 0.08)); g.beginPath(); g.arc(pts[i][0], pts[i][1], r.range(80, 150), 0, 7); g.fill(); }
      g.strokeStyle = INK; g.lineCap = 'round';
      for (let i = 0; i < 70; i++) { let x = r.range(0, W), y = r.range(0, H); g.lineWidth = r.range(3, 6); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += r.range(-70, 70); y += r.range(-70, 70); g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(255,240,210,0.5)'; g.lineWidth = 2; for (let i = 0; i < 60; i++) { const x = r.range(0, W), y = r.range(0, H); g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.range(-30, 30), y + r.range(-30, 30)); g.stroke(); }
    }).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size[0] / tile, size[1] / tile); t.needsUpdate = true; return toon({map: t});
  }, [color, size, tile]);
  return <mesh position={pos} rotation-x={-Math.PI / 2} material={mat}><planeGeometry args={size} /></mesh>;
};

/** Little toon fish (flopping on dry mud, or swimming). */
export const Fish: React.FC<Base & {color?: string; flop?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, color = '#F2A33A', flop = false}) => {
  const {frame} = useStage();
  const mat = useMemo(() => toon({color}), [color]);
  const fl = flop ? Math.abs(Math.sin(frame * 0.4 + seed)) * 0.12 : 0;
  return (
    <group position={[pos[0], pos[1] + fl, pos[2]]} rotation={[rot[0], rot[1], rot[2] + (flop ? Math.sin(frame * 0.4 + seed) * 0.5 : 0)]} scale={scale}>
      <mesh scale={[0.28, 0.13, 0.06]} material={mat}><sphereGeometry args={[1, 12, 8]} /><Ink t={0.012} /></mesh>
      <mesh position={[-0.3, 0, 0]} rotation-z={Math.PI / 2} material={mat}><coneGeometry args={[0.1, 0.16, 3]} /><Ink t={0.008} /></mesh>
      <mesh position={[0.17, 0.03, 0.06]}><sphereGeometry args={[0.022, 6, 4]} /><meshBasicMaterial color={INK} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- Backdrop: hills ×2 + tree line + clouds in one line
/** Drop into any exterior set so the horizon is never empty. `facing` rotates the whole backdrop (radians, about y). */
export const Backdrop: React.FC<{center?: V3; facing?: number; seed?: number; near?: string; far?: string; trees?: string; cloudTint?: string; cloudShadow?: string; treeline?: boolean; dist?: number}> = ({center = [0, 0, 0], facing = 0, seed = 1, near = '#7FAE6A', far = '#93A9C9', trees = '#4F8A3A', cloudTint = '#FFF6E8', cloudShadow = '#B9A8E0', treeline = true, dist = 1}) => (
  <group position={center} rotation-y={facing}>
    <Hills pos={[0, -2, -320 * dist]} width={760} height={36} color={far} seed={seed + 2} bumps={5} />
    <Hills pos={[30, -2, -200 * dist]} width={560} height={22} color={near} seed={seed + 5} bumps={8} />
    {treeline && <TreeLine pos={[0, 0, -120 * dist]} length={260} count={56} height={5} seed={seed + 3} color={trees} />}
    <Clouds tint={cloudTint} shadow={cloudShadow} clouds={[{pos: [-80, 42, -280], scale: 36, seed: seed + 1, drift: 0.05}, {pos: [70, 58, -310], scale: 46, seed: seed + 2, drift: 0.04}, {pos: [5, 36, -350], scale: 28, seed: seed + 5, drift: 0.06}, {pos: [130, 32, -290], scale: 30, seed: seed + 7, drift: 0.05}, {pos: [-150, 64, -370], scale: 52, seed: seed + 9, drift: 0.03}]} />
  </group>
);
void fbm1;
