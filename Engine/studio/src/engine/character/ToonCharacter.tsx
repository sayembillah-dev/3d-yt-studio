/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import React, {useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useStage} from '../Stage';
import {radial} from '../textures/canvas';
import {Inked, inkMat, toonMat, inkLight, INK_COLOR} from '../ink';
import {characterState, posAt, StickCharacterProps} from './StickCharacter';
import {drawFace, drawFx, drawHeld, HEAD, HIP_X, UPPER, FORE, FEET_Y, FIG_H, Look, Outfit, Hat, Hair} from './draw';

/**
 * ToonCharacter — the reference character as REAL 3D (measured: "real 3D toon render, not flat 2D"):
 *  white squashed-sphere head (h/w 0.93) + swapped face decal, bean torso with a painted outfit,
 *  ink-tube arms/legs, ink ball hands, tiny ink feet, chunky 3D hats — everything ink-outlined (#2A1B26).
 *  ~3 heads tall. Same acting API as StickCharacter (keys / talk / path), default motion = 'pose'
 *  (4-frame bezier(.2,0,.1,1) attacks, then HOLD — measured on the references).
 *
 * Units: built in "unit height" space (feet at 0, head top at ~1) then scaled by `height` (default 1.7).
 */
const U = 1 / FIG_H;
const py = (y: number) => (FEET_Y - y) * U;
const R = HEAD.rx * U;                 // head radius (unit space) ≈ 0.171 → head diameter D ≈ 0.34
// Proportions MEASURED on reference close-ups (in head diameters D): bean 1.5 D tall x 0.7 D wide, legs ≈ 0.7 D, ~3 heads tall.
const BEAN_BOT = 0.215, BEAN_TOP = 0.735, BEAN_HW = 0.118;
const HIP = 0.25, LEG1 = 0.125, LEG2 = 0.125;          // hip height, thigh, shin
const SHO_Y = 0.625, SHO_X = 0.095, ARM1 = UPPER / FIG_H, ARM2 = FORE / FIG_H;
const HEAD_Y = 0.862;
const TOP = HEAD_Y + R * 0.93;         // head top → normalise so `height` is exact
const HEAD_SQ = 0.93;                  // h/w
const INK_W = 0.0075;                  // lit-side outline width (unit space); shadow side 2x
const LIMB_R = 0.0068, HAND_R = 0.016;
const rad = (d: number) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ geometry (cached)
const G: Record<string, THREE.BufferGeometry> = {};
const geo = (k: string, make: () => THREE.BufferGeometry) => (G[k] ??= make());

function beanGeo(long: boolean) {
  return geo('bean' + long, () => {
    const top = BEAN_TOP, bot = long ? 0.035 : BEAN_BOT, hw = BEAN_HW;
    const h = top - bot; const pts: THREE.Vector2[] = []; const N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N; const e = Math.abs(2 * t - 1);
      let r = hw * Math.pow(Math.max(0, 1 - Math.pow(e, long ? 3.2 : 2.4)), 1 / (long ? 3.2 : 2.4)) * (1.06 - 0.12 * t);
      if (long) r *= 1 + 0.35 * Math.pow(1 - t, 2);      // robe flares at the hem
      pts.push(new THREE.Vector2(Math.max(r, 1e-4), bot + t * h));
    }
    return new THREE.LatheGeometry(pts, 48);
  });
}
const sphere = (r: number, w = 32, h = 20) => geo(`s${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const cap = (r: number, theta: number) => geo(`cap${r}|${theta}`, () => new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, theta));
const cyl = (rt: number, rb: number, h: number, seg = 40, open = false) => geo(`c${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const torus = (r: number, t: number) => geo(`t${r}|${t}`, () => new THREE.TorusGeometry(r, t, 12, 48));
const halfDisc = (r: number, h: number) => geo(`hd${r}|${h}`, () => new THREE.CylinderGeometry(r, r, h, 24, 1, false, -Math.PI / 2, Math.PI));
const cone = (r: number, h: number) => geo(`cone${r}|${h}`, () => new THREE.ConeGeometry(r, h, 16));

/** Front spherical cap with PLANAR-projected UVs: the face is a flat drawing pressed onto the sphere. */
const FACE_SPAN = 1.15;
function faceCapGeo() {
  return geo('facecap', () => {
    const g = new THREE.SphereGeometry(R * 1.008, 48, 32, Math.PI / 2 - 1.3, 2.6, 0.2, 2.75);
    const p = g.attributes.position, uv = g.attributes.uv; const S = R * FACE_SPAN;
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * S), 0.5 + p.getY(i) / (2 * S));
    uv.needsUpdate = true;
    return g;
  });
}

