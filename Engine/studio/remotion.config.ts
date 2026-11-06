import {Config} from '@remotion/cli/config';
import path from 'node:path';
import fs from 'node:fs';

// Active project folder (on the SSD). Set SW_PROJECT=/abs/path/to/projects/<slug>
const studioRoot = process.cwd();
const project = process.env.SW_PROJECT || path.join(studioRoot, 'demo-project');
if (!fs.existsSync(path.join(project, 'scenes', 'index.tsx'))) {
  throw new Error(`SW_PROJECT has no scenes/index.tsx: ${project}`);
}
Config.setPublicDir(path.join(project, 'public'));
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(Number(process.env.SW_CONCURRENCY || 3));
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(93);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setDelayRenderTimeoutInMilliseconds(120000);
// webpack's filesystem cache goes to the internal disk (render.sh sets SW_CACHE) — keeps write bursts off the exFAT SSD
const cacheDir = process.env.SW_CACHE;
Config.overrideWebpackConfig((c) => ({
  ...c,
  ...(cacheDir && c.cache && typeof c.cache === 'object' && c.cache.type === 'filesystem' ? {cache: {...c.cache, cacheDirectory: cacheDir}} : {}),
  resolve: {
    ...c.resolve,
    alias: {...(c.resolve?.alias || {}), '@project': path.join(project, 'scenes'), '@engine': path.join(studioRoot, 'src/engine')},
    modules: [path.join(studioRoot, 'node_modules'), 'node_modules'],
  },
}));
