import * as THREE from 'three';
import {rng} from '../random';

/**
 * Hand-illustrated texture generators. Everything is drawn like an illustrator would:
 * flat base colour + per-piece variation + painted gradient + INK line detail + wear.
 * All seeded → deterministic across render workers.
 */
export const INK = '#2A1B26';
const cache = new Map<string, THREE.Texture>();

export function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const k = `${key}|${w}x${h}|${repeat?.join(',')}`;
  const hit = cache.get(k);
  if (hit) return hit as THREE.CanvasTexture;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  cache.set(k, t);
  return t;
}

// ---------- colour helpers ----------
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = {h: 0, s: 0, l: 0}; c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * (amt < 0 ? 1.05 : 0.95)), Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}
export function jitter(hex: string, r: ReturnType<typeof rng>, amt = 0.04): string {
  const c = new THREE.Color(hex); const hsl = {h: 0, s: 0, l: 0}; c.getHSL(hsl);
  c.setHSL((hsl.h + r.range(-amt * 0.3, amt * 0.3) + 1) % 1, Math.max(0, Math.min(1, hsl.s + r.range(-amt, amt))), Math.max(0, Math.min(1, hsl.l + r.range(-amt, amt))));
  return '#' + c.getHexString();
}
function inkLine(g: CanvasRenderingContext2D, pts: [number, number][], width: number, color = INK, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke(); g.restore();
}
/** slightly wobbly hand-drawn line between two points */
export function handLine(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, r: ReturnType<typeof rng>, color = INK, alpha = 1, wobble = 1.2) {
  const n = 6; const pts: [number, number][] = [];
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= n; i++) { const t = i / n; const o = (i === 0 || i === n) ? 0 : r.range(-wobble, wobble); pts.push([x1 + dx * t + nx * o, y1 + dy * t + ny * o]); }
  inkLine(g, pts, width, color, alpha);
}
function grain(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof rng>, n: number, alpha: number, size = 1.2) {
  g.save();
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * r.next();
    g.fillStyle = r.chance(0.5) ? '#000' : '#fff';
    g.fillRect(r.range(0, w), r.range(0, h), size, size);
  }
  g.restore();
}
function vGradient(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bottom: string, alpha = 1) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.save(); g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
}