// ------------------------------------------------------------------ outfit texture (lathe UV: u around, front at u=0 → offset 0.5)
const outfitCache = new Map<string, THREE.CanvasTexture>();
function shadeHex(hex: string, amt: number): string { const c = new THREE.Color(hex); const hsl = {h: 0, s: 0, l: 0}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt))); return '#' + c.getHexString(); }
function outfitTexture(o: Outfit): THREE.CanvasTexture {
  const key = JSON.stringify(o);
  const hit = outfitCache.get(key); if (hit) return hit;
  const W = 1024, H = 512, FX = 512; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  const ink = (w = 7) => { g.strokeStyle = INK_COLOR; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; };
  const rect = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const button = (x: number, y: number, col = '#F2D16B', r = 9) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); ink(3); g.stroke(); };
  switch (o.kind) {
    case 'plain': rect(0, 0, W, H, o.color); break;
    case 'stripes': { const n = o.count ?? 7; const bh = H / n; for (let i = 0; i < n; i++) rect(0, i * bh, W, bh + 1, i % 2 ? o.b : o.a); break; }
    case 'vest': {
      rect(0, 0, W, H, o.vest);
      g.fillStyle = o.shirt; g.beginPath(); g.moveTo(FX - 80, 0); g.lineTo(FX, 200); g.lineTo(FX + 80, 0); g.fill();
      rect(FX - 14, 180, 28, H - 180, o.shirt);
      ink(6); g.beginPath(); g.moveTo(FX - 80, 0); g.lineTo(FX - 14, 180); g.lineTo(FX - 14, H); g.moveTo(FX + 80, 0); g.lineTo(FX + 14, 180); g.lineTo(FX + 14, H); g.stroke();
      for (let y = 240; y < H - 40; y += 62) button(FX + 30, y, o.buttons ?? '#E8C25A');
      if (o.chain) { g.strokeStyle = '#E8C25A'; g.lineWidth = 6; g.beginPath(); g.moveTo(FX + 34, 300); g.quadraticCurveTo(FX + 90, 360, FX + 150, 310); g.stroke(); }
      // pocket welts
      ink(5); g.beginPath(); g.moveTo(FX - 150, 330); g.lineTo(FX - 80, 330); g.moveTo(FX + 80, 330); g.lineTo(FX + 150, 330); g.stroke();
      break;
    }
    case 'robe': {
      rect(0, 0, W, H, o.color);
      if (o.trim) { rect(0, H - 46, W, 46, o.trim); ink(5); g.beginPath(); g.moveTo(0, H - 46); g.lineTo(W, H - 46); g.stroke(); }
      // crossed collar
      g.fillStyle = '#F4EFEA'; g.beginPath(); g.moveTo(FX - 90, 0); g.lineTo(FX + 30, 150); g.lineTo(FX + 50, 125); g.lineTo(FX - 50, 0); g.fill();
      g.beginPath(); g.moveTo(FX + 90, 0); g.lineTo(FX - 10, 120); g.lineTo(FX - 30, 100); g.lineTo(FX + 50, 0); g.fill();
      ink(5); g.beginPath(); g.moveTo(FX - 90, 0); g.lineTo(FX + 30, 150); g.moveTo(FX + 90, 0); g.lineTo(FX - 10, 120); g.stroke();
      if (o.sash) { const y = o.long === false ? 300 : 200; rect(0, y, W, 34, o.sash); ink(5); g.strokeRect(-10, y, W + 20, 34); }
      break;
    }
    case 'uniform': {
      rect(0, 0, W, H, o.color);
      const dk = shadeHex(o.color, -0.22), lt = shadeHex(o.color, 0.18), trim = o.trim ?? '#F4EFEA';
      // standing collar band + piping down the front placket
      rect(0, 0, W, 34, o.collar ?? dk); ink(4); g.beginPath(); g.moveTo(0, 34); g.lineTo(W, 34); g.stroke();
      g.strokeStyle = trim; g.lineWidth = 7; g.beginPath(); g.moveTo(FX - 26, 34); g.lineTo(FX - 26, 340); g.moveTo(FX + 26, 34); g.lineTo(FX + 26, 340); g.stroke();
      // pocket flaps with buttons (both chest sides)
      for (const sd of [-1, 1]) { const px = FX + sd * 120; g.fillStyle = dk; g.beginPath(); g.moveTo(px - 52, 120); g.lineTo(px + 52, 120); g.lineTo(px + 46, 156); g.lineTo(px, 168); g.lineTo(px - 46, 156); g.closePath(); g.fill(); ink(4); g.stroke(); button(px, 150, o.buttons ?? '#E8C25A', 7); ink(3); g.setLineDash([6, 6]); g.strokeRect(px - 50, 168, 100, 90); g.setLineDash([]); }
      for (let y = 70; y < 330; y += 52) { button(FX - 46, y, o.buttons ?? '#E8C25A', 8); button(FX + 46, y, o.buttons ?? '#E8C25A', 8); }
      // shoulder epaulettes (sides of the bean = u ≈ 0.25 / 0.75)
      if (o.epaulettes) for (const ex of [FX - 256, FX + 256]) { g.fillStyle = o.epaulettes; g.beginPath(); g.ellipse(ex, 18, 60, 22, 0, 0, 7); g.fill(); ink(4); g.stroke(); g.strokeStyle = o.epaulettes; g.lineWidth = 5; for (let k = -50; k <= 50; k += 10) { g.beginPath(); g.moveTo(ex + k, 36); g.lineTo(ex + k * 1.1, 62); g.stroke(); } }
      // diagonal cross-strap (bandolier) over the chest
      if (o.strap) { g.save(); g.translate(FX, 190); g.rotate(-0.62); g.fillStyle = o.strap; g.fillRect(-340, -18, 680, 36); ink(4); g.strokeRect(-340, -18, 680, 36); g.fillStyle = '#E8C25A'; g.fillRect(-20, -14, 40, 28); ink(3); g.strokeRect(-20, -14, 40, 28); g.restore(); }
      if (o.belt) { rect(0, 340, W, 40, o.belt); ink(5); g.strokeRect(-10, 340, W + 20, 40); g.fillStyle = '#E8C25A'; g.fillRect(FX - 22, 344, 44, 32); ink(4); g.strokeRect(FX - 22, 344, 44, 32); }
      // coat skirt below the belt: tails split at the back + highlight
      rect(0, 380, W, H - 380, lt); rect(0, 392, W, H - 392, o.color); ink(4); g.beginPath(); g.moveTo(0, 0 + W); g.moveTo(FX + 512 - 2, 380); g.lineTo(FX + 512 - 2, H); g.moveTo(2, 380); g.lineTo(2, H); g.stroke();
      if (o.badge) { g.fillStyle = o.badge; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? 12 : 28; g.lineTo(FX - 110 + Math.cos(a) * rr, 150 + Math.sin(a) * rr); } g.closePath(); g.fill(); ink(4); g.stroke(); }
      break;
    }
    case 'hoodie': {
      rect(0, 0, W, H, o.color); rect(0, 0, W, 40, '#00000022');
      g.fillStyle = '#00000018'; g.beginPath(); g.roundRect(FX - 120, 300, 240, 120, 30); g.fill(); ink(5); g.stroke();
      g.strokeStyle = o.strings ?? '#F4EFEA'; g.lineWidth = 7; g.beginPath(); g.moveTo(FX - 40, 20); g.lineTo(FX - 44, 150); g.moveTo(FX + 40, 20); g.lineTo(FX + 44, 150); g.stroke();
      break;
    }
    case 'overalls': {
      rect(0, 0, W, H, o.shirt); rect(0, 230, W, H - 230, o.overall);
      g.fillStyle = o.overall; g.fillRect(FX - 110, 110, 220, 130); ink(5); g.strokeRect(FX - 110, 110, 220, 130);
      g.strokeStyle = o.overall; g.lineWidth = 30; g.beginPath(); g.moveTo(FX - 95, 115); g.lineTo(FX - 160, 0); g.moveTo(FX + 95, 115); g.lineTo(FX + 160, 0); g.stroke();
      button(FX - 90, 130); button(FX + 90, 130);
      ink(5); g.beginPath(); g.moveTo(0, 230); g.lineTo(FX - 110, 230); g.moveTo(FX + 110, 230); g.lineTo(W, 230); g.stroke();
      if (o.scarf) rect(0, 0, W, 36, o.scarf);
      break;
    }
    case 'coat': {
      rect(0, 0, W, H, o.color);
      g.fillStyle = '#F4EFEA'; g.beginPath(); g.moveTo(FX - 70, 0); g.lineTo(FX, 210); g.lineTo(FX + 70, 0); g.fill();
      if (o.tie) { g.fillStyle = o.tie; g.beginPath(); g.moveTo(FX - 14, 10); g.lineTo(FX + 14, 10); g.lineTo(FX + 20, 170); g.lineTo(FX, 200); g.lineTo(FX - 20, 170); g.fill(); ink(4); g.stroke(); }
      g.fillStyle = o.lapel ?? '#00000030'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(FX + sd * 70, 0); g.lineTo(FX + sd * 10, 210); g.lineTo(FX + sd * 120, 90); g.lineTo(FX + sd * 110, 0); g.fill(); ink(5); g.stroke(); }
      for (let y = 260; y < H - 40; y += 70) button(FX + 26, y, '#2A1B26', 8);
      break;
    }
    case 'armor': {
      rect(0, 0, W, H, o.color);
      g.strokeStyle = '#00000040'; g.lineWidth = 4; for (let y = 10; y < H - 70; y += 36) for (let x = (y / 36) % 2 ? 0 : 24; x < W; x += 48) { g.beginPath(); g.arc(x, y, 22, 0, Math.PI); g.stroke(); }
      rect(0, H - 80, W, 80, o.skirt ?? '#8E2B2B'); ink(5); g.beginPath(); g.moveTo(0, H - 80); g.lineTo(W, H - 80); g.stroke();
      for (let x = 0; x < W; x += 64) { ink(4); g.beginPath(); g.moveTo(x, H - 80); g.lineTo(x, H); g.stroke(); }
      break;
    }
  }
  // ---- universal tailoring pass (2026-11-06 look-dev: never a flat bean) — applies to EVERY outfit kind
  // side seams with stitching (u = 0.25 / 0.75), back seam, hem band, fabric folds at the waist + under the arms
  g.save();
  for (const sx of [FX - 256, FX + 256, 0, W]) { g.strokeStyle = 'rgba(42,27,38,0.45)'; g.lineWidth = 4; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, H); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([7, 7]); g.beginPath(); g.moveTo(sx + 9, 40); g.lineTo(sx + 9, H - 20); g.stroke(); g.setLineDash([]); }
  g.fillStyle = 'rgba(42,27,38,0.20)'; g.fillRect(0, H - 26, W, 26); g.strokeStyle = 'rgba(42,27,38,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H - 26); g.lineTo(W, H - 26); g.stroke();
  g.strokeStyle = 'rgba(42,27,38,0.28)'; g.lineWidth = 5; g.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[FX - 200, 60, FX - 170, 160], [FX + 200, 60, FX + 170, 160], [FX - 150, 300, FX - 90, 330], [FX + 150, 300, FX + 90, 330], [FX - 60, 420, FX - 40, 470], [FX + 70, 410, FX + 50, 470]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 14, (y0 + y1) / 2, x1, y1); g.stroke(); }
  // painted form shading: front-centre lighter, sides/back darker (reads as a round cloth body even before lighting)
  const sh = g.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, 'rgba(30,15,40,0.28)'); sh.addColorStop(0.3, 'rgba(30,15,40,0.06)'); sh.addColorStop(0.5, 'rgba(255,250,235,0.10)'); sh.addColorStop(0.7, 'rgba(30,15,40,0.06)'); sh.addColorStop(1, 'rgba(30,15,40,0.28)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(255,255,255,0.08)'); vg.addColorStop(0.6, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,40,0.16)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.restore();
  // fabric grain (designer detail, never flat): fine speckle + soft top-light
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalAlpha = 0.05; g.fillStyle = '#000'; for (let i = 0; i < 2600; i++) g.fillRect(rnd() * W, rnd() * H, 2, 2);
  g.globalAlpha = 0.06; g.fillStyle = '#fff'; for (let i = 0; i < 1400; i++) g.fillRect(rnd() * W, rnd() * H, 2, 2);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.offset.x = 0.5; t.anisotropy = 8;
  outfitCache.set(key, t); return t;
}

