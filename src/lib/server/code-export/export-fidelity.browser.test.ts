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
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
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
  'landing:tablet': 0.6515,
  'landing:phone': 0.6461,
  'hero-phone:phone': 0.7031,
  'features-grid:tablet': 0.9085,
  'features-grid:phone': 0.8236,
  'component-main-override:phone': 0.6919
};
const OVERFLOWING = new Set(['landing', 'features-grid']);
const floorOf = (fixture: string, view: string) => (MEASURED[`${fixture}:${view}`] ?? TARGET_SCORE) - (`${fixture}:${view}` in MEASURED ? FLOOR_MARGIN : 0);
const OVERFLOW_WIDTHS = [320, 414, 600, 720, 900, 1100];
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
          await page.close();
          const score = await scored(reference, shot, view.width);
          mkdirSync(OUT, { recursive: true });
          const stem = join(OUT, `${fixture.name}-${view.id}`);
          writeFileSync(`${stem}.png`, await sideBySide(score.a, score.b, score.width, score.height));
          writeFileSync(`${stem}.json`, JSON.stringify({ fixture: fixture.name, view: view.id, width: view.width, mean: score.mean, min: score.min, heightRatio: score.heightRatio }));
          console.log(`FIDELITY ${fixture.name} ${view.id} ${view.width} mean=${score.mean.toFixed(4)} min=${score.min.toFixed(4)} height=${score.heightRatio.toFixed(3)}`);

          expect(score.mean).toBeGreaterThanOrEqual(floorOf(fixture.name, view.id));
        });
      }

      const sideways = OVERFLOWING.has(fixture.name) ? it.fails : it;
      sideways('never scrolls sideways between breakpoints', async () => {
        const widths = OVERFLOW_WIDTHS.filter((w) => w <= fixture.doc.width);
        const overflow: string[] = [];
        for (const width of widths) {
          const page = await openExport(entry, width, 800);
          const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
          await page.close();
          if (scroll > width) {
            overflow.push(`${width}px scrolls to ${scroll}px`);
          }
        }

        expect(overflow).toEqual([]);
      });
    });
  }
});
