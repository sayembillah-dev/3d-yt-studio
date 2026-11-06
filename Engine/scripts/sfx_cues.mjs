import {fileURLToPath} from 'node:url';
// sfx_cues.mjs — Phase 10 step 1: derive every SFX cue from the animation itself (no hand timing needed).
// usage: node sfx_cues.mjs <project_dir> [out.json]          → <project>/work/sfx_cues.json
//
// Sources (style-bible §11.1):
//   camera.ts   whoosh at every camera-move speed peak (≥ 0.7 °/f, ≥ 20 f apart; 'whip' on whip segments),
//               whoosh on every dissolve, impact on every cut, boom on every camera shake
//   cast.ts     pop on every face swap · beat → hop:boing nod:click recoil:impact shake:rattle stomp:thud
//               new fx → sweat:gulp shockLines:sting sparkle/hearts:sparkle steam:steam exclaim:ding question/dizzy:boing vein:thud
//               a newly held coin/cash → coin/cash
//   blocking.ts footsteps every 9 f while an actor's path moves
//   words.json  literal onomatopoeia (boom, crash, splash, clickety, whistle, ding, …) on the word
//   sfx.ts      SFX_EXTRA hand cues + AMBIENCE ranges
// Checks (fix-playbook §5): SX1 no_cues (0 cues) · SX2 density (≥ 1 cue / 2 s; and for videos ≥ 30 s the last 15 %
// must be at least as dense as the average — the climax is the densest part). Exit 1 on failure.
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const proj = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('usage: node sfx_cues.mjs <project_dir> [out.json]'); process.exit(2); }
const out = process.argv[3] || path.join(proj, 'work', 'sfx_cues.json');
const studio = process.env.STUDIO || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'studio');
const require = createRequire(path.join(studio, 'package.json'));
const esbuild = require('esbuild');
const sc = (f) => path.join(proj, 'scenes', f);
if (!fs.existsSync(sc('camera.ts'))) { console.error(`MISSING ${sc('camera.ts')}`); process.exit(2); }
const has = (f) => fs.existsSync(sc(f));
const imp = (f, name) => has(f) ? `import * as ${name} from ${JSON.stringify(sc(f))};` : `const ${name} = {};`;
const shim = `${imp('camera.ts', 'C')} ${imp('cast.ts', 'K')} ${imp('sfx.ts', 'X')} ${imp('blocking.ts', 'B')}
import {projectCameraAt, projectKeys, projectShakes} from ${JSON.stringify(path.join(studio, 'src/engine/camera.ts'))};
import {posAt} from ${JSON.stringify(path.join(studio, 'src/engine/blocking.ts'))};
export function dump(){ const END=C.END; const cam=[]; for(let f=-1; f<=END; f++){ const s=projectCameraAt(C,f); cam.push([...s.pos,...s.look,s.fov]); }
  const actors=(B.ACTORS||[]).filter(a=>a.path&&a.path.length>1).map(a=>({id:a.id, pos:Array.from({length:END+1},(_,f)=>posAt(a,f))}));
  return {END, keys:projectKeys(C), shakes:projectShakes(C), transitions:C.TRANSITIONS||[], cast:K.CAST||{}, extra:X.SFX_EXTRA||[], ambience:X.AMBIENCE||[], cam, actors}; }`;
const tmp = path.join(os.tmpdir(), `sfxcues_${process.pid}.mjs`);
await esbuild.build({stdin: {contents: shim, resolveDir: proj, loader: 'ts'}, bundle: true, format: 'esm', platform: 'node', outfile: tmp,
  alias: {'@engine': path.join(studio, 'src/engine')}, logLevel: 'error', loader: {'.json': 'json'}});
const D = (await import(tmp)).dump();
fs.unlinkSync(tmp);
const FPS = 30, END = D.END;
const cues = [];
const add = (f, kind, gain, src) => { if (f >= 0 && f <= END) cues.push({f: Math.round(f), kind, gain: gain ?? 0, src}); };

// ---- camera: apparent speed (same measure as cam_qa: rotation + translation at look distance + fov change)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (a) => Math.hypot(a[0], a[1], a[2]);
const ang = (a, b) => { const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (nrm(a) * nrm(b) || 1); return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; };
const spd = [0];
for (let f = 1; f <= END + 1; f++) {
  const a = D.cam[f - 1], b = D.cam[f];
  const v0 = sub(a.slice(3, 6), a.slice(0, 3)), v1 = sub(b.slice(3, 6), b.slice(0, 3));
  spd.push(ang(v0, v1) + (nrm(sub(b, a)) / Math.max(0.5, nrm(v1))) * 180 / Math.PI + Math.abs(b[6] - a[6]) * 0.5);
}
const whipF = new Set();
D.keys.forEach((k, i) => { if (i && k.ease === 'whip') for (let f = D.keys[i - 1].f; f <= k.f; f++) whipF.add(f); });
let last = -99;
for (let f = 2; f < spd.length - 2; f++) {
  const s = spd[f];
  const win = spd.slice(Math.max(0, f - 10), f + 11);
  if (s >= 0.7 && s === Math.max(...win) && f - last >= 20) {
    let on = f; while (on > 0 && spd[on - 1] > s * 0.5) on--;      // whoosh starts when the move starts
    add(Math.max(on, f - 12), whipF.has(f) ? 'whip' : 'whoosh', -14 + 6 * Math.min(1, (s - 0.7) / 3), `camera peak ${s.toFixed(2)}°/f @${f - 1}`);
    last = f;
  }
}
for (const t of D.transitions) add(t.kind === 'cut' ? t.f : t.f - (t.len ?? 8) / 2, t.kind === 'cut' ? 'impact' : 'whoosh', t.kind === 'cut' ? -6 : -12, `${t.kind} @${t.f}`);
for (const s of D.shakes) add(s.f, 'boom', -4, `camera shake @${s.f}`);

