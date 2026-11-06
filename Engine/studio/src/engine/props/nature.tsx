/* NATURE DRESSING — reusable detail for ANY outdoor set (look-dev 2026-11-06: "never flat, never bare").
 * Instanced grass that sways, flowers, reeds, leafy trees with painted leaf clusters, bushes, rocks, lily pads, a duck,
 * and hazy backdrop layers (tree lines, hills) for depth. Every solid gets toon light + plum ink.
 * Usage rule (style-bible §3.2b): every exterior set gets ≥ 1 ground-cover layer (GrassField/Flowers/Reeds), ≥ 3 leafy
 * trees or bushes in mid/background, and ≥ 1 Backdrop layer, so no frame ever shows bare ground or empty horizon. */
import * as THREE from 'three';
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {Ink} from './basic';
import {toon} from '../materials';
import {toonMat} from '../ink';
import {useStage} from '../Stage';
import {canvasTexture, INK, shade} from '../textures/canvas';
import {rng, fbm1} from '../random';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};

// ---------------------------------------------------------------- painted leaf texture (scalloped clumps + ink strokes)
export function leafTex(base = '#4E9A3A', seed = 1) {
  return canvasTexture(`leaf:${base}:${seed}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
    const dk = shade(base, -0.16), lt = shade(base, 0.16), lt2 = shade(base, 0.3);
    for (let i = 0; i < 90; i++) { const x = r.range(0, W), y = r.range(0, H), rr = r.range(18, 44); g.fillStyle = r.next() < 0.5 ? dk : lt; g.globalAlpha = 0.55; g.beginPath(); for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.arc(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.45, 0, 7); } g.fill(); }
    g.globalAlpha = 0.8; g.fillStyle = lt2; for (let i = 0; i < 70; i++) { const x = r.range(0, W), y = r.range(0, H); g.beginPath(); g.ellipse(x, y, r.range(5, 10), r.range(3, 6), r.range(0, 3), 0, 7); g.fill(); }
    g.globalAlpha = 0.5; g.strokeStyle = INK; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let i = 0; i < 120; i++) { const x = r.range(0, W), y = r.range(0, H), a = r.range(0, Math.PI * 2), l = r.range(8, 16); g.beginPath(); g.arc(x, y, l, a, a + 1.4); g.stroke(); }
    g.globalAlpha = 1;
  }, [1, 1]);
}
function barkTex(seed = 2) {
  return canvasTexture(`bark:${seed}`, 256, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = '#6B4426'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.strokeStyle = r.next() < 0.5 ? 'rgba(42,27,38,0.55)' : 'rgba(200,150,100,0.35)'; g.lineWidth = r.range(2, 5); const x = r.range(0, W); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r.range(-20, 20), H * 0.3, x + r.range(-20, 20), H * 0.7, x + r.range(-10, 10), H); g.stroke(); }
  }, [1, 1]);
}

// ---------------------------------------------------------------- leafy tree (many inked leaf clusters, slow sway)
export const LeafyTree: React.FC<Base & {height?: number; crown?: string; spread?: number; clusters?: number; sunk?: number; sway?: number; kind?: 'round' | 'poplar' | 'willow'}> = ({pos = [0, 0, 0], scale = 1, seed = 1, height = 3.2, crown = '#4E9A3A', spread = 1.4, clusters = 14, sunk = 0, sway = 1, kind = 'round'}) => {
  const {frame} = useStage();
  const r = useMemo(() => rng(seed), [seed]);
  const shape = kind === 'poplar' ? {sx: 0.45, sy: 2.2} : kind === 'willow' ? {sx: 1.3, sy: 0.9} : {sx: 1, sy: 1};
  const blobs = useMemo(() => Array.from({length: clusters}, (_, i) => {
    const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * spread * shape.sx, y = r.range(-0.4, 1.0) * spread * shape.sy;
    return {p: [Math.cos(a) * d, height + 0.3 + y + (kind === 'willow' ? -Math.abs(d) * 0.35 : 0), Math.sin(a) * d] as V3, s: r.range(0.55, 0.95) * spread * (kind === 'poplar' ? 0.55 : 0.7), tone: i % 3};
  }), [r, clusters, spread, height, kind, shape.sx, shape.sy]);
  const mats = useMemo(() => [0, 1, 2].map((k) => toon({map: leafTex(shade(crown, [0, 0.08, -0.08][k]), seed * 7 + k)})), [crown, seed]);
  const bark = useMemo(() => toon({map: barkTex(seed)}), [seed]);
  const trunk = useMemo(() => { const g = new THREE.CylinderGeometry(0.12, 0.26, height, 8, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / height + 0.5; p.setX(i, p.getX(i) + Math.sin(y * 3 + seed) * 0.06); } g.computeVertexNormals(); return g; }, [height, seed]);
  const branches = useMemo(() => Array.from({length: 3}, () => ({a: r.range(0, Math.PI * 2), y: r.range(0.55, 0.85) * height, l: r.range(0.6, 1.0) * spread})), [r, height, spread]);
  const sw = Math.sin(frame * 0.04 + seed) * 0.02 * sway;
  return (
    <group position={[pos[0], pos[1] - sunk, pos[2]]} scale={scale} rotation-z={sw}>
      <mesh geometry={trunk} position-y={height / 2} material={bark}><Ink t={0.03} /></mesh>
      {branches.map((b, i) => <mesh key={i} position={[Math.cos(b.a) * b.l * 0.35, b.y, Math.sin(b.a) * b.l * 0.35]} rotation={[Math.sin(b.a) * 0.9, 0, -Math.cos(b.a) * 0.9]} material={bark}><cylinderGeometry args={[0.04, 0.08, b.l, 6]} /><Ink t={0.015} /></mesh>)}
      {blobs.map((b, i) => <mesh key={i} position={b.p} scale={[b.s, b.s * 0.85, b.s]} rotation={[i, i * 0.7, 0]} material={mats[b.tone]}><icosahedronGeometry args={[1, 1]} /><Ink t={0.035} /></mesh>)}
    </group>
  );
};

/** Low round bush (3–6 leaf clusters) — foreground / midground filler. Optional flowers dotted on top. */
export const Bush: React.FC<Base & {color?: string; size?: number; flowers?: string}> = ({pos = [0, 0, 0], scale = 1, seed = 3, color = '#5BA544', size = 0.8, flowers}) => {
  const r = useMemo(() => rng(seed), [seed]);
  const blobs = useMemo(() => Array.from({length: 5}, () => [r.range(-0.6, 0.6) * size, r.range(0.2, 0.55) * size, r.range(-0.4, 0.4) * size, r.range(0.45, 0.7) * size]), [r, size]);
  const mat = useMemo(() => toon({map: leafTex(color, seed)}), [color, seed]);
  const fl = useMemo(() => (flowers ? toon({color: flowers}) : null), [flowers]);
  return (
    <group position={pos} scale={scale}>
      {blobs.map((b, i) => <mesh key={i} position={[b[0], b[1], b[2]]} scale={b[3]} material={mat}><icosahedronGeometry args={[1, 1]} /><Ink t={0.03} /></mesh>)}
      {fl && blobs.map((b, i) => <mesh key={'f' + i} position={[b[0] + 0.15 * size, b[1] + b[3] * 0.85, b[2] + 0.2 * size]} material={fl}><sphereGeometry args={[0.07 * size, 6, 4]} /></mesh>)}
    </group>
  );
};

// ---------------------------------------------------------------- instanced ground cover (grass tufts / flowers / reeds) with wind
type Scatter = {center?: V3; size?: [number, number]; count?: number; seed?: number; clear?: {pos: V3; r: number}[]; y?: number; wind?: number};
function useScatter({center = [0, 0, 0], size = [20, 20], count = 800, seed = 1, clear = []}: Scatter) {
  return useMemo(() => {
    const r = rng(seed); const pts: {x: number; z: number; s: number; rot: number; ph: number}[] = [];
    let guard = 0;
    while (pts.length < count && guard++ < count * 6) {
      const x = center[0] + r.range(-0.5, 0.5) * size[0], z = center[2] + r.range(-0.5, 0.5) * size[1];
      if (clear.some((c) => Math.hypot(x - c.pos[0], z - c.pos[2]) < c.r)) continue;
      // clumpy distribution: noise-thresholded so it looks planted by nature, not sprinkled
      if (fbm1(x * 0.35 + z * 0.21, seed) < -0.25 && r.next() < 0.6) continue;
      pts.push({x, z, s: r.range(0.7, 1.3), rot: r.range(0, Math.PI * 2), ph: r.range(0, 6.28)});
    }
    return pts;
  }, [center, size, count, seed, clear]); // eslint-disable-line react-hooks/exhaustive-deps
}
function useInstanced(ref: React.RefObject<THREE.InstancedMesh | null>, pts: ReturnType<typeof useScatter>, y: number, frame: number, wind: number, colors?: string[], seed = 1) {
  const m = useMemo(() => new THREE.Matrix4(), []); const q = useMemo(() => new THREE.Quaternion(), []); const e = useMemo(() => new THREE.Euler(), []);
  useLayoutEffect(() => {
    const im = ref.current; if (!im || !colors) return; const r = rng(seed + 99); const c = new THREE.Color();
    pts.forEach((_, i) => { c.set(colors[Math.floor(r.next() * colors.length)]); im.setColorAt(i, c); }); if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [ref, pts, colors, seed]);
  const im = ref.current;
  if (im) {
    pts.forEach((p, i) => {
      const bend = Math.sin(frame * 0.07 + p.x * 0.4 + p.ph) * 0.12 * wind;
      e.set(bend * 0.6, p.rot, bend); q.setFromEuler(e); m.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  }
}

/** Thousands of swaying grass tufts (3 crossed blades each), colour-varied. `clear` keeps paths / actor spots open. */
export const GrassField: React.FC<Scatter & {colors?: string[]; height?: number}> = (p) => {
  const {frame} = useStage();
  const pts = useScatter(p);
  const ref = useRef<THREE.InstancedMesh>(null);
  const h = p.height ?? 0.32;
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) { const b = new THREE.ConeGeometry(0.035, h, 3, 1); b.translate(0, h / 2, 0); b.rotateZ((k - 1) * 0.35); b.rotateY(k * 2.1); parts.push(b); }
    const merged = new THREE.BufferGeometry(); const pos: number[] = []; const nor: number[] = [];
    for (const b of parts) { const nb = b.toNonIndexed(); pos.push(...(nb.attributes.position.array as Float32Array)); nor.push(...(nb.attributes.normal.array as Float32Array)); }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return merged;
  }, [h]);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color: '#ffffff'}), []);
  useInstanced(ref, pts, p.y ?? 0, frame, p.wind ?? 1, p.colors ?? ['#6FB33F', '#5E9E35', '#8CC152', '#7DBA4C', '#A6C84A'], p.seed);
  return <instancedMesh ref={ref} args={[geo, mat, pts.length]} frustumCulled={false} />;
};

/** Scattered little flowers (stem-less heads on the grass): colour pops in the midground. */
export const Flowers: React.FC<Scatter & {colors?: string[]}> = (p) => {
  const {frame} = useStage();
  const pts = useScatter({...p, count: p.count ?? 160});
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => { const g = new THREE.IcosahedronGeometry(0.06, 0); g.translate(0, 0.3, 0); return g; }, []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color: '#ffffff'}), []);
  useInstanced(ref, pts, p.y ?? 0, frame, p.wind ?? 1, p.colors ?? ['#FFD23F', '#FF6B8A', '#FFFFFF', '#B07CFF', '#FF9A3C'], (p.seed ?? 1) + 5);
  return <instancedMesh ref={ref} args={[geo, mat, pts.length]} frustumCulled={false} />;
};

/** Reeds + cattails along a water edge (instanced, swaying). */
export const Reeds: React.FC<Scatter & {height?: number}> = (p) => {
  const {frame} = useStage();
  const pts = useScatter({...p, count: p.count ?? 140});
  const ref = useRef<THREE.InstancedMesh>(null); const refC = useRef<THREE.InstancedMesh>(null);
  const h = p.height ?? 1.1;
  const geo = useMemo(() => { const g = new THREE.CylinderGeometry(0.012, 0.025, h, 4); g.translate(0, h / 2, 0); return g; }, [h]);
  const cat = useMemo(() => { const g = new THREE.CapsuleGeometry(0.035, 0.16, 2, 6); g.translate(0, h * 0.86, 0); return g; }, [h]);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color: '#ffffff'}), []);
  const matC = useMemo(() => new THREE.MeshToonMaterial({color: '#6B3E1E'}), []);
  useInstanced(ref, pts, p.y ?? 0, frame, (p.wind ?? 1) * 0.7, ['#7A9A3A', '#8AAE48', '#5E8A2E'], p.seed);
  const half = useMemo(() => pts.filter((_, i) => i % 3 === 0), [pts]);
  useInstanced(refC, half, p.y ?? 0, frame, (p.wind ?? 1) * 0.7, undefined, p.seed);
  return (<group><instancedMesh ref={ref} args={[geo, mat, pts.length]} frustumCulled={false} /><instancedMesh ref={refC} args={[cat, matC, half.length]} frustumCulled={false} /></group>);
};

/** Chunky inked rocks / pebbles. */
export const Rocks: React.FC<Base & {count?: number; spread?: number; color?: string; size?: number}> = ({pos = [0, 0, 0], seed = 4, count = 5, spread = 1.2, color = '#9A9488', size = 0.25}) => {
  const r = useMemo(() => rng(seed), [seed]);
  const rs = useMemo(() => Array.from({length: count}, () => ({p: [r.range(-spread, spread), 0, r.range(-spread, spread)] as V3, s: r.range(0.5, 1.3) * size, rot: [r.next(), r.next(), r.next()] as V3, c: shade(color, r.range(-0.1, 0.1))})), [r, count, spread, size, color]);
  return (<group position={pos}>{rs.map((k, i) => <mesh key={i} position={[k.p[0], k.s * 0.4, k.p[2]]} rotation={k.rot} scale={[k.s, k.s * 0.7, k.s]} material={toonMat(k.c)}><dodecahedronGeometry args={[1, 0]} /><Ink t={0.04} /></mesh>)}</group>);
};

/** Lily pads (+ the odd pink flower) floating on a water surface at height y. */
export const LilyPads: React.FC<Base & {count?: number; spread?: number; y?: number}> = ({pos = [0, 0, 0], seed = 5, count = 7, spread = 2, y = 0}) => {
  const {frame} = useStage();
  const r = useMemo(() => rng(seed), [seed]);
  const ps = useMemo(() => Array.from({length: count}, () => ({x: r.range(-spread, spread), z: r.range(-spread, spread), s: r.range(0.18, 0.34), a: r.range(0, 6), fl: r.next() < 0.3})), [r, count, spread]);
  const pad = useMemo(() => toon({color: '#4E9A3A'}), []); const pink = useMemo(() => toon({color: '#FF8AB0'}), []);
  return (<group position={[pos[0], y + 0.01, pos[2]]}>{ps.map((p, i) => (
    <group key={i} position={[p.x, Math.sin(frame * 0.08 + i) * 0.008, p.z]} rotation-y={p.a + Math.sin(frame * 0.02 + i) * 0.05}>
      <mesh rotation-x={-Math.PI / 2} material={pad}><circleGeometry args={[p.s, 20, 0.3, Math.PI * 2 - 0.3]} /></mesh>
      {p.fl && <mesh position-y={0.05} material={pink}><coneGeometry args={[0.07, 0.1, 6]} /><Ink t={0.01} /></mesh>}
    </group>))}</group>);
};

/** A paddling duck (easter-egg life): bobs, drifts along x. */
export const Duck: React.FC<Base & {y?: number; drift?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, y, drift = 0.004}) => {
  const {frame} = useStage();
  const body = useMemo(() => toon({color: '#F4EFEA'}), []); const head = useMemo(() => toon({color: '#2E7D4A'}), []); const bill = useMemo(() => toon({color: '#FFB020'}), []);
  const x = pos[0] + frame * drift, bob = Math.sin(frame * 0.15 + seed) * 0.015;
  return (
    <group position={[x, (y ?? pos[1]) + bob, pos[2]]} rotation={rot} scale={scale}>
      <mesh scale={[0.16, 0.11, 0.24]} position-y={0.06} material={body}><sphereGeometry args={[1, 12, 8]} /><Ink t={0.02} /></mesh>
      <mesh position={[0, 0.2, 0.17]} scale={0.085} material={head}><sphereGeometry args={[1, 10, 8]} /><Ink t={0.02} /></mesh>
      <mesh position={[0, 0.19, 0.27]} rotation-x={Math.PI / 2} material={bill}><coneGeometry args={[0.03, 0.08, 6]} /><Ink t={0.008} /></mesh>
      <mesh position={[0.05, 0.23, 0.23]} material={new THREE.MeshBasicMaterial({color: INK})}><sphereGeometry args={[0.012, 6, 4]} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- backdrops: depth layers that fill the horizon
/** Long row of distant trees (silhouette-ish, hazed by fog) along local x. */
export const TreeLine: React.FC<Base & {length?: number; count?: number; color?: string; height?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], seed = 6, length = 120, count = 40, color = '#4F8A3A', height = 4}) => {
  const r = useMemo(() => rng(seed), [seed]);
  const ts = useMemo(() => Array.from({length: count}, (_, i) => ({x: -length / 2 + (i + r.range(0, 0.8)) * (length / count), h: r.range(0.6, 1.3) * height, w: r.range(0.8, 1.5) * height * 0.45, k: i % 3, poplar: r.next() < 0.25})), [r, count, length, height]);
  const mats = useMemo(() => [0, 1, 2].map((k) => toon({map: leafTex(shade(color, [0, 0.07, -0.07][k]), seed + k)})), [color, seed]);
  const trunk = useMemo(() => toonMat('#5A3A22'), []);
  return (<group position={pos} rotation={rot}>{ts.map((t, i) => (
    <group key={i} position={[t.x, 0, (i % 2) * 1.5]}>
      <mesh position-y={t.h * 0.3} material={trunk}><cylinderGeometry args={[0.12, 0.2, t.h * 0.6, 5]} /></mesh>
      <mesh position-y={t.h * 0.75} scale={t.poplar ? [t.w * 0.45, t.h * 0.55, t.w * 0.45] : [t.w, t.h * 0.42, t.w]} material={mats[t.k]}><icosahedronGeometry args={[1, 1]} /><Ink t={0.06} /></mesh>
    </group>))}</group>);
};

/** Rolling hills band (painted gradient, inked ridge), pushed far back; layer 2–3 of these with fog for aerial perspective. */
export const Hills: React.FC<Base & {width?: number; height?: number; color?: string; bumps?: number}> = ({pos = [0, 0, 0], seed = 7, width = 400, height = 18, color = '#6FA85A', bumps = 7}) => {
  const geo = useMemo(() => {
    const r = rng(seed); const s = new THREE.Shape(); s.moveTo(-width / 2, -2);
    const n = 60; for (let i = 0; i <= n; i++) { const x = -width / 2 + (i / n) * width; const y = height * (0.45 + 0.35 * Math.sin((i / n) * Math.PI * bumps + seed) + 0.2 * fbm1(i * 0.3, seed)); s.lineTo(x, Math.max(1, y)); }
    s.lineTo(width / 2, -2); s.closePath(); void r; return new THREE.ExtrudeGeometry(s, {depth: 4, bevelEnabled: false});
  }, [seed, width, height, bumps]);
  const mat = useMemo(() => toon({map: canvasTexture(`hill:${color}`, 256, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(color, 0.12)); gr.addColorStop(1, shade(color, -0.12)); g.fillStyle = gr; g.fillRect(0, 0, W, H); const r = rng(color); for (let i = 0; i < 60; i++) { g.fillStyle = shade(color, r.range(-0.15, 0.1)); g.beginPath(); g.arc(r.range(0, W), r.range(0, H), r.range(3, 9), 0, 7); g.fill(); } })}), [color]);
  return <mesh geometry={geo} position={pos} material={mat}><Ink t={0.25} /></mesh>;
};
