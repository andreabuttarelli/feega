import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import type { PageTree } from './page-tree';
import { capturedIn, scoredIn } from './fidelity-pages';
import { fontsWanted, FULL_SHAPE, urlPlan } from './url-doc';

const LABEL = process.env.URL_IMPORT_SHEET ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const CANVAS = { r: 0xeb, g: 0xeb, b: 0xeb };
const MARGIN_PX = 40;
const MAX_WIDTH_PX = 2400;

const captured = LABEL ? capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL) : '';
const names = captured && existsSync(captured) ? readdirSync(captured).filter((f) => f.endsWith('.json') && !f.includes('@')).map((f) => f.replace(/\.json$/, '')).filter((n) => !ONLY || ONLY.includes(n)) : [];

describe.runIf(LABEL && names.length && process.env.CHROMIUM_PATH)('the Components page of an imported page', () => {
  it.each(names)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    let n = 0;
    const faces = fontsWanted(tree);
    const made = urlPlan(tree, () => `c${++n}`, undefined, Object.fromEntries(faces.map((f, i) => [f.url, `font-${i}`])), FULL_SHAPE)!;
    const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
    const assets = { ...Object.fromEntries(Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, url])), ...Object.fromEntries(faces.map((f, i) => [`font-${i}`, f.url])) };
    const left = Math.min(...made.sets.map((s) => s.centre.x - s.size.width / 2));
    const top = Math.min(...made.sets.map((s) => s.centre.y - s.size.height / 2));
    const placed: { input: Buffer; left: number; top: number }[] = [];
    for (const set of made.sets) {
      const spec = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => ({ width: set.doc.width, height: set.doc.height }) } as never;
      const png = await drawStill(chromiumFrames, { doc: imagesFilled(set.doc, set.images, assetOf), tokens: FEEGA_TOKENS, assets }, spec);
      placed.push({ input: png, left: Math.round(set.centre.x - set.size.width / 2 - left + MARGIN_PX), top: Math.round(set.centre.y - set.size.height / 2 - top + MARGIN_PX) });
    }
    const width = Math.max(...placed.map((p, i) => p.left + made.sets[i].size.width)) + MARGIN_PX;
    const height = Math.max(...placed.map((p, i) => p.top + made.sets[i].size.height)) + MARGIN_PX;
    const page = await sharp({ create: { width, height, channels: 3, background: CANVAS } }).composite(placed).png().toBuffer();
    const out = scoredIn(LABEL);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${name}-components.png`), await sharp(page).resize({ width: Math.min(width, MAX_WIDTH_PX) }).png().toBuffer());

    expect(made.sets.length).toBeGreaterThan(0);
  }, 300_000);
});