// ---------- WOOD PLANKS (decks, floors, walls, hulls) ----------
export type WoodOpts = {base?: string; planks?: number; seed?: number; ink?: number; nails?: boolean; knots?: boolean; vertical?: boolean; worn?: number};
export function woodPlanks(o: WoodOpts = {}, repeat?: [number, number]) {
  const {base = '#C98A4E', planks = 8, seed = 1, ink = 1, nails = true, knots = true, vertical = false, worn = 0.5} = o;
  return canvasTexture(`wood:${JSON.stringify(o)}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed);
    if (vertical) { g.translate(W, 0); g.rotate(Math.PI / 2); }
    const ph = H / planks;
    for (let p = 0; p < planks; p++) {
      const y = p * ph;
      // planks are broken into segments with butt joints
      let x = -r.range(0, W * 0.5);
      while (x < W) {
        const len = r.range(W * 0.35, W * 0.9);
        const col = jitter(base, r, 0.05);
        g.fillStyle = col; g.fillRect(x, y, len, ph);
        // painted light: top edge lighter, bottom darker
        vGradient(g, x, y, len, ph, 'rgba(255,240,220,0.18)', 'rgba(60,25,5,0.22)');
        // grain: long thin wavy strokes
        const strokes = r.int(5, 9);
        for (let s = 0; s < strokes; s++) {
          const gy = y + r.range(ph * 0.12, ph * 0.88); const pts: [number, number][] = [];
          const sx = x + r.range(0, len * 0.3), ex = x + len - r.range(0, len * 0.3);
          for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([sx + (ex - sx) * t, gy + Math.sin(t * 6 + s) * r.range(0.5, 2.5)]); }
          inkLine(g, pts, r.range(1, 2.2), shade(col, -0.22), 0.35 + 0.25 * ink);
        }
        if (knots && r.chance(0.35)) {
          const kx = x + r.range(len * 0.2, len * 0.8), ky = y + ph * r.range(0.3, 0.7), kr = r.range(4, 9);
          g.save(); g.strokeStyle = shade(col, -0.3); g.globalAlpha = 0.6; g.lineWidth = 1.6;
          for (let q = 0; q < 3; q++) { g.beginPath(); g.ellipse(kx, ky, kr * (1 + q * 0.9) * 2.2, kr * (1 + q * 0.6), 0, 0, Math.PI * 2); g.stroke(); }
          g.fillStyle = shade(col, -0.35); g.beginPath(); g.ellipse(kx, ky, kr * 1.4, kr * 0.8, 0, 0, Math.PI * 2); g.fill(); g.restore();
        }
        // worn light scuffs
        for (let s = 0; s < 4 * worn; s++) { g.save(); g.globalAlpha = 0.12; g.fillStyle = '#fff3e0'; g.beginPath(); g.ellipse(x + r.range(0, len), y + r.range(0, ph), r.range(8, 30), r.range(1, 3), 0, 0, 7); g.fill(); g.restore(); }
        // butt joint ink + nails
        handLine(g, x, y, x, y + ph, 3 * ink, r);
        if (nails) for (const nx of [x + 10, x + len - 10]) for (const ny of [y + ph * 0.28, y + ph * 0.72]) { g.fillStyle = shade(base, -0.45); g.beginPath(); g.arc(nx, ny, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(nx - 0.8, ny - 0.8, 0.9, 0, 7); g.fill(); }
        x += len;
      }
      // seam between plank rows (thick ink + soft shadow under)
      g.save(); g.globalAlpha = 0.35; g.fillStyle = '#2a1408'; g.fillRect(0, y + ph - 4, W, 4); g.restore();
      handLine(g, 0, y + ph, W, y + ph, 3.4 * ink, r, INK, 0.9, 0.8);
    }
    grain(g, W, H, r, 9000, 0.06);
  }, repeat);
}

// ---------- BRICKS ----------
export function bricks(o: {base?: string; mortar?: string; rows?: number; seed?: number} = {}, repeat?: [number, number]) {
  const {base = '#D4643A', mortar = '#E9D9C0', rows = 14, seed = 2} = o;
  return canvasTexture(`brick:${JSON.stringify(o)}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); g.fillStyle = mortar; g.fillRect(0, 0, W, H);
    const bh = H / rows, bw = bh * 2.1, gap = bh * 0.12;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -off; x < W; x += bw) {
        const col = jitter(base, r, 0.06);
        const bx = x + gap / 2, by = row * bh + gap / 2, w = bw - gap, h = bh - gap;
        g.fillStyle = col; g.beginPath(); g.roundRect(bx, by, w, h, 3); g.fill();
        vGradient(g, bx, by, w, h, 'rgba(255,230,200,0.22)', 'rgba(70,15,0,0.25)');
        if (r.chance(0.25)) { g.fillStyle = shade(col, 0.08); g.beginPath(); g.moveTo(bx + w, by); g.lineTo(bx + w - r.range(6, 14), by); g.lineTo(bx + w, by + r.range(5, 12)); g.fill(); }
        g.save(); g.strokeStyle = INK; g.lineWidth = 2.2; g.globalAlpha = 0.85; g.beginPath(); g.roundRect(bx, by, w, h, 3); g.stroke(); g.restore();
        // highlight stroke on top edge
        handLine(g, bx + 5, by + 4, bx + w * r.range(0.3, 0.7), by + 4, 1.5, r, '#ffe9cc', 0.5, 0.4);
      }
    }
    grain(g, W, H, r, 7000, 0.07);
  }, repeat);
}

