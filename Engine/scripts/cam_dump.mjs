import {fileURLToPath} from 'node:url';
// cam_dump.mjs — evaluate a project's ONE camera at every frame (no render needed).
// usage: node cam_dump.mjs <project_dir> [out.json]
// Requires <project>/scenes/camera.ts exporting: camera (CameraSpec) OR CAMERAS (CameraTrack[], one per set), END, optional TRANSITIONS [{f, kind:'dissolve'|'cut', len}]
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
const proj = path.resolve(process.argv[2]);
const out = process.argv[3] || path.join(proj, 'work', 'camera_dump.json');
const studio = process.env.STUDIO || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'studio');
const require = createRequire(path.join(studio, 'package.json'));
const esbuild = require('esbuild');
const entry = path.join(proj, 'scenes', 'camera.ts');
if (!fs.existsSync(entry)) { console.error(`MISSING ${entry} — every project keeps its camera in scenes/camera.ts (see references/project-template)`); process.exit(2); }
const tmp = path.join(os.tmpdir(), `camdump_${process.pid}.mjs`);
const blk = path.join(proj, 'scenes', 'blocking.ts');
const hasBlk = fs.existsSync(blk);
const shim = `import * as C from ${JSON.stringify(entry)}; import {projectCameraAt, projectKeys, projectSwaps} from ${JSON.stringify(path.join(studio, 'src/engine/camera.ts'))};
import {posAt} from ${JSON.stringify(path.join(studio, 'src/engine/blocking.ts'))};
${hasBlk ? `import * as B from ${JSON.stringify(blk)};` : 'const B = {};'}
export function dump(){ const END=C.END; const fr=[]; for(let f=-1; f<=END; f++){ const s=projectCameraAt(C,f); fr.push([f,...s.pos,...s.look,s.fov,s.roll]); }
 const actors=(B.ACTORS||[]).map(a=>({id:a.id, radius:a.radius??0.28, enter:a.enter??-1e9, exit:a.exit??1e9, pos:Array.from({length:END+1},(_,f)=>posAt(a,f))}));
 return {END, keys:projectKeys(C), swaps:projectSwaps(C), transitions:C.TRANSITIONS||[], frames:fr, actors, obstacles:B.OBSTACLES||[]}; }`;
await esbuild.build({stdin: {contents: shim, resolveDir: proj, loader: 'ts'}, bundle: true, format: 'esm', platform: 'node', outfile: tmp,
  alias: {'@engine': path.join(studio, 'src/engine')}, logLevel: 'error', loader: {'.json': 'json'}});
const mod = await import(tmp);
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify(mod.dump()));
fs.unlinkSync(tmp);
console.log(out);
