/* Old-town props: tiled roofs, chimneys, crenellated roof decks, iron pot + tripod, molten lead streams, row houses with
 * balconies, a Gothic tower that BUILDS block by block (+ ghost Abbey silhouette), church, cobbles, workshop / yard /
 * counting-house furniture, furnace, calendar, patent scroll, coin sacks, tilted test table, clock, rock chips, and the
 * easter-egg animals (cat, pigeon, rat). First used by Projects/02_shot-tower. Generic for any 17th-19th c. town story.
 * Every mesh toon-lit + plum ink (style-bible §3.1). Pure functions of the frame: deterministic. */
import * as THREE from 'three';
import React, {useMemo} from 'react';
import {Ink} from './basic';
import {toon} from '../materials';
import {inkHullMaterial} from '../ink';
import {useStage} from '../Stage';
import {canvasTexture, woodPlanks, bricks, stoneTiles, signTexture, radial, shade, INK} from '../textures/canvas';
import {rng, fbm1} from '../random';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** 0 -> 1 with a springy overshoot over `len` frames starting at `f0` */
const pop = (f: number, f0: number, len = 10) => { const t = clamp01((f - f0) / len); return t <= 0 ? 0 : 1 - Math.exp(-5 * t) * Math.cos(10 * t); };

// cached toon materials by colour (module level: shared by every instance)
const mc = new Map<string, THREE.Material>();
const T = (c: string) => { let m = mc.get(c); if (!m) { m = toon({color: c}); mc.set(c, m); } return m; };
const Glow = (c: string, k = 1.6) => <meshBasicMaterial color={new THREE.Color(c).multiplyScalar(k)} toneMapped={false} />;
/** inked box */
const Bx: React.FC<{p?: V3; s: V3; c?: string; m?: THREE.Material; r?: V3; ink?: number}> = ({p = [0, 0, 0], s, c = '#ffffff', m, r = [0, 0, 0], ink = 0.025}) => (
  <mesh position={p} rotation={r} material={m ?? T(c)}><boxGeometry args={s} /><Ink t={ink} /></mesh>);
/** inked cylinder */
const Cy: React.FC<{p?: V3; r0: number; r1?: number; h: number; c?: string; m?: THREE.Material; rot?: V3; seg?: number; ink?: number}> = ({p = [0, 0, 0], r0, r1, h, c = '#ffffff', m, rot = [0, 0, 0], seg = 14, ink = 0.02}) => (
  <mesh position={p} rotation={rot} material={m ?? T(c)}><cylinderGeometry args={[r1 ?? r0, r0, h, seg]} /><Ink t={ink} /></mesh>);
const Sp: React.FC<{p?: V3; s: number | V3; c?: string; m?: THREE.Material; ink?: number}> = ({p = [0, 0, 0], s, c = '#ffffff', m, ink = 0.02}) => (
  <mesh position={p} scale={s} material={m ?? T(c)}><sphereGeometry args={[1, 16, 12]} /><Ink t={ink} /></mesh>);
const useMat = (f: () => THREE.Material, deps: React.DependencyList) => useMemo(f, deps);

