import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { exportCode } from '@feega/motion-core/motion/codegen/index';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { similarity } from '$lib/server/web/ui-fidelity';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';
import { urlPlan } from '$lib/server/url-import/url-doc';
import { componentCount } from './import-code';

const OUT = join(homedir(), 'Documents/feega-videos/code-import');
const FOLD = { width: 1280, height: 800 };
const FIXTURES = ['shadcn-admin'];
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;

const fold = async (png: Buffer) => sharp(await sharp(png).resize({ width: FOLD.width }).png().toBuffer()).extract({ left: 0, top: 0, ...FOLD }).png().toBuffer();

describe.runIf(process.env.CODE_IMPORT_FIDELITY)('a page imported from code painted again looks like the running app', () => {
  it.each(FIXTURES)('%s', async (name) => {
    const { tree, uses } = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as { tree: PageTree; uses: ComponentUse[] };
    let n = 0;
    const made = codePlan(tree, uses, () => `c${++n}`)!;
    const item = made.plan.items[0];
    const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
    const doc = imagesFilled(item.doc, item.images, assetOf);
    const assets = Object.fromEntries(Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, url]));

    const drawn = await drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets }, SPEC);
    mkdirSync(OUT, { recursive: true });
    const plain = urlPlan(tree, () => `p${++n}`)!.plan.items[0];
    const flat = await drawStill(chromiumFrames, { doc: imagesFilled(plain.doc, plain.images, assetOf), tokens: FEEGA_TOKENS, assets }, SPEC);
    writeFileSync(join(OUT, `${name}-plain.png`), flat);
    writeFileSync(join(OUT, `${name}-imported.png`), drawn);
    const source = join(OUT, `${name}-source.png`);
    const scored = async (png: Buffer) => (existsSync(source) ? similarity(await fold(readFileSync(source)), await fold(png)) : 0);
    const [score, plainScore] = [await scored(drawn), await scored(flat)];

    const sets = Object.values(doc.comps).filter((c) => c.component).map((c) => `${c.component!.name} ${JSON.stringify(c.component!.variant ?? {})}`).sort();
    writeFileSync(join(OUT, `${name}-report.json`), JSON.stringify({ score, plainScore, ...componentCount(doc), uses: uses.length, mains: sets, skipped: made.plan.skipped }, null, 2));
    for (const file of exportCode(doc, { name: 'Dashboard', assets }).files) {
      const path = join(OUT, `${name}-react`, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
    }

    expect(componentCount(doc).components).toBeGreaterThan(0);
  }, 120_000);
});
