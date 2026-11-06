/* Shot-tower props: lantern-lit shaft CUT-AWAY (rock strata + brick-lined shaft + water basin), perforated sieve,
 * falling LEAD DROPS (hot glow -> silver, lumpy -> sphere, ripples where they land), the HERO DROP that snaps from a
 * lumpy blob into a perfect sphere (surface tension), tension arrows, depth ruler.
 * First used by Projects/02_shot-tower. Generic for any vertical cut-away / falling-liquid / molten-metal story.
 * Every mesh toon-lit + plum ink (style-bible §3.1). Pure functions of the frame: deterministic. */
import * as THREE from 'three';
import React, {useMemo} from 'react';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {Ink, Lantern} from './basic';
import {WaterSlab} from './dutch';
import {toon} from '../materials';
import {inkHullMaterial} from '../ink';
import {useStage} from '../Stage';
import {canvasTexture, woodPlanks, bricks, signTexture, radial, shade, INK} from '../textures/canvas';
import {rng} from '../random';

type V3 = [number, number, number];
type Base = {pos?: V3; rot?: V3; scale?: number | V3; seed?: number};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- textures
/** Sandstone cut-face: warm ochre/rust layers running across (depth bands), inked seams, speckle, pebbles. */
function sandstoneTex(seed = 3) {
  return canvasTexture(`sandstone:${seed}`, 512, 1024, (g, W, H) => {
    const r = rng(seed);
    const bands = ['#D9A066', '#C98A52', '#E2B27A', '#B97A47', '#D49A5E', '#C07E4C', '#E0AC72'];
    let y = 0; let i = 0;
    while (y < H) {
      const h = r.range(60, 130); const c = bands[i++ % bands.length];
      g.fillStyle = c; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 7);
      g.lineTo(W, y + h + 8); g.lineTo(0, y + h + 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(42,27,38,0.75)'; g.lineWidth = 5; g.beginPath();
      for (let x = 0; x <= W; x += 32) { const yy = y + Math.sin(x * 0.02 + i) * 7; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke();
      for (let k = 0; k < 70; k++) { g.fillStyle = shade(c, r.range(-0.2, 0.14)); g.fillRect(r.range(0, W), y + r.range(4, h), r.range(8, 26), 3); }
      y += h;
    }
    for (let k = 0; k < 40; k++) { const x = r.range(0, W), yy = r.range(0, H), rx = r.range(7, 17); g.fillStyle = r.pick(['#BFA98C', '#9A8470', '#D8C7A8']); g.beginPath(); g.ellipse(x, yy, rx, rx * 0.65, r.range(-0.4, 0.4), 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - rx * 0.3, yy - rx * 0.25, rx * 0.35, rx * 0.2, 0, 0, 7); g.fill(); }
  }, [1, 1]);
}
/** Painted depth ruler strip: ticks every unit, big red tick + FT label every `labelEvery`. `top` label at the top. */
function rulerTex(units: number, labelEvery: number, ftPerUnit: number) {
  return canvasTexture(`shaftruler:${units}:${labelEvery}:${ftPerUnit}`, 256, 1024, (g, W, H) => {
    g.fillStyle = '#F4EFEA'; g.fillRect(0, 0, W, H);
    g.fillStyle = INK; g.font = 'bold 40px "Archivo Black", Arial Black, sans-serif'; g.textAlign = 'left';
    for (let i = 0; i <= units; i++) {
      const y = (i / units) * H; const big = i % labelEvery === 0;
      g.fillStyle = big ? '#C0392B' : INK; g.fillRect(0, y - (big ? 5 : 3), big ? W * 0.62 : W * 0.34, big ? 10 : 6);
      if (big && i > 0 && i < units) { g.fillStyle = INK; g.fillText(String(Math.round(i * ftPerUnit)), W * 0.5, y + 34); }
    }
    g.strokeStyle = INK; g.lineWidth = 12; g.strokeRect(0, 0, W, H);
  });
}

// ---------------------------------------------------------------- shaft cut-away
export type ShaftProps = Base & {
  /** total height of the shaft (floor y=0 .. deck y=h) */ h?: number;
  /** half-width / half-depth of the upper shaft */ hw?: number; hd?: number;
  /** half-width of the bottom chamber, and its height */ chamberHw?: number; chamberH?: number;
  /** water surface y in the basin and basin half-width */ poolY?: number; poolHw?: number;
  ftPerUnit?: number;
  /** y of the top of a plank scaffold ledge jutting out of the right shaft wall (a character can stand beside the falling drops) */
  ledge?: number;
};
export const SHAFT_DEFAULTS = {h: 9, hw: 1.5, hd: 1.4, chamberHw: 4.4, chamberH: 2.2, poolY: 0.8, poolHw: 1.9, ftPerUnit: 10};

export const ShaftCutaway: React.FC<ShaftProps> = ({pos = [0, 0, 0], rot = [0, 0, 0], h = SHAFT_DEFAULTS.h, hw = SHAFT_DEFAULTS.hw, hd = SHAFT_DEFAULTS.hd,
  chamberHw = SHAFT_DEFAULTS.chamberHw, chamberH = SHAFT_DEFAULTS.chamberH, poolY = SHAFT_DEFAULTS.poolY, poolHw = SHAFT_DEFAULTS.poolHw, ftPerUnit = SHAFT_DEFAULTS.ftPerUnit, ledge, seed = 3}) => {
  const {frame} = useStage();
  const rock = useMemo(() => { const t = sandstoneTex(seed).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; const m = toon({map: t}); m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = 0.45; return m; }, [seed]);
  const brick = useMemo(() => { const t = bricks({base: '#6F7C98', mortar: '#A9B2C6', rows: 18, seed: 4}, [3, 5]).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 5); t.needsUpdate = true; const m = toon({map: t}); m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = 0.1; return m; }, []);
  const plank = useMemo(() => toon({map: woodPlanks({base: '#A8703E', planks: 7, seed: 6}, [2, 1])}), []);
  const stone = useMemo(() => toon({color: '#9AA3B4'}), []);
  const ruler = useMemo(() => toon({map: rulerTex(Math.round(h), 2, ftPerUnit)}), [h, ftPerUnit]);
  const W = 7;                    // rock extends this far sideways of the shaft
  const D = hd * 2;
  const upH = h - chamberH;
  const box = (w: number, hh: number, d: number, x: number, y: number, z: number, m: THREE.Material, ink = 0.03, key?: string) => (
    <mesh key={key} position={[x, y, z]} material={m}><boxGeometry args={[w, hh, d]} /><Ink t={ink} /></mesh>);
  const poolMid = (chamberHw + poolHw) / 2; void poolMid;
  return (
    <group position={pos} rotation={rot}>
      {/* back wall: brick-lined shaft, full height + the tower above */}
      <mesh position={[0, (h + 5) / 2, -hd - 0.05]} material={brick}><boxGeometry args={[W * 2 + chamberHw * 0, h + 5, 0.1]} /><Ink t={0.03} /></mesh>
      {/* upper rock walls (left / right of the shaft) */}
      {box(W - hw, upH, D, -(hw + (W - hw) / 2), chamberH + upH / 2, 0, rock, 0.03, 'ul')}
      {box(W - hw, upH, D, hw + (W - hw) / 2, chamberH + upH / 2, 0, rock, 0.03, 'ur')}
      {/* bottom chamber walls */}
      {box(W - chamberHw, chamberH, D, -(chamberHw + (W - chamberHw) / 2), chamberH / 2, 0, rock, 0.03, 'll')}
      {box(W - chamberHw, chamberH, D, chamberHw + (W - chamberHw) / 2, chamberH / 2, 0, rock, 0.03, 'lr')}
      {/* floor of the chamber */}
      {box(chamberHw * 2, 0.3, D, 0, -0.15, 0, stone, 0.03, 'fl')}
      {/* ceiling lip where the shaft opens into the chamber (left / right overhang) */}
      {box(chamberHw - hw, 0.3, D, -(hw + (chamberHw - hw) / 2), chamberH - 0.15, 0, stone, 0.03, 'cl')}
      {box(chamberHw - hw, 0.3, D, hw + (chamberHw - hw) / 2, chamberH - 0.15, 0, stone, 0.03, 'cr')}
      {/* plank deck on top of both rock walls */}
      {box(W - hw, 0.18, D, -(hw + (W - hw) / 2), h + 0.09, 0, plank, 0.025, 'dl')}
      {box(W - hw, 0.18, D, hw + (W - hw) / 2, h + 0.09, 0, plank, 0.025, 'dr')}
      {/* stone basin: back + side walls, water inside (front is open glass: cut-away) */}
      {box(0.22, poolY + 0.2, D - 0.2, -poolHw - 0.11, (poolY + 0.2) / 2, 0, stone, 0.02, 'bl')}
      {box(0.22, poolY + 0.2, D - 0.2, poolHw + 0.11, (poolY + 0.2) / 2, 0, stone, 0.02, 'br')}
      <WaterSlab pos={[0, 0.02, 0]} size={[poolHw * 2, poolY - 0.02, D - 0.2]} color="#7FD0EE" deep="#1F5E9A" opacity={0.7} />
      {/* depth ruler painted on the inside of the left shaft wall (faces the camera on the cut line) */}
      <mesh position={[-hw + 0.001, chamberH + upH / 2, hd - 0.02]} material={ruler}><boxGeometry args={[0.34, upH, 0.05]} /><Ink t={0.012} /></mesh>
      {/* "90 FT" painted plaque (the drop), hanging on the back wall */}
      <mesh position={[hw - 0.62, chamberH + 0.55, -hd + 0.02]}><planeGeometry args={[1.0, 0.34]} /><meshBasicMaterial map={signTexture('90 FT', {style: 'painted', w: 512, h: 170, bg: '#FFD23F', color: INK})} transparent alphaTest={0.02} toneMapped={false} /></mesh>
      {ledge !== undefined && (<>
        {box(0.75, 0.14, D - 0.1, hw - 0.375, ledge - 0.07, 0, plank, 0.02, 'ledge')}
        {[-0.5, 0.5].map((z, i) => <mesh key={'br' + i} position={[hw - 0.4, ledge - 0.42, z]} rotation-z={0.9} material={toon({color: '#3A3F4C'})}><boxGeometry args={[0.7, 0.07, 0.07]} /><Ink t={0.012} /></mesh>)}
      </>)}
      {/* iron cross-beams holding the sieve */}
      <mesh position={[0, h - 0.34, 0]} material={toon({color: '#3A3F4C'})}><boxGeometry args={[hw * 2, 0.12, 0.16]} /><Ink t={0.02} /></mesh>
      <mesh position={[0, h - 0.34, 0]} material={toon({color: '#3A3F4C'})}><boxGeometry args={[0.16, 0.12, hd * 2 - 0.1]} /><Ink t={0.02} /></mesh>
      {/* lantern pools of warm light down the right-hand wall (bright mid-tones in a blue shaft) */}
      {[h - 2.2, h * 0.5, chamberH + 0.4].map((y, i) => <Lantern key={i} pos={[hw - 0.28, y + 0.55, -hd + 0.45]} seed={seed + i} color={i === 1 ? '#FFD28A' : '#FFC46B'} swing={0.05} />)}
      <Sparkles frame={frame} h={h} hw={hw} hd={hd} />
    </group>
  );
};

