import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import sharp from 'sharp';
import { chromium } from 'playwright';
import base from '../vite-node.config';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { imagesFilled } from '$lib/canvas/figma/images';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { PAGE_VIEWS, type PageView, type ViewRead } from '$lib/server/url-import/page-views';
import { capturedIn, scoredIn } from '$lib/server/url-import/fidelity-pages';
import { band, FOLD, harnessShape, plannedPage, scores, sideBySide } from '$lib/server/url-import/fidelity-score';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { GpuBackend, type WorldInput, type WorldResult } from './gpu-world';

const ROOT = resolve(import.meta.dirname, '../..');
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const TIMEOUT_MS = 1_800_000;
const STATIC_ROUTES = ['/gpu-core/', '/gpu-text/'];
const TYPES: Record<string, string> = { js: 'text/javascript; charset=utf-8', wasm: 'application/wasm', json: 'application/json' };
const LAUNCH = { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--enable-unsafe-webgpu'] };
const WHITE = { r: 255, g: 255, b: 255 };
const DIGITS = 3;
const BROWSER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const label = process.env.URL_IMPORT_GPU ?? '';
const captured = capturedIn(process.env.URL_IMPORT_CAPTURED ?? label);
const only = process.env.URL_IMPORT_ONLY?.split(',');
const backend = (process.env.URL_IMPORT_GPU_BACKEND ?? GpuBackend.WebGpu) as GpuBackend;
const headed = process.env.URL_IMPORT_GPU_HEADED === '1';
const smoothing = (process.env.URL_IMPORT_GPU_SMOOTHING ?? Smoothing.Plain) as Smoothing;

if (!label || !existsSync(captured)) {
  throw new Error(`no capture at ${captured}: set URL_IMPORT_GPU=<label> (and URL_IMPORT_CAPTURED=<capture label>)`);
}

async function hostBundle(): Promise<string> {
  const out = await build({ ...base, configFile: false, logLevel: 'warn', build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, 'gpu-host.ts'), formats: ['iife'], name: 'host' } } });
  const chunks = (Array.isArray(out) ? out[0] : out) as { output: { code?: string }[] };
  return chunks.output[0].code ?? '';
}

const proxied = new Map<string, { type: string; body: Buffer }>();

async function served(url: string, referer: string): Promise<string> {
  if (!/^https?:/.test(url)) {
    return url;
  }
  const key = `/assets/${createHash('sha1').update(url).digest('hex')}`;
  if (proxied.has(key)) {
    return key;
  }
  const response = await fetch(url, { headers: { referer, 'user-agent': BROWSER_AGENT } }).catch(() => null);
  if (!response?.ok) {
    return url;
  }
  proxied.set(key, { type: response.headers.get('content-type') ?? 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) });
  return key;
}