const patternCache = new Map<string, THREE.CanvasTexture>();
function patternTex(kind: 'dots' | 'vstripes', a: string, b: string): THREE.CanvasTexture {
  const key = kind + a + b; const hit = patternCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = a; g.fillRect(0, 0, 512, 256); g.fillStyle = b;
  if (kind === 'dots') for (let y = 20; y < 256; y += 44) for (let x = (y / 44) % 2 ? 0 : 22; x < 512; x += 44) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  else for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 14, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; patternCache.set(key, t); return t;
}

// ------------------------------------------------------------------ hats & hair (positions relative to head centre, unit space)
const HatMesh: React.FC<{hat: Hat}> = ({hat}) => {
  const k = hat.kind; const w = INK_W;
  if (k === 'none') return null;
  const col = (hat as any).color ?? '#FFFFFF';
  switch (k) {
    case 'bowler': return (<group position={[0, R * 0.5, 0]} rotation={[-0.12, 0, 0]}>
      <Inked geometry={cap(R * 0.8, Math.PI / 2)} material={toonMat(col)} ink={w} scale={[1, 0.95, 1]} position={[0, R * 0.06, 0]} />
      <Inked geometry={cyl(R * 1.08, R * 1.08, R * 0.05)} material={toonMat(col)} ink={w} />
      <Inked geometry={torus(R * 1.06, R * 0.05)} material={toonMat(col)} ink={w} rotation={[Math.PI / 2, 0, 0]} position={[0, R * 0.03, 0]} />
    </group>);
    case 'topHat': return (<group position={[0, R * 0.55, 0]} rotation={[-0.1, 0, 0]}>
      <Inked geometry={cyl(R * 1.05, R * 1.05, R * 0.05)} material={toonMat(col)} ink={w} />
      <Inked geometry={cyl(R * 0.62, R * 0.68, R * 1.0)} material={toonMat(col)} ink={w} position={[0, R * 0.52, 0]} />
      <Inked geometry={cyl(R * 0.69, R * 0.7, R * 0.2)} material={toonMat((hat as any).band ?? '#8E2B2B')} ink={0} position={[0, R * 0.15, 0]} />
    </group>);
    case 'newsboy': return (<group position={[0, R * 0.32, 0]} rotation={[-0.15, 0, 0]}>
      <Inked geometry={cap(R * 1.1, Math.PI / 2.05)} material={toonMat('#FFFFFF', patternTex('vstripes', col, (hat as any).stripe ?? '#FFFFFF'))} ink={w} scale={[1.02, 0.62, 1.05]} />
      <Inked geometry={halfDisc(R * 0.62, R * 0.06)} material={toonMat(col)} ink={w} position={[0, R * 0.05, R * 0.95]} rotation={[0.18, 0, 0]} />
      <Inked geometry={sphere(R * 0.09, 12, 8)} material={toonMat(col)} ink={w} position={[0, R * 0.68, 0]} />
    </group>);
    case 'bandana': return (<group rotation={[-0.42, 0, 0]}>
      <Inked geometry={cap(R * 1.04, 1.32)} material={toonMat('#FFFFFF', patternTex('dots', col, (hat as any).dots ?? '#FFFFFF'))} ink={w} />
      <Inked geometry={sphere(R * 0.16, 12, 8)} material={toonMat(col)} ink={w} position={[R * 0.25, R * 0.15, -R * 1.02]} />
      <Inked geometry={sphere(R * 0.13, 12, 8)} material={toonMat(col)} ink={w} position={[R * 0.45, -R * 0.05, -R * 0.98]} />
    </group>);
    case 'tricorn': {
      // dome + three upturned brim flaps (corners point front-left, front-right, back) + gold edge trim
      const flap = geo('triFlap', () => new THREE.BoxGeometry(R * 2.1, R * 0.55, R * 0.07));
      const edge = geo('triEdge', () => new THREE.BoxGeometry(R * 2.12, R * 0.07, R * 0.09));
      return (<group position={[0, R * 0.48, 0]} rotation={[-0.08, 0, 0]}>
        <Inked geometry={cap(R * 0.86, Math.PI / 2)} material={toonMat(col)} ink={w} scale={[1, 0.95, 1]} />
        {[0, 1, 2].map((i) => { const a = Math.PI + (i * 2 * Math.PI) / 3; return (
          <group key={i} rotation={[0, a, 0]}>
            <group position={[0, R * 0.2, R * 0.86]} rotation={[0.38, 0, 0]}>
              <Inked geometry={flap} material={toonMat(col)} ink={w} />
              {(hat as any).trim && <Inked geometry={edge} material={toonMat((hat as any).trim)} ink={0} position={[0, R * 0.25, 0]} />}
            </group>
          </group>); })}
      </group>);
    }
    case 'police': return (<group position={[0, R * 0.6, 0]} rotation={[-0.1, 0, 0]}>
      <Inked geometry={cyl(R * 0.98, R * 0.86, R * 0.42)} material={toonMat(col)} ink={w} position={[0, R * 0.12, 0]} />
      <Inked geometry={cyl(R * 1.12, R * 1.0, R * 0.14)} material={toonMat(col)} ink={w} position={[0, R * 0.36, 0]} />
      <Inked geometry={cyl(R * 0.87, R * 0.87, R * 0.12)} material={toonMat((hat as any).band ?? '#2A1B26')} ink={0} position={[0, R * 0.0, 0]} />
      <Inked geometry={halfDisc(R * 0.62, R * 0.05)} material={toonMat('#2A1B26')} ink={w} position={[0, -R * 0.06, R * 0.75]} rotation={[0.3, 0, 0]} />
      <Inked geometry={sphere(R * 0.1, 10, 8)} material={toonMat((hat as any).badge ?? '#E8C25A')} ink={w} position={[0, R * 0.2, R * 0.95]} scale={[1, 1.2, 0.4]} />
    </group>);
    case 'imperial': return (<group position={[0, R * 0.62, 0]}>
      <Inked geometry={cyl(R * 0.86, R * 0.9, R * 0.4)} material={toonMat(col)} ink={w} />
      <Inked geometry={geo('board', () => new THREE.BoxGeometry(R * 2.3, R * 0.07, R * 1.3))} material={toonMat(col)} ink={w} position={[0, R * 0.26, 0]} />
      <Inked geometry={cyl(R * 0.91, R * 0.91, R * 0.08, 40, true)} material={toonMat((hat as any).trim ?? '#E8C25A')} ink={0} position={[0, -R * 0.1, 0]} />
      {Array.from({length: 7}, (_, i) => <Inked key={i} geometry={sphere(R * 0.06, 10, 8)} material={toonMat(((hat as any).beads ?? ['#C0392B', '#E8C25A', '#2E86DE'])[i % 3])} ink={0.004} position={[-R * 1.0 + i * R * 0.33, R * 0.12, R * 0.66]} />)}
    </group>);
    case 'helmet': return (<group position={[0, R * 0.08, 0]}>
      <Inked geometry={cap(R * 1.1, 1.45)} material={toonMat(col)} ink={w} />
      <Inked geometry={torus(R * 1.02, R * 0.06)} material={toonMat(col)} ink={w} rotation={[Math.PI / 2, 0, 0]} position={[0, R * 0.12, 0]} />
      {(hat as any).plume && <Inked geometry={cone(R * 0.16, R * 0.7)} material={toonMat((hat as any).plume)} ink={w} position={[0, R * 1.35, 0]} />}
    </group>);
    case 'crown': return (<group position={[0, R * 0.75, 0]}>
      <Inked geometry={cyl(R * 0.72, R * 0.66, R * 0.32, 40, true)} material={toonMat(col)} ink={w} />
      {Array.from({length: 6}, (_, i) => { const a = (i / 6) * Math.PI * 2; return <Inked key={i} geometry={cone(R * 0.12, R * 0.3)} material={toonMat(col)} ink={w} position={[Math.sin(a) * R * 0.7, R * 0.3, Math.cos(a) * R * 0.7]} />; })}
      <Inked geometry={sphere(R * 0.08, 10, 8)} material={toonMat('#C0392B')} ink={0.004} position={[0, 0, R * 0.7]} />
    </group>);
    case 'chef': return (<group position={[0, R * 0.65, 0]}>
      <Inked geometry={cyl(R * 0.72, R * 0.78, R * 0.6)} material={toonMat('#FFFFFF')} ink={w} />
      <Inked geometry={sphere(R * 0.9, 24, 16)} material={toonMat('#FFFFFF')} ink={w} position={[0, R * 0.55, 0]} scale={[1, 0.6, 1]} />
    </group>);
    case 'beanie': return (<group rotation={[-0.3, 0, 0]}>
      <Inked geometry={cap(R * 1.05, 1.35)} material={toonMat(col)} ink={w} />
      {(hat as any).stripe && <Inked geometry={torus(R * 0.86, R * 0.07)} material={toonMat((hat as any).stripe)} ink={0} rotation={[Math.PI / 2, 0, 0]} position={[0, R * 0.52, 0]} />}
      <Inked geometry={sphere(R * 0.17, 12, 10)} material={toonMat((hat as any).stripe ?? col)} ink={w} position={[0, R * 1.08, 0]} />
    </group>);
    case 'cowboy': return (<group position={[0, R * 0.55, 0]} rotation={[-0.12, 0, 0]}>
      <Inked geometry={cap(R * 0.78, Math.PI / 2)} material={toonMat(col)} ink={w} scale={[1, 1.15, 1]} />
      <Inked geometry={cyl(R * 1.55, R * 1.55, R * 0.05)} material={toonMat(col)} ink={w} scale={[1, 1, 0.85]} />
      <Inked geometry={cyl(R * 0.79, R * 0.79, R * 0.12)} material={toonMat((hat as any).band ?? '#2A1B26')} ink={0} position={[0, R * 0.08, 0]} />
    </group>);
    case 'hardhat': return (<group position={[0, R * 0.1, 0]} rotation={[-0.15, 0, 0]}>
      <Inked geometry={cap(R * 1.08, 1.4)} material={toonMat(col)} ink={w} />
      <Inked geometry={cyl(R * 1.25, R * 1.25, R * 0.05)} material={toonMat(col)} ink={w} position={[0, R * 0.2, 0]} />
    </group>);
  }
  return null;
};