// ---------- STONE PAVING / FLAGSTONES ----------
export function stoneTiles(o: {base?: string; seed?: number; cols?: number} = {}, repeat?: [number, number]) {
  const {base = '#CFC6B4', seed = 3, cols = 5} = o;
  return canvasTexture(`stone:${JSON.stringify(o)}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); g.fillStyle = shade(base, -0.25); g.fillRect(0, 0, W, H);
    const cw = W / cols, rows = cols;
    for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
      const off = row % 2 ? cw / 2 : 0;
      for (const ox of [0, -W]) {
        const x = c * cw + off + ox + 5, y = row * (H / rows) + 5, w = cw - 10, h = H / rows - 10;
        const col = jitter(base, r, 0.04);
        g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
        vGradient(g, x, y, w, h, 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.12)');
        for (let k = 0; k < 4; k++) { g.save(); g.globalAlpha = 0.18; g.fillStyle = shade(col, -0.2); g.beginPath(); g.arc(x + r.range(10, w - 10), y + r.range(10, h - 10), r.range(2, 5), 0, 7); g.fill(); g.restore(); }
        if (r.chance(0.3)) handLine(g, x + r.range(10, w / 2), y + r.range(10, h / 2), x + r.range(w / 2, w - 10), y + r.range(h / 2, h - 10), 1.5, r, INK, 0.5, 3);
        g.save(); g.strokeStyle = INK; g.globalAlpha = 0.75; g.lineWidth = 2.4; g.beginPath(); g.roundRect(x, y, w, h, 10); g.stroke(); g.restore();
      }
    }
    grain(g, W, H, r, 8000, 0.06);
  }, repeat);
}

// ---------- STRIPES / FABRIC ----------
export function stripes(o: {a: string; b: string; count?: number; vertical?: boolean}) {
  return canvasTexture(`stripes:${JSON.stringify(o)}`, 256, 256, (g, W, H) => {
    const n = o.count ?? 6;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? o.b : o.a; if (o.vertical) g.fillRect((i * W) / n, 0, W / n + 1, H); else g.fillRect(0, (i * H) / n, W, H / n + 1); }
  });
}

// ---------- LAYERED ROCK STRATA (canyons, cliffs, sea stacks) ----------
export function strata(o: {colors: string[]; seed?: number; bands?: number}, repeat?: [number, number]) {
  const {colors, seed = 4, bands = 18} = o;
  return canvasTexture(`strata:${JSON.stringify(o)}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); let y = 0;
    while (y < H) {
      const bh = r.range(H / bands * 0.5, H / bands * 1.6); const col = jitter(r.pick(colors), r, 0.04);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + y) * 3 + r.range(-2, 2));
      g.lineTo(W, y + bh + 4); g.lineTo(0, y + bh + 4); g.closePath(); g.fill();
      for (let s = 0; s < 6; s++) { const sx = r.range(0, W); handLine(g, sx, y + r.range(0, bh), sx + r.range(40, 160), y + r.range(0, bh), r.range(1, 2), r, shade(col, -0.18), 0.5, 1.5); }
      handLine(g, 0, y, W, y, 1.8, r, shade(col, -0.3), 0.55, 2);
      y += bh;
    }
    // vertical erosion streaks
    for (let s = 0; s < 40; s++) { const sx = r.range(0, W); g.save(); g.globalAlpha = 0.1; g.fillStyle = '#000'; g.fillRect(sx, 0, r.range(2, 6), H); g.restore(); }
    grain(g, W, H, r, 9000, 0.06);
  }, repeat);
}

// ---------- METAL (cannon iron, rails, rivets) ----------
export function metal(o: {base?: string; rivets?: boolean; seed?: number} = {}, repeat?: [number, number]) {
  const {base = '#5A6270', rivets = false, seed = 5} = o;
  return canvasTexture(`metal:${JSON.stringify(o)}`, 512, 512, (g, W, H) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { g.save(); g.globalAlpha = 0.08; g.fillStyle = r.chance(0.5) ? '#fff' : '#000'; g.fillRect(0, r.range(0, H), W, r.range(1, 6)); g.restore(); }
    for (let i = 0; i < 12; i++) { g.save(); g.globalAlpha = 0.18; g.fillStyle = '#7a3b1c'; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(4, 20), r.range(2, 8), r.range(0, 3), 0, 7); g.fill(); g.restore(); }
    if (rivets) for (let x = 24; x < W; x += 64) for (const y of [20, H - 20]) { g.fillStyle = shade(base, -0.2); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, 7); g.fill(); }
    grain(g, W, H, r, 4000, 0.08);
  }, repeat);
}