function serve(script: string): Promise<{ url: string; origin: string; close: () => void }> {
  const page = `<!doctype html><html><body style="margin:0;background:#fff"><script src="/host.js"></script></body></html>`;
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://gpu').pathname;
    if (STATIC_ROUTES.some((r) => pathname.startsWith(r))) {
      const file = join(ROOT, 'static', pathname);
      res.writeHead(existsSync(file) ? HTTP_OK : HTTP_NOT_FOUND, { 'content-type': TYPES[file.split('.').pop() ?? ''] ?? 'text/plain' }).end(existsSync(file) ? readFileSync(file) : undefined);
      return;
    }
    const asset = proxied.get(pathname);
    if (asset) {
      res.writeHead(HTTP_OK, { 'content-type': asset.type, 'access-control-allow-origin': '*' }).end(asset.body);
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

async function stitched(result: WorldResult, width: number, height: number): Promise<Buffer> {
  const parts = result.bands.map((b64, i) => ({ input: Buffer.from(b64, 'base64'), top: i * FOLD.height, left: 0 }));
  const whole = await sharp({ create: { width, height: parts.length * FOLD.height, channels: 3, background: WHITE } }).composite(parts).png().toBuffer();
  return sharp(whole).extract({ left: 0, top: 0, width, height }).png().toBuffer();
}

const viewsOf = (name: string): ViewRead[] => PAGE_VIEWS.flatMap((view) => (existsSync(join(captured, `${name}@${view.width}.json`)) ? [{ view, tree: JSON.parse(readFileSync(join(captured, `${name}@${view.width}.json`), 'utf8')) as PageTree }] : []));

const placedItems = (docs: { doc: MotionDoc; width: number; height: number }[]) => {
  let top = 0;
  const items = docs.map((d) => {
    const placed = { doc: d.doc as unknown, top, width: d.width, height: d.height };
    top += d.height;
    return placed;
  });
  return { items, height: top };
};

const htmlScore = (out: string, name: string): { fold?: number; full?: number } => {
  const file = join(out, `${name}-score.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
};

type Host = { worldOpen: (i: WorldInput) => Promise<void>; worldAt: (top: number) => Promise<void>; worldClose: (i: WorldInput) => WorldResult };

const host = <K extends keyof Host>(fn: K, arg: Parameters<Host[K]>[0]) => page.evaluate(([f, a]) => (window as unknown as Record<string, (x: unknown) => unknown>)[f as string](a), [fn, arg] as const) as Promise<Awaited<ReturnType<Host[K]>>>;

async function worldShots(input: WorldInput): Promise<WorldResult> {
  await host('worldOpen', input);
  const bands: string[] = [];
  for (let top = 0; top < input.height; top += input.band) {
    await host('worldAt', top);
    bands.push((await page.locator('canvas').screenshot()).toString('base64'));
  }
  return { ...(await host('worldClose', input)), bands };
}

const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toFixed(DIGITS) : '—');

const server = await serve(await hostBundle());
const browser = await chromium.launch({ ...LAUNCH, headless: !headed });
const page = await browser.newPage({ viewport: { width: FOLD.width, height: FOLD.height }, deviceScaleFactor: 1 });
page.setDefaultTimeout(TIMEOUT_MS);
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => (m.type() === 'error' ? console.error('console', m.text().slice(0, 300)) : undefined));
await page.goto(server.url);

const out = scoredIn(label);
mkdirSync(out, { recursive: true });
const names = readdirSync(captured).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).filter((n) => !n.includes('@') && (!only || only.includes(n)));
const rows: string[] = [];

async function gpuScored(name: string, docs: { doc: MotionDoc; width: number; height: number }[], assets: Record<string, string>, width: number) {
  const { items, height } = placedItems(docs);
  const result = await worldShots({ items, assets, width, band: FOLD.height, height, backend, smoothing });
  const drawn = await stitched(result, width, height);
  const fold = { width, height: FOLD.height };
  const scored = await scores(readFileSync(join(captured, `${name}-source.png`)), drawn, fold);
  writeFileSync(join(out, `${name}-gpu-imported.png`), drawn);
  writeFileSync(join(out, `${name}-gpu-fold.png`), await sideBySide(await band(scored.a, 0, fold), await band(scored.b, 0, fold), FOLD.height, width));
  writeFileSync(join(out, `${name}-gpu-full.png`), await sideBySide(scored.a, scored.b, scored.height, width));
  writeFileSync(join(out, `${name}-gpu-score.json`), JSON.stringify({ fold: scored.fold, full: scored.full, bands: scored.bands, frames: items.length, height, backend: result.backend, unsettled: result.unsettled, skipped: result.skipped }, null, 2));
  const html = htmlScore(out, name);
  const row = `| ${name} | ${items.length} | ${height} | ${fmt(html.fold)} | ${fmt(scored.fold)} | ${fmt(html.full)} | ${fmt(scored.full)} | ${result.unsettled} | ${result.skipped.length} |`;
  rows.push(row);
  console.log(row);
}

const viewDocs = (docs: { doc: MotionDoc; width: number }[], view: PageView) =>
  docs.map(({ doc, width }) => {
    const seen = resolveView(doc, view.id);
    const pxPerUnit = width / doc.width;
    return { doc: seen, width: Math.min(view.width, Math.round(seen.width * pxPerUnit)), height: Math.round(seen.height * pxPerUnit) };
  });

for (const name of names) {
  const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
  const views = viewsOf(name);
  const { made, assetOf, assets } = await plannedPage(tree, views, harnessShape());
  const local = Object.fromEntries(await Promise.all(Object.entries(assets).map(async ([id, url]) => [id, await served(url, tree.url)] as const)).then((all) => all.map(([id, url]) => [id, url.startsWith('/') ? `${server.origin}${url}` : url])));
  const docs = made.plan.items.map((item) => ({ doc: imagesFilled(item.doc, item.images, assetOf), ...item.size }));
  await gpuScored(name, docs, local, FOLD.width);
  for (const { view } of views) {
    await gpuScored(`${name}@${view.width}`, viewDocs(docs, view), local, view.width);
  }
}
const table = ['| page | frames | height | HTML fold | GPU fold | HTML full | GPU full | unsettled bands | skipped |', '|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
writeFileSync(join(out, `gpu-${backend}.md`), `${table}\n`);
console.log(table);
await browser.close();
server.close();
process.exit(0);
