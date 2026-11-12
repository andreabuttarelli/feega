import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import { withContentHeight } from '@feega/motion-core/motion/layout/resolve';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { imagesFilled } from '$lib/canvas/figma/images';
import { fitToNode, ResizeMode } from '$lib/motion/custom-size';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import type { PageTree } from './page-tree';
import { PAGE_VIEWS, type ViewRead } from './page-views';
import { capturedIn, scoredIn } from './fidelity-pages';
import { FOLD, plannedPage, scores } from './fidelity-score';
import { FULL_SHAPE, PLAIN_SHAPE } from './url-doc';

const LABEL = process.env.URL_IMPORT_LAYERS ?? '';
const BASE = process.env.URL_IMPORT_LAYERS_BASE ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const RESIZED = [768, 390];
const CHANNELS = 4;

const captured = LABEL ? capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL) : '';
const names = captured && existsSync(captured) ? readdirSync(captured).filter((f) => f.endsWith('.json') && !f.includes('@')).map((f) => f.replace(/\.json$/, '')).filter((n) => !ONLY || ONLY.includes(n)) : [];

const viewsOf = (name: string): ViewRead[] => PAGE_VIEWS.flatMap((view) => (existsSync(join(captured, `${name}@${view.width}.json`)) ? [{ view, tree: JSON.parse(readFileSync(join(captured, `${name}@${view.width}.json`), 'utf8')) as PageTree }] : []));

const spec = (scale: number) => ({ mime: 'image/png', ext: 'png', scale, quality: undefined, size: () => FOLD }) as never;

async function differing(a: Buffer, b: Buffer): Promise<number> {
  const [x, y] = await Promise.all([sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) {
    return Math.max(x.info.width * x.info.height, y.info.width * y.info.height);
  }
  let count = 0;
  for (let i = 0; i < x.data.length; i += CHANNELS) {
    count += x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3] ? 1 : 0;
  }
  return count;
}

type Shot = { file: string; png: Buffer };

async function drawn(doc: MotionDoc, assets: Record<string, string>, file: string, scale: number): Promise<Shot> {
  return { file, png: await drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets }, spec(scale)) };
}

async function flat(assets: Record<string, string>): Promise<Record<string, string>> {
  const images = Object.keys(assets).filter((key) => key.startsWith('img-'));
  const made = await Promise.all(images.map(async (key, i) => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: (i * 53) % 256, g: (i * 97) % 256, b: (i * 151) % 256 } } }).png().toBuffer();
    return [key, `data:image/png;base64,${png.toString('base64')}`];
  }));
  return { ...assets, ...Object.fromEntries(made) };
}

describe.runIf(LABEL && names.length)('fewer layers paint the same pixels', () => {
  it.each(names)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    const views = viewsOf(name);
    const out = join(scoredIn(LABEL), name);
    mkdirSync(out, { recursive: true });
    const shots: Shot[] = [];

    const full = await plannedPage(tree, views, FULL_SHAPE);
    const real = await drawn(imagesFilled(full.made.plan.items[0].doc, full.made.plan.items[0].images, full.assetOf), full.assets, 'live.png', FOLD.width / full.made.plan.items[0].doc.width);
    full.assets = await flat(full.assets);
    for (const [i, item] of full.made.plan.items.entries()) {
      const doc = imagesFilled(item.doc, item.images, full.assetOf);
      shots.push(await drawn(doc, full.assets, `full-${i}.png`, FOLD.width / doc.width));
      for (const { view } of views) {
        shots.push(await drawn(resolveView(doc, view.id), full.assets, `full-${i}@${view.width}.png`, FOLD.width / doc.width));
      }
    }

    const plain = await plannedPage(tree, [], PLAIN_SHAPE);
    plain.assets = await flat(plain.assets);
    const [first] = plain.made.plan.items;
    const doc = imagesFilled(first.doc, first.images, plain.assetOf);
    shots.push(await drawn(doc, plain.assets, 'plain-0.png', FOLD.width / doc.width));
    for (const width of RESIZED) {
      const sized = fitToNode(first.doc, { width: Math.round((width * first.doc.width) / tree.width), height: first.doc.height }, ResizeMode.Constrained);
      if (sized.ok) {
        shots.push(await drawn(withContentHeight(imagesFilled(sized.doc, first.images, plain.assetOf)), plain.assets, `plain-0-resized-${width}.png`, 1));
      }
    }

    [real, ...shots].forEach((s) => writeFileSync(join(out, s.file), s.png));
    const source = join(captured, `${name}-source.png`);
    const live = existsSync(source) ? await scores(readFileSync(source), await sharp(real.png).resize({ width: FOLD.width }).png().toBuffer()) : null;
    const diffs = BASE ? await Promise.all(shots.map(async (s) => ({ file: s.file, pixels: existsSync(join(BASE, name, s.file)) ? await differing(s.png, readFileSync(join(BASE, name, s.file))) : -1 }))) : [];
    writeFileSync(join(out, 'guard.json'), JSON.stringify({ fold: live?.fold, full: live?.full, diffs }, null, 2));

    expect(diffs.filter((d) => d.pixels !== 0)).toEqual([]);
  }, 900_000);
});
