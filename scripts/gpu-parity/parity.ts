import { createServer, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { MOTION_LIBS_ROUTE } from '$lib/motion/libs/catalog';
import { lanesWithin, webglPerLane } from '$lib/motion/export/webgl-budget';
import base from '../vite-node.config';
import { libraryPath } from '../motion-libs';
import { luma, psnr, ssim } from './metrics';
import type { ExportInput, ExportResult, PreviewInput, PreviewResult, ShotsInput, ShotsResult } from './probe';

enum Mode {
  Parity = 'parity',
  Export = 'export',
  Preview = 'preview'
}

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(process.env.PARITY_OUT ?? join(homedir(), 'Documents/feega-videos/gpu-motion'));
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const TIMEOUT_MS = 3_600_000;
const APP_LANES = 4;
const ASSET_SIZE = { width: 1600, height: 1000 };
const TYPES: Record<string, string> = { js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', png: 'image/png' };
const LAUNCH = { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--enable-unsafe-webgpu'] };

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const docPath = flags.get('doc') ?? '';
const mode = (flags.get('mode') ?? Mode.Parity) as Mode;
const frames = Number(flags.get('frames') ?? 12);
const preference = flags.get('backend') ?? 'webgpu';
const seconds = Number(flags.get('seconds') ?? 6);
const name = flags.get('name') ?? docPath.split('/').pop()?.replace(/\.(doc\.)?json$/, '') ?? 'doc';

async function hostBundle(): Promise<string> {
  const out = await build({ ...base, configFile: false, logLevel: 'warn', build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, 'host.ts'), formats: ['iife'], name: 'host' } } });
  const chunks = (Array.isArray(out) ? out[0] : out) as { output: { code?: string }[] };
  return chunks.output[0].code ?? '';
}

function assetIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => assetIds(v, into));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'assetId' && typeof v === 'string' && v) {
        into.add(v);
      } else {
        assetIds(v, into);
      }
    }
  }
  return into;
}

async function placeholder(id: string): Promise<Buffer> {
  const hue = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ASSET_SIZE.width}" height="${ASSET_SIZE.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 120) % 360},60%,25%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="520" cy="420" r="260" fill="hsl(${(hue + 60) % 360},80%,70%)" opacity="0.8"/><rect x="900" y="560" width="520" height="300" fill="#fff" opacity="0.85"/><path d="M0 1000 L800 600 L1600 1000Z" fill="#111" opacity="0.5"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function serve(script: string, assets: Map<string, Buffer>): Promise<{ url: string; origin: string; close: () => void }> {
  const page = `<!doctype html><html><body style="margin:0;background:#000"><div id="host" style="position:relative;width:1920px;height:1080px;overflow:hidden"></div><script src="/host.js"></script></body></html>`;
  const server = createServer((req, res: ServerResponse) => {
    const pathname = new URL(req.url ?? '/', 'http://parity').pathname;
    if (pathname.startsWith(MOTION_LIBS_ROUTE)) {
      const file = libraryPath(ROOT, pathname);
      if (!existsSync(file)) {
        res.writeHead(HTTP_NOT_FOUND).end();
        return;
      }
      res.writeHead(HTTP_OK, { 'content-type': TYPES[file.split('.').pop() ?? ''] ?? 'text/plain', 'access-control-allow-origin': '*' }).end(readFileSync(file));
      return;
    }
    const asset = assets.get(pathname);
    if (asset) {
      res.writeHead(HTTP_OK, { 'content-type': TYPES.png, 'access-control-allow-origin': '*' }).end(asset);
      return;
    }
    if (pathname === '/host.js') {
      res.writeHead(HTTP_OK, { 'content-type': TYPES.js }).end(script);
      return;
    }
    res.writeHead(HTTP_OK, { 'content-type': 'text/html; charset=utf-8' }).end(page);
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      ok({ url: `${origin}/`, origin, close: () => server.close() });
    })
  );
}

const spread = (doc: MotionDoc, n: number) => Array.from({ length: n }, (_, i) => Math.floor(((i + 0.5) * doc.durationInFrames) / n) / doc.fps);

async function rgba(b64: string) {
  const { data, info } = await sharp(Buffer.from(b64, 'base64')).flatten({ background: '#000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

const raw = JSON.parse(readFileSync(docPath, 'utf8'));
const verdict = parseMotionDoc(raw.doc ?? raw);
if (!verdict.ok) {
  throw new Error(verdict.error);
}
const doc = verdict.doc;
const ids = assetIds(doc);
const assetFiles = new Map<string, Buffer>();
for (const id of ids) {
  assetFiles.set(`/assets/${id}.png`, await placeholder(id));
}
const server = await serve(await hostBundle(), assetFiles);
const assets = Object.fromEntries([...ids].map((id) => [id, `${server.origin}/assets/${id}.png`]));
const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets, origin: server.origin });
const size = { width: doc.width, height: doc.height };
const spec = { doc, assets, origin: server.origin };
const dir = join(OUT, name);
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ ...LAUNCH, headless: mode !== Mode.Preview });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(TIMEOUT_MS);
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => (m.type() === 'error' ? console.error('console', m.text().slice(0, 300)) : undefined));
await page.goto(server.url);
const call = <I, O>(fn: string, input: I) => page.evaluate(([f, i]) => (window as unknown as Record<string, (x: unknown) => Promise<unknown>>)[f as string](i), [fn, input] as const) as Promise<O>;

