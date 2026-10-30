import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { similarity } from '$lib/server/web/ui-fidelity';
import type { PageTree } from './page-tree';
import { capturedIn, scoredIn } from './fidelity-pages';
import { fontsWanted, urlPlan } from './url-doc';

const LABEL = process.env.URL_IMPORT_FIDELITY ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const FOLD = { width: 1280, height: 800 };
const SIDE_GAP = 20;
const THUMB_WIDTH = 1600;
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;
const WHITE = { r: 255, g: 255, b: 255 };

const captured = LABEL ? capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL) : '';
const names = captured && existsSync(captured) ? readdirSync(captured).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).filter((n) => !ONLY || ONLY.includes(n)) : [];

const band = (png: Buffer, top: number) => sharp(png).extract({ left: 0, top, ...FOLD }).png().toBuffer();

async function inlined(url: string): Promise<string> {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    return url;
  }
  return `data:font/woff2;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
}

async function padded(png: Buffer, height: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const fitted = await sharp(png).resize({ width: FOLD.width }).png().toBuffer();
  const tall = Math.round((meta.height! * FOLD.width) / meta.width!);
  const cut = Math.min(tall, height);
  const top = await sharp(fitted).extract({ left: 0, top: 0, width: FOLD.width, height: cut }).png().toBuffer();
  return sharp({ create: { width: FOLD.width, height, channels: 3, background: WHITE } }).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
}

async function sideBySide(a: Buffer, b: Buffer, height: number): Promise<Buffer> {
  const joined = await sharp({ create: { width: FOLD.width * 2 + SIDE_GAP, height, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: FOLD.width + SIDE_GAP, top: 0 }
    ])
    .png()
    .toBuffer();
  return sharp(joined).resize({ width: THUMB_WIDTH }).png().toBuffer();
}

async function scores(source: Buffer, drawn: Buffer) {
  const height = Math.floor((await sharp(source).metadata()).height! / FOLD.height) * FOLD.height || FOLD.height;
  const [a, b] = [await padded(source, height), await padded(drawn, height)];
  const bands: number[] = [];
  for (let top = 0; top + FOLD.height <= height; top += FOLD.height) {
    bands.push(await similarity(await band(a, top), await band(b, top)));
  }
  return { fold: bands[0], full: bands.reduce((s, v) => s + v, 0) / bands.length, bands, a, b, height };
}

describe.runIf(LABEL && names.length)('an imported page painted again looks like the page', () => {
  it.each(names)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    let n = 0;
    const faces = fontsWanted(tree);
    const fonts = Object.fromEntries(faces.map((f, i) => [f.url, `font-${i}`]));
    const made = urlPlan(tree, () => `c${++n}`, undefined, fonts)!;
    const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
    const assets = { ...Object.fromEntries(Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, url])), ...Object.fromEntries(await Promise.all(faces.map(async (f, i) => [`font-${i}`, await inlined(f.url)]))) };
    const parts: { input: Buffer; top: number; left: number }[] = [];
    let top = 0;
    for (const item of made.plan.items) {
      const png = await drawStill(chromiumFrames, { doc: imagesFilled(item.doc, item.images, assetOf), tokens: FEEGA_TOKENS, assets }, SPEC);
      parts.push({ input: await sharp(png).resize({ width: FOLD.width, height: item.size.height }).png().toBuffer(), top, left: 0 });
      top += item.size.height;
    }
    const drawn = await sharp({ create: { width: FOLD.width, height: top, channels: 3, background: WHITE } }).composite(parts).png().toBuffer();
    const out = scoredIn(LABEL);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${name}-imported.png`), drawn);
    const scored = await scores(readFileSync(join(captured, `${name}-source.png`)), drawn);
    writeFileSync(join(out, `${name}-fold.png`), await sideBySide(await band(scored.a, 0), await band(scored.b, 0), FOLD.height));
    writeFileSync(join(out, `${name}-full.png`), await sideBySide(scored.a, scored.b, scored.height));
    writeFileSync(join(out, `${name}-score.json`), JSON.stringify({ fold: scored.fold, full: scored.full, bands: scored.bands, height: tree.height, truncated: tree.truncated, skipped: made.plan.skipped.length }, null, 2));

    expect(drawn.length).toBeGreaterThan(0);
  }, 300_000);
});
