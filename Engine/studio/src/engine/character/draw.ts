/* eslint-disable @typescript-eslint/no-explicit-any */
// Canvas renderer for StickWorld characters. Pure: draw(g, look, state) — no globals, deterministic.
export const INK = '#2A1B26'; // dark plum, never black (guide/style-bible: ink #2a1b26)
export const SKIN = '#F4EFEA';
export const SKIN_SHADE = '#D8CCC2';

export const CW = 1000, CH = 1400, CX = 500, FEET_Y = 1168, PAD = 200; // PAD = headroom above the figure for hats/fx
export const FIG_H = FEET_Y - 165; // px from head top to feet (unpadded)
export const HEAD = {cy: 330, rx: 172, ry: 165};
export const BODY = {top: 468, bottom: 800, hw: 92};
export const SHOULDER_Y = 522, SHOULDER_X = 78, HIP_Y = 782, HIP_X = 36;
export const UPPER = 125, FORE = 118, THIGH = 192, SHIN = 194;
const LIMB_W = 11, HAND_R = 9.5;

// ---------------------------------------------------------------- types
export type Face = 'neutral' | 'smug' | 'happy' | 'grin' | 'laugh' | 'shock' | 'panic' | 'squint' | 'angry' | 'furious' | 'skeptical' | 'sleepy' | 'sad' | 'nervous' | 'cool' | 'determined' | 'evil' | 'crying' | 'dead' | 'wow' | 'talk' | 'content';
export type ArmPose = 'down' | 'relaxed' | 'hip' | 'point' | 'pointUp' | 'wave' | 'up' | 'hold' | 'chin' | 'shrug' | 'carry' | 'behind' | 'cross' | 'reach' | 'fist' | 'present' | 'drink';
export type LegPose = 'stand' | 'walk' | 'run' | 'sit' | 'crouch' | 'wide' | 'tiptoe';
export type Hat =
  | {kind: 'none'}
  | {kind: 'bandana'; color: string; dots?: string}
  | {kind: 'tricorn'; color: string; trim?: string; emblem?: 'skull' | 'none'}
  | {kind: 'bowler'; color: string}
  | {kind: 'topHat'; color: string; band?: string}
  | {kind: 'newsboy'; color: string; stripe?: string}
  | {kind: 'police'; color: string; band?: string; badge?: string}
  | {kind: 'imperial'; color: string; trim?: string; beads?: string[]}
  | {kind: 'helmet'; color: string; plume?: string}
  | {kind: 'crown'; color: string}
  | {kind: 'chef'}
  | {kind: 'beanie'; color: string; stripe?: string}
  | {kind: 'cowboy'; color: string; band?: string}
  | {kind: 'hardhat'; color: string};
export type Hair = {style: 'none' | 'bowl' | 'side' | 'bun' | 'bob' | 'spiky' | 'bald-sides' | 'curly'; color: string};
export type Outfit =
  | {kind: 'plain'; color: string}
  | {kind: 'stripes'; a: string; b: string; count?: number}
  | {kind: 'vest'; shirt: string; vest: string; chain?: boolean; buttons?: string}
  | {kind: 'robe'; color: string; sash?: string; trim?: string; long?: boolean}
  | {kind: 'uniform'; color: string; belt?: string; buttons?: string; badge?: string; strap?: string; trim?: string; collar?: string; epaulettes?: string}
  | {kind: 'hoodie'; color: string; strings?: string}
  | {kind: 'overalls'; shirt: string; overall: string; scarf?: string}
  | {kind: 'coat'; color: string; lapel?: string; tie?: string}
  | {kind: 'armor'; color: string; skirt?: string};
export type Accessory = 'glasses' | 'sunglasses' | 'mustache' | 'beard' | 'grayBeard' | 'eyepatch' | 'camera' | 'blush' | 'bowtie' | 'scarf' | 'hook';
export type Look = {hat: Hat; hair?: Hair; outfit: Outfit; accessories?: Accessory[]; skin?: string; scale?: number};
export type Fx = 'sweat' | 'tears' | 'steam' | 'zzz' | 'shockLines' | 'sparkle' | 'question' | 'exclaim' | 'vein' | 'hearts' | 'dizzy';
export type HeldProp =
  | {kind: 'mug'} | {kind: 'bottle'; color?: string; label?: string} | {kind: 'newspaper'; title: string; sub?: string}
  | {kind: 'torch'} | {kind: 'lantern'} | {kind: 'cane'} | {kind: 'shovel'} | {kind: 'coin'} | {kind: 'cash'} | {kind: 'cup'; liquid?: string}
  | {kind: 'scroll'} | {kind: 'bucket'; content?: string} | {kind: 'tongs'} | {kind: 'phone'} | {kind: 'sign'; text: string} | {kind: 'clipboard'; text: string} | {kind: 'ball'; color?: string; glow?: boolean} | {kind: 'pot'; glow?: boolean};

export type DrawState = {
  frame: number; face: Face; lookX: number; lookY: number; blink: number; talkOpen: boolean;
  armL: [number, number]; armR: [number, number]; legs: {lt: number; ls: number; rt: number; rs: number; thighScale: number};
  bob: number; lean: number; squash: number; facing: 'front' | 'back';
  flush: {color: string; amt: number} | null; fx: Fx[]; fxAge: Record<string, number>;
  holdL?: HeldProp; holdR?: HeldProp; rim: string; behindArms: {l: boolean; r: boolean};
};

// ---------------------------------------------------------------- pose tables (deg)
export const ARM_POSES: Record<ArmPose, [number, number]> = {
  down: [10, 4], relaxed: [18, -10], hip: [58, -118], point: [100, -6], pointUp: [148, 6], wave: [138, 28], up: [158, 8],
  hold: [24, -96], chin: [30, -150], shrug: [72, 82], carry: [36, -70], behind: [8, 0], cross: [22, -128], reach: [78, -16],
  fist: [122, 62], present: [62, -30], drink: [28, -160],
};
export const LEG_POSES: Record<LegPose, {lt: number; ls: number; rt: number; rs: number; thighScale: number}> = {
  stand: {lt: 6, ls: -2, rt: 6, rs: -2, thighScale: 1}, wide: {lt: 18, ls: -8, rt: 18, rs: -8, thighScale: 1},
  walk: {lt: 6, ls: -2, rt: 6, rs: -2, thighScale: 1}, run: {lt: 6, ls: -2, rt: 6, rs: -2, thighScale: 1},
  sit: {lt: 70, ls: -66, rt: 70, rs: -66, thighScale: 0.32}, crouch: {lt: 38, ls: -62, rt: 38, rs: -62, thighScale: 0.85},
  tiptoe: {lt: 3, ls: 0, rt: 3, rs: 0, thighScale: 1},
};

