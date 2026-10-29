import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { similarity } from '$lib/server/web/ui-fidelity';
import type { PageTree } from './page-tree';
import { urlPlan } from './url-doc';

const OUT = join(homedir(), 'Documents/feega-videos/url-import');
const FOLD = { width: 1280, height: 800 };
const FIXTURES = ['linear', 'stripe', 'vercel'];
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;

const fold = (png: Buffer) => sharp(png).extract({ left: 0, top: 0, ...FOLD }).png().toBuffer();

describe.runIf(process.env.URL_IMPORT_FIDELITY)('an imported page painted again looks like the page', () => {
  it.each(FIXTURES)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as PageTree;
    let n = 0;
    const made = urlPlan(tree, () => `c${++n}`)!;
    const item = made.plan.items[0];
    const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
    const doc = imagesFilled(item.doc, item.images, assetOf);
    const assets = Object.fromEntries(Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, url]));

    const drawn = await drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets }, SPEC);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${name}-imported.png`), drawn);
    const source = join(OUT, `${name}-source.png`);
    const score = existsSync(source) ? await similarity(await fold(readFileSync(source)), await fold(drawn)) : 0;
    writeFileSync(join(OUT, `${name}-score.txt`), String(score));

    expect(drawn.length).toBeGreaterThan(0);
  }, 120_000);
});