const HairMesh: React.FC<{hair?: Hair}> = ({hair}) => {
  if (!hair || hair.style === 'none') return null;
  const m = toonMat(hair.color); const w = INK_W;
  switch (hair.style) {
    case 'bowl': return <Inked geometry={cap(R * 1.03, 1.3)} material={m} ink={w} rotation={[-0.5, 0, 0]} />;
    case 'side': return <Inked geometry={cap(R * 1.03, 1.3)} material={m} ink={w} rotation={[-0.45, 0, 0.25]} />;
    case 'bun': return (<group><Inked geometry={cap(R * 1.03, 1.3)} material={m} ink={w} rotation={[-0.5, 0, 0]} /><Inked geometry={sphere(R * 0.32, 20, 14)} material={m} ink={w} position={[0, R * 1.0, -R * 0.2]} /></group>);
    case 'bob': return <Inked geometry={cap(R * 1.05, 1.75)} material={m} ink={w} rotation={[-0.75, 0, 0]} />;
    case 'spiky': return (<group><Inked geometry={cap(R * 1.03, 1.2)} material={m} ink={w} rotation={[-0.45, 0, 0]} />{[-0.5, 0, 0.5].map((a, i) => <Inked key={i} geometry={cone(R * 0.2, R * 0.45)} material={m} ink={w} position={[Math.sin(a) * R * 0.6, R * 0.95, -R * 0.2]} rotation={[-0.4, 0, -a]} />)}</group>);
    case 'curly': return (<group>{Array.from({length: 9}, (_, i) => { const a = (i / 9) * Math.PI * 2; return <Inked key={i} geometry={sphere(R * 0.3, 14, 10)} material={m} ink={w} position={[Math.sin(a) * R * 0.62, R * 0.72 + Math.cos(a * 2) * R * 0.06, Math.cos(a) * R * 0.5 - R * 0.15]} />; })}</group>);
    case 'bald-sides': return (<group>{[-1, 1].map((s) => <Inked key={s} geometry={sphere(R * 0.36, 16, 12)} material={m} ink={w} position={[s * R * 0.8, R * 0.05, -R * 0.2]} scale={[0.6, 0.9, 1]} />)}</group>);
  }
  return null;
};