// ---------------------------------------------------------------- helpers
const rad = (d: number) => (d * Math.PI) / 180;
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function headPath(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2; const s = Math.sin(t);
    const x = cx + rx * Math.cos(t) * (1 - 0.065 * Math.max(0, s)); const y = cy + ry * s * (s > 0 ? 0.97 : 1.02);
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
}
function capsule(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2; g.beginPath(); g.moveTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h - r * 0.9);
  g.quadraticCurveTo(x + w, y + h, x + w - r * 0.9, y + h); g.lineTo(x + r * 0.9, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r * 0.9); g.closePath();
}
/** brush-style outline: thick dark offset copy behind = heavier stroke on shadow side */
function inked(g: CanvasRenderingContext2D, path: () => void, fill: string | CanvasGradient, lw = 9, offset = [2.5, 4]) {
  g.save(); g.translate(offset[0], offset[1]); path(); g.fillStyle = INK; g.lineWidth = lw + 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.fill(); g.stroke(); g.restore();
  path(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
}
function celShade(g: CanvasRenderingContext2D, path: () => void, x0: number, x1: number, shadow = 'rgba(80,50,40,0.20)', rim?: string) {
  g.save(); path(); g.clip();
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(0.68, shadow); gr.addColorStop(1, shadow);
  g.fillStyle = gr; g.fillRect(x0 - 50, 0, x1 - x0 + 100, CH);
  if (rim) { g.globalAlpha = 0.55; g.strokeStyle = rim; g.lineWidth = 14; g.translate(-7, 0); path(); g.stroke(); }
  g.restore();
}
function limb(g: CanvasRenderingContext2D, x0: number, y0: number, a1: number, a2: number, l1: number, l2: number, side: 1 | -1, scale1 = 1) {
  const ex = x0 + side * Math.sin(rad(a1)) * l1 * scale1, ey = y0 + Math.cos(rad(a1)) * l1 * scale1;
  const a = a1 + a2; const hx = ex + side * Math.sin(rad(a)) * l2, hy = ey + Math.cos(rad(a)) * l2;
  g.save(); g.strokeStyle = INK; g.lineWidth = LIMB_W; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x0, y0);
  // smooth bend through the elbow/knee
  g.quadraticCurveTo(ex, ey, (ex + hx) / 2, (ey + hy) / 2); g.lineTo(hx, hy); g.stroke(); g.restore();
  return {ex, ey, hx, hy, ang: a};
}

