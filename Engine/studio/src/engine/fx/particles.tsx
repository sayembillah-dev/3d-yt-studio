import * as THREE from 'three';
import React, {useMemo} from 'react';
import {useStage} from '../Stage';
import {rng, fbm1} from '../random';
import {radial, canvasTexture, INK} from '../textures/canvas';

type V3 = [number, number, number];

/** Floating dust / pollen motes catching the light — near-camera depth cue, always moving. */
export const Motes: React.FC<{center?: V3; size?: V3; count?: number; color?: string; seed?: number; scale?: number}> = ({center = [0, 2, 0], size = [10, 4, 10], count = 60, color = '#FFF4D0', seed = 1, scale = 0.06}) => {
  const {frame} = useStage();
  const base = useMemo(() => { const r = rng(seed); return Array.from({length: count}, () => [r.range(-0.5, 0.5), r.range(-0.5, 0.5), r.range(-0.5, 0.5), r.range(0.5, 1.5), r.next() * 100] as const); }, [count, seed]);
  const tex = useMemo(() => radial(color, 'mote:' + color), [color]);
  return (<group position={center}>{base.map(([x, y, z, s, ph], i) => (
    <sprite key={i} position={[x * size[0] + fbm1(frame / 90 + ph, i) * 0.6, y * size[1] + Math.sin(frame * 0.02 + ph) * 0.25, z * size[2] + fbm1(frame / 100 + ph, i + 7) * 0.6]} scale={[scale * s, scale * s, 1]}>
      <spriteMaterial map={tex} transparent opacity={0.55 + 0.35 * Math.sin(frame * 0.1 + ph)} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>))}</group>);
};

const gullTex = () => canvasTexture('gull', 256, 128, (g, W, H) => { g.strokeStyle = INK; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(16, H * 0.55); g.quadraticCurveTo(W * 0.28, H * 0.15, W / 2, H * 0.6); g.quadraticCurveTo(W * 0.72, H * 0.15, W - 16, H * 0.55); g.stroke(); });
const gullTex2 = () => canvasTexture('gull2', 256, 128, (g, W, H) => { g.strokeStyle = INK; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(20, H * 0.25); g.quadraticCurveTo(W * 0.3, H * 0.8, W / 2, H * 0.55); g.quadraticCurveTo(W * 0.7, H * 0.8, W - 20, H * 0.25); g.stroke(); });

/** Flock of ink-line seagulls circling far away (sky ambient motion). */
export const Gulls: React.FC<{center?: V3; radius?: number; count?: number; seed?: number; scale?: number}> = ({center = [0, 25, -60], radius = 14, count = 5, seed = 2, scale = 1.6}) => {
  const {frame} = useStage();
  const birds = useMemo(() => { const r = rng(seed); return Array.from({length: count}, () => ({ph: r.next() * Math.PI * 2, rr: radius * r.range(0.6, 1.2), h: r.range(-3, 3), sp: r.range(0.006, 0.012), flap: r.range(0.25, 0.4)})); }, [count, seed, radius]);
  const a = useMemo(gullTex, []), b = useMemo(gullTex2, []);
  return (<group position={center}>{birds.map((bd, i) => {
    const t = frame * bd.sp + bd.ph; const up = Math.sin(frame * bd.flap + i) > 0;
    return <sprite key={i} position={[Math.cos(t) * bd.rr, bd.h + Math.sin(t * 2) * 1.2, Math.sin(t) * bd.rr * 0.4]} scale={[scale, scale / 2, 1]}><spriteMaterial map={up ? a : b} transparent depthWrite={false} /></sprite>;
  })}</group>);
};

/** Rising embers / sparks (fire, forge, cannon). */
export const Embers: React.FC<{pos?: V3; count?: number; spread?: number; rise?: number; color?: string; seed?: number}> = ({pos = [0, 0, 0], count = 30, spread = 1, rise = 3, color = '#FFB040', seed = 3}) => {
  const {frame} = useStage();
  const ps = useMemo(() => { const r = rng(seed); return Array.from({length: count}, () => ({x: r.range(-1, 1), z: r.range(-1, 1), life: r.range(30, 70), off: r.range(0, 70), s: r.range(0.03, 0.08)})); }, [count, seed]);
  const tex = useMemo(() => radial(color, 'ember:' + color), [color]);
  return (<group position={pos}>{ps.map((p, i) => { const t = ((frame + p.off) % p.life) / p.life; return (
    <sprite key={i} position={[p.x * spread + Math.sin(t * 6 + i) * 0.2, t * rise, p.z * spread]} scale={[p.s * (1 - t * 0.6), p.s * (1 - t * 0.6), 1]}>
      <spriteMaterial map={tex} color={new THREE.Color(color).multiplyScalar(2)} transparent opacity={1 - t} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>); })}</group>);
};

const puffTex = () => canvasTexture('puff', 256, 256, (g, W) => { const r = rng(5); g.fillStyle = '#FFFFFF'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(W / 2 + r.range(-45, 45), W / 2 + r.range(-35, 35), r.range(45, 75), 0, 7); g.fill(); } });
/** Cartoon smoke puffs (chimney, cannon, steam): grow, rise, fade. */
export const SmokePuffs: React.FC<{pos?: V3; count?: number; rate?: number; color?: string; rise?: number; size?: number; drift?: V3; seed?: number; start?: number}> = ({pos = [0, 0, 0], count = 8, rate = 10, color = '#EDEDED', rise = 3, size = 1, drift = [0.4, 0, 0], seed = 4, start = -9999}) => {
  const {frame} = useStage();
  const tex = useMemo(puffTex, []);
  const life = count * rate;
  return (<group position={pos}>{Array.from({length: count}, (_, i) => {
    const age = (frame - start + i * rate) % life; if (frame < start || age < 0) return null; const t = age / life;
    return <sprite key={i} position={[drift[0] * t * rise + Math.sin(i * 2.1) * 0.15, t * rise, drift[2] * t * rise]} scale={[size * (0.4 + t * 1.4), size * (0.4 + t * 1.4), 1]}>
      <spriteMaterial map={tex} color={color} transparent opacity={(1 - t) * 0.9} depthWrite={false} />
    </sprite>;
  })}</group>);
};

/** Waving cloth flag (vertex-animated plane). */
export const Flag: React.FC<{pos?: V3; w?: number; h?: number; map?: THREE.Texture; color?: string; seed?: number}> = ({pos = [0, 0, 0], w = 1.6, h = 1, map, color = '#1E1612', seed = 1}) => {
  const {frame} = useStage();
  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, 16, 6), [w, h]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = base[i * 3] + w / 2; const k = x / w; p.setZ(i, Math.sin(x * 3 - frame * 0.25 + seed) * 0.12 * k + Math.sin(x * 7 - frame * 0.4) * 0.03 * k); p.setY(i, base[i * 3 + 1] - k * k * 0.08); }
  p.needsUpdate = true; geo.computeVertexNormals();
  return <mesh geometry={geo} position={[pos[0] + w / 2, pos[1], pos[2]]}><meshToonMaterial map={map ?? null} color={color} side={THREE.DoubleSide} /></mesh>;
};
