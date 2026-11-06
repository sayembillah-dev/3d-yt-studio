import * as THREE from 'three';
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {inkHullMaterial} from '../ink';
import {useStage} from '../Stage';
import {toon} from '../materials';
import {woodPlanks, metal, signTexture, strata, canvasTexture, INK, SignStyle} from '../textures/canvas';
import {rng, fbm1} from '../random';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};
const INKC = INK;
/**
 * Ink line for the PARENT mesh: <mesh geometry material><Ink t={0.02}/></mesh>.
 * Engine inverted hull (ink.tsx): plum #2A1B26, lit side t*0.7, shadow side 2x (brush weight, style-bible §3.1).
 * The hull uses crease-smoothed normals so boxes/cylinders get a closed outline (no gaps at hard edges).
 * t is in the parent's LOCAL units.
 */
const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function hullGeometry(g: THREE.BufferGeometry) {
  let h = hullCache.get(g);
  if (!h) { h = toCreasedNormals(g.clone(), Math.PI); hullCache.set(g, h); }
  return h;
}
export const Ink: React.FC<{t?: number; shadowMul?: number}> = ({t = 0.025, shadowMul = 2}) => {
  const ref = useRef<THREE.Mesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; const parent = m?.parent as THREE.Mesh | null;
    if (m && parent && parent.geometry && m.geometry !== hullCache.get(parent.geometry)) m.geometry = hullGeometry(parent.geometry);
  });
  return <mesh ref={ref} material={inkHullMaterial(t * 0.7, shadowMul, INKC)} raycast={() => null} />;
};

// ---------------------------------------------------------------- barrel (lathe + staves texture + iron hoops)
export const Barrel: React.FC<Base & {label?: string; labelStyle?: SignStyle; wood?: string; open?: boolean; content?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, label, labelStyle = 'stencil', wood = '#A86A3A', open, content}) => {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const y = t * 1.2; const r = 0.42 + Math.sin(t * Math.PI) * 0.08; pts.push(new THREE.Vector2(r, y)); }
    const g = new THREE.LatheGeometry(pts, 28); g.computeVertexNormals(); return g;
  }, []);
  const mat = useMemo(() => toon({map: woodPlanks({base: wood, planks: 14, seed, vertical: true, nails: false, knots: true, worn: 0.5}, [1, 1])}), [wood, seed]);
  const lid = useMemo(() => toon({map: woodPlanks({base: wood, planks: 5, seed: seed + 3, nails: true})}), [wood, seed]);
  const iron = useMemo(() => toon({color: '#3B3A40'}), []);
  const labelTex = useMemo(() => (label ? signTexture(label, {style: labelStyle, w: 512, h: 256, seed}) : null), [label, labelStyle, seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh geometry={geo} material={mat}><Ink t={0.02} /></mesh>
      {[0.12, 0.42, 0.78, 1.08].map((y, i) => (
        <mesh key={i} position-y={y} material={iron} rotation-x={Math.PI / 2}><torusGeometry args={[0.42 + Math.sin((y / 1.2) * Math.PI) * 0.08 + 0.008, 0.02, 6, 32]} /><Ink t={0.006} /></mesh>
      ))}
      <mesh position-y={1.18} rotation-x={-Math.PI / 2} material={open && content ? toon({color: content}) : lid}><circleGeometry args={[0.41, 28]} /></mesh>
      {labelTex && (
        <mesh position={[0, 0.6, 0.505]}><planeGeometry args={[0.62, 0.31]} /><meshBasicMaterial map={labelTex} transparent alphaTest={0.05} toneMapped={false} /></mesh>
      )}
    </group>
  );
};