if (mode === Mode.Parity) {
  const times = spread(doc, frames);
  const shots: ShotsInput = { html, spec, times, ...size, preference };
  const before = await call<ShotsInput, ShotsResult>('htmlShots', shots);
  console.log(`html engine ${(before.ms / times.length).toFixed(0)} ms/frame`);
  const after = await call<ShotsInput, ShotsResult>('gpuShots', shots);
  const framesDir = join(dir, 'frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const rows: { t: number; ssim: number; psnr: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    const a = await rgba(before.pngs[i]);
    const b = await rgba(after.pngs[i]);
    const la = luma(a.pixels);
    const lb = luma(b.pixels);
    rows.push({ t: times[i], ssim: ssim(la, lb, a.width, a.height), psnr: psnr(la, lb) });
    writeFileSync(join(framesDir, `html-${String(i).padStart(3, '0')}.png`), Buffer.from(before.pngs[i], 'base64'));
    writeFileSync(join(framesDir, `gpu-${String(i).padStart(3, '0')}.png`), Buffer.from(after.pngs[i], 'base64'));
  }
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'inf');
  const worst = rows.reduce((w, r) => (r.ssim < w.ssim ? r : w), rows[0]);
  const mean = rows.reduce((s, r) => s + r.ssim, 0) / rows.length;
  const report = [`# ${name} — backend ${after.backend}, ${after.runs} html runs`, '', '| t (s) | SSIM | PSNR dB |', '|---|---|---|', ...rows.map((r) => `| ${r.t.toFixed(2)} | ${r.ssim.toFixed(4)} | ${fmt(r.psnr)} |`), '', `mean SSIM ${mean.toFixed(4)}, worst ${worst.ssim.toFixed(4)} at ${worst.t.toFixed(2)} s`, `stats ${JSON.stringify(after.stats.slice(0, 3))}`].join('\n');
  writeFileSync(join(dir, 'parity.md'), report);
  console.log(report);
  const ff = (args: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  const scale = 'scale=960:-2';
  ff(['-framerate', '2', '-i', join(framesDir, 'html-%03d.png'), '-framerate', '2', '-i', join(framesDir, 'gpu-%03d.png'), '-filter_complex', `[0]${scale}[a];[1]${scale}[b];[a][b]hstack`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', join(dir, 'side-by-side.mp4')]);
  ff(['-i', join(dir, 'side-by-side.mp4'), '-vf', `fps=2,scale=960:-2,tile=1x${Math.min(times.length, 6)}`, '-frames:v', '1', join(dir, 'sheet.png')]);
}

if (mode === Mode.Export) {
  const times = Array.from({ length: Math.min(frames, doc.durationInFrames) }, (_, i) => i / doc.fps);
  const input: ExportInput = { html, spec, times, ...size, fps: doc.fps, lanes: lanesWithin(APP_LANES, webglPerLane(html)), preference, keep: true };
  const today = await call<ExportInput, ExportResult>('htmlExport', input);
  const gpu = await call<ExportInput, ExportResult>('gpuExport', input);
  for (const [label, r] of [['html', today], ['gpu', gpu]] as const) {
    if (r.mp4) {
      writeFileSync(join(dir, `export-${label}.mp4`), Buffer.from(r.mp4, 'base64'));
    }
  }
  const line = `| ${name} | ${times.length} | ${input.lanes} | ${(today.wallMs / times.length).toFixed(0)} | ${(gpu.wallMs / times.length).toFixed(0)} | ${(today.wallMs / gpu.wallMs).toFixed(2)}x |`;
  writeFileSync(join(dir, 'export.md'), `| doc | frames | html lanes | html ms/frame | gpu ms/frame | speed-up |\n|---|---|---|---|---|---|\n${line}\n`);
  console.log(line);
}

if (mode === Mode.Preview) {
  const input: PreviewInput = { html, spec, seconds, warmMs: 2000, preference };
  const today = await call<PreviewInput, PreviewResult>('htmlPreview', input);
  const gpu = await call<PreviewInput, PreviewResult>('gpuPreview', input);
  const row = (label: string, r: PreviewResult) => `| ${name} | ${label} | ${r.frames} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.dropped} | ${r.workP50.toFixed(1)} | ${r.workP95.toFixed(1)} |`;
  const table = `| doc | engine | frames | rAF p50 ms | rAF p95 ms | dropped (>18.7ms) | work p50 ms | work p95 ms |\n|---|---|---|---|---|---|---|---|\n${row('html', today)}\n${row('gpu', gpu)}\n`;
  writeFileSync(join(dir, 'preview.md'), table);
  console.log(table);
}

await browser.close();
server.close();
process.exit(0);