// ---------------------------------------------------------------- textures
const tileTex = (base: string, seed = 1) => canvasTexture(`rooftile:${base}:${seed}`, 256, 256, (g, W, H) => {
  const r = rng(seed); g.fillStyle = shade(base, -0.2); g.fillRect(0, 0, W, H); const rows = 8, cols = 6, th = H / rows, tw = W / cols;
  for (let i = 0; i < rows; i++) for (let j = -1; j <= cols; j++) {
    const x = (j + (i % 2 ? 0.5 : 0)) * tw, y = i * th; g.fillStyle = shade(base, r.range(-0.12, 0.1));
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw, y); g.lineTo(x + tw, y + th * 0.55); g.arc(x + tw / 2, y + th * 0.55, tw / 2, 0, Math.PI); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  }
}, [1, 1]);
const archTex = (glass: string, seed = 1) => canvasTexture(`gothwin:${glass}:${seed}`, 128, 256, (g, W, H) => {
  g.clearRect(0, 0, W, H); const path = () => { g.beginPath(); g.moveTo(14, H - 8); g.lineTo(14, H * 0.42); g.quadraticCurveTo(14, 18, W / 2, 6); g.quadraticCurveTo(W - 14, 18, W - 14, H * 0.42); g.lineTo(W - 14, H - 8); g.closePath(); };
  path(); g.fillStyle = '#EDE4D0'; g.fill(); g.strokeStyle = INK; g.lineWidth = 7; g.stroke();
  g.save(); g.translate(W / 2, H / 2); g.scale(0.78, 0.82); g.translate(-W / 2, -H / 2 + 8); path(); g.fillStyle = glass; g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
  g.beginPath(); g.moveTo(W / 2, 14); g.lineTo(W / 2, H - 14); g.moveTo(14, H * 0.55); g.lineTo(W - 14, H * 0.55); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.arc(W / 2, H * 0.3, 14, 0, 7); g.stroke(); g.restore();
});
const abbeyTex = () => canvasTexture('abbey', 512, 512, (g, W, H) => {
  g.clearRect(0, 0, W, H); g.fillStyle = '#FFF2B8'; g.strokeStyle = '#FFFFFF'; g.lineWidth = 6; g.lineJoin = 'round';
  const tower = (x: number, w: number, top: number) => { g.beginPath(); g.rect(x, top, w, H - 40 - top); g.fill(); for (let k = 0; k < 4; k++) { g.beginPath(); g.rect(x + k * (w / 4), top - 24, w / 4 - 6, 24); g.fill(); } for (const px of [x, x + w]) { g.beginPath(); g.moveTo(px - 8, top); g.lineTo(px + 4, top - 70); g.lineTo(px + 16, top); g.fill(); } };
  tower(70, 100, 170); tower(342, 100, 170);
  g.beginPath(); g.rect(160, 250, 192, H - 290); g.fill();                         // nave
  g.beginPath(); g.moveTo(220, 250); g.lineTo(256, 90); g.lineTo(292, 250); g.fill();  // central spire
  g.globalCompositeOperation = 'destination-out';                                   // pointed windows + rose window
  for (const x of [95, 125, 367, 397, 185, 232, 279, 326]) { g.beginPath(); g.moveTo(x - 12, 330); g.lineTo(x - 12, 280); g.quadraticCurveTo(x - 12, 250, x, 238); g.quadraticCurveTo(x + 12, 250, x + 12, 280); g.lineTo(x + 12, 330); g.fill(); }
  g.beginPath(); g.arc(256, 190, 22, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
});

// ---------------------------------------------------------------- roofs
/** Pitched tile roof (gable along x). w = along ridge, d = depth of the footprint, pitch = rise. */
export const TileRoof: React.FC<Base & {w?: number; d?: number; rise?: number; color?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, w = 4, d = 3, rise = 1.3, color = '#B5553C', seed = 1}) => {
  const m = useMat(() => toon({map: tileTex(color, seed)}), [color, seed]);
  const len = Math.hypot(d / 2, rise) + 0.12, a = Math.atan2(rise, d / 2);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={m} s={[w + 0.3, 0.12, len]} p={[0, rise / 2, -d / 4 - 0.04]} r={[-a, 0, 0]} ink={0.03} />
      <Bx m={m} s={[w + 0.3, 0.12, len]} p={[0, rise / 2, d / 4 + 0.04]} r={[a, 0, 0]} ink={0.03} />
      <Bx c={shade(color, -0.2)} s={[w + 0.34, 0.14, 0.18]} p={[0, rise + 0.03, 0]} />
      {[-w / 2, w / 2].map((x, i) => (<mesh key={i} position={[x, rise / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={T('#D9C8A8')}><cylinderGeometry args={[d / 2 + 0.01, d / 2 + 0.01, 0.1, 3]} /><Ink t={0.02} /></mesh>))}
    </group>);
};

/** Brick chimney with pots; optional smoke. */
export const Chimney: React.FC<Base & {h?: number; smoke?: string; pots?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, h = 1.6, pots = 2, seed = 2}) => {
  const m = useMat(() => toon({map: bricks({base: '#A8543C', mortar: '#D9C8A8', rows: 8, seed}, [1, 2])}), [seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={m} s={[0.8, h, 0.7]} p={[0, h / 2, 0]} ink={0.03} />
      <Bx c="#8A7A70" s={[0.98, 0.14, 0.88]} p={[0, h + 0.07, 0]} />
      {Array.from({length: pots}, (_, i) => <Cy key={i} p={[(i - (pots - 1) / 2) * 0.34, h + 0.34, 0]} r0={0.1} r1={0.13} h={0.38} c="#C9743C" />)}
    </group>);
};

/** Crenellated roof deck slab with a parapet along the front (+z) and the right (+x) edges. */
export const RoofDeck: React.FC<Base & {size?: [number, number]; stone?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, size = [14.4, 3.2], stone = '#B9A98C', seed = 3}) => {
  const m = useMat(() => { const t = stoneTiles({base: stone, seed, cols: 5}, [4, 1]); return toon({map: t}); }, [stone, seed]);
  const wall = useMat(() => toon({map: stoneTiles({base: shade(stone, -0.06), seed: seed + 1, cols: 6}, [3, 1])}), [stone, seed]);
  const [W, D] = size; const n = Math.round(W / 1.1), nz = Math.round(D / 1.1);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={m} s={[W, 0.34, D]} p={[0, 0.17, 0]} ink={0.03} />
      <Bx m={wall} s={[W, 0.5, 0.3]} p={[0, 0.6, D / 2 - 0.15]} />
      <Bx m={wall} s={[0.3, 0.5, D - 0.4]} p={[W / 2 - 0.15, 0.6, 0]} />
      {Array.from({length: n}, (_, i) => <Bx key={'f' + i} m={wall} s={[0.52, 0.38, 0.3]} p={[-W / 2 + 0.55 + i * ((W - 1.1) / Math.max(1, n - 1)), 1.04, D / 2 - 0.15]} ink={0.018} />)}
      {Array.from({length: nz}, (_, i) => <Bx key={'s' + i} m={wall} s={[0.3, 0.38, 0.52]} p={[W / 2 - 0.15, 1.04, -D / 2 + 0.9 + i * ((D - 1.4) / Math.max(1, nz - 1))]} ink={0.018} />)}
      {[[-W / 2 + 0.2, D / 2 - 0.15], [W / 2 - 0.15, D / 2 - 0.15]].map(([x, z], i) => (<group key={i} position={[x, 1.2, z]}><Bx c="#9A8A70" s={[0.34, 0.9, 0.34]} /><mesh position-y={0.68} material={T('#7A6A58')}><coneGeometry args={[0.28, 0.6, 4]} /><Ink t={0.02} /></mesh></group>))}
      {/* stone fascia + corbels under the slab edge */}
      <Bx m={wall} s={[W, 0.3, 0.2]} p={[0, -0.1, D / 2 + 0.05]} />
      {Array.from({length: n}, (_, i) => <Bx key={'c' + i} c="#8E7E66" s={[0.22, 0.4, 0.3]} p={[-W / 2 + 0.55 + i * ((W - 1.1) / Math.max(1, n - 1)), -0.3, D / 2 + 0.1]} ink={0.015} />)}
    </group>);
};

// ---------------------------------------------------------------- iron pot on a tripod (+ molten pour)
export const IronPot: React.FC<Base & {tilt?: number; glow?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, tilt = 0, glow = 1}) => {
  const {frame} = useStage();
  const geo = useMemo(() => { const pts = [[0.001, 0], [0.3, 0.02], [0.44, 0.2], [0.48, 0.42], [0.42, 0.62], [0.46, 0.66]].map(([x, y]) => new THREE.Vector2(x, y)); const g = new THREE.LatheGeometry(pts, 24); g.computeVertexNormals(); return g; }, []);
  const lava = 1.2 + 0.25 * Math.sin(frame * 0.3);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <group rotation-z={tilt}>
        <mesh geometry={geo} material={T('#2E2C36')}><Ink t={0.02} /></mesh>
        <mesh position-y={0.58} rotation-x={-Math.PI / 2}><circleGeometry args={[0.42, 24]} />{Glow('#FF7A24', lava * glow + 0.2)}</mesh>
        <mesh position={[0.46, 0.64, 0]} rotation-z={-0.6} material={T('#2E2C36')}><boxGeometry args={[0.22, 0.05, 0.16]} /><Ink t={0.012} /></mesh>
        {glow > 0 && <pointLight position-y={0.9} color="#FF9040" intensity={2.4 * glow} distance={5} decay={2} />}
      </group>
    </group>);
};
export const Tripod: React.FC<Base & {h?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, h = 1.1}) => (
  <group position={pos} rotation={rot} scale={scale}>
    {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; const R = 0.62; return <Cy key={i} p={[Math.cos(a) * R * 0.5, h / 2, Math.sin(a) * R * 0.5]} r0={0.04} h={Math.hypot(h, R)} c="#3A3F4C" rot={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} seg={6} ink={0.012} />; })}
    <mesh position-y={h} rotation-x={Math.PI / 2} material={T('#3A3F4C')}><torusGeometry args={[0.36, 0.035, 6, 20]} /><Ink t={0.01} /></mesh>
  </group>);