// ---- cast keys
const BEAT = {hop: 'boing', nod: 'click', recoil: 'impact', shake: 'rattle', stomp: 'thud'};
const FX = {sweat: 'gulp', shockLines: 'sting', sparkle: 'sparkle', hearts: 'sparkle', steam: 'steam', exclaim: 'ding', question: 'boing', dizzy: 'boing', vein: 'thud'};
for (const [id, m] of Object.entries(D.cast)) {
  let face = null, fx = new Set(), held = {L: null, R: null};
  for (const k of [...(m.keys || [])].sort((a, b) => a.f - b.f)) {
    if (k.face && k.face !== face) { if (face !== null) add(k.f, 'pop', -8, `${id} face ${face}→${k.face}`); face = k.face; }
    if (k.beat) add(k.f + 1, BEAT[k.beat] || 'click', -6, `${id} beat ${k.beat}`);
    if (k.fx) { for (const x of k.fx) if (!fx.has(x) && FX[x]) add(k.f + 2, FX[x], -9, `${id} fx ${x}`); fx = new Set(k.fx); }
    for (const side of ['L', 'R']) {
      const h = k['hold' + side];
      if (h !== undefined) { if (h && (!held[side] || held[side].kind !== h.kind) && (h.kind === 'coin' || h.kind === 'cash')) add(k.f + 2, h.kind, -8, `${id} holds ${h.kind}`); held[side] = h; }
    }
  }
}
// ---- footsteps
for (const a of D.actors) {
  let acc = 0;
  for (let f = 1; f <= END; f++) {
    const d = Math.hypot(a.pos[f][0] - a.pos[f - 1][0], a.pos[f][2] - a.pos[f - 1][2]);
    if (d > 0.004) { acc++; if (acc % 9 === 1) add(f, 'step', -16, `${a.id} walks`); } else acc = 0;
  }
}
// ---- onomatopoeia
const ONO = {boom: 'boom', kaboom: 'boom', bang: 'boom', crash: 'crash', smash: 'crash', splash: 'splash', splat: 'splash', ding: 'ding', dong: 'bell', ring: 'bell',
  pop: 'pop', click: 'click', clack: 'clack', clickety: 'clack', 'clickety-clack': 'clack', whistle: 'whistle', sizzle: 'sizzle', hiss: 'sizzle', clink: 'coin', clank: 'clank',
  rustle: 'rustle', creak: 'creak', whoosh: 'whoosh', thud: 'thud', snap: 'click', crack: 'crash', boing: 'boing', roar: 'boom', chime: 'ding'};
const wpath = path.join(proj, 'public', 'words.json');
if (fs.existsSync(wpath)) {
  let W = JSON.parse(fs.readFileSync(wpath, 'utf8')); W = W.words || W;
  for (const w of W) { const t = w.w.toLowerCase().replace(/[^a-z\-]/g, ''); const k = ONO[t] || ONO[t.split('-')[0]]; if (k) add(w.s * FPS, k, -6, `word "${w.w}"`); }
}
// ---- hand cues
for (const x of D.extra) add(x.f, x.kind, x.gain ?? 0, x.note ? `extra: ${x.note}` : 'extra');

// merge duplicates (same kind within 3 f), sort, number variants per kind (synth varies each one)
cues.sort((a, b) => a.f - b.f);
const merged = [];
for (const c of cues) { const p = merged.findLast?.((m) => m.kind === c.kind && c.f - m.f <= 3); if (p) { p.gain = Math.max(p.gain, c.gain); p.src += ' + ' + c.src; } else merged.push({...c}); }
const nth = {};
for (const c of merged) { nth[c.kind] = (nth[c.kind] ?? -1) + 1; c.v = nth[c.kind]; }
const ambience = D.ambience.length ? D.ambience : [{from: 0, to: END, kind: 'room'}];

// ---- checks
const dur = END / FPS;
const rate = merged.length / Math.max(dur, 1e-9);
const res = [];
res.push(['SX1', 'no_cues', merged.length > 0, `${merged.length} cues`]);
const tail = merged.filter((c) => c.f >= END * 0.85).length / Math.max(dur * 0.15, 1e-9);
const dens = rate >= 0.5 && (dur < 30 || tail >= rate);
res.push(['SX2', 'density', dens, `${rate.toFixed(2)} cues/s (≥ 0.5)` + (dur >= 30 ? `; last 15 %: ${tail.toFixed(2)}/s vs mean ${rate.toFixed(2)}/s (climax must be densest)` : '; climax check N/A (< 30 s)')]);
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify({fps: FPS, end: END, cues: merged, ambience}, null, 1));
const byKind = {}; for (const c of merged) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
console.log(out);
console.log('cues by kind:', Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', '));
console.log('ambience:', ambience.map((a) => `${a.kind} f${a.from}-${a.to}`).join(', '));
for (const [id, name, ok, det] of res) console.log(`${id}  ${name.padEnd(8)} ${ok ? 'PASS' : 'FAIL'}  ${det}`);
const bad = res.filter((r) => !r[2]);
if (bad.length) {
  console.log('\nFIX PLAYBOOK:');
  for (const [id] of bad) console.log('  ' + {SX1: 'SX1: scenes/cast.ts must export CAST with keys and scenes/camera.ts must export camera.', SX2: 'SX2: add SFX_EXTRA hits in scenes/sfx.ts on impact/action words; put the biggest hits in the last 15 %.'}[id]);
}
console.log(`\nSFX_CUES: ${bad.length ? 'FAIL' : 'PASS'}`);
process.exit(bad.length ? 1 : 0);