// ---------------------------------------------------------------- hats & hair
function drawHair(g: CanvasRenderingContext2D, h: Hair | undefined, cx: number, cy: number, back: boolean) {
  if (!h || h.style === 'none') return;
  const {rx, ry} = HEAD; const col = h.color;
  const p = () => {
    g.beginPath();
    if (h.style === 'bowl' || back) { g.ellipse(cx, cy - ry * 0.12, rx * 1.03, ry * (back ? 1.0 : 0.92), 0, Math.PI * 1.0, Math.PI * 2.0); if (!back) { g.lineTo(cx + rx * 1.02, cy - ry * 0.05); g.quadraticCurveTo(cx, cy - ry * 0.32, cx - rx * 1.02, cy - ry * 0.05); } else { g.ellipse(cx, cy, rx * 1.02, ry * 1.0, 0, 0, Math.PI); } g.closePath(); }
    else if (h.style === 'side') { g.ellipse(cx, cy - ry * 0.2, rx * 1.02, ry * 0.85, 0, Math.PI * 0.95, Math.PI * 2.05); g.quadraticCurveTo(cx + rx * 0.3, cy - ry * 0.75, cx - rx * 0.6, cy - ry * 0.35); g.closePath(); }
    else if (h.style === 'bob') { g.ellipse(cx, cy - ry * 0.1, rx * 1.1, ry * 1.0, 0, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(cx + rx * 1.05, cy + ry * 0.45); g.lineTo(cx + rx * 0.82, cy + ry * 0.45); g.quadraticCurveTo(cx + rx * 0.6, cy - ry * 0.55, cx, cy - ry * 0.62); g.quadraticCurveTo(cx - rx * 0.6, cy - ry * 0.55, cx - rx * 0.82, cy + ry * 0.45); g.lineTo(cx - rx * 1.05, cy + ry * 0.45); g.closePath(); }
    else if (h.style === 'bun') { g.ellipse(cx, cy - ry * 0.15, rx * 1.02, ry * 0.9, 0, Math.PI, Math.PI * 2); g.quadraticCurveTo(cx, cy - ry * 0.45, cx - rx * 1.02, cy - ry * 0.15); g.moveTo(cx + 55, cy - ry * 1.05); g.arc(cx, cy - ry * 1.05, 55, 0, Math.PI * 2); }
    else if (h.style === 'spiky') { g.moveTo(cx - rx, cy - ry * 0.2); for (let i = 0; i <= 8; i++) { const t = i / 8; const x = cx - rx + t * rx * 2; g.lineTo(x, cy - ry * (i % 2 ? 1.25 : 0.85) * (1 - Math.abs(t - 0.5) * 0.4)); } g.lineTo(cx + rx, cy - ry * 0.2); g.quadraticCurveTo(cx, cy - ry * 0.5, cx - rx, cy - ry * 0.2); g.closePath(); }
    else if (h.style === 'curly') { for (let i = 0; i < 11; i++) { const t = Math.PI * (1.0 + i / 10); g.moveTo(cx + Math.cos(t) * rx * 0.95 + 42, cy + Math.sin(t) * ry * 0.9); g.arc(cx + Math.cos(t) * rx * 0.95, cy + Math.sin(t) * ry * 0.9, 42, 0, Math.PI * 2); } }
    else if (h.style === 'bald-sides') { g.ellipse(cx - rx * 0.95, cy, 30, 60, 0, 0, Math.PI * 2); g.moveTo(cx + rx * 0.95 + 30, cy); g.ellipse(cx + rx * 0.95, cy, 30, 60, 0, 0, Math.PI * 2); }
  };
  inked(g, p, col, 7, [1.5, 2.5]);
  // one highlight stroke
  g.save(); g.strokeStyle = shade(col, 0.35); g.globalAlpha = 0.7; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(cx - rx * 0.25, cy - ry * 0.25, rx * 0.6, Math.PI * 1.25, Math.PI * 1.45); g.stroke(); g.restore();
}

function drawHat(g: CanvasRenderingContext2D, hat: Hat, cx: number, cy: number) {
  const {rx, ry} = HEAD; const top = cy - ry;
  const hl = (col: string) => shade(col, 0.3);
  switch (hat.kind) {
    case 'none': return;
    case 'bandana': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 1.0, cy - ry * 0.18); g.bezierCurveTo(cx - rx * 1.05, top - 40, cx + rx * 1.05, top - 40, cx + rx * 1.0, cy - ry * 0.18); g.quadraticCurveTo(cx, cy - ry * 0.32, cx - rx * 1.0, cy - ry * 0.18); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.save(); p(); g.clip(); if (hat.dots) { g.fillStyle = hat.dots; for (let i = 0; i < 14; i++) { const a = i * 2.4; g.beginPath(); g.ellipse(cx + Math.cos(a) * rx * (0.25 + (i % 4) * 0.2), top + 45 + (i % 3) * 38 + Math.sin(a) * 12, 10, 8, 0, 0, 7); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(cx - rx * 0.35, top + 50, rx * 0.4, 30, -0.3, 0, 7); g.fill(); g.restore();
      // knot tails on the side
      inked(g, () => { g.beginPath(); g.moveTo(cx + rx * 0.92, cy - ry * 0.3); g.quadraticCurveTo(cx + rx * 1.35, cy - ry * 0.2, cx + rx * 1.3, cy + ry * 0.05); g.lineTo(cx + rx * 1.1, cy - ry * 0.12); g.closePath(); }, hat.color, 6);
      return;
    }
    case 'tricorn': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 1.45, cy - ry * 0.45); g.quadraticCurveTo(cx, cy - ry * 0.05, cx + rx * 1.45, cy - ry * 0.45); g.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.75, cx + rx * 0.6, top - 30); g.quadraticCurveTo(cx, top - 95, cx - rx * 0.6, top - 30); g.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.75, cx - rx * 1.45, cy - ry * 0.45); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.save(); g.strokeStyle = hat.trim ?? '#D9A441'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx - rx * 1.38, cy - ry * 0.45); g.quadraticCurveTo(cx, cy - ry * 0.1, cx + rx * 1.38, cy - ry * 0.45); g.stroke(); g.restore();
      if (hat.emblem !== 'none') { g.fillStyle = '#F4EFEA'; g.beginPath(); g.arc(cx, top + 15, 22, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(cx - 8, top + 12, 5, 0, 7); g.arc(cx + 8, top + 12, 5, 0, 7); g.fill(); }
      return;
    }
    case 'bowler': {
      inked(g, () => { g.beginPath(); g.ellipse(cx, cy - ry * 0.55, rx * 1.2, 34, 0, 0, Math.PI * 2); }, shade(hat.color, -0.1), 8);
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 0.82, cy - ry * 0.55); g.bezierCurveTo(cx - rx * 0.9, top - 125, cx + rx * 0.9, top - 125, cx + rx * 0.82, cy - ry * 0.55); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.save(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx - rx * 0.35, top - 50, 30, 50, -0.4, 0, 7); g.fill(); g.restore();
      return;
    }
    case 'topHat': {
      inked(g, () => { g.beginPath(); g.ellipse(cx, cy - ry * 0.62, rx * 1.15, 30, 0, 0, Math.PI * 2); }, hat.color, 8);
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 0.7, cy - ry * 0.62); g.lineTo(cx - rx * 0.78, top - 210); g.quadraticCurveTo(cx, top - 235, cx + rx * 0.78, top - 210); g.lineTo(cx + rx * 0.7, cy - ry * 0.62); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.fillStyle = hat.band ?? '#C9A227'; g.fillRect(cx - rx * 0.72, cy - ry * 0.62 - 50, rx * 1.44, 34); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(cx - rx * 0.72, cy - ry * 0.62 - 50, rx * 1.44, 34);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(cx - rx * 0.5, top - 200, 18, 160);
      return;
    }
    case 'newsboy': {
      inked(g, () => { g.beginPath(); g.ellipse(cx + rx * 0.15, cy - ry * 0.48, rx * 0.95, 26, -0.05, 0, Math.PI * 2); }, shade(hat.color, -0.15), 7);
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 1.02, cy - ry * 0.4); g.bezierCurveTo(cx - rx * 1.25, top - 80, cx + rx * 1.25, top - 80, cx + rx * 1.02, cy - ry * 0.4); g.quadraticCurveTo(cx, cy - ry * 0.62, cx - rx * 1.02, cy - ry * 0.4); g.closePath(); };
      inked(g, p, hat.color, 8);
      if (hat.stripe) { g.save(); p(); g.clip(); g.strokeStyle = hat.stripe; g.lineWidth = 10; for (let x = -rx * 1.3; x < rx * 1.3; x += 30) { g.beginPath(); g.moveTo(cx + x, cy - ry * 0.3); g.quadraticCurveTo(cx + x * 0.6, top - 30, cx + x * 0.2, top - 70); g.stroke(); } g.restore(); }
      g.fillStyle = INK; g.beginPath(); g.arc(cx, top - 58, 10, 0, 7); g.fill();
      return;
    }
    case 'police': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 0.98, cy - ry * 0.42); g.lineTo(cx - rx * 1.12, top - 70); g.quadraticCurveTo(cx, top - 120, cx + rx * 1.12, top - 70); g.lineTo(cx + rx * 0.98, cy - ry * 0.42); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.fillStyle = hat.band ?? INK; g.fillRect(cx - rx * 0.98, cy - ry * 0.62, rx * 1.96, 40);
      inked(g, () => { g.beginPath(); g.ellipse(cx + rx * 0.2, cy - ry * 0.4, rx * 0.9, 24, 0.05, 0, Math.PI); g.closePath(); }, INK, 5);
      g.fillStyle = hat.badge ?? '#F2C94C'; star(g, cx, top - 20, 26); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      return;
    }
    case 'imperial': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 0.7, cy - ry * 0.5); g.lineTo(cx - rx * 0.75, top - 70); g.lineTo(cx + rx * 0.75, top - 70); g.lineTo(cx + rx * 0.7, cy - ry * 0.5); g.closePath(); };
      inked(g, p, hat.color, 8);
      inked(g, () => { g.beginPath(); g.moveTo(cx - rx * 1.25, top - 70); g.lineTo(cx + rx * 1.25, top - 90); g.lineTo(cx + rx * 1.25, top - 108); g.lineTo(cx - rx * 1.25, top - 90); g.closePath(); }, hat.color, 7);
      g.strokeStyle = hat.trim ?? '#E0B23A'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx - rx * 1.2, top - 86); g.lineTo(cx + rx * 1.2, top - 104); g.stroke();
      g.beginPath(); g.moveTo(cx - rx * 0.68, cy - ry * 0.62); g.lineTo(cx + rx * 0.68, cy - ry * 0.62); g.stroke();
      const beads = hat.beads ?? ['#2E9E6A', '#C0392B', '#F4EFEA', '#E0B23A'];
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { g.fillStyle = beads[k % beads.length]; g.beginPath(); g.arc(cx + side * rx * 1.15, top - 70 + k * 26 + (side > 0 ? -16 : 0), 11, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
      return;
    }
    case 'helmet': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 1.05, cy - ry * 0.25); g.bezierCurveTo(cx - rx * 1.1, top - 70, cx + rx * 1.1, top - 70, cx + rx * 1.05, cy - ry * 0.25); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.save(); p(); g.clip(); g.fillStyle = shade(hat.color, -0.25); for (let x = -rx; x < rx; x += 40) g.fillRect(cx + x, top - 80, 6, 400); g.restore();
      g.fillStyle = '#E0B23A'; g.fillRect(cx - rx * 1.05, cy - ry * 0.32, rx * 2.1, 26); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(cx - rx * 1.05, cy - ry * 0.32, rx * 2.1, 26);
      if (hat.plume) inked(g, () => { g.beginPath(); g.moveTo(cx + 10, top - 40); g.quadraticCurveTo(cx + 120, top - 160, cx + 60, top - 80); g.quadraticCurveTo(cx + 40, top - 60, cx + 10, top - 40); g.closePath(); }, hat.plume, 5);
      return;
    }
    case 'crown': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 0.75, cy - ry * 0.55); for (let i = 0; i <= 4; i++) { const x = cx - rx * 0.75 + (i / 4) * rx * 1.5; g.lineTo(x, top - 90); if (i < 4) g.lineTo(x + rx * 0.19, top - 30); } g.lineTo(cx + rx * 0.75, cy - ry * 0.55); g.closePath(); };
      inked(g, p, hat.color, 7); for (let i = 0; i <= 4; i++) { g.fillStyle = i % 2 ? '#C0392B' : '#2E86DE'; g.beginPath(); g.arc(cx - rx * 0.75 + (i / 4) * rx * 1.5, top - 90, 12, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
      return;
    }
    case 'chef': {
      inked(g, () => { g.beginPath(); g.rect(cx - rx * 0.7, top - 60, rx * 1.4, 70); g.moveTo(cx + 80, top - 110); for (const [x, y, r] of [[-70, -110, 70], [0, -150, 80], [70, -110, 70]]) { g.moveTo(cx + x + r, top + y); g.arc(cx + x, top + y, r, 0, 7); } }, '#FFFFFF', 7);
      return;
    }
    case 'beanie': {
      const p = () => { g.beginPath(); g.moveTo(cx - rx * 1.02, cy - ry * 0.3); g.bezierCurveTo(cx - rx * 1.05, top - 110, cx + rx * 1.05, top - 110, cx + rx * 1.02, cy - ry * 0.3); g.closePath(); };
      inked(g, p, hat.color, 8);
      g.fillStyle = shade(hat.color, -0.2); g.fillRect(cx - rx * 1.02, cy - ry * 0.48, rx * 2.04, 34); g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(cx - rx * 1.02, cy - ry * 0.48, rx * 2.04, 34);
      if (hat.stripe) { g.fillStyle = hat.stripe; g.fillRect(cx - rx * 0.95, top - 30, rx * 1.9, 18); }
      inked(g, () => { g.beginPath(); g.arc(cx + rx * 0.4, top - 75, 30, 0, 7); }, hat.stripe ?? '#FFFFFF', 5);
      return;
    }
    case 'cowboy': {
      inked(g, () => { g.beginPath(); g.ellipse(cx, cy - ry * 0.55, rx * 1.55, 38, 0, 0, Math.PI * 2); }, hat.color, 8);
      inked(g, () => { g.beginPath(); g.moveTo(cx - rx * 0.75, cy - ry * 0.58); g.bezierCurveTo(cx - rx * 0.85, top - 120, cx - 20, top - 80, cx, top - 95); g.bezierCurveTo(cx + 20, top - 80, cx + rx * 0.85, top - 120, cx + rx * 0.75, cy - ry * 0.58); g.closePath(); }, hat.color, 8);
      g.fillStyle = hat.band ?? '#5B3A1E'; g.fillRect(cx - rx * 0.76, cy - ry * 0.58 - 34, rx * 1.52, 24);
      return;
    }
    case 'hardhat': {
      inked(g, () => { g.beginPath(); g.ellipse(cx, cy - ry * 0.42, rx * 1.2, 28, 0, 0, Math.PI * 2); }, hat.color, 7);
      inked(g, () => { g.beginPath(); g.moveTo(cx - rx * 0.95, cy - ry * 0.42); g.bezierCurveTo(cx - rx, top - 90, cx + rx, top - 90, cx + rx * 0.95, cy - ry * 0.42); g.closePath(); }, hat.color, 8);
      g.fillStyle = shade(hat.color, -0.2); g.fillRect(cx - 14, top - 60, 28, 140);
      return;
    }
  }
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
}

