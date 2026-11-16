import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { viewsOf } from '@feega/motion-core/motion/breakpoints/model';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import { CodeTarget, exportCode } from '@feega/motion-core/motion/codegen/index';
import { allFixtures } from '@feega/motion-core/motion/codegen/fixtures/responsive';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumExport, chromiumFrames } from '$lib/server/motion/chromium-frames';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { posterSecond } from '$lib/motion/poster-time';
import { libsOrigin } from '$lib/server/motion/libs-origin';
import { everyClip } from '@feega/motion-core/motion/doc';
import { similarity } from '$lib/server/web/ui-fidelity';

const ENABLED = process.env.CODE_EXPORT_FIDELITY === '1';
const OUT = process.env.CODE_EXPORT_OUT ?? join(tmpdir(), 'export-fidelity');
const CHROME_PATHS = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => ({ width: 0, height: 0 }) } as never;
const BAND_ASPECT = 1.6;
const SETTLE_MS = 400;
const TARGET_SCORE = 0.9;
const FLOOR_MARGIN = 0.02;
const MEASURED: Record<string, number> = {
  'landing:base': 0.766,
  'landing:tablet': 0.599,
  'landing:phone': 0.6461,
  'hero-phone:base': 0.9362,
  'hero-phone:phone': 0.8469,
  'features-grid:base': 0.9838,
  'features-grid:tablet': 0.9598,
  'features-grid:phone': 0.8798,
  'component-main-override:base': 0.9362,
  'component-main-override:phone': 0.6872
};
const floorOf = (fixture: string, view: string) => (MEASURED[`${fixture}:${view}`] ?? TARGET_SCORE) - (`${fixture}:${view}` in MEASURED ? FLOOR_MARGIN : 0);
const OVERFLOW_WIDTHS = [320, 390, 414, 600, 720, 810, 900, 1100];
const WHITE = { r: 255, g: 255, b: 255 };
const SIDE_GAP = 16;

process.env.CHROMIUM_PATH ??= CHROME_PATHS.find((p) => existsSync(p));

let browser: Browser;

beforeAll(async () => {
  if (ENABLED) {
    browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  }
});

afterAll(async () => {
  await browser?.close();
});


async function sized(png: Buffer, width: number, height: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const top = await sharp(png).extract({ left: 0, top: 0, width: Math.min(width, meta.width!), height: Math.min(height, meta.height!) }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: WHITE } }).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
}

async function scored(reference: Buffer, exported: Buffer, width: number) {
  const refMeta = await sharp(reference).metadata();
  const expMeta = await sharp(exported).metadata();
  const height = Math.max(refMeta.height!, expMeta.height!);
  const [a, b] = await Promise.all([sized(reference, width, height), sized(exported, width, height)]);
  const band = Math.max(1, Math.round(width / BAND_ASPECT));
  const bands: number[] = [];
  for (let top = 0; top < height; top += band) {
    const h = Math.min(band, height - top);
    const cut = (png: Buffer) => sharp(png).extract({ left: 0, top, width, height: h }).png().toBuffer();
    bands.push(await similarity(await cut(a), await cut(b)));
  }
  return { mean: bands.reduce((s, v) => s + v, 0) / bands.length, min: Math.min(...bands), heightRatio: expMeta.height! / refMeta.height!, a, b, width, height };
}

async function sideBySide(a: Buffer, b: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width: width * 2 + SIDE_GAP, height, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: width + SIDE_GAP, top: 0 }
    ])
    .png()
    .toBuffer();
}

function written(dir: string, files: { path: string; content: string }[]): string {
  for (const f of files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.content);
  }
  return join(dir, 'index.html');
}

