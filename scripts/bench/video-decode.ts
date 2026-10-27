import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';

const clip = resolve(process.argv[2] ?? `${process.env.HOME}/Documents/feega-videos/bench/clip-4k.mp4`);
const PORT = 5188;

const bundle = await build({ entryPoints: [resolve('scripts/bench/video-decode.entry.ts')], bundle: true, write: false, format: 'iife', target: 'es2022', alias: { $lib: resolve('src/lib'), '@feega/motion-core': resolve('packages/motion-core/src') } });
const page = `<!doctype html><meta charset=utf-8><script>${bundle.outputFiles[0].text.replace(/<\/script/g, '<\\/script')}</script>`;

const server = createServer((req, res) => {
  if (req.url === '/clip.mp4') {
    const size = statSync(clip).size;
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Number(range[2]) : size - 1;
    res.writeHead(range ? 206 : 200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': end - start + 1, ...(range ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}) });
    createReadStream(clip, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(page);
}).listen(PORT);

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const tab = await browser.newPage();
tab.on('console', (m) => console.error('[page]', m.text()));
await tab.goto(`http://localhost:${PORT}/`);
const result = await tab.evaluate((url) => (window as unknown as { bench: (u: string) => Promise<unknown> }).bench(url), `http://localhost:${PORT}/clip.mp4`);
console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