// ---------------------------------------------------------------- outfits
function drawBody(g: CanvasRenderingContext2D, o: Outfit, cx: number, rim: string) {
  const {top, bottom, hw} = BODY; const long = o.kind === 'robe' && o.long !== false;
  const h = (long ? FEET_Y - 30 : bottom) - top; const x = cx - hw * (long ? 1.05 : 1), w = hw * 2 * (long ? 1.05 : 1);
  const p = () => capsule(g, x, top, w, h);
  const base = o.kind === 'stripes' ? o.a : o.kind === 'vest' ? o.shirt : o.kind === 'overalls' ? o.shirt : (o as any).color;
  inked(g, p, base, 9);
  g.save(); p(); g.clip();
  switch (o.kind) {
    case 'stripes': { const n = o.count ?? 7; const sh = h / n; g.fillStyle = o.b; for (let i = 1; i < n; i += 2) { g.beginPath(); g.moveTo(x - 10, top + i * sh + 8); g.quadraticCurveTo(cx, top + i * sh + 22, x + w + 10, top + i * sh + 8); g.lineTo(x + w + 10, top + (i + 1) * sh + 8); g.quadraticCurveTo(cx, top + (i + 1) * sh + 22, x - 10, top + (i + 1) * sh + 8); g.fill(); } break; }
    case 'vest': {
      g.fillStyle = o.vest; g.beginPath(); g.moveTo(x - 5, top); g.lineTo(cx - 18, top + 40); g.lineTo(cx - 6, bottom - 10); g.lineTo(x - 5, bottom); g.fill();
      g.beginPath(); g.moveTo(x + w + 5, top); g.lineTo(cx + 18, top + 40); g.lineTo(cx + 6, bottom - 10); g.lineTo(x + w + 5, bottom); g.fill();
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 18, top + 40); g.lineTo(cx - 6, bottom - 10); g.moveTo(cx + 18, top + 40); g.lineTo(cx + 6, bottom - 10); g.stroke();
      g.fillStyle = o.buttons ?? '#E0B23A'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + 22, top + 80 + i * 55, 8, 0, 7); g.fill(); g.stroke(); }
      if (o.chain) { g.strokeStyle = '#E0B23A'; g.lineWidth = 4; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(cx + 22, top + 160); g.quadraticCurveTo(cx - 20, top + 230, cx - 60, top + 170); g.stroke(); g.setLineDash([]); }
      // texture speckle on vest (tweed)
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 160; i++) { const sx = x + ((i * 53) % w), sy = top + ((i * 97) % h); g.fillRect(sx, sy, 3, 3); }
      break;
    }
    case 'robe': {
      if (o.sash) { g.fillStyle = o.sash; g.beginPath(); g.moveTo(cx - 10, top); g.lineTo(cx + 40, top); g.lineTo(cx + 10, top + 140); g.lineTo(cx - 35, top + 140); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
      g.strokeStyle = o.trim ?? '#E0B23A'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, top + 300); g.lineTo(x + w, top + 300); g.stroke(); g.beginPath(); g.moveTo(x, top + h - 30); g.lineTo(x + w, top + h - 30); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 5; for (const fx of [-0.45, 0.1, 0.55]) { g.beginPath(); g.moveTo(cx + fx * hw, top + 330); g.lineTo(cx + fx * hw * 1.2, top + h); g.stroke(); }
      break;
    }
    case 'uniform': {
      g.fillStyle = o.belt ?? INK; g.fillRect(x, top + h * 0.68, w, 26); g.fillStyle = '#E0B23A'; g.fillRect(cx - 14, top + h * 0.68 + 2, 28, 22);
      g.fillStyle = o.buttons ?? '#E0B23A'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx, top + 55 + i * 50, 8, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
      if (o.badge) { g.fillStyle = o.badge; star(g, cx - 45, top + 90, 18); }
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 40, top); g.lineTo(cx, top + 45); g.lineTo(cx + 40, top); g.stroke();
      break;
    }
    case 'hoodie': {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, top + 40); g.lineTo(cx, bottom); g.stroke();
      g.strokeStyle = o.strings ?? '#FFFFFF'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 25, top + 20); g.lineTo(cx - 30, top + 110); g.moveTo(cx + 25, top + 20); g.lineTo(cx + 30, top + 110); g.stroke();
      g.fillStyle = shade(o.color, -0.25); g.beginPath(); g.roundRect(cx - 60, top + h * 0.62, 120, 60, 12); g.fill();
      g.fillStyle = shade(o.color, -0.3); g.beginPath(); g.ellipse(cx, top + 6, hw * 0.9, 36, 0, 0, Math.PI); g.fill();
      break;
    }
    case 'overalls': {
      g.fillStyle = o.overall; g.fillRect(x, top + h * 0.4, w, h); g.fillRect(cx - 55, top + 60, 110, h * 0.4);
      g.strokeStyle = o.overall; g.lineWidth = 16; g.beginPath(); g.moveTo(cx - 45, top + 70); g.lineTo(cx - 70, top + 5); g.moveTo(cx + 45, top + 70); g.lineTo(cx + 70, top + 5); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(cx - 55, top + 60, 110, h * 0.4); g.beginPath(); g.moveTo(cx - 40, top + h * 0.72); g.lineTo(cx + 40, top + h * 0.72); g.stroke();
      g.fillStyle = '#E0B23A'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 42, top + 72, 8, 0, 7); g.fill(); g.stroke(); }
      if (o.scarf) { g.fillStyle = o.scarf; g.beginPath(); g.moveTo(cx - 60, top + 5); g.lineTo(cx + 60, top + 5); g.lineTo(cx, top + 70); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx - 30 + i * 15, top + 20 + (i % 2) * 14, 3, 0, 7); g.fill(); } }
      break;
    }
    case 'coat': {
      g.fillStyle = '#F4EFEA'; g.beginPath(); g.moveTo(cx - 35, top); g.lineTo(cx, top + 120); g.lineTo(cx + 35, top); g.fill();
      if (o.tie) { g.fillStyle = o.tie; g.beginPath(); g.moveTo(cx - 9, top + 10); g.lineTo(cx + 9, top + 10); g.lineTo(cx + 14, top + 100); g.lineTo(cx, top + 120); g.lineTo(cx - 14, top + 100); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 35, top); g.lineTo(cx, top + 120); g.lineTo(cx + 35, top); g.moveTo(cx, top + 120); g.lineTo(cx, bottom); g.stroke();
      g.fillStyle = o.lapel ?? shade(o.color, -0.2); g.beginPath(); g.moveTo(cx - 35, top); g.lineTo(cx - 60, top + 60); g.lineTo(cx - 5, top + 115); g.fill(); g.beginPath(); g.moveTo(cx + 35, top); g.lineTo(cx + 60, top + 60); g.lineTo(cx + 5, top + 115); g.fill();
      break;
    }
    case 'armor': {
      g.fillStyle = shade(o.color, -0.2); for (let r = 0; r < 9; r++) for (let c = -4; c <= 4; c++) { g.beginPath(); g.arc(cx + c * 24 + (r % 2) * 12, top + 20 + r * 26, 10, 0, Math.PI); g.fill(); }
      if (o.skirt) { g.fillStyle = o.skirt; g.fillRect(x, top + h * 0.72, w, h); }
      g.fillStyle = '#E0B23A'; g.fillRect(x, top + h * 0.68, w, 18);
      break;
    }
    case 'plain': break;
  }
  g.restore();
  celShade(g, p, x, x + w, 'rgba(40,20,40,0.22)', rim);
  g.save(); p(); g.lineWidth = 9; g.strokeStyle = INK; g.stroke(); g.restore();
}