/** A stream of molten lead pouring from `from`: glowing rod for the first `rod` units, then drops that fall (and cool) for `fall` units. */
export const LeadStream: React.FC<{from: V3; rod?: number; fall?: number; on?: [number, number]; radius?: number; count?: number; seed?: number; drift?: V3; width?: number}> = ({from, rod = 0.8, fall = 12, on = [-1e9, 1e9], radius = 0.07, count = 16, seed = 3, drift = [0.2, 0, 0], width = 0.05}) => {
  const {frame} = useStage();
  const cfg = useMemo(() => { const r = rng(seed); return Array.from({length: count}, (_, i) => ({off: (i / count) * 40 + r.range(0, 2), x: r.range(-0.5, 0.5), z: r.range(-0.3, 0.3), k: r.range(0.8, 1.2)})); }, [count, seed]);
  const hot = useMemo(() => new THREE.Color('#FF8A30'), []), silver = useMemo(() => new THREE.Color('#E6EDF7'), []);
  const mats = useMemo(() => cfg.map(() => new THREE.MeshBasicMaterial({toneMapped: false})), [cfg]);
  if (frame < on[0] || frame > on[1] + 40) return null;
  const grow = clamp01((frame - on[0]) / 6) * (1 - clamp01((frame - on[1]) / 8));
  return (
    <group position={from}>
      <mesh position={[0, -rod / 2, 0]} scale={[grow, 1, grow]}><cylinderGeometry args={[width, width * 0.7, rod, 8]} />{Glow('#FFB060', 1.5)}</mesh>
      {cfg.map((c, i) => {
        const age = (frame - on[0] + c.off) % 40; const u = age / 40; const y = -rod - fall * u * u; const cool = smooth(0.1, 0.7, u);
        const m = mats[i]; m.color.copy(hot).multiplyScalar(1.4).lerp(silver, cool); const s = radius * c.k * (1 - 0.3 * u) * (1 + 0.5 * (1 - cool));
        return <group key={i} position={[c.x * 0.06 + drift[0] * u * 2, y, c.z * 0.1]} scale={[s, s * (1 + 0.8 * u), s]}><mesh><sphereGeometry args={[1, 10, 8]} />{<primitive object={m} attach="material" />}</mesh><mesh material={inkHullMaterial(0.2)}><sphereGeometry args={[1, 10, 8]} /></mesh></group>;
      })}
    </group>);
};

// ---------------------------------------------------------------- animals (easter eggs)
export const Cat: React.FC<Base & {look?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1}) => {
  const {frame} = useStage();
  const tail = Math.sin(frame * 0.09) * 0.5; const ear = Math.sin(frame * 0.4) > 0.94 ? 0.3 : 0;
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Sp p={[0, 0.16, 0]} s={[0.26, 0.17, 0.17]} c="#F4EFEA" />
      <Sp p={[-0.06, 0.2, 0.05]} s={[0.1, 0.1, 0.06]} c="#D9822B" ink={0.012} />
      <Sp p={[0.1, 0.2, -0.03]} s={[0.09, 0.09, 0.06]} c="#2A2420" ink={0.012} />
      <Sp p={[0.24, 0.3, 0]} s={0.12} c="#F4EFEA" />
      <Sp p={[0.27, 0.34, 0.06]} s={[0.05, 0.05, 0.03]} c="#D9822B" ink={0.01} />
      {[-0.06, 0.06].map((z, i) => <mesh key={i} position={[0.22, 0.42 - (i ? ear : 0), z]} material={T(i ? '#2A2420' : '#D9822B')}><coneGeometry args={[0.045, 0.1, 4]} /><Ink t={0.012} /></mesh>)}
      {[-0.045, 0.045].map((z, i) => <mesh key={i} position={[0.35, 0.32, z]}><sphereGeometry args={[0.018, 8, 6]} /><meshBasicMaterial color="#2A1B26" /></mesh>)}
      <group position={[-0.24, 0.16, 0]} rotation-z={0.9 + tail}><Cy p={[0, 0.2, 0]} r0={0.035} r1={0.03} h={0.42} c="#D9822B" ink={0.012} /></group>
    </group>);
};
export const Pigeon: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1}) => {
  const {frame} = useStage(); const bob = Math.max(0, Math.sin(frame * 0.35 + seed * 3)) * 0.04;
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Sp p={[0, 0.14, 0]} s={[0.17, 0.12, 0.11]} c="#8E96A8" /><Sp p={[0.03, 0.14, 0.08]} s={[0.1, 0.08, 0.02]} c="#6A7288" ink={0.008} />
      <Sp p={[0.16 + bob, 0.27, 0]} s={0.07} c="#6A7288" />
      <mesh position={[0.24 + bob, 0.26, 0]} rotation-z={-Math.PI / 2}><coneGeometry args={[0.02, 0.06, 5]} /><meshToonMaterial color="#F2A33A" /></mesh>
      <mesh position={[0.2 + bob, 0.29, 0.05]}><sphereGeometry args={[0.012, 6, 6]} /><meshBasicMaterial color="#2A1B26" /></mesh>
      <Cy p={[-0.2, 0.12, 0]} r0={0.02} r1={0.05} h={0.2} c="#8E96A8" rot={[0, 0, 1.3]} ink={0.008} />
      {[-0.03, 0.03].map((z, i) => <Cy key={i} p={[0, 0.03, z]} r0={0.012} h={0.08} c="#E0A070" ink={0.006} />)}
    </group>);
};
export const Rat: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1}) => {
  const {frame} = useStage(); const sniff = Math.sin(frame * 0.5 + seed) * 0.02; const tail = Math.sin(frame * 0.12 + seed) * 0.3;
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Sp p={[0, 0.1, 0]} s={[0.2, 0.1, 0.1]} c="#8C7C70" /><Sp p={[0.2 + sniff, 0.1, 0]} s={[0.1, 0.07, 0.07]} c="#9A8A7E" />
      <mesh position={[0.31 + sniff, 0.1, 0]}><sphereGeometry args={[0.022, 8, 6]} /><meshBasicMaterial color="#E58A9A" /></mesh>
      {[-0.05, 0.05].map((z, i) => <Sp key={i} p={[0.14, 0.2, z]} s={[0.04, 0.05, 0.015]} c="#E9B0B0" ink={0.008} />)}
      {[-0.035, 0.035].map((z, i) => <mesh key={i} position={[0.24, 0.13, z]}><sphereGeometry args={[0.014, 6, 6]} /><meshBasicMaterial color="#2A1B26" /></mesh>)}
      <group position={[-0.2, 0.08, 0]} rotation-z={Math.PI / 2 + 0.3 + tail}><Cy p={[0, 0.18, 0]} r0={0.014} r1={0.008} h={0.36} c="#E9B0B0" ink={0.006} /></group>
    </group>);
};