// ------------------------------------------------------------------ limbs
type P3 = THREE.Vector3;
/** 2D pose angles (deg, 0 = straight down, + = outward) → 3D joint points. Arms angle slightly forward (depth). */
function armPoints(side: 1 | -1, a1: number, a2: number, behind: boolean): [P3, P3, P3] {
  const S = new THREE.Vector3(side * SHO_X, SHO_Y, 0);
  const fwd = behind ? -0.45 : 0.32;
  const dir = (a: number) => new THREE.Vector3(side * Math.sin(rad(a)), -Math.cos(rad(a)), Math.abs(Math.sin(rad(a))) * fwd + 0.12 * (behind ? -1 : 1)).normalize();
  const E = S.clone().addScaledVector(dir(a1), ARM1);
  const Hn = E.clone().addScaledVector(dir(a1 + a2), ARM2);
  return [S, E, Hn];
}
/** Legs: base spread is sideways (6°); everything beyond that swings FORWARD in z (walk / sit / crouch). */
function legPoints(side: 1 | -1, t: number, s: number): [P3, P3, P3] {
  const Hp = new THREE.Vector3(side * HIP_X * U * 1.3, HIP, 0);
  const spread = rad(Math.min(t, 8)); const fwd = rad(Math.max(0, t - 8));
  const thighDir = new THREE.Vector3(side * Math.sin(spread), -Math.cos(fwd) * Math.cos(spread), Math.sin(fwd)).normalize();
  const K = Hp.clone().addScaledVector(thighDir, LEG1);
  const a = fwd + rad(s); // knee bend (s < 0 bends the shin back)
  const shinDir = new THREE.Vector3(side * Math.sin(spread) * 0.6, -Math.cos(a), Math.sin(a)).normalize();
  const F = K.clone().addScaledVector(shinDir, LEG2);
  return [Hp, K, F];
}
function tube(pts: P3[], r: number) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(curve, 14, r, 7, false);
}