// ---------------------------------------------------------------- face
export function drawFace(g: CanvasRenderingContext2D, s: DrawState, look: Look, cx: number, cy: number) {
  const {rx, ry} = HEAD; const ox = s.lookX * rx * 0.28, oy = s.lookY * ry * 0.15;
  const ex = 0.36 * rx, ey = cy - ry * 0.02 + oy; const L = cx - ex + ox, R = cx + ex + ox; const my = cy + ry * 0.42 + oy, mx = cx + ox * 1.1;
  const acc = look.accessories ?? [];
  const eyeOval = (x: number, y: number, w = 15, h = 21) => { g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, w, h * (1 - s.blink * 0.92), 0, 0, 7); g.fill(); if (s.blink < 0.5) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x - w * 0.3, y - h * 0.35, w * 0.28, 0, 7); g.fill(); } };
  const lidEye = (x: number, y: number, lid = 0.45) => { g.save(); g.beginPath(); g.rect(x - 30, y - 40 + 40 * lid * 2 * 0.5 + 6, 60, 80); g.clip(); eyeOval(x, y, 16, 20); g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 22, y - 20 + 38 * lid * 0.5 + 4); g.lineTo(x + 22, y - 20 + 38 * lid * 0.5 + 4); g.stroke(); };
  const ring = (x: number, y: number, r = 30, pupil = 9) => { g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x, y, r, r * (1 - s.blink * 0.92), 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); if (s.blink < 0.5) { g.fillStyle = INK; g.beginPath(); g.arc(x + s.lookX * 6, y + 2, pupil, 0, 7); g.fill(); } };
  const arc = (x: number, y: number, up = true, w = 22) => { g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); up ? g.arc(x, y + 8, w, Math.PI * 1.15, Math.PI * 1.85) : g.arc(x, y - 10, w, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); };
  const chevron = (x: number, y: number, dir: 1 | -1) => { g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - 16 * dir, y - 16); g.lineTo(x + 14 * dir, y); g.lineTo(x - 16 * dir, y + 16); g.stroke(); };
  const brow = (x: number, y: number, angle: number, len = 26, w = 8) => { g.save(); g.translate(x, y); g.rotate(angle); g.strokeStyle = INK; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -5, len, 0); g.stroke(); g.restore(); };
  const line = (x0: number, y0: number, x1: number, y1: number, w = 6) => { g.strokeStyle = INK; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const teeth = (x: number, y: number, w: number, h: number, rows = 1, cols = 6) => { g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 8); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.lineWidth = 3; for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(x - w / 2 + (i * w) / cols, y - h / 2); g.lineTo(x - w / 2 + (i * w) / cols, y + h / 2); g.stroke(); } if (rows > 1) { g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke(); } };
  const smile = (x: number, y: number, w = 40, depth = 18) => { g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - w, y - 4); g.quadraticCurveTo(x, y + depth, x + w, y - 4); g.stroke(); };
  const grinMouth = (x: number, y: number, w = 62, h = 40) => { g.fillStyle = INK; g.beginPath(); g.moveTo(x - w, y - h * 0.35); g.quadraticCurveTo(x, y - h * 0.15, x + w, y - h * 0.35); g.quadraticCurveTo(x + w * 0.8, y + h, x, y + h); g.quadraticCurveTo(x - w * 0.8, y + h, x - w, y - h * 0.35); g.fill(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(x - w * 0.85, y - h * 0.28); g.quadraticCurveTo(x, y - h * 0.08, x + w * 0.85, y - h * 0.28); g.lineTo(x + w * 0.7, y + h * 0.12); g.quadraticCurveTo(x, y + h * 0.22, x - w * 0.7, y + h * 0.12); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * w * 0.2, y - h * 0.22); g.lineTo(x + i * w * 0.2, y + h * 0.16); g.stroke(); } };
  const oMouth = (x: number, y: number, r = 14) => { g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, 7); g.fill(); };
  const talkMouth = (x: number, y: number) => { g.fillStyle = INK; g.beginPath(); g.ellipse(x, y + 4, 22, 16, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#C0392B'; g.beginPath(); g.ellipse(x, y + 12, 12, 6, 0, 0, Math.PI * 2); g.fill(); };

  const face = s.talkOpen && !['laugh', 'shock', 'panic', 'wow'].includes(s.face) ? 'talk' : s.face;
  const eyesFor = (f: Face) => {
    switch (f) {
      case 'happy': case 'laugh': case 'content': arc(L, ey); arc(R, ey); break;
      case 'shock': case 'panic': case 'wow': ring(L, ey, 30, 8); ring(R, ey, 30, 8); break;
      case 'squint': chevron(L, ey, 1); chevron(R, ey, -1); break;
      case 'smug': case 'evil': lidEye(L, ey, 0.55); lidEye(R, ey, 0.55); break;
      case 'skeptical': lidEye(L, ey, 0.6); eyeOval(R, ey - 4, 15, 22); break;
      case 'sleepy': line(L - 20, ey + 4, L + 20, ey + 4, 7); line(R - 20, ey + 4, R + 20, ey + 4, 7); break;
      case 'crying': arc(L, ey, false); arc(R, ey, false); break;
      case 'dead': line(L - 15, ey - 15, L + 15, ey + 15, 7); line(L - 15, ey + 15, L + 15, ey - 15, 7); line(R - 15, ey - 15, R + 15, ey + 15, 7); line(R - 15, ey + 15, R + 15, ey - 15, 7); break;
      case 'angry': case 'furious': case 'determined': eyeOval(L, ey + 4, 15, 17); eyeOval(R, ey + 4, 15, 17); break;
      default: eyeOval(L, ey); eyeOval(R, ey);
    }
  };
  if (!acc.includes('sunglasses') && face !== 'cool') eyesFor(face === 'talk' ? s.face : face);
  else { // sunglasses
    g.fillStyle = INK; for (const x of [L, R]) { g.beginPath(); g.roundRect(x - 36, ey - 22, 72, 44, 16); g.fill(); } g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.moveTo(L + 30, ey - 12); g.lineTo(R - 30, ey - 12); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (const x of [L, R]) { g.beginPath(); g.ellipse(x - 14, ey - 8, 12, 6, -0.4, 0, 7); g.fill(); }
  }
  // brows
  switch (s.face) {
    case 'angry': case 'furious': brow(L + 4, ey - 34, 0.42, 26, 10); brow(R - 4, ey - 34, -0.42, 26, 10); break;
    case 'determined': brow(L, ey - 34, 0.2); brow(R, ey - 34, -0.2); break;
    case 'skeptical': brow(L, ey - 22, 0.12); brow(R, ey - 46, -0.18); break;
    case 'smug': brow(R, ey - 42, -0.15); break;
    case 'sad': case 'crying': case 'nervous': brow(L, ey - 36, -0.3); brow(R, ey - 36, 0.3); break;
    case 'shock': case 'panic': case 'wow': brow(L, ey - 50, -0.1, 22, 6); brow(R, ey - 50, 0.1, 22, 6); break;
    case 'evil': brow(L + 4, ey - 30, 0.35); brow(R - 4, ey - 30, -0.35); break;
  }
  // mustache sits over the mouth area
  const mouthFor = (f: Face) => {
    switch (f) {
      case 'neutral': line(mx - 22, my, mx + 22, my, 7); break;
      case 'content': smile(mx, my, 26, 12); break;
      case 'smug': g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx - 26, my + 4); g.quadraticCurveTo(mx + 6, my + 10, mx + 30, my - 8); g.stroke(); break;
      case 'happy': grinMouth(mx, my, 52, 34); break;
      case 'grin': case 'evil': teeth(mx, my + 4, 96, 34, 1, 7); break;
      case 'laugh': g.fillStyle = INK; g.beginPath(); g.moveTo(mx - 50, my - 10); g.quadraticCurveTo(mx, my - 4, mx + 50, my - 10); g.quadraticCurveTo(mx + 40, my + 50, mx, my + 52); g.quadraticCurveTo(mx - 40, my + 50, mx - 50, my - 10); g.fill(); g.fillStyle = '#E2626B'; g.beginPath(); g.ellipse(mx, my + 34, 24, 12, 0, 0, 7); g.fill(); break;
      case 'shock': case 'wow': oMouth(mx, my + 6, f === 'wow' ? 26 : 14); break;
      case 'panic': case 'furious': teeth(mx, my + 6, 74, 40, 2, 5); break;
      case 'angry': g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(mx - 26, my + 10); g.quadraticCurveTo(mx, my - 8, mx + 26, my + 10); g.stroke(); break;
      case 'squint': g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(mx - 30, my); for (let i = 0; i < 6; i++) g.lineTo(mx - 30 + (i + 1) * 10, my + (i % 2 ? -7 : 7)); g.stroke(); break;
      case 'skeptical': line(mx - 20, my + 4, mx + 22, my - 4, 7); break;
      case 'sleepy': oMouth(mx, my + 4, 9); break;
      case 'sad': case 'crying': g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(mx - 26, my + 12); g.quadraticCurveTo(mx, my - 6, mx + 26, my + 12); g.stroke(); break;
      case 'nervous': g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(mx - 28, my); g.bezierCurveTo(mx - 10, my - 10, mx + 10, my + 10, mx + 28, my); g.stroke(); break;
      case 'cool': smile(mx + 4, my - 2, 28, 10); break;
      case 'determined': line(mx - 24, my + 2, mx + 24, my + 2, 8); break;
      case 'dead': g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(mx - 24, my); g.quadraticCurveTo(mx, my - 12, mx + 24, my); g.stroke(); break;
      case 'talk': talkMouth(mx, my); break;
    }
  };
  mouthFor(face);
  if (acc.includes('mustache') || acc.includes('grayBeard')) {
    g.fillStyle = acc.includes('grayBeard') ? '#D9D4CC' : INK; const y = my - 20;
    g.beginPath(); g.moveTo(mx, y - 6); g.bezierCurveTo(mx - 25, y - 22, mx - 55, y - 6, mx - 62, y + 26); g.bezierCurveTo(mx - 48, y + 6, mx - 22, y + 8, mx, y + 6); g.bezierCurveTo(mx + 22, y + 8, mx + 48, y + 6, mx + 62, y + 26); g.bezierCurveTo(mx + 55, y - 6, mx + 25, y - 22, mx, y - 6); g.fill();
    if (acc.includes('grayBeard')) { g.beginPath(); g.moveTo(mx - 70, my - 10); g.quadraticCurveTo(mx - 60, my + 120, mx, my + 140); g.quadraticCurveTo(mx + 60, my + 120, mx + 70, my - 10); g.quadraticCurveTo(mx, my + 40, mx - 70, my - 10); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); }
  }
  if (acc.includes('beard')) { g.fillStyle = INK; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(cx - rx * 0.75, cy + ry * 0.2); g.quadraticCurveTo(cx, cy + ry * 1.25, cx + rx * 0.75, cy + ry * 0.2); g.quadraticCurveTo(cx, cy + ry * 0.75, cx - rx * 0.75, cy + ry * 0.2); g.fill(); g.globalAlpha = 1; }
  if (acc.includes('glasses')) { g.strokeStyle = INK; g.lineWidth = 6; for (const x of [L, R]) { g.beginPath(); g.arc(x, ey, 34, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(L + 34, ey); g.lineTo(R - 34, ey); g.stroke(); }
  if (acc.includes('eyepatch')) { g.fillStyle = INK; g.beginPath(); g.ellipse(R, ey, 34, 30, 0, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.moveTo(cx - rx, cy - ry * 0.45); g.lineTo(cx + rx * 0.98, cy + ry * 0.15); g.stroke(); }
  if (acc.includes('blush') || s.face === 'laugh' || s.face === 'happy') { g.fillStyle = 'rgba(230,110,110,0.35)'; for (const x of [L - 18, R + 18]) { g.beginPath(); g.ellipse(x, ey + 48, 24, 13, 0, 0, 7); g.fill(); } }
}

// ---------------------------------------------------------------- fx
export function drawFx(g: CanvasRenderingContext2D, s: DrawState, cx: number, cy: number) {
  const {rx, ry} = HEAD; const f = s.frame;
  for (const fx of s.fx) {
    const age = s.fxAge[fx] ?? 0;
    if (fx === 'sweat') { const y = cy - ry * 0.55 + Math.min(age, 20) * 2.2; const x = cx + rx * 0.82; g.fillStyle = '#7CC6F2'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y - 30); g.quadraticCurveTo(x + 20, y, x + 14, y + 10); g.arc(x, y + 8, 15, 0.2, Math.PI - 0.2); g.quadraticCurveTo(x - 20, y, x, y - 30); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 5, y + 4, 4, 0, 7); g.fill(); }
    if (fx === 'tears') { g.fillStyle = '#7CC6F2'; for (const sx of [-1, 1]) { const x = cx + sx * rx * 0.36; const len = 40 + (age % 12) * 4; g.beginPath(); g.roundRect(x - 9, cy + 10, 18, len, 9); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); } }
    if (fx === 'steam') for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const t = ((age + k * 8) % 24) / 24; const x = cx + sx * (rx * 0.95 + t * 50), y = cy - ry * 0.6 - t * 120; const r = 18 + t * 26; g.globalAlpha = 1 - t; g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(30,22,18,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, 7); g.arc(x + r * 0.7, y + 4, r * 0.7, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (fx === 'zzz') for (let k = 0; k < 3; k++) { const t = ((age + k * 12) % 36) / 36; g.globalAlpha = 1 - t * 0.8; g.fillStyle = '#FFFFFF'; g.strokeStyle = INK; g.lineWidth = 6; g.font = `900 ${50 + k * 18}px Nunito, sans-serif`; const x = cx + rx * 0.7 + t * 60 + k * 20, y = cy - ry * 0.7 - t * 140 - k * 30; g.strokeText('Z', x, y); g.fillText('Z', x, y); g.globalAlpha = 1; }
    if (fx === 'shockLines') { g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; const p = 1 + Math.sin(f * 1.3) * 0.06; for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.95 + k * (Math.PI * 0.9 / 6); g.beginPath(); g.moveTo(cx + Math.cos(a) * rx * 1.15 * p, cy + Math.sin(a) * ry * 1.2 * p); g.lineTo(cx + Math.cos(a) * rx * 1.4 * p, cy + Math.sin(a) * ry * 1.45 * p); g.stroke(); } }
    if (fx === 'sparkle') for (let k = 0; k < 4; k++) { const a = k * 1.7 + f * 0.05; const x = cx + Math.cos(a) * rx * 1.3, y = cy + Math.sin(a) * ry * 1.2; const r = 14 + 8 * Math.sin(f * 0.4 + k); g.fillStyle = '#FFF4B0'; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }
    if (fx === 'question' || fx === 'exclaim') { const pop = Math.min(1, age / 5); g.save(); g.translate(cx + rx * 0.95, cy - ry * 1.05); g.scale(pop, pop); g.font = '900 120px Nunito, sans-serif'; g.lineWidth = 10; g.strokeStyle = INK; g.fillStyle = fx === 'question' ? '#FFFFFF' : '#FFD23F'; const ch = fx === 'question' ? '?' : '!'; g.strokeText(ch, 0, 0); g.fillText(ch, 0, 0); g.restore(); }
    if (fx === 'vein') { const x = cx + rx * 0.55, y = cy - ry * 0.6; g.strokeStyle = '#C0392B'; g.lineWidth = 7; g.lineCap = 'round'; const p = 1 + 0.12 * Math.sin(f * 0.8); for (const [a, b] of [[[-1, -1], [-0.3, -0.3]], [[1, -1], [0.3, -0.3]], [[-1, 1], [-0.3, 0.3]], [[1, 1], [0.3, 0.3]]] as const) { g.beginPath(); g.moveTo(x + a[0] * 22 * p, y + a[1] * 22 * p); g.quadraticCurveTo(x + b[0] * 10, y + a[1] * 6, x + b[0] * 22 * p, y + b[1] * 22 * p); g.stroke(); } }
    if (fx === 'hearts') for (let k = 0; k < 3; k++) { const t = ((age + k * 10) % 30) / 30; const x = cx + (k - 1) * 70, y = cy - ry - t * 120; g.globalAlpha = 1 - t; g.fillStyle = '#FF5A7A'; g.beginPath(); g.moveTo(x, y + 18); g.bezierCurveTo(x - 30, y - 6, x - 14, y - 26, x, y - 10); g.bezierCurveTo(x + 14, y - 26, x + 30, y - 6, x, y + 18); g.fill(); g.globalAlpha = 1; }
    if (fx === 'dizzy') for (let k = 0; k < 3; k++) { const a = f * 0.25 + (k * Math.PI * 2) / 3; g.fillStyle = '#FFD23F'; g.strokeStyle = INK; g.lineWidth = 3; const x = cx + Math.cos(a) * rx * 0.9, y = cy - ry * 1.0 + Math.sin(a) * 25; star(g, x, y, 18); g.stroke(); }
  }
}