// ---------------------------------------------------------------- furnace room
export const Furnace: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 2}) => {
  const {frame} = useStage(); const fl = 1.5 + 0.4 * fbm1(frame / 5, seed);
  const m = useMat(() => toon({map: bricks({base: '#8A4A3A', mortar: '#C9B08A', rows: 9, seed}, [1, 1.4])}), [seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={m} s={[2.0, 2.1, 1.5]} p={[0, 1.05, 0]} ink={0.03} />
      <Bx c="#6A3A2E" s={[2.2, 0.2, 1.7]} p={[0, 0.1, 0]} /><Bx c="#6A3A2E" s={[1.7, 0.2, 1.3]} p={[0, 2.2, 0]} />
      <Cy p={[0.2, 3.1, -0.1]} r0={0.34} r1={0.28} h={1.6} c="#4A4048" />
      <mesh position={[0, 0.8, 0.77]}><planeGeometry args={[1.0, 0.9]} />{Glow('#FF6A18', fl)}</mesh>
      <mesh position={[0, 0.8, 0.79]} material={T('#2A2028')}><torusGeometry args={[0.52, 0.06, 6, 24]} /></mesh>
      <Bx c="#2A2028" s={[1.2, 0.08, 0.14]} p={[0, 0.3, 0.8]} />
      <pointLight position={[0, 1.0, 1.6]} color="#FF8030" intensity={5 * fl / 1.5} distance={7} decay={2} />
      {[[-0.5, 0.15], [0.5, -0.1], [0.1, 0.4]].map(([x, z], i) => <Sp key={i} p={[x, 0.2, 1.0 + z]} s={[0.14, 0.08, 0.1]} c="#2A2420" ink={0.01} />)}
    </group>);
};
export const Jar: React.FC<Base & {label?: string; color?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, label = 'ARSENIC', color = '#9DBF8A', seed = 4}) => {
  const tex = useMemo(() => signTexture(label, {style: 'paper', w: 512, h: 256, seed}), [label, seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Cy p={[0, 0.3, 0]} r0={0.24} r1={0.22} h={0.6} m={toon({color, transparent: true, opacity: 0.88})} />
      <Cy p={[0, 0.66, 0]} r0={0.13} r1={0.11} h={0.12} c="#C9A46A" />
      <mesh position={[0, 0.3, 0.226]}><planeGeometry args={[0.36, 0.2]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <mesh position={[0, 0.5, 0.2]}><sphereGeometry args={[0.04, 8, 6]} /><meshBasicMaterial color="#F4EFEA" /></mesh>
    </group>);
};
export const Table: React.FC<Base & {size?: V3; wood?: string; legs?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, size = [2, 0.9, 1], wood = '#8A5A30', legs = true, seed = 5}) => {
  const m = useMat(() => toon({map: woodPlanks({base: wood, planks: 5, seed}, [1, 1])}), [wood, seed]);
  return (<group position={pos} rotation={rot} scale={scale}>
    <Bx m={m} s={[size[0], 0.12, size[2]]} p={[0, size[1], 0]} ink={0.02} />
    {legs && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <Bx key={i} m={m} s={[0.12, size[1], 0.12]} p={[a * (size[0] / 2 - 0.1), size[1] / 2, b * (size[2] / 2 - 0.1)]} ink={0.012} />)}
  </group>);
};

// ---------------------------------------------------------------- row houses, balconies, Gothic tower, church
const WindowFrame: React.FC<{p: V3; w?: number; h?: number; lit?: boolean; shutters?: boolean}> = ({p, w = 0.8, h = 1.1, lit = true, shutters = true}) => (
  <group position={p}>
    <Bx c="#F4EFEA" s={[w + 0.16, h + 0.16, 0.08]} p={[0, 0, 0]} ink={0.015} />
    <mesh position-z={0.045}><planeGeometry args={[w, h]} />{Glow(lit ? '#FFD88A' : '#6A7FA8', lit ? 1.15 : 0.9)}</mesh>
    <Bx c="#F4EFEA" s={[w, 0.05, 0.05]} p={[0, 0, 0.07]} ink={0.008} /><Bx c="#F4EFEA" s={[0.05, h, 0.05]} p={[0, 0, 0.07]} ink={0.008} />
    <Bx c="#F4EFEA" s={[w + 0.3, 0.08, 0.22]} p={[0, -h / 2 - 0.1, 0.1]} ink={0.012} />
    {shutters && [-1, 1].map((s, i) => <Bx key={i} c="#3E6A58" s={[0.26, h + 0.1, 0.05]} p={[s * (w / 2 + 0.28), 0, 0.03]} ink={0.012} />)}
  </group>);
