import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { chromiumFrames, chromiumPage } from '$lib/server/motion/chromium-frames';
import { drawStill } from '$lib/server/motion/still-export';
import { localBrowser } from '$lib/server/web/browser';
import { similarity } from '$lib/server/web/ui-fidelity';
import { pageTreeAt, PLAIN_PLANNER } from '$lib/server/url-import/import-url';
import { urlPlan } from '$lib/server/url-import/url-doc';
import { CodeImportOutcome, Crop, importBoards } from './import-code';
import { Responsive } from './code-views';
import { Scheme } from './render-conditions';
import { storeOf } from './code-import.testkit';

const APP = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
html,body{margin:0;font-family:Helvetica,Arial,sans-serif;background:#fff;color:#111}
nav{display:flex;gap:24px;padding:20px 48px;background:#0b1020;color:#fff}
nav span{font-size:16px}
.menu{display:none;margin-left:auto}
.hero{padding:72px 48px;background:#e8eefc}
.hero h1{font-size:56px;margin:0 0 16px;line-height:1.1}
.hero p{font-size:20px;margin:0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:48px}
.card{background:#2f5bea;color:#fff;border-radius:12px;padding:28px;height:160px}
.card b{font-size:22px;display:block;margin-bottom:8px}
footer{background:#111;color:#ddd;padding:32px 48px}
@media (max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.hero h1{font-size:40px}}
@media (max-width:600px){.grid{grid-template-columns:1fr;padding:24px}nav span.l{display:none}.menu{display:block}.hero{padding:40px 20px}.hero h1{font-size:32px}nav{padding:16px 20px}footer{padding:24px 20px}}
</style></head><body><nav><span>Acme</span><span class="l">Product</span><span class="l">Pricing</span><span class="l">Docs</span><span class="menu">Menu</span></nav>
<div class="hero"><h1>Ship faster with Acme</h1><p>One platform for the whole team.</p></div>
<div class="grid"><div class="card"><b>Fast</b>Builds in seconds</div><div class="card"><b>Safe</b>Reviews on every change</div><div class="card"><b>Open</b>Works with your stack</div></div>
<footer>Acme Inc. 2026</footer></body></html>`;

const WIDTHS = [1280, 768, 390];
const FOLD_HEIGHT = 800;

let url = '';
let close = () => undefined as unknown;

beforeAll(() => {
  if (!process.env.CHROMIUM_PATH) {
    return;
  }
  const server = createServer((_, res) => res.setHeader('content-type', 'text/html').end(APP));
  return new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      close = () => server.close();
      resolve();
    })
  );
});

afterAll(() => close());

async function shotAt(width: number): Promise<Buffer> {
  const tab = await localBrowser(chromiumPage, new URL(url).origin)();
  try {
    await tab.viewport(width);
    await tab.goto(url);
    return await tab.shot();
  } finally {
    await tab.close();
  }
}

async function treeAt(width: number) {
  const tab = await localBrowser(chromiumPage, new URL(url).origin)();
  try {
    await tab.viewport(width);
    return await pageTreeAt(tab, new URL(url), 300, PLAIN_PLANNER);
  } finally {
    await tab.close();
  }
}

async function painted(doc: MotionDoc): Promise<Buffer> {
  return drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets: {} }, { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => ({ width: doc.width, height: doc.height }) } as never);
}

async function score(source: Buffer, drawn: Buffer, width: number): Promise<number> {
  const [a, b] = await Promise.all([sharp(source).resize({ width }).png().toBuffer(), sharp(drawn).resize({ width }).png().toBuffer()]);
  const height = Math.min(FOLD_HEIGHT, (await sharp(a).metadata()).height!, (await sharp(b).metadata()).height!);
  const crop = (png: Buffer) => sharp(png).extract({ left: 0, top: 0, width, height }).png().toBuffer();
  return similarity(await crop(a), await crop(b));
}

describe.runIf(process.env.CHROMIUM_PATH)('a responsive page imported at three widths', () => {
  it('each view of the one frame matches the page at that width, as the separate boards did', async () => {
    let n = 0;
    const newId = () => `c${++n}`;
    const before: Record<number, number> = {};
    for (const width of WIDTHS) {
      const tree = await treeAt(width);
      expect('root' in tree).toBe(true);
      const made = urlPlan(tree as never, newId)!;
      before[width] = await score(await shotAt(width), await painted(made.plan.items[0].doc), width);
    }

    const { store, docs } = storeOf();
    let k = 0;
    const done = await importBoards({
      store,
      place: { projectId: 'p', canvasId: 'c' },
      at: { x: 0, y: 0 },
      open: localBrowser(chromiumPage, new URL(url).origin),
      guard: async () => undefined,
      importImage: async () => null,
      newId: () => `v${++k}`,
      settleMs: 300,
      name: 'fixture',
      pages: WIDTHS.map((width) => ({ label: `/${width}`, url, route: '/', conditions: { scheme: Scheme.Light, width } })),
      names: [],
      crop: Crop.Page,
      responsive: Responsive.Views
    });
    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    const doc = docs.get('frame-1')!.doc as MotionDoc;
    expect(doc.breakpoints?.map((b) => b.width)).toEqual([768, 390]);

    const after: Record<number, number> = {};
    for (const width of WIDTHS) {
      const view = width === WIDTHS[0] ? doc : resolveView(doc, `w${width}`);
      after[width] = await score(await shotAt(width), await painted(view), width);
    }
    console.log('FIDELITY before (separate boards)', JSON.stringify(before), 'after (views)', JSON.stringify(after));
    for (const width of WIDTHS) {
      expect(after[width]).toBeGreaterThan(before[width] - 0.08);
    }
  }, 240_000);
});