// ---------------------------------------------------------------- held props
export function drawHeld(g: CanvasRenderingContext2D, p: HeldProp, x: number, y: number, side: 1 | -1, frame: number) {
  g.save(); g.translate(x, y); g.lineJoin = 'round';
  const ink = (path: () => void, fill: string, lw = 5) => { path(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
  switch (p.kind) {
    case 'mug': ink(() => { g.beginPath(); g.roundRect(-34, -70, 60, 80, 8); }, '#E0A93A'); ink(() => { g.beginPath(); g.arc(30 * side, -30, 20, -1.3, 1.3); }, 'rgba(0,0,0,0)', 7); g.fillStyle = '#FFF8E8'; g.beginPath(); g.ellipse(-4, -72, 32, 12, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); break;
    case 'bottle': ink(() => { g.beginPath(); g.moveTo(-10, -110); g.lineTo(10, -110); g.lineTo(10, -80); g.quadraticCurveTo(26, -70, 26, -50); g.lineTo(26, 20); g.lineTo(-26, 20); g.lineTo(-26, -50); g.quadraticCurveTo(-26, -70, -10, -80); g.closePath(); }, p.color ?? '#3FA9F5'); if (p.label) { g.fillStyle = '#FFFFFF'; g.fillRect(-22, -40, 44, 34); g.fillStyle = INK; g.font = '900 13px Nunito'; g.textAlign = 'center'; g.fillText(p.label, 0, -18); } g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-18, -60, 7, 70); break;
    case 'newspaper': ink(() => { g.beginPath(); g.rect(-120, -190, 240, 300); }, '#F3E9D2', 5); g.fillStyle = INK; g.textAlign = 'center'; g.font = '700 22px "Playfair Display", serif'; g.fillText(p.sub ?? 'The Daily Herald', 0, -155); g.fillRect(-105, -145, 210, 3); g.font = '900 30px "Playfair Display", serif'; const words = p.title.split(' '); let line = '', ly = -110; for (const w of words) { if (g.measureText(line + w).width > 200) { g.fillText(line.trim(), 0, ly); line = ''; ly += 34; } line += w + ' '; } g.fillText(line.trim(), 0, ly); g.fillStyle = 'rgba(30,22,18,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(-100, ly + 30 + i * 14, i % 3 === 2 ? 120 : 200, 6); break;
    case 'torch': ink(() => { g.beginPath(); g.rect(-8, -40, 16, 140); }, '#7A4A22'); { const fl = 1 + 0.15 * Math.sin(frame * 0.9); g.fillStyle = '#FFB020'; g.beginPath(); g.moveTo(0, -120 * fl); g.quadraticCurveTo(34, -60, 0, -38); g.quadraticCurveTo(-34, -60, 0, -120 * fl); g.fill(); g.fillStyle = '#FFF1A8'; g.beginPath(); g.ellipse(0, -60, 10, 18, 0, 0, 7); g.fill(); } break;
    case 'lantern': ink(() => { g.beginPath(); g.rect(-30, 20, 60, 80); }, '#FFD27A'); ink(() => { g.beginPath(); g.rect(-36, 10, 72, 14); g.rect(-36, 96, 72, 14); }, '#3A2A20'); g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(0, 10, 22, Math.PI, 0); g.stroke(); g.fillStyle = 'rgba(255,240,180,0.9)'; g.beginPath(); g.ellipse(0, 60, 12, 20, 0, 0, 7); g.fill(); break;
    case 'cane': g.strokeStyle = '#6B3E1E'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 18, 330); g.stroke(); g.fillStyle = '#E0B23A'; g.beginPath(); g.arc(0, -6, 14, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); break;
    case 'shovel': g.strokeStyle = '#7A4A22'; g.lineWidth = 12; g.beginPath(); g.moveTo(-side * 60, -120); g.lineTo(side * 60, 120); g.stroke(); ink(() => { g.beginPath(); g.moveTo(side * 50, 110); g.lineTo(side * 110, 130); g.lineTo(side * 100, 210); g.lineTo(side * 40, 190); g.closePath(); }, '#8A939E'); break;
    case 'coin': ink(() => { g.beginPath(); g.arc(0, 0, 18, 0, 7); }, '#F2C94C', 4); break;
    case 'cash': for (let i = 0; i < 3; i++) ink(() => { g.beginPath(); g.rect(-50 + i * 6, -30 - i * 6, 100, 56); }, '#9BD37A', 4); g.fillStyle = INK; g.font = '900 30px Nunito'; g.textAlign = 'center'; g.fillText('¥', 12, -8); break;
    case 'cup': ink(() => { g.beginPath(); g.moveTo(-30, -50); g.lineTo(30, -50); g.quadraticCurveTo(30, 0, 0, 5); g.quadraticCurveTo(-30, 0, -30, -50); }, '#D9A441'); g.fillStyle = p.liquid ?? '#7A1F2B'; g.beginPath(); g.ellipse(0, -50, 28, 9, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 5); g.lineTo(0, 40); g.moveTo(-18, 42); g.lineTo(18, 42); g.stroke(); break;
    case 'scroll': ink(() => { g.beginPath(); g.rect(-60, -100, 120, 160); }, '#F3E2B8'); ink(() => { g.beginPath(); g.ellipse(0, -100, 66, 12, 0, 0, 7); g.ellipse(0, 60, 66, 12, 0, 0, 7); }, '#E0C88A', 4); break;
    case 'bucket': ink(() => { g.beginPath(); g.moveTo(-50, -60); g.lineTo(50, -60); g.lineTo(40, 30); g.lineTo(-40, 30); g.closePath(); }, '#3A3A44'); if (p.content) { g.fillStyle = p.content; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-36 + (i % 5) * 18, -64 - Math.floor(i / 5) * 14, 10, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); } } break;
    case 'tongs': g.strokeStyle = '#4A4F58'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 220, 40); g.moveTo(0, 0); g.lineTo(side * 220, 70); g.stroke(); break;
    case 'phone': ink(() => { g.beginPath(); g.roundRect(-24, -50, 48, 90, 8); }, '#2A2A33'); g.fillStyle = '#7FD3FF'; g.fillRect(-18, -42, 36, 70); break;
    case 'sign': ink(() => { g.beginPath(); g.rect(-6, -40, 12, 200); }, '#7A4A22'); ink(() => { g.beginPath(); g.rect(-150, -170, 300, 140); }, '#F3E9D2'); g.fillStyle = '#C0392B'; g.textAlign = 'center'; g.font = '900 44px Rye, serif'; g.fillText(p.text, 0, -86); break;
    case 'clipboard': ink(() => { g.beginPath(); g.roundRect(-90, -150, 180, 230, 8); }, '#B07A44'); ink(() => { g.beginPath(); g.rect(-75, -130, 150, 195); }, '#FFFFFF', 3); g.fillStyle = INK; g.textAlign = 'center'; g.font = '800 22px Nunito'; p.text.split('\n').forEach((l, i) => g.fillText(l, 0, -95 + i * 32)); break;
    case 'ball': { const glow = p.glow ? 0.5 + 0.2 * Math.sin(frame * 0.5) : 0; if (glow) { const gr = g.createRadialGradient(0, 0, 10, 0, 0, 90); gr.addColorStop(0, `rgba(255,170,60,${glow})`); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(-90, -90, 180, 180); } ink(() => { g.beginPath(); g.arc(0, -20, 40, 0, 7); }, p.color ?? '#2B2B33'); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-14, -34, 10, 0, 7); g.fill(); break; }
    case 'pot': ink(() => { g.beginPath(); g.moveTo(-60, -40); g.lineTo(60, -40); g.quadraticCurveTo(70, 50, 0, 55); g.quadraticCurveTo(-70, 50, -60, -40); }, '#2E2A28'); if (p.glow) { g.fillStyle = '#FFB020'; g.beginPath(); g.ellipse(0, -40, 56, 14, 0, 0, 7); g.fill(); } break;
  }
  g.restore();
}