// ---------------------------------------------------------------- crate
export const Crate: React.FC<Base & {size?: V3; wood?: string; label?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 2, size = [0.9, 0.8, 0.9], wood = '#B98A52', label}) => {
  const tex = useMemo(() => canvasTexture(`crate:${seed}:${wood}:${label ?? ''}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = wood; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + r.next() * 0.06})`; g.fillRect(0, (i * H) / 5, W, H / 5 - 6); g.fillStyle = INK; g.globalAlpha = 0.55; g.fillRect(0, ((i + 1) * H) / 5 - 6, W, 5); g.globalAlpha = 1; }
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(60,30,10,${0.08 + r.next() * 0.12})`; g.lineWidth = 1 + r.next() * 2; const y = r.range(0, H); g.beginPath(); g.moveTo(r.range(-20, W), y); g.bezierCurveTo(W * 0.3, y + r.range(-6, 6), W * 0.6, y + r.range(-6, 6), r.range(0, W + 20), y + r.range(-4, 4)); g.stroke(); }
    // frame + diagonal brace
    g.fillStyle = '#8A5E32'; g.fillRect(0, 0, W, 46); g.fillRect(0, H - 46, W, 46); g.fillRect(0, 0, 46, H); g.fillRect(W - 46, 0, 46, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 4); g.fillRect(-W * 0.7, -22, W * 1.4, 44); g.restore();
    g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6); g.strokeRect(46, 46, W - 92, H - 92);
    g.fillStyle = '#3B3A40'; for (const [x, y] of [[23, 23], [W - 23, 23], [23, H - 23], [W - 23, H - 23]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
    if (label) { g.save(); g.translate(W / 2, H / 2); g.rotate(-0.08); g.font = '900 86px "Black Ops One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(30,22,18,0.82)'; g.fillText(label, 0, 0); g.restore(); }
  }), [seed, wood, label]);
  const mat = useMemo(() => toon({map: tex}), [tex]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={size[1] / 2} material={mat}><boxGeometry args={size} /><Ink /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- planked deck / floor
export const Deck: React.FC<Base & {size?: [number, number]; wood?: string; planks?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], size = [12, 30], wood = '#B07A48', planks = 10, seed = 5}) => {
  const mat = useMemo(() => toon({map: woodPlanks({base: wood, planks, seed, nails: true, knots: true, worn: 0.6}, [size[0] / 4, size[1] / 4])}), [wood, planks, seed, size]);
  return <mesh position={pos} rotation={[-Math.PI / 2 + rot[0], rot[1], rot[2]]} material={mat}><planeGeometry args={size} /></mesh>;
};

// ---------------------------------------------------------------- railing (posts + top rail + balusters)
export const Railing: React.FC<Base & {length?: number; height?: number; wood?: string; spacing?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], length = 8, height = 1.0, wood = '#7A4A26', spacing = 0.35, seed = 7}) => {
  const mat = useMemo(() => toon({map: woodPlanks({base: wood, planks: 2, seed, vertical: true, nails: false})}), [wood, seed]);
  const n = Math.floor(length / spacing);
  return (
    <group position={pos} rotation={rot}>
      <mesh position={[0, height, 0]} material={mat}><boxGeometry args={[length, 0.1, 0.14]} /><Ink t={0.012} /></mesh>
      <mesh position={[0, height * 0.35, 0]} material={mat}><boxGeometry args={[length, 0.06, 0.08]} /><Ink t={0.01} /></mesh>
      {Array.from({length: n + 1}, (_, i) => {
        const x = -length / 2 + i * spacing; const post = i % 6 === 0;
        return <mesh key={i} position={[x, height / 2, 0]} material={mat}>{post ? <boxGeometry args={[0.14, height + 0.12, 0.16]} /> : <cylinderGeometry args={[0.03, 0.035, height, 6]} />}<Ink t={post ? 0.012 : 0.008} /></mesh>;
      })}
    </group>
  );
};

// ---------------------------------------------------------------- cannon
export const Cannon: React.FC<Base & {recoil?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, recoil = 0}) => {
  const iron = useMemo(() => toon({map: metal({base: '#3A3B42', rivets: false, seed: 4})}), []);
  const wood = useMemo(() => toon({map: woodPlanks({base: '#7A4A26', planks: 3, seed: 9})}), []);
  const barrel = useMemo(() => { const pts = [[0.0, -0.05], [0.2, 0], [0.24, 0.1], [0.2, 0.18], [0.19, 0.9], [0.15, 1.5], [0.17, 1.55], [0.17, 1.62], [0.12, 1.62], [0.1, 1.55]].map(([r, y]) => new THREE.Vector2(r, y)); return new THREE.LatheGeometry(pts, 24); }, []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <group position={[0, 0, -recoil * 0.4]}>
        <mesh material={wood} position={[0, 0.3, 0]}><boxGeometry args={[0.6, 0.3, 1.0]} /><Ink t={0.015} /></mesh>
        {[[-0.32, 0.35], [0.32, 0.35], [-0.32, -0.35], [0.32, -0.35]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.18, z]} rotation-z={Math.PI / 2} material={wood}><cylinderGeometry args={[0.18, 0.18, 0.08, 14]} /><Ink t={0.012} /></mesh>
        ))}
        <mesh geometry={barrel} material={iron} position={[0, 0.6, -0.45]} rotation-x={Math.PI / 2 - 0.08}><Ink t={0.015} /></mesh>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- hanging / standing sign
export const Sign: React.FC<Base & {text: string; sub?: string; style?: SignStyle; w?: number; h?: number; board?: boolean; color?: string; bg?: string; glow?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, text, sub, style = 'painted', w = 2, h = 0.8, board = true, color, bg, glow = 0, seed = 3}) => {
  const tex = useMemo(() => signTexture(text, {style, sub, w: 1024, h: Math.round((1024 * h) / w), color, bg, seed}), [text, sub, style, w, h, color, bg, seed]);
  const wood = useMemo(() => toon({map: woodPlanks({base: '#6B4022', planks: 3, seed})}), [seed]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {board && <mesh position-z={-0.04} material={wood}><boxGeometry args={[w + 0.12, h + 0.12, 0.06]} /><Ink t={0.012} /></mesh>}
      <mesh><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent alphaTest={0.02} color={glow ? new THREE.Color(1 + glow, 1 + glow, 1 + glow) : '#ffffff'} toneMapped={false} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- lantern (emissive, flicker) — ambient motion
export const Lantern: React.FC<Base & {color?: string; swing?: number}> = ({pos = [0, 0, 0], scale = 1, color = '#FFC46B', swing = 0.06, seed = 1}) => {
  const {frame} = useStage();
  const fl = 1.6 + 0.35 * fbm1(frame / 6, seed);
  return (
    <group position={pos} scale={scale} rotation-z={Math.sin(frame * 0.06 + seed) * swing}>
      <mesh position-y={-0.15}><cylinderGeometry args={[0.012, 0.012, 0.3, 4]} /><meshBasicMaterial color={INKC} /></mesh>
      <mesh position-y={-0.42}><boxGeometry args={[0.22, 0.3, 0.22]} /><meshBasicMaterial color={new THREE.Color(color).multiplyScalar(fl)} toneMapped={false} /><Ink t={0.01} /></mesh>
      <mesh position-y={-0.25}><coneGeometry args={[0.16, 0.1, 4]} /><meshToonMaterial color="#2A2420" /><Ink t={0.008} /></mesh>
      <pointLight position-y={-0.42} color={color} intensity={2.2 * fl} distance={5} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------- rope coil
export const RopeCoil: React.FC<Base> = ({pos = [0, 0, 0], scale = 1}) => {
  const m = useMemo(() => toon({color: '#C9A46A'}), []);
  return (<group position={pos} scale={scale}>{[0, 1, 2, 3].map((i) => (
    <mesh key={i} position-y={0.05 + i * 0.075} rotation-x={Math.PI / 2} material={m}><torusGeometry args={[0.32 - i * 0.04, 0.04, 6, 24]} /><Ink t={0.008} /></mesh>))}</group>);
};

// ---------------------------------------------------------------- sea stack / rock spire with strata (backdrop)
export const SeaStack: React.FC<Base & {height?: number; radius?: number; colors?: string[]}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, height = 30, radius = 7, seed = 11, colors = ['#C98A5A', '#B5704A', '#D9A574', '#A86240']}) => {
  const geo = useMemo(() => {
    const r = rng(seed); const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(radius * (1 - t * 0.35) * (0.9 + r.next() * 0.2) * (i === 10 ? 0.6 : 1), t * height)); }
    pts.push(new THREE.Vector2(0.01, height + 0.6));
    const g = new THREE.LatheGeometry(pts, 9); // low facet count = chunky painted rock
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.12 * fbm1(a * 2 + y * 0.15, seed); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals(); return g;
  }, [seed, height, radius]);
  const mat = useMemo(() => toon({map: strata({colors, seed, bands: 9}, [2, 1])}), [colors, seed]);
  const grass = useMemo(() => toon({color: '#6DAA45'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh geometry={geo} material={mat}><Ink t={0.08} /></mesh>
      <mesh position-y={height + 0.2} material={grass} scale={[radius * 0.62, 0.7, radius * 0.62]}><sphereGeometry args={[1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Ink t={0.06} /></mesh>
    </group>
  );
};