export type ToonCharacterProps = StickCharacterProps & {
  /** base yaw (radians, 0 = facing +z). The body turns `follow` of the way toward the camera (default 0.8). */
  yaw?: number; follow?: number;
};

export const ToonCharacter: React.FC<ToonCharacterProps> = (p) => {
  const {mood, frame} = useStage();
  const H = p.height ?? 1.7;
  const look: Look = p.look;
  const pos = posAt(p, frame), prev = posAt(p, frame - 1);
  const vel = [pos[0] - prev[0], pos[2] - prev[2]]; const speed = Math.hypot(vel[0], vel[1]);
  const s = characterState({...p, motion: p.motion ?? 'pose'}, frame, mood.rim, vel[0], speed);
  inkLight.value.set(...mood.sunDir).normalize();

  // ---- face decal (drawn this frame, deterministic)
  const face = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.MeshBasicMaterial({map: t, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true});
    return {c, t, m};
  }, []);
  {
    const g = face.c.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 512, 512);
    const k = 256 / FACE_SPAN / HEAD.rx; g.setTransform(k, 0, 0, k, 0, 0);
    if (s.facing === 'front') drawFace(g, s, look, 256 / k, 256 / k);
    face.t.needsUpdate = true;
  }
  // ---- fx + held props (camera-facing sprites drawn with the 2D painter)
  const fxS = useMemo(() => { const c = document.createElement('canvas'); c.width = c.height = 800; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return {c, t, m: new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false})}; }, []);
  if (s.fx.length) { const g = fxS.c.getContext('2d')!; g.clearRect(0, 0, 800, 800); drawFx(g, s, 400, 400); fxS.t.needsUpdate = true; }
  const heldS = useMemo(() => [0, 1].map(() => { const c = document.createElement('canvas'); c.width = c.height = 360; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return {c, t, m: new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: true, alphaTest: 0.3})}; }), []);
  ([[s.holdL, -1, 0], [s.holdR, 1, 1]] as const).forEach(([hp, side, i]) => { if (hp) { const g = heldS[i].c.getContext('2d')!; g.clearRect(0, 0, 360, 360); drawHeld(g, hp, 180, 180, side as 1 | -1, frame); heldS[i].t.needsUpdate = true; } });

  // ---- head material (flush tints the head, e.g. turning purple with rage)
  // faces stay near-white in any light (reference look): a little white self-light under the scene lighting
  const headMat = useMemo(() => new THREE.MeshToonMaterial({color: look.skin ?? '#FFFFFF', gradientMap: toonMat('#fff').gradientMap, emissive: look.skin ?? '#FFFFFF', emissiveIntensity: 0.14}), [look.skin]);
  const base = new THREE.Color(look.skin ?? '#FFFFFF');
  headMat.color.copy(s.flush ? base.clone().lerp(new THREE.Color(s.flush.color), Math.min(1, s.flush.amt)) : base);

  // ---- limbs (rebuilt per frame; disposed on the next)
  const limbs = useRef<THREE.BufferGeometry[]>([]);
  limbs.current.forEach((g) => g.dispose());
  const L = armPoints(-1, s.armL[0], s.armL[1], s.behindArms.l), Rr = armPoints(1, s.armR[0], s.armR[1], s.behindArms.r);
  const longRobe = look.outfit.kind === 'robe' && (look.outfit as any).long !== false;
  const LL = legPoints(-1, s.legs.lt, s.legs.ls), RL = legPoints(1, s.legs.rt, s.legs.rs);
  const footY = Math.min(LL[2].y, RL[2].y);
  const ground = longRobe ? 0 : -footY + 0.012;    // ground-lock: lowest foot on the floor (sitting drops the body)
  limbs.current = [tube(L, LIMB_R), tube(Rr, LIMB_R), ...(longRobe ? [] : [tube(LL, LIMB_R), tube(RL, LIMB_R)])];

  // ---- facing: turn toward the camera (or walk direction while moving)
  const grp = useRef<THREE.Group>(null);
  const moving = speed > 0.004;
  const baseYaw = (moving ? Math.atan2(vel[0], vel[1]) : p.yaw ?? 0) + (s.facing === 'back' ? Math.PI : 0);
  const follow = moving ? 0.35 : p.follow ?? 0.8;
  useFrame(({camera}) => {
    if (!grp.current) return;
    const wp = grp.current.parent!.getWorldPosition(new THREE.Vector3());
    const toCam = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    let d = toCam - baseYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    grp.current.rotation.y = baseYaw + (s.facing === 'back' ? 0 : d * follow);
  });

  const shadowTex = useMemo(() => radial('#000000', 'contact-shadow'), []);
  const sc = ((look.scale ?? 1) * H) / TOP; const sq = s.squash;
  const acc = look.accessories ?? [];
  return (
    <group position={pos} userData={{noReceive: true}}>
      {p.shadow !== false && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012} scale={[0.5 * sc * (1 - s.hop * 1.5), 0.34 * sc * (1 - s.hop * 1.5), 1]} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      <group ref={grp} scale={sc}>
        <group position-y={s.hop + s.bob * U * 0.5} rotation-z={-rad(s.lean)} scale={[1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)]}>
          <group position-y={ground}>
            {/* legs + feet */}
            {!longRobe && <><mesh geometry={limbs.current[2]} material={inkMat()} /><mesh geometry={limbs.current[3]} material={inkMat()} /></>}
            {(longRobe ? [new THREE.Vector3(-0.04, 0.012 - ground, 0.05), new THREE.Vector3(0.04, 0.012 - ground, 0.05)] : [LL[2], RL[2]]).map((f, i) => (
              <mesh key={i} geometry={sphere(1, 16, 10)} material={inkMat()} position={[f.x, f.y + 0.004, f.z + 0.014]} scale={[0.024, 0.014, 0.036]} />
            ))}
            {/* body */}
            <Inked geometry={beanGeo(longRobe)} material={toonMat('#FFFFFF', outfitTexture(look.outfit))} ink={INK_W} />
            {acc.includes('bowtie') && [-1, 1].map((sd) => <Inked key={sd} geometry={cone(0.022, 0.04)} material={toonMat('#C0392B')} ink={0.004} position={[sd * 0.02, BEAN_TOP - 0.03, BEAN_HW * 0.92]} rotation={[0, 0, sd * Math.PI / 2]} />)}
            {acc.includes('scarf') && <Inked geometry={torus(BEAN_HW * 0.8, 0.018)} material={toonMat('#C0392B')} ink={0.004} rotation={[Math.PI / 2, 0, 0]} position={[0, BEAN_TOP - 0.02, 0]} />}
            {acc.includes('camera') && <Inked geometry={geo('camBox', () => new THREE.BoxGeometry(0.06, 0.042, 0.03))} material={toonMat('#2A2A33')} ink={0.004} position={[0, BEAN_TOP - 0.14, BEAN_HW * 0.97]} />}
            {/* arms + ball hands */}
            <mesh geometry={limbs.current[0]} material={inkMat()} />
            <mesh geometry={limbs.current[1]} material={inkMat()} />
            {[L[2], Rr[2]].map((h, i) => <mesh key={i} geometry={sphere(HAND_R, 14, 10)} material={inkMat()} position={h} />)}
            {[[s.holdL, L[2], 0], [s.holdR, Rr[2], 1]].map(([hp, h, i]: any) => hp ? <sprite key={i} material={heldS[i].m} position={[h.x, h.y, h.z + 0.02]} scale={[360 * U, 360 * U, 1]} /> : null)}
            {/* head */}
            <group position-y={HEAD_Y} scale={[1, HEAD_SQ, 1]}>
              <Inked geometry={sphere(R, 48, 32)} material={headMat} ink={INK_W} />
              {s.facing === 'front' && <mesh geometry={faceCapGeo()} material={face.m} renderOrder={3} />}
              <HairMesh hair={look.hair} />
              <HatMesh hat={look.hat} />
            </group>
            {s.fx.length > 0 && <sprite material={fxS.m} position={[0, HEAD_Y, 0.05]} scale={[800 * U, 800 * U, 1]} renderOrder={4} />}
          </group>
        </group>
      </group>
    </group>
  );
};
