#!/usr/bin/env node
// stills.mjs — batched Remotion stills: ONE browser + ONE local server for the WHOLE batch of frames, instead of
// render.sh's old loop that started a brand-new Remotion/Chrome process per frame (~7 s of start-up each; 86 stills
// = ~10 min). See Improvements/faster-and-cheaper.md #3. Keeps the exact same output: <project>/work/still_<f>.png
// per frame, so render.sh's sheet_stills.jpg step (and every caller: thumbnail.py, the skill's `stills` step) is
// unchanged.
//
// usage: node stills.mjs <studio_dir> <bundle_dir> <project_dir> <Comp> <f1,f2,...>
// env (inherited from render.sh, same names used by the video/range modes):
//   SW_PROPS   JSON input props (e.g. '{"noCaptions":true}' for a clean thumbnail still)
//   SW_SCALE   e.g. 0.25 for a quarter-res preview still (default 1 = full res)
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';

const [, , STUDIO, BUILD, PROJ, COMP, FRAMES] = process.argv;
if (!STUDIO || !BUILD || !PROJ || !COMP || !FRAMES) {
  console.error('usage: node stills.mjs <studio_dir> <bundle_dir> <project_dir> <Comp> <f1,f2,...>');
  process.exit(2);
}
// @remotion/renderer lives in <studio>/node_modules, not next to this script (exFAT studio has no root
// node_modules of its own) — resolve it the same way cam_dump.mjs resolves esbuild: require() rooted at the
// studio's package.json, which walks up to studio/node_modules.
const require = createRequire(path.join(path.resolve(STUDIO), 'package.json'));
const {openBrowser, renderStill, selectComposition, RenderInternals} = require('@remotion/renderer');

const frames = FRAMES.split(',').map(Number);
const inputProps = process.env.SW_PROPS ? JSON.parse(process.env.SW_PROPS) : {};
const scale = process.env.SW_SCALE ? Number(process.env.SW_SCALE) : 1;
const chromiumOptions = {gl: 'angle'};
const logLevel = 'error';

const server = await RenderInternals.prepareServer({
  webpackConfigOrServeUrl: BUILD,
  port: null,
  remotionRoot: path.resolve(STUDIO),
  offthreadVideoThreads: Math.max(1, Math.min(4, os.cpus().length)),
  logLevel,
  indent: false,
  offthreadVideoCacheSizeInBytes: null,
  binariesDirectory: null,
  forceIPv4: false,
  sampleRate: 44100,
});
const puppeteerInstance = await openBrowser('chrome', {chromiumOptions, logLevel});
let failed = false;
try {
  const composition = await selectComposition({
    serveUrl: server.serveUrl, id: COMP, puppeteerInstance, server, inputProps, chromiumOptions, logLevel,
  });
  for (const frame of frames) {
    const out = path.join(PROJ, 'work', `still_${frame}.png`);
    try {
      await renderStill({
        composition, serveUrl: server.serveUrl, server, puppeteerInstance, frame, output: out, scale,
        chromiumOptions, inputProps, imageFormat: 'png', overwrite: true, logLevel,
      });
      console.log(out);
    } catch (e) {
      failed = true;
      console.error(`still ${frame} FAILED: ${e.message || e}`);
    }
  }
} finally {
  await puppeteerInstance.close({silent: true});
  await server.closeServer(true);
}
if (failed) process.exit(1);