// ---------- SIGNAGE / LABELS (story-specific text props — always spelled correctly) ----------
export type SignStyle = 'stencil' | 'painted' | 'brass' | 'neon' | 'paper' | 'banner';
export function signTexture(text: string, o: {style?: SignStyle; sub?: string; w?: number; h?: number; color?: string; bg?: string; seed?: number} = {}) {
  const {style = 'painted', sub, w = 1024, h = 384, color, bg, seed = 6} = o;
  return canvasTexture(`sign:${text}:${JSON.stringify(o)}`, w, h, (g, W, H) => {
    const r = rng(seed);
    const font = style === 'stencil' ? '"Black Ops One", "Stencil", Impact, sans-serif' : style === 'neon' ? '"Nunito", sans-serif' : style === 'paper' ? '"Playfair Display", Georgia, serif' : '"Rye", "Alfa Slab One", Georgia, serif';
    if (style === 'stencil') {
      // stencilled directly onto wood/metal: transparent bg, distressed ink
      g.clearRect(0, 0, W, H);
    } else if (style === 'brass') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#F6D77A'); gr.addColorStop(0.5, '#D9A441'); gr.addColorStop(1, '#A8761E');
      g.fillStyle = gr; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 18); g.fill(); g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
      g.strokeStyle = 'rgba(90,50,0,.6)'; g.lineWidth = 3; g.beginPath(); g.roundRect(26, 26, W - 52, H - 52, 10); g.stroke();
    } else if (style === 'paper') {
      g.fillStyle = bg ?? '#F3E9D2'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 20; i++) { g.save(); g.globalAlpha = 0.06; g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(r.range(0, W), r.range(0, H), r.range(10, 60), 0, 7); g.fill(); g.restore(); }
    } else if (style === 'neon') {
      g.fillStyle = bg ?? '#1B1446'; g.fillRect(0, 0, W, H);
    } else if (style === 'banner') {
      g.fillStyle = bg ?? '#B3202A'; g.fillRect(0, 0, W, H); g.strokeStyle = '#E8C15A'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28);
    } else {
      g.fillStyle = bg ?? '#EADBB8'; g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 12); g.fill(); g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    }
    const fc = color ?? (style === 'stencil' ? '#2A1A10' : style === 'neon' ? '#FF3EA5' : style === 'brass' ? '#3A2208' : style === 'banner' ? '#F7E7B0' : '#3A2208');
    const lines = [text, sub].filter(Boolean) as string[];
    const mainSize = sub ? H * 0.42 : H * 0.6;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = mainSize; g.font = `900 ${fs}px ${font}`;
    while (g.measureText(text).width > W * 0.88 && fs > 10) { fs -= 4; g.font = `900 ${fs}px ${font}`; }
    const y0 = sub ? H * 0.4 : H * 0.53;
    if (style === 'neon') { g.shadowColor = fc; g.shadowBlur = 30; }
    g.fillStyle = fc; g.fillText(text, W / 2, y0);
    if (style === 'neon') { g.shadowBlur = 0; g.fillStyle = '#FFE3F3'; g.font = `900 ${fs * 0.96}px ${font}`; g.fillText(text, W / 2, y0); }
    if (sub) { let ss = H * 0.17; g.font = `700 ${ss}px ${font}`; while (g.measureText(sub).width > W * 0.85 && ss > 8) { ss -= 2; g.font = `700 ${ss}px ${font}`; } g.fillStyle = fc; g.fillText(sub, W / 2, H * 0.74); }
    if (style === 'stencil' || style === 'painted') {
      // distress: knock out speckles so it feels painted by hand
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.globalAlpha = r.range(0.2, 0.9); g.beginPath(); g.arc(r.range(0, W), r.range(0, H), r.range(0.5, 2.5), 0, 7); g.fill(); }
      g.restore();
    }
    void lines;
  });
}

// ---------- SOFT RADIAL (glows, contact shadows, light pools) ----------
export function radial(color: string, key = 'radial') {
  return canvasTexture(`${key}:${color}`, 256, 256, (g, W) => {
    const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
  });
}