async function openExport(entry: string, width: number, height: number) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto(`file://${entry}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  return page;
}

function parsed(doc: MotionDoc): MotionDoc {
  const verdict = parseMotionDoc(doc);
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

const BOX_TOLERANCE_PX = 4;

type Seen = { text: string; top: number; left: number; width: number; height: number };

const wordsOf = (text: string) => text.replace(/\s+/g, '');

async function canvasBoxes(doc: MotionDoc): Promise<Seen[]> {
  const page = await chromiumExport.open({ width: doc.width, height: doc.height, scale: 1 });
  try {
    await page.load(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: libsOrigin() }));
    await page.seek(posterSecond(doc));
    const texts = everyClip(doc).filter((c) => typeof c.props.text === 'string' && c.props.text.trim() && !c.hidden);
    const seen: Seen[] = [];
    for (const clip of texts) {
      const box = await page.boxOf(clip.id);
      if (box) {
        seen.push({ text: wordsOf(String(clip.props.text)), ...box });
      }
    }
    return seen;
  } finally {
    await page.close();
  }
}

async function exportBoxes(page: Awaited<ReturnType<typeof openExport>>, texts: string[]): Promise<Map<string, Seen[]>> {
  const rows = (await page.evaluate((wanted) => {
    const leaves = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()));
    return wanted.map((text) => leaves.filter((e) => (e.textContent ?? '').replace(/\s+/g, '') === text).map((e) => { const r = e.getBoundingClientRect(); return { text, top: r.top + scrollY, left: r.left, width: r.width, height: r.height }; }));
  }, texts)) as Seen[][];
  return new Map(texts.map((t, i) => [t, rows[i]]));
}

function firstDivergence(canvas: Seen[], exported: Map<string, Seen[]>): string {
  const used = new Map<string, number>();
  for (const c of canvas) {
    const n = used.get(c.text) ?? 0;
    used.set(c.text, n + 1);
    const e = exported.get(c.text)?.[n];
    if (!e) {
      return `"${c.text.slice(0, 40)}" is missing from the export`;
    }
    if (Math.abs(e.top - c.top) > BOX_TOLERANCE_PX || Math.abs(e.left - c.left) > BOX_TOLERANCE_PX) {
      return `"${c.text.slice(0, 40)}" canvas ${Math.round(c.left)},${Math.round(c.top)} ${Math.round(c.width)}x${Math.round(c.height)} export ${Math.round(e.left)},${Math.round(e.top)} ${Math.round(e.width)}x${Math.round(e.height)}`;
    }
  }
  return 'none';
}

const cases = ENABLED ? allFixtures().map((f) => ({ ...f, doc: parsed(f.doc) })) : [];
const only = process.env.CODE_EXPORT_ONLY?.split(',');

describe.runIf(ENABLED)('exported HTML paints like the canvas at every view', () => {
  for (const fixture of cases.filter((f) => !only || only.includes(f.name))) {
    const exported = exportCode(fixture.doc, { target: CodeTarget.Html, name: 'Page' });
    const dir = mkdtempSync(join(tmpdir(), `export-${fixture.name}-`));
    const entry = written(dir, exported.files);

    describe(fixture.name, () => {
      for (const view of viewsOf(fixture.doc)) {
        it(`${view.id} ${view.width}px`, async () => {
          const seen = resolveView(fixture.doc, view.id);
          const reference = await drawStill(chromiumFrames, { doc: seen, tokens: FEEGA_TOKENS, assets: {} }, SPEC);
          const refHeight = (await sharp(reference).metadata()).height!;
          const page = await openExport(entry, view.width, refHeight);
          const shot = Buffer.from(await page.screenshot({ fullPage: true, type: 'png' }));
          const canvas = await canvasBoxes(seen);
          const diverges = firstDivergence(canvas, await exportBoxes(page, [...new Set(canvas.map((c) => c.text))]));
          await page.close();
          const score = await scored(reference, shot, view.width);
          mkdirSync(OUT, { recursive: true });
          const stem = join(OUT, `${fixture.name}-${view.id}`);
          writeFileSync(`${stem}.png`, await sideBySide(score.a, score.b, score.width, score.height));
          writeFileSync(`${stem}.json`, JSON.stringify({ fixture: fixture.name, view: view.id, width: view.width, mean: score.mean, min: score.min, heightRatio: score.heightRatio }));
          console.log(`FIDELITY ${fixture.name} ${view.id} ${view.width} mean=${score.mean.toFixed(4)} min=${score.min.toFixed(4)} height=${score.heightRatio.toFixed(3)} first-diverging=${diverges}`);

          expect(score.mean).toBeGreaterThanOrEqual(floorOf(fixture.name, view.id));
        });
      }

      it('never scrolls sideways between breakpoints', async () => {
        const widths = OVERFLOW_WIDTHS.filter((w) => w <= fixture.doc.width);
        const overflow: string[] = [];
        for (const width of widths) {
          const page = await openExport(entry, width, 800);
          const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
          const culprits = scroll > width ? await page.evaluate((w) => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 1 && ![...e.children].some((c) => c.getBoundingClientRect().right > w + 1)).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${e.className && typeof e.className === 'string' ? e.className : ''} right=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`), width) : [];
          await page.close();
          if (scroll > width) {
            overflow.push(`${width}px scrolls to ${scroll}px by ${culprits.join(' | ')}`);
          }
        }

        expect(overflow).toEqual([]);
      });
    });
  }
});
