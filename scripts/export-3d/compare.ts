import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { toyGlb } from '@feega/motion-core/motion/codegen/fixtures/glb';
import { MODEL_ASSET, showcaseDoc } from '@feega/motion-core/motion/codegen/fixtures/scene3d';
import { luma, psnr, ssim } from '../gpu-parity/metrics';

const [projects, shots] = process.argv.slice(2);
const FRAMES = { model: { left: 640, top: 60, width: 560, height: 600 }, ring: { left: 80, top: 320, width: 400, height: 380 } };
const VIEWPORT = { width: 1280, height: 720 };
const TIMES_S = [0, 2, 4];
const SETTLE_MS = 400;
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };

type Frame = (typeof FRAMES)[keyof typeof FRAMES];

type Route = (path: string) => { body: Buffer | string; type: string } | null;

function serve(route: Route): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const found = route(new URL(req.url ?? '/', 'http://x').pathname);
    res.writeHead(found ? 200 : 404, { 'content-type': found?.type ?? 'text/plain', 'access-control-allow-origin': '*' });
    res.end(found?.body ?? 'missing');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${(server.address() as { port: number }).port}` })));
}

const fromDir = (root: string, prefix = ''): Route => (path) => {
  const rel = path.slice(prefix.length) || '/';
  const file = join(root, rel.endsWith('/') ? `${rel}index.html` : rel);
  return path.startsWith(prefix) && existsSync(file) && statSync(file).isFile() ? { body: readFileSync(file), type: MIME[extname(file)] ?? 'application/octet-stream' } : null;
};

async function crop(page: Page, name: string, frame: Frame): Promise<Buffer> {
  const png = await page.screenshot({ clip: { x: frame.left, y: frame.top, width: frame.width, height: frame.height } });
  writeFileSync(join(shots, `${name}.png`), png);
  return sharp(png).ensureAlpha().raw().toBuffer();
}

const timeDriver = () => {
  (window as unknown as { __t: number }).__t = 0;
  performance.now = () => (window as unknown as { __t: number }).__t;
};

const score = (a: Buffer, b: Buffer, frame: Frame) => {
  const la = luma(new Uint8Array(a));
  const lb = luma(new Uint8Array(b));
  return { ssim: ssim(la, lb, frame.width, frame.height), psnr: psnr(la, lb) };
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const verdict = parseMotionDoc(showcaseDoc());
if (!verdict.ok) {
  throw new Error(verdict.error);
}
const doc = verdict.doc;

const libs = fromDir(join(process.cwd(), 'static'));
const reference = await serve((path) => {
  if (path === '/ref') {
    return { body: composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { [MODEL_ASSET]: `${reference.origin}/toy.glb` }, origin: reference.origin }), type: 'text/html' };
  }
  return path === '/toy.glb' ? { body: (process.env.MODEL_GLB ? readFileSync(process.env.MODEL_GLB) : Buffer.from(toyGlb())), type: MIME['.glb'] } : libs(path);
});
const targets = {
  html: await serve(fromDir(join(projects, 'html'))),
  react: await serve(fromDir(join(projects, 'react', 'dist'))),
  svelte: process.env.SVELTE_URL ? { server: { close: () => undefined } as unknown as Server, origin: process.env.SVELTE_URL } : null
};

async function open(url: string, withTime: boolean): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  if (withTime) {
    await page.addInitScript(timeDriver);
  }
  await page.goto(url);
  return page;
}

const refPage = await open(`${reference.origin}/ref`, false);
await refPage.waitForFunction(() => (window as unknown as { __hf?: { buildReady?: Record<string, Promise<unknown>> } }).__hf?.buildReady?.['motion-three'] !== undefined);
await refPage.evaluate(() => (window as unknown as { __hf: { buildReady: Record<string, Promise<unknown>> } }).__hf.buildReady['motion-three']);
const refShots = new Map<string, Buffer>();
for (const t of TIMES_S) {
  await refPage.evaluate((time) => (window as unknown as { __feegaThreeRedraw: (t: number) => void }).__feegaThreeRedraw(time), t);
  await refPage.waitForTimeout(SETTLE_MS);
  for (const [part, frame] of Object.entries(FRAMES)) {
    refShots.set(`${part}-${t}`, await crop(refPage, `canvas-${part}-${t}s`, frame));
  }
}

for (const [name, target] of Object.entries(targets)) {
  if (!target) {
    continue;
  }
  const page = await open(`${target.origin}/`, true);
  await page.waitForTimeout(2500);
  for (const t of TIMES_S) {
    await page.evaluate((ms) => ((window as unknown as { __t: number }).__t = ms), t * 1000);
    await page.waitForTimeout(SETTLE_MS);
    for (const [part, frame] of Object.entries(FRAMES)) {
      const got = await crop(page, `${name}-${part}-${t}s`, frame);
      const { ssim: s, psnr: p } = score(refShots.get(`${part}-${t}`)!, got, frame);
      console.log(`${name} ${part} t=${t}s ssim=${s.toFixed(4)} psnr=${p.toFixed(2)}`);
    }
  }
  await page.close();
}

await browser.close();
reference.server.close();
Object.values(targets).forEach((t) => t?.server.close());