/** Drifting pale motes inside the shaft (ambient motion + volume). */
const Sparkles: React.FC<{frame: number; h: number; hw: number; hd: number}> = ({frame, h, hw, hd}) => {
  const tex = useMemo(() => radial('#CFE6FF', 'shaftmote'), []);
  const pts = useMemo(() => { const r = rng('shaftmotes'); return Array.from({length: 38}, () => ({x: r.range(-hw, hw), y: r.range(0, h), z: r.range(-hd, hd), s: r.range(0.04, 0.1), v: r.range(0.002, 0.008), ph: r.next() * 6})); }, [h, hw, hd]);
  return (<group>{pts.map((p, i) => (
    <sprite key={i} position={[p.x + Math.sin(frame * 0.02 + p.ph) * 0.15, ((p.y + frame * p.v) % h), p.z]} scale={[p.s, p.s, 1]}>
      <spriteMaterial map={tex} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>))}</group>);
};

// ---------------------------------------------------------------- sieve (perforated pan with a glowing sheet of molten lead)
export const Sieve: React.FC<Base & {radius?: number; holes?: number; glow?: number; pour?: [number, number]}> = ({pos = [0, 0, 0], radius = 0.8, holes = 7, glow = 1, pour = [-1e9, 1e9], seed = 1}) => {
  const {frame} = useStage();
  const tex = useMemo(() => canvasTexture(`sieve:${holes}`, 512, 512, (g, W) => {
    g.fillStyle = '#4A505E'; g.fillRect(0, 0, W, W);
    g.fillStyle = '#1B1A24';
    for (let i = 0; i < holes; i++) for (let j = 0; j < holes; j++) { const x = ((i + 0.5) / holes) * W, y = ((j + 0.5) / holes) * W; g.beginPath(); g.arc(x, y, W / holes / 4, 0, 7); g.fill(); g.strokeStyle = '#FFB866'; g.lineWidth = 3; g.stroke(); }
  }), [holes]);
  const lead = glow * (frame >= pour[0] && frame <= pour[1] ? 1 : 0.35);
  const pulse = 1.1 + 0.2 * Math.sin(frame * 0.35 + seed);
  return (
    <group position={pos}>
      <mesh material={toon({map: tex})}><cylinderGeometry args={[radius, radius * 0.9, 0.1, 40]} /><Ink t={0.02} /></mesh>
      <mesh position-y={0.062} rotation-x={-Math.PI / 2}><circleGeometry args={[radius * 0.86, 40]} /><meshBasicMaterial color={new THREE.Color('#FF7A24').multiplyScalar(pulse * lead * 1.8 + 0.2)} toneMapped={false} transparent opacity={0.55 * lead + 0.2} /></mesh>
      <pointLight position-y={-0.3} color="#FF9040" intensity={3.2 * lead} distance={4} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------- falling lead drops
const dropGeo = new THREE.SphereGeometry(1, 14, 10);
const HOT = new THREE.Color('#FF5A10'), HOT2 = new THREE.Color('#FF9A3A'), SILVER = new THREE.Color('#D5E0F2'), SILVER_EM = new THREE.Color('#2E4A80');

export type DropsProps = {
  /** centre of the sieve (where drops are born) and the water surface y where they land */
  from: V3; poolY: number; area?: [number, number];
  count?: number; period?: number;          // frames for one full fall (u = age / period); count drops evenly staggered
  on?: [number, number];                    // frames the stream runs
  radius?: number; lumpUntil?: number;      // fall fraction u by which a drop has become a sphere (default 0.5)
  coolAt?: number;                          // fall fraction u by which it has cooled from glowing to silver (default 0.7)
  seed?: number;
};
/** Stream of silver lead drops: born glowing + lumpy at the sieve, round and silver by the time they hit the water, with
 *  a ripple ring + tiny splash crown where each lands. u = fall fraction: y = from.y - (from.y - poolY) * u² (gravity). */
export const LeadDrops: React.FC<DropsProps> = ({from, poolY, area = [1.3, 1.1], count = 22, period = 56, on = [-1e9, 1e9], radius = 0.1, lumpUntil = 0.62, coolAt = 0.5, seed = 5}) => {
  const {frame} = useStage();
  const cfg = useMemo(() => { const r = rng(seed); return Array.from({length: count}, (_, i) => ({off: (i * period) / count + r.range(0, 1.5), x: r.range(-0.5, 0.5), z: r.range(-0.5, 0.5), ph: r.next() * 6, k: r.range(0.85, 1.15)})); }, [count, period, seed]);
  const mats = useMemo(() => cfg.map(() => new THREE.MeshToonMaterial({color: '#E6EDF7', emissive: '#FF5A10', emissiveIntensity: 1, gradientMap: (toon().gradientMap)})), [cfg]);
  const ringMats = useMemo(() => cfg.map(() => new THREE.MeshBasicMaterial({color: '#EAF8FF', transparent: true, depthWrite: false, side: THREE.DoubleSide})), [cfg]);
  const glintMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#FFFFFF', toneMapped: false}), []);
  const splashMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#EAF8FF'}), []);
  const fall = from[1] - poolY;
  if (frame < on[0]) return null;
  return (
    <group>
      {cfg.map((c, i) => {
        const t = frame - on[0] + c.off; const age = ((t % period) + period) % period; const u = age / period;
        if (frame > on[1] + period) return null;
        const y = from[1] - fall * u * u; const x = from[0] + c.x * area[0], z = from[2] + c.z * area[1];
        const lump = 1 - smooth(0.08, lumpUntil, u); const cool = smooth(0.15, coolAt, u);
        const wob = lump * 0.6;
        const sx = 1 + wob * Math.sin(age * 0.7 + c.ph), sy = 1 + wob * Math.sin(age * 0.53 + c.ph * 2) + 0.35 * u, sz = 1 + wob * Math.cos(age * 0.61 + c.ph);
        const m = mats[i]; m.color.copy(HOT2).lerp(SILVER, cool); m.emissive.copy(HOT).lerp(SILVER_EM, cool); m.emissiveIntensity = 0.95 - 0.7 * cool;
        const r = radius * c.k;
        // ripple + splash: the drop re-spawns at age 0 = it just landed (age counts frames since landing for the ring)
        const landed = t >= period; const rt = age; const ring = rt < 22 ? rt / 22 : 1;
        const rm = ringMats[i]; rm.opacity = 0.9 * (1 - ring);
        return (
          <group key={i}>
            <group position={[x, y, z]} scale={[r * sx, r * sy, r * sz]}>
              <mesh geometry={dropGeo} material={m} />
              <mesh geometry={dropGeo} material={inkHullMaterial(0.16)} />
              <mesh geometry={dropGeo} material={glintMat} position={[-0.35, 0.4, 0.62]} scale={[0.26, 0.2, 0.12]} />
            </group>
            {landed && rt < 22 && (
              <group position={[x, poolY + 0.012, z]}>
                <mesh rotation-x={-Math.PI / 2} scale={0.06 + ring * 0.46} material={rm} renderOrder={9}><ringGeometry args={[0.8, 1, 28]} /></mesh>
                {rt < 8 && [0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 + c.ph; const rr = 0.04 + rt * 0.012; return <mesh key={k} position={[Math.cos(a) * rr, rt * 0.045 - rt * rt * 0.0045, Math.sin(a) * rr]} scale={0.018} geometry={dropGeo} material={splashMat} />; })}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- the hero drop: lumpy blob -> perfect sphere (surface tension)
const heroBase = (() => { const g = new THREE.IcosahedronGeometry(1, 4); g.deleteAttribute('normal'); g.deleteAttribute('uv'); return mergeVertices(g, 1e-4); })();
export type HeroDropProps = {
  at: (f: number) => V3; radius?: number;
  /** frame the drop snaps into a sphere (spring overshoot ~10 f), and the frame it has cooled from glowing orange to silver */
  snap: number; cool?: number; coolLen?: number;
  /** frames the tension arrows show (they pinch inward, then vanish at the snap) */
  arrows?: [number, number]; seed?: number;
};
export const HeroDrop: React.FC<HeroDropProps> = ({at, radius = 0.34, snap, cool = snap + 40, coolLen = 12, arrows = [snap - 56, snap], seed = 2}) => {
  const {frame} = useStage();
  const geo = useMemo(() => heroBase.clone(), []);
  const dirs = useMemo(() => { const p = heroBase.attributes.position as THREE.BufferAttribute; return Array.from({length: p.count}, (_, i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize()); }, []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color: '#FFD070', emissive: '#FF5A10', emissiveIntensity: 1, gradientMap: toon().gradientMap}), []);
  const spark = useMemo(() => radial('#FFFFFF', 'herospark'), []);
  const pos = at(frame);
  const since = frame - snap;
  const tt = clamp01(since / 14);
  const m = since < 0 ? 0 : 1 - Math.exp(-5 * tt) * Math.cos(11 * tt);       // spring: 0 -> 1 with overshoot
  const buildUp = smooth(arrows[0], snap, frame);                               // lump grows more extreme as tension builds
  const amp = (0.34 + 0.22 * buildUp) * (1 - clamp01(m));
  const ph = frame * 0.23 + seed;
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const n = Math.sin(d.x * 3.1 + ph) * Math.sin(d.y * 2.7 - ph * 0.8) + 0.7 * Math.sin(d.z * 4.3 + ph * 1.3 + d.x * 2) + 0.5 * Math.sin((d.x + d.y) * 5.2 - ph * 1.7);
    const rr = 1 + amp * n * 0.55 + (since >= 0 ? 0.06 * Math.sin(since * 1.2) * (1 - tt) : 0);
    p.setXYZ(i, d.x * rr, d.y * rr * (1 + 0.08 * (1 - m)), d.z * rr);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  const cl = smooth(cool, cool + coolLen, frame);
  mat.color.copy(HOT2).lerp(SILVER, Math.max(cl, smooth(snap, snap + 14, frame) * 0.35)); mat.emissive.copy(HOT).lerp(SILVER_EM, cl); mat.emissiveIntensity = 1.0 - 0.75 * cl;
  const showArrows = frame >= arrows[0] && frame < arrows[1] + 3;
  const pinch = 1.9 - 0.9 * smooth(arrows[0], arrows[1], frame) + 0.08 * Math.sin(frame * 0.8);
  // snap flash + starburst
  const fl = since >= 0 && since < 16 ? 1 - since / 16 : 0;
  const glintM = useMemo(() => new THREE.MeshBasicMaterial({color: '#FFFFFF', toneMapped: false}), []);
  const glint = smooth(snap + 4, snap + 12, frame);
  const rays = useMemo(() => Array.from({length: 10}, (_, k) => k), []);
  return (
    <group position={pos}>
      <group scale={radius}>
        <mesh geometry={geo} material={mat} />
        <mesh geometry={geo} material={inkHullMaterial(0.07)} />
        <mesh geometry={heroBase} material={glintM} position={[-0.38, 0.42, 0.7]} scale={[0.3 * glint, 0.2 * glint, 0.1 * glint]} />
      </group>
      {showArrows && ARROW_DIRS.map((d, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().multiplyScalar(-1));
        const fade = 1 - smooth(arrows[1] - 4, arrows[1] + 3, frame);
        return (
          <group key={i} position={d.clone().multiplyScalar(radius * pinch * 1.35)} quaternion={q} scale={fade}>
            <mesh position-y={-radius * 0.22}><cylinderGeometry args={[radius * 0.05, radius * 0.05, radius * 0.5, 8]} /><meshBasicMaterial color="#8FE0FF" toneMapped={false} /><Ink t={0.01} /></mesh>
            <mesh position-y={radius * 0.12}><coneGeometry args={[radius * 0.15, radius * 0.3, 10]} /><meshBasicMaterial color="#8FE0FF" toneMapped={false} /><Ink t={0.01} /></mesh>
          </group>);
      })}
      {fl > 0 && (<>
        <sprite scale={[radius * (3 + 5 * (1 - fl)), radius * (3 + 5 * (1 - fl)), 1]}><spriteMaterial map={spark} transparent opacity={fl} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        {rays.map((k) => { const a = (k / 10) * Math.PI * 2; const rr = radius * (1.2 + (1 - fl) * 3.2); return <mesh key={k} position={[Math.cos(a) * rr, Math.sin(a) * rr, 0.1]} rotation-z={a - Math.PI / 2} scale={[radius * 0.1 * fl, radius * 0.55 * fl, 1]}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={fl} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>; })}
      </>)}
    </group>
  );
};
const ARROW_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0.7, 0.7, 0.4], [-0.7, 0.7, 0.4], [0.7, -0.7, 0.4], [-0.7, -0.7, 0.4]].map((v) => new THREE.Vector3(...(v as V3)).normalize());

/** Hoist rope with a wooden bucket hanging in the shaft (foreground element that sways; blurred by DOF when near the lens). */
export const HoistRope: React.FC<Base & {length?: number; sway?: number}> = ({pos = [0, 0, 0], length = 6, sway = 0.05, seed = 1}) => {
  const {frame} = useStage();
  const rope = useMemo(() => toon({color: '#C9A46A'}), []);
  const wood = useMemo(() => toon({color: '#8A5A30'}), []);
  return (
    <group position={pos} rotation-z={Math.sin(frame * 0.05 + seed) * sway}>
      <mesh position-y={-length / 2} material={rope}><cylinderGeometry args={[0.035, 0.035, length, 8]} /><Ink t={0.012} /></mesh>
      <group position-y={-length - 0.22}>
        <mesh material={wood}><cylinderGeometry args={[0.3, 0.24, 0.44, 16]} /><Ink t={0.02} /></mesh>
        <mesh position-y={0.24} rotation-x={Math.PI / 2} material={toon({color: '#3A3F4C'})}><torusGeometry args={[0.3, 0.02, 6, 20]} /><Ink t={0.01} /></mesh>
      </group>
    </group>
  );
};
