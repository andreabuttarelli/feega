import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import type { PageTree } from './page-tree';
import { capturedIn, scoredIn } from './fidelity-pages';
import { band, FOLD, plannedPage, scores, sideBySide, stacked } from './fidelity-score';

const LABEL = process.env.URL_IMPORT_FIDELITY ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;

const captured = LABEL ? capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL) : '';
const names = captured && existsSync(captured) ? readdirSync(captured).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).filter((n) => !ONLY || ONLY.includes(n)) : [];

describe.runIf(LABEL && names.length)('an imported page painted again looks like the page', () => {
  it.each(names)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    const { made, assetOf, assets } = await plannedPage(tree);
    const parts: { png: Buffer; height: number }[] = [];
    for (const item of made.plan.items) {
      parts.push({ png: await drawStill(chromiumFrames, { doc: imagesFilled(item.doc, item.images, assetOf), tokens: FEEGA_TOKENS, assets }, SPEC), height: item.size.height });
    }
    const drawn = await stacked(parts);
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