// ---------------------------------------------------------------- main
export function drawCharacter(g: CanvasRenderingContext2D, look: Look, s: DrawState) {
  g.clearRect(0, 0, CW, CH);
  g.save();
  g.translate(0, PAD);
  // body transforms around the feet: squash, lean, bob
  g.translate(CX, FEET_Y); g.rotate(rad(s.lean)); g.scale(1 / Math.sqrt(s.squash), s.squash); g.translate(-CX, -FEET_Y);
  g.translate(0, -s.bob);
  const cx = CX; const legs = s.legs; const seated = legs.thighScale < 0.5;
  const sitDrop = seated ? THIGH * 0.62 : 0;
  g.translate(0, sitDrop);
  const longRobe = look.outfit.kind === 'robe' && (look.outfit as any).long !== false;
  // arms that go behind the body
  const shoulderL = [cx - SHOULDER_X, SHOULDER_Y] as const, shoulderR = [cx + SHOULDER_X, SHOULDER_Y] as const;
  if (s.behindArms.l) limb(g, shoulderL[0], shoulderL[1], s.armL[0], s.armL[1], UPPER, FORE, -1);
  if (s.behindArms.r) limb(g, shoulderR[0], shoulderR[1], s.armR[0], s.armR[1], UPPER, FORE, 1);
  // legs
  if (!longRobe) {
    for (const [side, t, sh] of [[-1, legs.lt, legs.ls], [1, legs.rt, legs.rs]] as const) {
      const r = limb(g, cx + side * HIP_X, HIP_Y, t, sh, THIGH, SHIN - (seated ? 0 : 0), side as 1 | -1, legs.thighScale);
      g.strokeStyle = INK; g.lineWidth = LIMB_W + 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(r.hx, r.hy); g.lineTo(r.hx + side * 16, r.hy + 2); g.stroke();
    }
  } else {
    g.fillStyle = INK; for (const side of [-1, 1]) { g.beginPath(); g.ellipse(cx + side * 36, FEET_Y - 26, 28, 12, 0, 0, 7); g.fill(); }
  }
  drawBody(g, look.outfit, cx, s.rim);
  if (s.facing === 'front') {
    if (!s.behindArms.l) { const r = limb(g, shoulderL[0], shoulderL[1], s.armL[0], s.armL[1], UPPER, FORE, -1); if (s.holdL) drawHeld(g, s.holdL, r.hx, r.hy, -1, s.frame); g.fillStyle = INK; g.beginPath(); g.arc(r.hx, r.hy, HAND_R, 0, 7); g.fill(); }
    if (!s.behindArms.r) { const r = limb(g, shoulderR[0], shoulderR[1], s.armR[0], s.armR[1], UPPER, FORE, 1); if (s.holdR) drawHeld(g, s.holdR, r.hx, r.hy, 1, s.frame); g.fillStyle = INK; g.beginPath(); g.arc(r.hx, r.hy, HAND_R, 0, 7); g.fill(); }
    if ((look.accessories ?? []).includes('camera')) { g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 70, BODY.top + 10); g.lineTo(cx, BODY.top + 120); g.lineTo(cx + 70, BODY.top + 10); g.stroke(); g.fillStyle = '#2A2A33'; g.beginPath(); g.roundRect(cx - 34, BODY.top + 100, 68, 46, 8); g.fill(); g.fillStyle = '#7FD3FF'; g.beginPath(); g.arc(cx, BODY.top + 123, 12, 0, 7); g.fill(); }
    if ((look.accessories ?? []).includes('bowtie')) { g.fillStyle = '#C0392B'; g.beginPath(); g.moveTo(cx, BODY.top + 18); g.lineTo(cx - 34, BODY.top); g.lineTo(cx - 34, BODY.top + 36); g.closePath(); g.moveTo(cx, BODY.top + 18); g.lineTo(cx + 34, BODY.top); g.lineTo(cx + 34, BODY.top + 36); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
  }
  // head
  const hcx = cx, hcy = HEAD.cy;
  if (s.facing === 'back') drawHair(g, look.hair, hcx, hcy, true);
  const hp = () => headPath(g, hcx, hcy, HEAD.rx, HEAD.ry);
  inked(g, hp, look.skin ?? SKIN, 10, [3, 5]);
  if (s.flush) { g.save(); hp(); g.clip(); g.fillStyle = s.flush.color; g.fillRect(hcx - HEAD.rx - 10, hcy - HEAD.ry - 10, HEAD.rx * 2 + 20, (HEAD.ry * 2 + 20) * s.flush.amt); g.restore(); }
  celShade(g, hp, hcx - HEAD.rx, hcx + HEAD.rx, 'rgba(110,80,70,0.20)', s.rim);
  g.save(); hp(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke(); g.restore();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(hcx - HEAD.rx * 0.52, hcy - HEAD.ry * 0.5, 22, 12, -0.6, 0, 7); g.fill();
  if (s.facing === 'front') { drawHair(g, look.hair, hcx, hcy, false); drawFace(g, s, look, hcx, hcy); }
  else if (look.hair && look.hair.style !== 'none') drawHair(g, look.hair, hcx, hcy, true);
  drawHat(g, look.hat, hcx, hcy);
  drawFx(g, s, hcx, hcy);
  g.restore();
}
