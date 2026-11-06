import * as THREE from 'three';
import {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {Mood} from '../moods';
import {canvasTexture, radial} from '../textures/canvas';
import {rng} from '../random';
import {toonRamp} from '../materials';

/** Gradient sky dome + sun/moon disc with glow + stars. */
export const SkyDome: React.FC<{mood: Mood; radius?: number}> = ({mood, radius = 900}) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {top: {value: new THREE.Color(mood.skyTop)}, mid: {value: new THREE.Color(mood.skyMid)}, hor: {value: new THREE.Color(mood.skyHorizon)}},
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
      void main(){ float h = clamp(vP.y,-0.2,1.); vec3 c = h<0.18 ? mix(hor, mid, smoothstep(-0.05,0.18,h)) : mix(mid, top, smoothstep(0.18,0.85,h));
      gl_FragColor = vec4(c,1.); }`,
  }), [mood]);
  const sd = mood.sunDisc;
  const glow = useMemo(() => radial(sd ? sd.color : '#fff', 'sunglow'), [sd]);
  const sunPos = useMemo(() => sd ? new THREE.Vector3(...sd.dir).normalize().multiplyScalar(radius * 0.9) : null, [sd, radius]);
  const stars = useMemo(() => {
    if (!mood.stars) return null;
    const r = rng('stars'); const pts: number[] = [];
    for (let i = 0; i < 700; i++) { const th = r.range(0, Math.PI * 2), y = r.range(0.15, 1); const rr = Math.sqrt(1 - y * y); pts.push(Math.cos(th) * rr * radius * 0.95, y * radius * 0.95, Math.sin(th) * rr * radius * 0.95); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
  }, [mood.stars, radius]);
  const f = useCurrentFrame();
  return (
    <group>
      <mesh material={mat} renderOrder={-10}><sphereGeometry args={[radius, 48, 24]} /></mesh>
      {stars && <points geometry={stars}><pointsMaterial color="#FFFFFF" size={2.2} sizeAttenuation={false} transparent opacity={0.6 + 0.2 * Math.sin(f * 0.15)} fog={false} /></points>}
      {sd && sunPos && (
        <group position={sunPos}>
          {(mood.sunburst ?? 0) > 0 && <sprite scale={[sd.size * 26, sd.size * 26, 1]}><spriteMaterial map={burstTex()} rotation={f * 0.0025} transparent opacity={mood.sunburst} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} color={sd.color} /></sprite>}
          <sprite scale={[sd.size * 9, sd.size * 9, 1]}><spriteMaterial map={glow} transparent opacity={0.55} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} /></sprite>
          <sprite scale={[sd.size * 2, sd.size * 2, 1]}><spriteMaterial map={radial(mood.moon ? '#F4F2D8' : '#FFFDF0', 'disc')} transparent depthWrite={false} fog={false} /></sprite>
          <sprite scale={[sd.size * 1.15, sd.size * 1.15, 1]}><spriteMaterial color={sd.color} map={discTex()} transparent depthWrite={false} fog={false} /></sprite>
        </group>
      )}
    </group>
  );
};
/** Stylised radial sunburst (alternating soft beams, fading out) — the reference's painted sun rays. */
const burstTex = () => canvasTexture('sunburst', 1024, 1024, (g, W) => {
  const c = W / 2; const r = rng('burst'); const n = 22;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + r.range(-0.04, 0.04), w = r.range(0.05, 0.11);
    const grd = g.createRadialGradient(c, c, 0, c, c, c); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c * r.range(0.75, 1), a0, a0 + w); g.closePath(); g.fill();
  }
});
const discTex = () => canvasTexture('disc-hard', 256, 256, (g, W) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 4, 0, 7); g.fill(); });

/** Puffy cartoon cumulus cloud (soft shading, flat bottom, no outline) drawn once per seed. */
export function cloudTexture(seed: number, tint = '#FFFFFF', shadow = '#C9D8F0') {
  return canvasTexture(`cloud:${seed}:${tint}:${shadow}`, 1024, 512, (g, W, H) => {
    const r = rng(seed * 31 + 7); const base = H * 0.78;
    const puffs: [number, number, number][] = [];
    const n = r.int(5, 8);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const rad = H * r.range(0.16, 0.3) * (1 - Math.abs(t - 0.5) * 0.9); puffs.push([W * (0.12 + 0.76 * t) + r.range(-20, 20), base - rad * r.range(0.6, 1.3), rad]); }
    for (let i = 0; i < 3; i++) puffs.push([W * r.range(0.3, 0.7), base - H * r.range(0.35, 0.5), H * r.range(0.2, 0.28)]);
    const draw = (dx: number, dy: number, col: string) => { g.fillStyle = col; g.beginPath(); for (const [x, y, rad] of puffs) { g.moveTo(x + dx + rad, y + dy); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); } g.fill(); };
    draw(0, 0, shadow);                 // shadow body
    draw(-W * 0.012, -H * 0.035, tint); // lit body offset up-left
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(0, base, W, H); g.restore(); // flat bottom
    g.fillStyle = shadow; g.globalAlpha = 0.55; g.fillRect(W * 0.1, base - H * 0.04, W * 0.8, H * 0.04); g.globalAlpha = 1;
    g.save(); g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#000'; g.beginPath(); for (const [x, y, rad] of puffs) { g.moveTo(x + rad, y); g.arc(x, y, rad, 0, Math.PI * 2); } g.fill(); g.restore();
  });
}

export type CloudSpec = {pos: [number, number, number]; scale: number; seed: number; drift?: number};

/**
 * Puffy 3D cartoon cumulus (style-bible §3.4, rubric S7): a seeded cluster of toon-shaded spheres on a flattened
 * base, lit by the scene sun (lit top, soft blue-grey underside), no outline, no fog. `scale` ≈ cloud height;
 * width ≈ 2 × scale (same footprint as the old sprite cards, so existing CloudSpecs keep their layout).
 */
type Puff = {x: number; y: number; z: number; r: number; sy: number};
function cloudPuffs(seed: number): Puff[] {
  const r = rng(seed * 31 + 7); const out: Puff[] = [];
  const n = r.int(5, 8);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n; const rad = r.range(0.2, 0.34) * (1 - Math.abs(t - 0.5) * 0.9);
    out.push({x: -0.78 + 1.56 * t + r.range(-0.04, 0.04), y: -0.12 + rad * r.range(0.25, 0.7), z: r.range(-0.12, 0.12), r: rad, sy: 0.82});
  }
  for (let i = 0; i < 3; i++) out.push({x: r.range(-0.35, 0.35), y: r.range(0.12, 0.26), z: r.range(-0.1, 0.1), r: r.range(0.24, 0.32), sy: 0.86});
  out.push({x: 0, y: -0.2, z: 0, r: 0.82, sy: 0.16}); // flat base slab
  return out;
}
const cloudMats = new Map<string, THREE.MeshToonMaterial>();
function cloudMat(tint: string, shadow: string, opacity: number) {
  const k = `${tint}|${shadow}|${opacity}`;
  let m = cloudMats.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({color: tint, emissive: new THREE.Color(shadow), emissiveIntensity: 0.32, gradientMap: toonRamp([0.62, 0.86, 1.0]), fog: false, transparent: opacity < 1, opacity});
    cloudMats.set(k, m);
  }
  return m;
}
const CloudPuffs: React.FC<{spec: CloudSpec; x: number; mat: THREE.Material}> = ({spec, x, mat}) => {
  const puffs = useMemo(() => cloudPuffs(spec.seed), [spec.seed]);
  const s = spec.scale;
  return (
    <group position={[x, spec.pos[1], spec.pos[2]]} scale={[s, s, s]}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} scale={[p.r, p.r * p.sy, p.r * 0.8]} material={mat}><sphereGeometry args={[1, 28, 16]} /></mesh>
      ))}
    </group>
  );
};
/** Puffy 3D clouds that drift slowly (ambient motion). */
export const Clouds: React.FC<{clouds: CloudSpec[]; tint?: string; shadow?: string; opacity?: number}> = ({clouds, tint = '#FFFFFF', shadow = '#C9D8F0', opacity = 1}) => {
  const f = useCurrentFrame();
  const mat = cloudMat(tint, shadow, opacity);
  return (<group>{clouds.map((c, i) => <CloudPuffs key={i} spec={c} x={c.pos[0] + (c.drift ?? 0.02) * f} mat={mat} />)}</group>);
};
