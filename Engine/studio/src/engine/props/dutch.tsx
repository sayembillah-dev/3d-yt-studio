/* Dutch-countryside props (polder, dikes, windmills, sluices, barges) — every mesh toon-lit + plum ink (style-bible §3.1).
 * First used by Projects/01_dutch-water-line. Generic enough for any lowland / river / farm story. */
import * as THREE from 'three';
import React, {useMemo} from 'react';
import {Ink} from './basic';
import {toon} from '../materials';
import {useStage} from '../Stage';
import {canvasTexture, woodPlanks, bricks, stoneTiles, signTexture, INK, shade} from '../textures/canvas';
import {rng, fbm1} from '../random';
import {LeafyTree} from './nature';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};

// ---------------------------------------------------------------- textures
function grassTex(seed = 1, base = '#7DBA4C') {
  return canvasTexture(`grass:${seed}:${base}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { g.fillStyle = shade(base, r.range(-0.08, 0.08)); g.globalAlpha = 0.5; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(30, 90), r.range(12, 30), 0, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = INK; g.lineCap = 'round';
    for (let i = 0; i < 140; i++) { const x = r.range(0, W), y = r.range(0, H); g.globalAlpha = r.range(0.25, 0.55); g.lineWidth = r.range(1.5, 3); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r.range(-4, 4), y - 8, x + r.range(-6, 6), y - r.range(10, 18)); g.stroke(); }
    g.globalAlpha = 1;
  }, [1, 1]);
}
function fieldTex(seed = 3, rows = 10, colors = ['#8CC152', '#6FAA3E', '#B9C95A', '#7FB547']) {
  return canvasTexture(`field:${seed}:${rows}:${colors.join()}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); const h = H / rows;
    for (let i = 0; i < rows; i++) { g.fillStyle = colors[i % colors.length]; g.fillRect(0, i * h, W, h); g.fillStyle = 'rgba(42,27,38,0.35)'; g.fillRect(0, i * h, W, 4); for (let k = 0; k < 40; k++) { g.fillStyle = shade(colors[i % colors.length], -0.12); g.beginPath(); g.arc(r.range(0, W), i * h + r.range(8, h - 8), r.range(4, 9), 0, 7); g.fill(); } }
    g.strokeStyle = 'rgba(80,140,200,0.9)'; g.lineWidth = 10; for (const x of [W * 0.33, W * 0.71]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } // drainage ditches
  }, [1, 1]);
}
function thatchTex(seed = 4, base = '#C9A15A') {
  return canvasTexture(`thatch:${seed}:${base}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let row = 0; row < 8; row++) { g.fillStyle = 'rgba(42,27,38,0.45)'; g.fillRect(0, row * 64 + 58, W, 5); }
    for (let i = 0; i < 600; i++) { const x = r.range(0, W), y = r.range(0, H); g.strokeStyle = `rgba(${r.next() < 0.5 ? '90,60,20' : '240,210,140'},${r.range(0.2, 0.5)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.range(-3, 3), y + 22); g.stroke(); }
  }, [1, 1]);
}
function mudTex(seed = 6, base = '#7A5236') {
  return canvasTexture(`mud:${seed}:${base}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { g.fillStyle = shade(base, i % 2 ? 0.08 : -0.08); g.fillRect(0, (i * H) / 6 + r.range(-8, 8), W, H / 12); }
    for (let i = 0; i < 70; i++) { g.fillStyle = shade(base, r.range(-0.25, 0.15)); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(5, 16), r.range(4, 10), r.next(), 0, 7); g.fill(); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
  }, [1, 1]);
}
function stripeTex(a: string, b: string, n = 8) {
  return canvasTexture(`tentstripe:${a}:${b}:${n}`, 512, 256, (g, W, H) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * W) / n, 0, W / n, H); } g.fillStyle = INK; for (let i = 1; i < n; i++) g.fillRect((i * W) / n - 1.5, 0, 3, H); });
}

// ---------------------------------------------------------------- ground: polder field (plane with crop rows + ditches)
export const Polder: React.FC<Base & {size?: [number, number]; rows?: number; colors?: string[]; tile?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], size = [80, 80], rows = 10, colors, seed = 3, tile = 20}) => {
  const mat = useMemo(() => { const t = fieldTex(seed, rows, colors).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size[0] / tile, size[1] / tile); t.needsUpdate = true; return toon({map: t}); }, [seed, rows, colors, size, tile]);
  return <mesh position={pos} rotation={[-Math.PI / 2 + rot[0], rot[1], rot[2]]} material={mat}><planeGeometry args={size} /></mesh>;
};

/** Plain grass / snow / mud ground plane. */
export const Ground: React.FC<Base & {size?: [number, number]; color?: string; kind?: 'grass' | 'mud' | 'snow'; tile?: number}> = ({pos = [0, 0, 0], size = [200, 200], color, kind = 'grass', seed = 1, tile = 8}) => {
  const mat = useMemo(() => {
    if (kind === 'snow') return toon({color: color ?? '#EEF4FA'});
    const t = (kind === 'mud' ? mudTex(seed, color ?? '#7A5236') : grassTex(seed, color ?? '#7DBA4C')).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size[0] / tile, size[1] / tile); t.needsUpdate = true; return toon({map: t});
  }, [kind, color, seed, size, tile]);
  return <mesh position={pos} rotation-x={-Math.PI / 2} material={mat}><planeGeometry args={size} /></mesh>;
};

// ---------------------------------------------------------------- dike: long trapezoid embankment, grass top, along local x
export const Dike: React.FC<Base & {length?: number; height?: number; top?: number; base?: number; color?: string; breach?: number; path?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], length = 30, height = 1.6, top = 2.2, base = 6, color = '#78B548', seed = 2, breach = 0, path = true}) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-base / 2, 0); s.lineTo(-top / 2, height); s.lineTo(top / 2, height); s.lineTo(base / 2, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {depth: length, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, steps: 1});
    g.translate(0, 0, -length / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals(); return g;
  }, [length, height, top, base]);
  const mat = useMemo(() => { const t = grassTex(seed, color).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(length / 6, 1); t.needsUpdate = true; return toon({map: t}); }, [seed, color, length]);
  const sand = useMemo(() => toon({color: '#D8C08A'}), []);
  const mud = useMemo(() => toon({map: mudTex(seed + 5)}), [seed]);
  return (
    <group position={pos} rotation={rot}>
      <mesh geometry={geo} material={mat}><Ink t={0.05} /></mesh>
      {path && <mesh position={[0, height + 0.17, 0]} material={sand}><boxGeometry args={[length, 0.04, top * 0.45]} /></mesh>}
      {breach > 0 && <mesh position={[0, height * 0.5, 0]} material={mud} scale={[breach, 1, 1]}><boxGeometry args={[1, height + 0.4, base * 0.92]} /><Ink t={0.03} /></mesh>}
    </group>
  );
};

// ---------------------------------------------------------------- windmill (sails turn every frame = ambient motion)
export const Windmill: React.FC<Base & {speed?: number; body?: string; sail?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, speed = 0.035, body = '#5E4A3A', sail = '#F2E6CF'}) => {
  const {frame} = useStage();
  const tower = useMemo(() => new THREE.CylinderGeometry(1.2, 2.1, 7, 8), []);
  const bodyMat = useMemo(() => toon({map: woodPlanks({base: body, planks: 6, seed, vertical: true})}), [body, seed]);
  const cap = useMemo(() => toon({map: thatchTex(seed + 2, '#8A6A42')}), [seed]);
  const sailMat = useMemo(() => toon({map: canvasTexture(`sail:${sail}`, 128, 512, (g, W, H) => { g.fillStyle = sail; g.fillRect(0, 0, W, H); g.strokeStyle = INK; g.lineWidth = 5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, (i * H) / 8); g.lineTo(W, (i * H) / 8); g.stroke(); } g.strokeRect(3, 3, W - 6, H - 6); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); }), side: THREE.DoubleSide}), [sail]);
  const wood = useMemo(() => toon({color: '#4A3526'}), []);
  const win = useMemo(() => toon({color: '#FFD98A', emissive: '#6B4A10', emissiveIntensity: 0.4}), []);
  const a = frame * speed + seed;
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh geometry={tower} position-y={3.5} material={bodyMat}><Ink t={0.06} /></mesh>
      <mesh position-y={7.6} material={cap} scale={[1.45, 1.1, 1.45]}><sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Ink t={0.05} /></mesh>
      <mesh position={[0, 1.2, 2.0]} material={wood}><boxGeometry args={[0.9, 1.6, 0.2]} /><Ink t={0.03} /></mesh>
      <mesh position={[0, 4.2, 1.62]} material={win}><boxGeometry args={[0.5, 0.6, 0.12]} /><Ink t={0.025} /></mesh>
      <group position={[0, 7.4, 1.6]} rotation-z={a}>
        <mesh material={wood} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.25, 0.25, 0.5, 10]} /><Ink t={0.03} /></mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-z={(i * Math.PI) / 2}>
            <mesh position={[0, 3.1, 0.1]} material={wood}><boxGeometry args={[0.16, 6.2, 0.12]} /><Ink t={0.025} /></mesh>
            <mesh position={[0.45, 3.6, 0.15]} material={sailMat}><planeGeometry args={[0.8, 4.6]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- tree → nature.LeafyTree (painted leaf clusters, sway)
export const Tree: React.FC<Base & {height?: number; crown?: string; sunk?: number; kind?: 'round' | 'poplar' | 'willow'}> = ({pos = [0, 0, 0], scale = 1, seed = 1, height = 3, crown = '#4E9A3A', sunk = 0, kind = 'round'}) => (
  <LeafyTree pos={pos} scale={scale} seed={seed} height={height} crown={crown} sunk={sunk} kind={kind} />
);

/** Row of fence posts along local x (half under water in the flood sets). */
export const FencePosts: React.FC<Base & {count?: number; spacing?: number; height?: number; rails?: boolean}> = ({pos = [0, 0, 0], rot = [0, 0, 0], count = 8, spacing = 1.4, height = 1.1, rails = true, seed = 3}) => {
  const mat = useMemo(() => toon({map: woodPlanks({base: '#8A6440', planks: 2, seed, vertical: true})}), [seed]);
  const L = (count - 1) * spacing;
  return (
    <group position={pos} rotation={rot}>
      {Array.from({length: count}, (_, i) => <mesh key={i} position={[-L / 2 + i * spacing, height / 2, 0]} rotation-z={fbm1(i, seed) * 0.12} material={mat}><boxGeometry args={[0.14, height, 0.14]} /><Ink t={0.015} /></mesh>)}
      {rails && [0.45, 0.85].map((y, i) => <mesh key={i} position={[0, height * y, 0.08]} material={mat}><boxGeometry args={[L + 0.3, 0.07, 0.05]} /><Ink t={0.01} /></mesh>)}
    </group>
  );
};

// ---------------------------------------------------------------- barn (brick walls, thatched roof, big doors)
export const Barn: React.FC<Base & {w?: number; d?: number; h?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, w = 6, d = 5, h = 3}) => {
  const wall = useMemo(() => toon({map: bricks({base: '#A8543A', mortar: '#E8D8C0', rows: 14, seed})}), [seed]);
  const roof = useMemo(() => toon({map: thatchTex(seed, '#C9A15A')}), [seed]);
  const door = useMemo(() => toon({map: woodPlanks({base: '#3F6B4A', planks: 5, seed: seed + 1, vertical: true})}), [seed]);
  const roofGeo = useMemo(() => { const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(0, h * 0.9); s.lineTo(w / 2 + 0.4, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, {depth: d + 0.6, bevelEnabled: false}); g.translate(0, 0, -(d + 0.6) / 2); return g; }, [w, d, h]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={h / 2} material={wall}><boxGeometry args={[w, h, d]} /><Ink t={0.04} /></mesh>
      <mesh geometry={roofGeo} position-y={h} material={roof}><Ink t={0.05} /></mesh>
      <mesh position={[0, 1.1, d / 2 + 0.03]} material={door}><boxGeometry args={[2.2, 2.2, 0.08]} /><Ink t={0.02} /></mesh>
    </group>
  );
};

/** Nailed paper placard (text in the period paper style) — the "poster" beat. */
export const Placard: React.FC<Base & {text: string; sub?: string; w?: number; h?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, text, sub, w = 1.2, h = 1.5, seed = 5}) => {
  const tex = useMemo(() => signTexture(text, {style: 'paper', sub, w: 768, h: Math.round((768 * h) / w), seed}), [text, sub, w, h, seed]);
  const nail = useMemo(() => toon({color: '#3B3A40'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} /></mesh>
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y], i) => <mesh key={i} position={[x * (w / 2 - 0.07), y * (h / 2 - 0.07), 0.02]} material={nail}><sphereGeometry args={[0.035, 6, 4]} /></mesh>)}
    </group>
  );
};

// ---------------------------------------------------------------- sluice gate (stone piers, wooden gate that lifts, turning wheel)
export const SluiceGate: React.FC<Base & {open?: number; wheel?: number; width?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, open = 0, wheel = 0, width = 2.4}) => {
  const stone = useMemo(() => toon({map: stoneTiles({base: '#B9AE9C', seed, cols: 4})}), [seed]);
  const wood = useMemo(() => toon({map: woodPlanks({base: '#7A4E2A', planks: 5, seed: seed + 3, nails: true})}), [seed]);
  const iron = useMemo(() => toon({color: '#3A3B42'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (width / 2 + 0.4), 1.4, 0]} material={stone}><boxGeometry args={[0.8, 2.8, 1.2]} /><Ink t={0.03} /></mesh>)}
      <mesh position={[0, 2.95, 0]} material={stone}><boxGeometry args={[width + 1.8, 0.4, 1.3]} /><Ink t={0.03} /></mesh>
      <mesh position={[0, 0.95 + open * 1.5, 0.1]} material={wood}><boxGeometry args={[width, 1.9, 0.18]} /><Ink t={0.025} /></mesh>
      <group position={[0, 3.7, 0.2]} rotation-z={wheel}>
        <mesh material={iron}><torusGeometry args={[0.5, 0.06, 6, 20]} /><Ink t={0.012} /></mesh>
        {[0, 1, 2].map((i) => <mesh key={i} rotation-z={(i * Math.PI) / 3} material={iron}><boxGeometry args={[1.0, 0.06, 0.06]} /></mesh>)}
      </group>
      <mesh position={[0, 3.35, 0.2]} material={iron}><cylinderGeometry args={[0.05, 0.05, 0.6, 6]} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- boats
/** Rowboat (keeled hull). tilt = grounded list in radians. */
export const Rowboat: React.FC<Base & {tilt?: number; color?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, tilt = 0, color = '#6A4A9A'}) => {
  const hull = useMemo(() => { const g = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); g.scale(0.75, 0.55, 1.9); return g; }, []);
  const mat = useMemo(() => toon({map: woodPlanks({base: color, planks: 6, seed, nails: true})}), [color, seed]);
  const seat = useMemo(() => toon({color: '#C98A4E'}), []);
  return (
    <group position={pos} rotation={[rot[0], rot[1], rot[2] + tilt]} scale={scale}>
      <mesh geometry={hull} material={mat}><Ink t={0.03} /></mesh>
      {[-0.6, 0.6].map((z) => <mesh key={z} position={[0, -0.12, z]} material={seat}><boxGeometry args={[1.35, 0.06, 0.3]} /><Ink t={0.012} /></mesh>)}
      <mesh position={[0.55, 0.0, 0.2]} rotation={[0.4, 0, -0.9]} material={seat}><cylinderGeometry args={[0.03, 0.03, 2.2, 6]} /><Ink t={0.01} /></mesh>
    </group>
  );
};

/** Flat-bottomed Dutch gun barge: shallow box hull, small cannon, orange flag. */
export const GunBarge: React.FC<Base & {length?: number; flag?: string}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 2, length = 4.2, flag = '#F08A24'}) => {
  const {frame} = useStage();
  const wood = useMemo(() => toon({map: woodPlanks({base: '#9A6638', planks: 5, seed, nails: true})}), [seed]);
  const dark = useMemo(() => toon({color: '#5E3A1E'}), []);
  const iron = useMemo(() => toon({color: '#34353C'}), []);
  const flagMat = useMemo(() => toon({color: flag, side: THREE.DoubleSide}), [flag]);
  const bob = Math.sin(frame * 0.12 + seed) * 0.03;
  return (
    <group position={[pos[0], pos[1] + bob, pos[2]]} rotation={rot} scale={scale}>
      <mesh position-y={0.12} material={wood}><boxGeometry args={[1.8, 0.3, length]} /><Ink t={0.025} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.92, 0.36, 0]} material={dark}><boxGeometry args={[0.1, 0.22, length]} /><Ink t={0.012} /></mesh>)}
      <mesh position={[0, 0.5, length / 2 - 0.5]} rotation-x={Math.PI / 2 - 0.1} material={iron}><cylinderGeometry args={[0.1, 0.14, 1.0, 12]} /><Ink t={0.015} /></mesh>
      <mesh position={[0, 0.36, length / 2 - 1.0]} material={dark}><boxGeometry args={[0.45, 0.2, 0.6]} /><Ink t={0.012} /></mesh>
      <mesh position={[0, 1.3, -length / 2 + 0.4]} material={dark}><cylinderGeometry args={[0.04, 0.04, 2.2, 6]} /></mesh>
      <mesh position={[0.42, 2.1, -length / 2 + 0.4]} rotation-y={Math.sin(frame * 0.2 + seed) * 0.25} material={flagMat}><planeGeometry args={[0.8, 0.5]} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- see-through flood slice (the reveal)
/** A slab of shallow water with a visible front cut face (cross-section view): depth gradient, animated caustic light on
 *  the bed, slanted light shafts, wavy surface line with foam. Reusable for any "how deep is it" explainer. */
function causticTex() {
  return canvasTexture('caustics', 512, 512, (g, W, H) => {
    g.clearRect(0, 0, W, H); const r = rng('caustic'); g.strokeStyle = 'rgba(255,255,230,0.9)'; g.lineCap = 'round';
    for (let i = 0; i < 46; i++) { const x = r.range(0, W), y = r.range(0, H), rr = r.range(18, 46); g.lineWidth = r.range(2, 5); g.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; const px = x + Math.cos(a) * rr * r.range(0.7, 1.2), py = y + Math.sin(a) * rr * r.range(0.7, 1.2); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
  }, [1, 1]);
}
export const WaterSlab: React.FC<Base & {size?: V3; color?: string; deep?: string; opacity?: number}> = ({pos = [0, 0, 0], size = [12, 0.5, 8], color = '#6CC0DE', deep = '#2A6E9E', opacity = 0.55}) => {
  const {frame} = useStage();
  const body = useMemo(() => new THREE.MeshToonMaterial({color, transparent: true, opacity: opacity * 0.6, depthWrite: false}), [color, opacity]);
  const front = useMemo(() => new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {top: {value: new THREE.Color(color)}, bot: {value: new THREE.Color(deep)}, a: {value: opacity}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform float a; varying vec2 vUv; void main(){ vec3 c = mix(bot, top, smoothstep(0.,1.,vUv.y)) * 1.15; float edge = smoothstep(0.86, 1.0, vUv.y); gl_FragColor = vec4(mix(c, vec3(1.), edge*0.35), a*(0.75+0.25*vUv.y)); }'}), [color, deep, opacity]);
  const top = useMemo(() => new THREE.MeshToonMaterial({color: shade(color, 0.12), transparent: true, opacity: Math.min(1, opacity + 0.15), depthWrite: false, side: THREE.DoubleSide}), [color, opacity]);
  const caus = useMemo(() => { const t = causticTex().clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size[0] / 2.5, size[2] / 2.5); t.needsUpdate = true; return new THREE.MeshBasicMaterial({map: t, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending}); }, [size]);
  caus.map!.offset.set(Math.sin(frame * 0.03) * 0.05 + frame * 0.002, Math.cos(frame * 0.025) * 0.05);
  const shaft = useMemo(() => new THREE.MeshBasicMaterial({color: '#FFFBE0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}), []);
  const lineGeo = useMemo(() => new THREE.PlaneGeometry(size[0], 0.05, 96, 1), [size]);
  const base = useMemo(() => Float32Array.from(lineGeo.attributes.position.array as Float32Array), [lineGeo]);
  const p = lineGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, base[i * 3 + 1] + Math.sin(base[i * 3] * 2.2 - frame * 0.15) * 0.025 + Math.sin(base[i * 3] * 5.1 + frame * 0.1) * 0.01);
  p.needsUpdate = true;
  return (
    <group position={pos}>
      <mesh position-y={size[1] / 2} material={body} renderOrder={5} userData={{noShadow: true}}><boxGeometry args={size} /></mesh>
      <mesh position={[0, size[1] / 2, size[2] / 2 + 0.004]} material={front} renderOrder={6}><planeGeometry args={[size[0], size[1]]} /></mesh>
      <mesh position-y={0.012} rotation-x={-Math.PI / 2} material={caus} renderOrder={5}><planeGeometry args={[size[0], size[2]]} /></mesh>
      {[-0.32, -0.05, 0.22, 0.4].map((x, i) => <mesh key={i} position={[x * size[0], size[1] / 2, size[2] * 0.3 - i * 0.6]} rotation={[0, 0, 0.35]} material={shaft} renderOrder={7}><planeGeometry args={[0.3 + i * 0.1, size[1] * 1.6]} /></mesh>)}
      <mesh position-y={size[1] + 0.002} rotation-x={-Math.PI / 2} material={top} renderOrder={6} userData={{noShadow: true}}><planeGeometry args={[size[0], size[2]]} /></mesh>
      <mesh geometry={lineGeo} position={[0, size[1], size[2] / 2 + 0.01]} renderOrder={8}><meshBasicMaterial color="#FFFFFF" /></mesh>
    </group>
  );
};

/** Cut-away block of earth under the water: painted soil strata (peat, clay, sand, gravel) with pebbles, roots and a worm. */
function strataTex(seed = 6) {
  return canvasTexture(`strata:${seed}`, 1024, 512, (g, W, H) => {
    const r = rng(seed);
    const bands = [['#6B4A2E', 0.0], ['#8A5E38', 0.16], ['#B7834F', 0.38], ['#D8B47A', 0.58], ['#9C8F80', 0.8]] as const;
    for (let i = 0; i < bands.length; i++) {
      const y0 = bands[i][1] * H, y1 = (i + 1 < bands.length ? bands[i + 1][1] : 1.05) * H;
      g.fillStyle = bands[i][0]; g.beginPath(); g.moveTo(0, y0);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.012 + i * 2) * 10 + r.range(-3, 3));
      g.lineTo(W, y1 + 12); g.lineTo(0, y1 + 12); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(42,27,38,0.7)'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 32) { const y = y0 + Math.sin(x * 0.012 + i * 2) * 10; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } if (i) g.stroke();
      // speckle + horizontal sediment strokes
      for (let k = 0; k < 140; k++) { g.fillStyle = shade(bands[i][0], r.range(-0.18, 0.14)); g.fillRect(r.range(0, W), r.range(y0, y1), r.range(6, 22), 3); }
    }
    // pebbles in the sand/gravel layers (shaded, inked, highlight)
    for (let k = 0; k < 70; k++) { const x = r.range(0, W), y = r.range(0.55, 1) * H, rx = r.range(7, 20), ry = rx * r.range(0.55, 0.8); const c = r.pick(['#A79C8E', '#C9B79C', '#8A8278', '#D6CCBA']); g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, r.range(-0.4, 0.4), 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25, 0, 0, 7); g.fill(); }
    // roots hanging from the topsoil
    g.strokeStyle = '#4A3020'; g.lineCap = 'round';
    for (let k = 0; k < 14; k++) { let x = r.range(0, W), y = 4; g.lineWidth = r.range(2, 4); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += r.range(-14, 14); y += r.range(10, 22); g.lineTo(x, y); } g.stroke(); }
    // easter egg: a pink worm curled in the clay
    g.strokeStyle = '#F29AAE'; g.lineWidth = 9; g.beginPath(); const wx = W * 0.62, wy = H * 0.3; g.moveTo(wx, wy); g.bezierCurveTo(wx + 20, wy - 18, wx + 40, wy + 18, wx + 60, wy); g.bezierCurveTo(wx + 75, wy - 10, wx + 85, wy + 6, wx + 95, wy - 4); g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  }, [1, 1]);
}
export const MudBlock: React.FC<Base & {size?: V3}> = ({pos = [0, 0, 0], size = [12, 1.2, 8], seed = 6}) => {
  // cut-away faces are diagrams: self-lit (emissive = its own texture) so they read even when the sun is behind the set
  const mat = useMemo(() => { const t = strataTex(seed).clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(size[0] / 6, 1); t.needsUpdate = true; const m = toon({map: t}); m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = 0.5; return m; }, [seed, size]);
  const top = useMemo(() => toon({map: mudTex(seed, '#7A5A3A')}), [seed]);
  return (
    <group position={pos}>
      <mesh position-y={-size[1] / 2} material={mat}><boxGeometry args={size} /><Ink t={0.03} /></mesh>
      <mesh position-y={0.005} rotation-x={-Math.PI / 2} material={top}><planeGeometry args={[size[0] - 0.05, size[2] - 0.05]} /></mesh>
    </group>
  );
};

/** Big painted depth ruler post with a "KNEE-DEEP" marker at `mark` (world units above its base). glow = burst on the reveal word. */
export const DepthRuler: React.FC<Base & {height?: number; mark?: number; label?: string; glow?: number; labelX?: number; labelW?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, height = 1.4, mark = 0.26, label = 'KNEE-DEEP', glow = 0, labelX = -0.62, labelW = 0.95}) => {
  const tex = useMemo(() => canvasTexture(`ruler:${height}`, 128, 1024, (g, W, H) => {
    g.fillStyle = '#F4EFEA'; g.fillRect(0, 0, W, H); const n = Math.round(height * 10);
    for (let i = 0; i <= n; i++) { const y = H - (i * H) / n; g.fillStyle = i % 5 === 0 ? '#C0392B' : INK; g.fillRect(0, y - 3, i % 5 === 0 ? W : W * 0.45, 6); }
    g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(0, 0, W, H);
  }), [height]);
  const mat = useMemo(() => toon({map: tex}), [tex]);
  const sign = useMemo(() => signTexture(label, {style: 'painted', w: 768, h: 256, bg: '#FFD23F', color: INK}), [label]);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#FFF2A0', transparent: true, opacity: 0, depthWrite: false, toneMapped: false}), []);
  glowMat.opacity = Math.max(0, Math.min(0.55, glow * 0.55));
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={height / 2} material={mat}><boxGeometry args={[0.18, height, 0.12]} /><Ink t={0.015} /></mesh>
      {/* label sits BESIDE the post (labelX < 0 = left), small enough never to cover the subject; glow = a tight halo */}
      <mesh position={[labelX, mark + 0.22, 0.08]} scale={1 + glow * 0.12}><planeGeometry args={[labelW, labelW / 3]} /><meshBasicMaterial map={sign} transparent alphaTest={0.02} toneMapped={false} /></mesh>
      <mesh position={[labelX, mark + 0.22, 0.04]} material={glowMat} scale={1 + glow * 0.3}><circleGeometry args={[labelW * 0.42, 32]} /></mesh>
      <mesh position={[0, mark, 0.08]}><boxGeometry args={[0.34, 0.035, 0.02]} /><meshBasicMaterial color="#C0392B" /></mesh>
      <mesh position={[0.24, mark, 0.07]} rotation-z={Math.PI / 2}><coneGeometry args={[0.07, 0.16, 3]} /><meshBasicMaterial color={INK} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- camp + city backdrops
/** Striped army tent (pyramid). */
export const Tent: React.FC<Base & {a?: string; b?: string; size?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, a = '#F4EFEA', b = '#F08A24', size = 2.2}) => {
  const mat = useMemo(() => toon({map: stripeTex(a, b)}), [a, b]);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={size * 0.6} rotation-y={Math.PI / 4} material={mat}><coneGeometry args={[size, size * 1.2, 4, 1, true]} /><Ink t={0.03} /></mesh>
      <mesh position-y={size * 1.3} ><cylinderGeometry args={[0.03, 0.03, 0.6, 5]} /><meshBasicMaterial color={INK} /></mesh>
    </group>
  );
};

/** Row of Dutch gabled canal-house fronts + a church spire (distant skyline card, inked). */
export const Skyline: React.FC<Base & {count?: number; width?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 4, count = 14, width = 40}) => {
  const houses = useMemo(() => { const r = rng(seed); return Array.from({length: count}, (_, i) => ({x: -width / 2 + (i + 0.5) * (width / count), h: r.range(3.5, 6), w: width / count * 0.95, c: r.pick(['#B5553C', '#8E3B2E', '#C98A4E', '#6E4A3A', '#D9B68A', '#4F5E7A'])})); }, [seed, count, width]);
  const winTex = useMemo(() => canvasTexture('gablewin', 128, 256, (g, W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = INK; for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) { g.fillRect(20 + x * 52, 30 + y * 72, 34, 46); g.fillStyle = '#FFE7A8'; g.fillRect(24 + x * 52, 34 + y * 72, 26, 38); g.fillStyle = INK; } }), []);
  const spire = useMemo(() => toon({color: '#5A4A44'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      {houses.map((hs, i) => (
        <group key={i} position={[hs.x, 0, 0]}>
          <mesh position-y={hs.h / 2}><boxGeometry args={[hs.w, hs.h, 1.5]} /><meshToonMaterial color={hs.c} map={winTex} /><Ink t={0.05} /></mesh>
          <mesh position-y={hs.h + 0.55} rotation-z={Math.PI / 4} scale={[hs.w * 0.5, hs.w * 0.5, 1]}><boxGeometry args={[1, 1, 1.4]} /><meshToonMaterial color={shade(hs.c, -0.1)} /><Ink t={0.05} /></mesh>
        </group>
      ))}
      <mesh position={[width * 0.12, 6, -0.5]} material={spire}><boxGeometry args={[2, 12, 2]} /><Ink t={0.06} /></mesh>
      <mesh position={[width * 0.12, 14.5, -0.5]} material={spire}><coneGeometry args={[1.4, 5, 8]} /><Ink t={0.05} /></mesh>
    </group>
  );
};

/** Hand pump (wooden post, iron spout, handle angle `pump` in radians). */
export const HandPump: React.FC<Base & {pump?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, pump = 0}) => {
  const wood = useMemo(() => toon({map: woodPlanks({base: '#6E4A2E', planks: 2, seed: 8, vertical: true})}), []);
  const iron = useMemo(() => toon({color: '#3A3B42'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={0.6} material={wood}><boxGeometry args={[0.3, 1.2, 0.3]} /><Ink t={0.015} /></mesh>
      <mesh position={[0, 0.95, 0.28]} rotation-x={Math.PI / 2.4} material={iron}><cylinderGeometry args={[0.05, 0.07, 0.4, 8]} /><Ink t={0.01} /></mesh>
      <group position={[0, 1.25, 0]} rotation-z={pump}><mesh position={[0.45, 0, 0]} material={iron}><boxGeometry args={[0.9, 0.06, 0.06]} /><Ink t={0.01} /></mesh></group>
    </group>
  );
};

/** Simple toon cow (Holstein patches) — easter-egg life on the farm. */
export const Cow: React.FC<Base & {graze?: number}> = ({pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, seed = 1, graze = 0}) => {
  const tex = useMemo(() => canvasTexture(`cow:${seed}`, 256, 256, (g, W, H) => { const r = rng(seed); g.fillStyle = '#F4EFEA'; g.fillRect(0, 0, W, H); g.fillStyle = INK; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(18, 40), r.range(14, 30), r.next() * 3, 0, 7); g.fill(); } }), [seed]);
  const body = useMemo(() => toon({map: tex}), [tex]);
  const pink = useMemo(() => toon({color: '#F2A8B8'}), []);
  const dark = useMemo(() => toon({color: '#2A1B26'}), []);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <mesh position-y={0.85} scale={[0.55, 0.5, 0.95]} material={body}><sphereGeometry args={[1, 12, 8]} /><Ink t={0.04} /></mesh>
      <group position={[0, 1.0 - graze * 0.45, 0.95]} rotation-x={graze * 0.6}>
        <mesh scale={[0.32, 0.3, 0.38]} material={body}><sphereGeometry args={[1, 10, 8]} /><Ink t={0.03} /></mesh>
        <mesh position={[0, -0.12, 0.3]} scale={[0.22, 0.16, 0.12]} material={pink}><sphereGeometry args={[1, 8, 6]} /><Ink t={0.02} /></mesh>
      </group>
      {[[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]].map(([x, z], i) => <mesh key={i} position={[x, 0.3, z]} material={dark}><cylinderGeometry args={[0.07, 0.07, 0.6, 6]} /></mesh>)}
    </group>
  );
};

/** Bubbles rising out of water (ambient motion in the cross-section). */
export const Bubbles: React.FC<{center?: V3; size?: V3; count?: number; seed?: number}> = ({center = [0, 0.3, 0], size = [6, 0.5, 2], count = 18, seed = 7}) => {
  const {frame} = useStage();
  const r = useMemo(() => rng(seed), [seed]);
  const pts = useMemo(() => Array.from({length: count}, () => [r.range(-0.5, 0.5), r.next(), r.range(-0.5, 0.5), r.range(0.02, 0.05), r.range(0.4, 1)]), [r, count]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({color: '#E8F8FF', transparent: true, opacity: 0.85, depthWrite: false}), []);
  return (<group position={center}>{pts.map((p, i) => { const y = ((p[1] + frame * 0.006 * p[4]) % 1) * size[1]; return <mesh key={i} position={[p[0] * size[0], y, p[2] * size[2]]} material={mat} renderOrder={8}><sphereGeometry args={[p[3], 6, 4]} /></mesh>; })}</group>);
};