/** Row house front: plaster body, door, windows, optional balcony per window, tiled gable roof + chimney. Front faces +z. */
export const RowHouse: React.FC<Base & {w?: number; floors?: number; wall?: string; roof?: string; door?: boolean; balconies?: number[]; smokeless?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, w = 3.2, floors = 3, wall = '#E9C98A', roof = '#B5553C', door = true, balconies = [], seed = 1}) => {
  const fh = 2.5, H = floors * fh; const cols = Math.max(2, Math.round(w / 1.4));
  const body = useMat(() => toon({color: wall, map: canvasTexture(`plaster:${seed}`, 256, 256, (g, W, Hh) => { const r = rng(seed); g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,80,40,${r.range(0.03, 0.08)})`; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, Hh), r.range(10, 40), r.range(6, 20), 0, 0, 7); g.fill(); } g.strokeStyle = 'rgba(42,27,38,0.35)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r.range(0, W), r.range(0, Hh)); g.lineTo(r.range(0, W), r.range(0, Hh)); g.stroke(); } }, [1, 1])}), [wall, seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={body} s={[w, H, 2.4]} p={[0, H / 2, 0]} ink={0.04} />
      {Array.from({length: floors - 1}, (_, k) => <Bx key={k} c={shade(wall, -0.18)} s={[w + 0.12, 0.1, 2.5]} p={[0, (k + 1) * fh, 0]} ink={0.015} />)}
      <TileRoof pos={[0, H, 0]} w={w} d={2.4} rise={1.2} color={roof} seed={seed} />
      <Chimney pos={[w * 0.28, H + 0.4, -0.4]} h={1.0} pots={2} seed={seed} />
      {Array.from({length: floors}, (_, k) => Array.from({length: cols}, (_, c) => {
        const x = (c - (cols - 1) / 2) * (w / cols); if (k === 0 && door && c === Math.floor(cols / 2)) return null;
        return <WindowFrame key={k + '_' + c} p={[x, k * fh + 1.5, 1.2]} lit={(k + c + seed) % 3 !== 0} />;
      }))}
      {door && <group position={[0, 0, 1.2]}><Bx c="#6B4022" s={[0.95, 1.8, 0.1]} p={[0, 0.9, 0]} ink={0.02} /><Bx c="#D9A441" s={[0.1, 0.1, 0.06]} p={[0.3, 0.9, 0.08]} ink={0.008} /><Bx c="#9A8A78" s={[1.3, 0.16, 0.5]} p={[0, 0.08, 0.2]} ink={0.012} /></group>}
      {balconies.map((k) => <group key={k} position={[0, k * fh + 0.95, 1.2]}><Bx c="#6B4A30" s={[1.5, 0.1, 0.62]} p={[0, 0, 0.3]} ink={0.015} /><Bx c="#3A3F4C" s={[1.5, 0.45, 0.04]} p={[0, 0.3, 0.6]} ink={0.01} />
        {[-0.7, -0.35, 0, 0.35, 0.7].map((x, i) => <Bx key={i} c="#3A3F4C" s={[0.03, 0.45, 0.03]} p={[x, 0.3, 0.6]} ink={0.006} />)}</group>)}
    </group>);
};

/** Gothic tower. build 0..1 stacks the stone courses block by block; adorn 0..1 pops the pointed windows, buttresses, pinnacles and spire. */
export const GothicTower: React.FC<Base & {w?: number; h?: number; build?: number; adorn?: number; courses?: number; sign?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, w = 3.0, h = 9, build = 1, adorn = 1, courses = 9, seed = 5, sign = false}) => {
  const {frame} = useStage();
  const stone = useMat(() => toon({map: bricks({base: '#B8AC98', mortar: '#7A6E62', rows: 9, seed}, [2, 1])}), [seed]);
  const win = useMemo(() => archTex('#6FA6D8', seed), [seed]); const glass = useMemo(() => archTex('#FFC86A', seed + 1), [seed]);
  const ch = h / courses;
  const A = adorn; const sc = (k: number) => Math.max(0, pop(adorn * 100, k * 40, 14));
  void sc; const grow = (d: number) => clamp01(A * 1.6 - d);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {Array.from({length: courses}, (_, i) => { const t = clamp01(build * (courses + 1) - i); const bounce = t > 0 && t < 1 ? 1 + 0.06 * Math.sin(t * Math.PI) : 1; return t > 0 && (
        <group key={i} position={[0, i * ch, 0]} scale={[bounce, t, bounce]}><Bx m={stone} s={[w, ch, w]} p={[0, ch / 2, 0]} ink={0.03} /></group>); })}
      {/* crenellated cap + corner pinnacles */}
      {grow(0) > 0 && <group position={[0, h, 0]} scale={grow(0)}>
        <Bx c="#9A8E7C" s={[w + 0.3, 0.3, w + 0.3]} p={[0, 0.15, 0]} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <group key={i} position={[a * (w / 2 + 0.05), 0.3, b * (w / 2 + 0.05)]}><Bx c="#B8AC98" s={[0.4, 0.9, 0.4]} p={[0, 0.45, 0]} /><mesh position-y={1.2} material={T('#6A6E80')}><coneGeometry args={[0.3, 0.7, 4]} /><Ink t={0.02} /></mesh></group>)}
        <mesh position-y={2.4} material={T('#5A6A8E')}><coneGeometry args={[w * 0.62, 3.8, 4]} /><Ink t={0.03} /></mesh>
        <mesh position-y={4.6} material={T('#D9A441')}><coneGeometry args={[0.12, 0.7, 6]} /><Ink t={0.012} /></mesh>
      </group>}
      {/* pointed windows (4 sides front only, 3 rows) */}
      {[0.28, 0.52, 0.76].map((fy, i) => grow(0.2 + i * 0.1) > 0 && (
        <group key={i} position={[0, h * fy, w / 2 + 0.02]} scale={grow(0.2 + i * 0.1)}><mesh><planeGeometry args={[0.8, 1.6]} /><meshBasicMaterial map={i === 2 ? glass : win} transparent alphaTest={0.05} toneMapped={false} /></mesh></group>))}
      {/* buttresses */}
      {[-1, 1].map((s) => grow(0.1) > 0 && <group key={s} position={[s * (w / 2 + 0.12), 0, w / 2 - 0.05]} scale={[1, grow(0.1), 1]}><Bx c="#A89C88" s={[0.3, h * 0.6, 0.5]} p={[0, h * 0.3, 0]} /><mesh position-y={h * 0.6 + 0.2} material={T('#A89C88')}><coneGeometry args={[0.25, 0.5, 4]} /><Ink t={0.015} /></mesh></group>)}
      {sign && <group position={[w / 2 + 0.55, 2.2, w / 2 + 0.2]} rotation-y={-0.3} scale={Math.max(0.01, pop(frame, 0, 1))}><mesh><planeGeometry args={[1.5, 0.6]} /><meshBasicMaterial map={signTexture('GOTHIC', {style: 'banner', w: 512, h: 205})} transparent alphaTest={0.02} toneMapped={false} /></mesh></group>}
    </group>);
};
export const AbbeyGhost: React.FC<Base & {glow?: number; w?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, glow = 1, w = 9}) => {
  const tex = useMemo(abbeyTex, []);
  const halo = useMemo(() => radial('#FFD27A', 'abbeyhalo'), []);
  const {frame} = useStage();
  if (glow <= 0) return null;
  return (<group position={pos} rotation={rot} scale={scale}>
    <mesh><planeGeometry args={[w, w]} /><meshBasicMaterial map={tex} transparent opacity={glow * (0.7 + 0.1 * Math.sin(frame * 0.2))} depthWrite={false} blending={THREE.AdditiveBlending} color="#FFE9A0" toneMapped={false} fog={false} /></mesh>
    <sprite position={[0, -w * 0.1, -0.2]} scale={[w * 1.3, w * 1.3, 1]}><spriteMaterial map={halo} transparent opacity={glow * 0.5} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
  </group>);
};
export const Church: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 6}) => {
  const stone = useMat(() => toon({map: bricks({base: '#C9BBA2', mortar: '#8A7E70', rows: 10, seed}, [3, 1.5])}), [seed]);
  const win = useMemo(() => archTex('#6FA6D8', seed), [seed]);
  return (<group position={pos} rotation={rot} scale={scale}>
    <Bx m={stone} s={[9, 5, 4]} p={[0, 2.5, 0]} ink={0.04} /><TileRoof pos={[0, 5, 0]} w={9} d={4} rise={1.8} color="#6A7A94" seed={seed} />
    <Bx m={stone} s={[2.4, 9, 2.4]} p={[-5.2, 4.5, 0.8]} ink={0.04} /><mesh position={[-5.2, 11.2, 0.8]} material={T('#5A6A8E')}><coneGeometry args={[1.9, 4.6, 4]} /><Ink t={0.04} /></mesh>
    <mesh position={[-5.2, 13.8, 0.8]} material={T('#D9A441')}><coneGeometry args={[0.1, 0.6, 5]} /><Ink t={0.012} /></mesh>
    {[-3, -1, 1, 3].map((x, i) => <mesh key={i} position={[x, 2.6, 2.03]}><planeGeometry args={[0.9, 1.8]} /><meshBasicMaterial map={win} transparent alphaTest={0.05} toneMapped={false} /></mesh>)}
  </group>);
};
export const Cobbles: React.FC<Base & {size?: [number, number]; tint?: string}> = ({pos = [0, 0, 0], size = [40, 30], tint = '#B8AC98', seed = 4}) => {
  const m = useMat(() => toon({map: stoneTiles({base: tint, seed, cols: 8}, [size[0] / 3, size[1] / 3])}), [tint, seed, size]);
  return <mesh position={pos} rotation-x={-Math.PI / 2} material={m}><planeGeometry args={size} /></mesh>;
};
export const Lamppost: React.FC<Base> = ({pos = [0, 0, 0], scale = 1}) => {
  const {frame} = useStage(); const fl = 1.5 + 0.3 * fbm1(frame / 6, 3);
  return (<group position={pos} scale={scale}><Cy p={[0, 1.4, 0]} r0={0.07} r1={0.05} h={2.8} c="#2E2C36" /><Bx c="#2E2C36" s={[0.34, 0.5, 0.34]} p={[0, 3.0, 0]} /><mesh position={[0, 3.0, 0]}><boxGeometry args={[0.26, 0.4, 0.26]} />{Glow('#FFC46B', fl)}</mesh><pointLight position={[0, 3, 0]} color="#FFC46B" intensity={2} distance={6} decay={2} /></group>);
};

// ---------------------------------------------------------------- workshop / yard / counting house
export const PipeRack: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1}) => (
  <group position={pos} rotation={rot} scale={scale}>
    {[0.2, 0.55, 0.9].map((y, i) => <group key={i}><Bx c="#5A3A22" s={[0.1, 1.1, 0.1]} p={[-0.9, 0.5, 0]} ink={0.01} /><Bx c="#5A3A22" s={[0.1, 1.1, 0.1]} p={[0.9, 0.5, 0]} ink={0.01} /><Bx c="#6B4022" s={[1.9, 0.07, 0.4]} p={[0, y - 0.1, 0]} ink={0.012} />
      {Array.from({length: 3}, (_, k) => <Cy key={k} p={[0, y + 0.02, -0.12 + k * 0.12]} r0={0.05} h={1.7} c={k % 2 ? '#8E96A8' : '#A6AEC0'} rot={[0, 0, Math.PI / 2]} seg={10} ink={0.008} />)}</group>)}
  </group>);
const lumpGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.2 * Math.sin(x * 5.1 + y * 2) * Math.cos(z * 4.3) + 0.1 * Math.sin(y * 7); p.setXYZ(i, x * k, y * k * 0.92, z * k); } g.computeVertexNormals(); return g; })();
/** Tray of lead shot. lumpy = dented blobs; one ball (idx 0) can roll off (`roll` frame start). */
export const ShotTray: React.FC<Base & {lumpy?: boolean; roll?: number; n?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, lumpy = true, roll = 1e9, n = 14, seed = 3}) => {
  const {frame} = useStage();
  const balls = useMemo(() => { const r = rng(seed); return Array.from({length: n}, (_, i) => ({x: -0.5 + (i % 5) * 0.25 + r.range(-0.04, 0.04), z: -0.2 + Math.floor(i / 5) * 0.2 + r.range(-0.03, 0.03), s: r.range(0.07, 0.1), a: r.range(0, 6)})); }, [n, seed]);
  const m = useMat(() => toon({color: '#9AA3B4'}), []);
  const t = Math.max(0, frame - roll);
  return (<group position={pos} rotation={rot} scale={scale}>
    <Bx c="#6B4022" s={[1.5, 0.08, 0.8]} p={[0, 0.04, 0]} ink={0.012} />
    {[[0, 0.38], [0, -0.38]].map(([x, z], i) => <Bx key={i} c="#6B4022" s={[1.5, 0.14, 0.05]} p={[x, 0.1, z]} ink={0.008} />)}{[-0.72, 0.72].map((x, i) => <Bx key={i} c="#6B4022" s={[0.05, 0.14, 0.8]} p={[x, 0.1, 0]} ink={0.008} />)}
    {balls.map((b, i) => { const rolling = i === 0 && t > 0; const x = rolling ? b.x + t * 0.018 : b.x; const fall = rolling && x > 0.72 ? Math.pow((x - 0.72) * 12, 2) * 0.02 : 0;
      return <mesh key={i} geometry={lumpy ? lumpGeo : undefined} position={[x, 0.16 - fall, rolling ? b.z + Math.sin(t * 0.5) * 0.02 : b.z]} rotation={[rolling ? t * 0.3 : 0, b.a, 0]} scale={b.s} material={m}>{!lumpy && <sphereGeometry args={[1, 12, 10]} />}<Ink t={0.2} /></mesh>; })}
  </group>);
};
/** Wall calendar: pages flip (hinged at the top). year/age: `flip` frame flips the top page to reveal `to`. */
export const WallCalendar: React.FC<Base & {from?: string; to: string; flip: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, from = '1781', to, flip}) => {
  const {frame} = useStage();
  const mk = (y: string) => signTexture(y, {style: 'paper', sub: 'ANNO', w: 512, h: 640, seed: 8});
  const a = useMemo(() => mk(from), [from]), b = useMemo(() => mk(to), [to]);
  const t = clamp01((frame - flip) / 9); const ang = -t * Math.PI * 0.96;
  return (<group position={pos} rotation={rot} scale={scale}>
    <Bx c="#6B4022" s={[1.1, 1.35, 0.06]} p={[0, 0, -0.04]} ink={0.012} />
    <mesh position-z={0.01}><planeGeometry args={[1.0, 1.25]} /><meshBasicMaterial map={b} toneMapped={false} /></mesh>
    <group position={[0, 0.62, 0.025]} rotation-x={ang}><mesh position-y={-0.62} visible={t < 0.98}><planeGeometry args={[1.0, 1.25]} /><meshBasicMaterial map={a} toneMapped={false} side={THREE.DoubleSide} /></mesh></group>
    <Cy p={[0, 0.66, 0.05]} r0={0.025} h={1.0} c="#2E2C36" rot={[0, 0, Math.PI / 2]} seg={6} ink={0.008} />
  </group>);
};
export const Ladle: React.FC<Base & {tip?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, tip = 0}) => (
  <group position={pos} rotation={rot} scale={scale}><group rotation-z={tip}><Cy p={[0.5, 0.0, 0]} r0={0.03} h={1.0} c="#6B4022" rot={[0, 0, Math.PI / 2 + 0.2]} seg={6} ink={0.008} /><mesh position={[-0.02, -0.12, 0]} material={T('#2E2C36')}><sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><Ink t={0.015} /></mesh><mesh position={[0, -0.1, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.18, 14]} />{Glow('#FF7A24', 1.3)}</mesh></group></group>);
export const Desk: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 5}) => {
  const m = useMat(() => toon({map: woodPlanks({base: '#7A4A26', planks: 6, seed}, [1, 1])}), [seed]);
  return (<group position={pos} rotation={rot} scale={scale}>
    <Bx m={m} s={[3.0, 0.14, 1.4]} p={[0, 0.95, 0]} ink={0.02} />
    {[-1.3, 1.3].map((x, i) => <group key={i}><Bx m={m} s={[0.6, 0.9, 1.2]} p={[x, 0.45, 0]} ink={0.02} />{[0.18, 0.5, 0.78].map((y, k) => <Bx key={k} c="#D9A441" s={[0.3, 0.05, 0.04]} p={[x, y, 0.62]} ink={0.006} />)}</group>)}
    <Bx c="#2E4A3A" s={[1.5, 0.02, 0.8]} p={[0, 1.03, 0.1]} ink={0.006} />
  </group>);
};
export const Ledger: React.FC<Base & {text?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, text = '10,000'}) => {
  const tex = useMemo(() => signTexture(text, {style: 'paper', sub: 'POUNDS', w: 512, h: 320, seed: 9}), [text]);
  return (<group position={pos} rotation={rot} scale={scale}><Bx c="#6A2E2E" s={[0.9, 0.1, 0.62]} p={[0, 0.05, 0]} ink={0.012} /><Bx c="#F4EFEA" s={[0.82, 0.08, 0.56]} p={[0, 0.13, 0]} ink={0.008} /><mesh position={[0, 0.176, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.8, 0.5]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh></group>);
};
export const CoinSack: React.FC<Base & {mark?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, mark = '£', seed = 2}) => {
  const tex = useMemo(() => signTexture(mark, {style: 'stencil', w: 256, h: 256, seed}), [mark, seed]);
  return (<group position={pos} rotation={rot} scale={scale}><Sp p={[0, 0.3, 0]} s={[0.36, 0.34, 0.32]} c="#C9A46A" /><Cy p={[0, 0.62, 0]} r0={0.1} r1={0.07} h={0.16} c="#B8935A" /><Cy p={[0, 0.58, 0]} r0={0.1} h={0.03} c="#8A3A2E" ink={0.006} /><mesh position={[0, 0.3, 0.325]}><planeGeometry args={[0.3, 0.3]} /><meshBasicMaterial map={tex} transparent alphaTest={0.05} toneMapped={false} /></mesh></group>);
};
/** Heap of gold coins; `spill` 0..1 scatters a few across the floor. */
export const CoinPile: React.FC<Base & {n?: number; spill?: number; r?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, n = 40, spill = 0, r = 0.5, seed = 3}) => {
  const {frame} = useStage(); const cs = useMemo(() => { const g = rng(seed); return Array.from({length: n}, (_, i) => { const a = g.range(0, 6.28), d = g.next() * r; return {x: Math.cos(a) * d, z: Math.sin(a) * d, y: Math.max(0.02, 0.22 * (1 - d / r)) + g.range(0, 0.1), t: g.range(-0.5, 0.5), ph: g.next() * 6}; }); }, [n, r, seed]);
  const gold = useMat(() => toon({color: '#F2C230', emissive: '#6A4A00', emissiveIntensity: 0.6}), []);
  return (<group position={pos} rotation={rot} scale={scale}>{cs.map((c, i) => { const sx = i < n * 0.25 ? spill * (0.7 + c.ph * 0.15) : 0; return <mesh key={i} position={[c.x * (1 + sx * 2.5), c.y * (1 - sx * 0.7), c.z * (1 + sx * 2.5)]} rotation={[c.t + (frame > 0 ? Math.sin(frame * 0.2 + c.ph) * 0.04 * spill : 0), c.ph, c.t]} material={gold}><cylinderGeometry args={[0.07, 0.07, 0.025, 12]} /><Ink t={0.012} /></mesh>; })}</group>);
};
/** Unrolling parchment scroll with a ball drawing + red wax seal. open 0..1 */
export const PatentScroll: React.FC<Base & {open?: number; text?: string; ball?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, open = 1, text = 'GLOBULAR', ball = true, seed = 3}) => {
  const tex = useMemo(() => canvasTexture(`patent:${text}:${ball}`, 512, 768, (g, W, H) => {
    g.fillStyle = '#F1E4C4'; g.fillRect(0, 0, W, H); g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 3; g.strokeRect(30, 30, W - 60, H - 60);
    g.fillStyle = INK; g.font = 'bold 44px "Rye", Georgia, serif'; g.textAlign = 'center'; g.fillText('LETTERS PATENT', W / 2, 96);
    for (let i = 0; i < 4; i++) { g.fillRect(70, 130 + i * 20, W - 140 - (i === 3 ? 160 : 0), 4); }
    if (ball) { const gr = g.createRadialGradient(W / 2 - 40, 330, 8, W / 2, 360, 120); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.5, '#C9D3E6'); gr.addColorStop(1, '#7E8AA8'); g.fillStyle = gr; g.beginPath(); g.arc(W / 2, 360, 110, 0, 7); g.fill(); g.lineWidth = 8; g.stroke(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(W / 2 - 40, 318, 28, 16, -0.5, 0, 7); g.fill(); }
    g.fillStyle = INK; g.font = 'bold 78px "Archivo Black", Impact, sans-serif'; g.fillText(text, W / 2, 560); g.fillRect(70, 580, W - 140, 12);
    g.fillStyle = '#C0392B'; g.beginPath(); g.arc(W / 2, 680, 42, 0, 7); g.fill(); g.lineWidth = 6; g.stroke(); g.fillStyle = '#8E2418'; g.beginPath(); g.arc(W / 2, 680, 24, 0, 7); g.fill();
  }), [text, ball]);
  return (<group position={pos} rotation={rot} scale={scale}>
    <mesh scale={[1, Math.max(0.05, open), 1]} position-y={0.0}><planeGeometry args={[1.1, 1.6]} /><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    <Cy p={[0, 0.8 * open, 0.02]} r0={0.06} h={1.25} c="#D9C08A" rot={[0, 0, Math.PI / 2]} seg={10} ink={0.012} /><Cy p={[0, -0.8 * open, 0.02]} r0={0.06} h={1.25} c="#D9C08A" rot={[0, 0, Math.PI / 2]} seg={10} ink={0.012} />
  </group>);
};
/** Test table, tilted down to +x. Balls roll off in a neat line (round ones) — `lumpyAt` stops one wobbling. */
export const TiltedTable: React.FC<Base & {start?: number; round?: number; angle?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, start = 0, round = 6, angle = 0.22, seed = 3}) => {
  const {frame} = useStage();
  const wood = useMat(() => toon({map: woodPlanks({base: '#9A6A3C', planks: 6, seed}, [1, 1])}), [seed]);
  const L = 3.0;
  return (<group position={pos} rotation={rot} scale={scale}>
    <group rotation-z={-angle} position={[0, 1.0, 0]}>
      <Bx m={wood} s={[L, 0.12, 1.1]} ink={0.02} />
      {[-0.55, 0.55].map((z, i) => <Bx key={i} c="#5A3A22" s={[L, 0.14, 0.07]} p={[0, 0.1, z]} ink={0.01} />)}
      {Array.from({length: round}, (_, i) => { const t = frame - start - i * 11; if (t < 0) return null; const x = -L / 2 + 0.3 + t * 0.045; if (x > L / 2 + 1.2) return null; const off = x > L / 2 ? x - L / 2 : 0; return <Sp key={i} p={[x, 0.2 - off * off * 1.2, -0.3 + (i % 2) * 0.05]} s={0.1} c="#D5E0F2" ink={0.015} />; })}
      {(() => { const t = frame - start - 20; const x = -L / 2 + 0.3 + Math.min(t * 0.03, 1.6); return t > 0 ? <mesh geometry={lumpGeo} position={[x, 0.2, 0.25]} rotation={[t * 0.2, 0, Math.sin(t * 0.4) * (t < 55 ? 0.3 : 0)]} scale={0.11} material={T('#9AA3B4')}><Ink t={0.2} /></mesh> : null; })()}
    </group>
    {[[-1.2, -0.45], [-1.2, 0.45], [1.2, -0.45], [1.2, 0.45]].map(([x, z], i) => <Bx key={i} c="#5A3A22" s={[0.1, 1.0 + (x > 0 ? -0.26 : 0.26) * 0.5, 0.1]} p={[x, 0.5, z]} ink={0.01} />)}
  </group>);
};
export const Clock: React.FC<Base & {period?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, period = 70}) => {
  const {frame} = useStage(); const a = -(frame / period) * Math.PI * 2;
  return (<group position={pos} rotation={rot} scale={scale}>
    <Cy p={[0, 0, 0]} r0={0.5} h={0.12} c="#F4EFEA" rot={[Math.PI / 2, 0, 0]} seg={28} ink={0.03} />
    <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.5, 0.05, 8, 28]} /><meshToonMaterial color="#D9A441" /><Ink t={0.012} /></mesh>
    {Array.from({length: 12}, (_, i) => <Bx key={i} c="#2A1B26" s={[0.035, i % 3 ? 0.08 : 0.14, 0.02]} p={[Math.sin((i / 12) * 6.283) * 0.4, Math.cos((i / 12) * 6.283) * 0.4, 0.07]} r={[0, 0, -(i / 12) * 6.283]} ink={0.004} />)}
    <group position-z={0.1} rotation-z={a}><Bx c="#C0392B" s={[0.05, 0.42, 0.03]} p={[0, 0.18, 0]} ink={0.006} /></group>
    <Sp p={[0, 0, 0.11]} s={0.05} c="#2A1B26" ink={0.005} />
  </group>);
};
/** Rock chips flying out of a spot every `period` frames (digging). */
export const Chips: React.FC<{pos?: V3; period?: number; count?: number; color?: string; on?: [number, number]; seed?: number; speed?: number}> = ({pos = [0, 0, 0], period = 20, count = 12, color = '#B97A47', on = [-1e9, 1e9], seed = 2, speed = 1}) => {
  const {frame} = useStage(); const cfg = useMemo(() => { const r = rng(seed); return Array.from({length: count}, () => ({vx: r.range(-0.07, 0.07), vy: r.range(0.06, 0.15), vz: r.range(0, 0.07), s: r.range(0.03, 0.07), o: r.range(0, period)})); }, [count, period, seed]);
  if (frame < on[0] || frame > on[1]) return null;
  return (<group position={pos}>{cfg.map((c, i) => { const t = ((frame + c.o) % period) * speed; if (t > 14) return null; return <mesh key={i} position={[c.vx * t, c.vy * t - 0.012 * t * t, c.vz * t]} rotation={[t * 0.5, t * 0.3, 0]} scale={c.s} material={T(i % 2 ? color : '#8A6A48')}><boxGeometry args={[1, 0.7, 0.8]} /><Ink t={0.2} /></mesh>; })}</group>);
};
/** Pickaxe prop (stand-alone: leaned on a wall / lying). */
export const Pickaxe: React.FC<Base> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1}) => (
  <group position={pos} rotation={rot} scale={scale}><Cy p={[0, 0.6, 0]} r0={0.03} h={1.3} c="#7A4A26" seg={6} ink={0.008} /><Bx c="#3A3F4C" s={[0.62, 0.07, 0.07]} p={[0, 1.22, 0]} ink={0.01} /></group>);

// ---------------------------------------------------------------- interior room (floor, 3 walls, ceiling beams, windows, hanging lanterns)
export const Room: React.FC<Base & {w?: number; d?: number; h?: number; wall?: 'brick' | 'plaster' | 'wood'; wallColor?: string; floor?: 'planks' | 'stone'; floorColor?: string; windows?: number[]; windowY?: number; sky?: string; lanterns?: V3[]}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, w = 9, d = 7, h = 3.6, wall = 'brick', wallColor = '#B8704E', floor = 'planks', floorColor = '#9A6A3C', windows = [], windowY = 1.9, sky = '#BFE4FF', lanterns = [], seed = 5}) => {
  const wm = useMat(() => toon({map: wall === 'brick' ? bricks({base: wallColor, mortar: '#D9C8A8', rows: 14, seed}, [w / 2.4, h / 1.6]) : wall === 'wood' ? woodPlanks({base: wallColor, planks: 12, seed, vertical: true}, [w / 3, 1]) : stoneTiles({base: wallColor, seed, cols: 6}, [w / 3, h / 2])}), [wall, wallColor, seed, w, h]);
  const fm = useMat(() => toon({map: floor === 'planks' ? woodPlanks({base: floorColor, planks: 12, seed: seed + 1}, [w / 3, d / 3]) : stoneTiles({base: floorColor, seed: seed + 1, cols: 6}, [w / 2.5, d / 2.5])}), [floor, floorColor, seed, w, d]);
  const beam = '#5A3A22';
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <Bx m={fm} s={[w, 0.2, d]} p={[0, -0.1, 0]} ink={0.03} />
      <Bx m={wm} s={[w, h, 0.25]} p={[0, h / 2, -d / 2]} ink={0.03} />
      <Bx m={wm} s={[0.25, h, d]} p={[-w / 2, h / 2, 0]} ink={0.03} />
      <Bx m={wm} s={[0.25, h, d]} p={[w / 2, h / 2, 0]} ink={0.03} />
      {Array.from({length: Math.round(w / 1.6)}, (_, i) => <Bx key={'b' + i} c={beam} s={[0.22, 0.28, d]} p={[-w / 2 + 0.4 + i * ((w - 0.8) / Math.max(1, Math.round(w / 1.6) - 1)), h - 0.1, 0]} ink={0.018} />)}
      <Bx c={beam} s={[w, 0.24, 0.24]} p={[0, h - 0.2, -d / 2 + 0.2]} ink={0.018} /><Bx c={beam} s={[w, 0.2, 0.2]} p={[0, 0.12, -d / 2 + 0.16]} ink={0.012} />
      {windows.map((x, i) => (<group key={i} position={[x, windowY, -d / 2 + 0.14]}>
        <Bx c="#F4EFEA" s={[1.35, 1.75, 0.1]} ink={0.015} /><mesh position-z={0.06}><planeGeometry args={[1.15, 1.55]} />{Glow(sky, 1.1)}</mesh>
        <Bx c="#F4EFEA" s={[1.15, 0.06, 0.06]} p={[0, 0, 0.09]} ink={0.008} /><Bx c="#F4EFEA" s={[0.06, 1.55, 0.06]} p={[0, 0, 0.09]} ink={0.008} />
        <Bx c="#F4EFEA" s={[1.6, 0.1, 0.3]} p={[0, -0.92, 0.12]} ink={0.012} />
        <pointLight position={[0, 0, 1.2]} color="#FFE2B0" intensity={2.2} distance={7} decay={2} />
      </group>))}
      {lanterns.map((p, i) => <React.Fragment key={i}><Lantern2 p={p} seed={i + seed} /></React.Fragment>)}
    </group>);
};
import {Lantern} from './basic';
const Lantern2: React.FC<{p: V3; seed: number}> = ({p, seed}) => <Lantern pos={p} seed={seed} swing={0.05} />;
