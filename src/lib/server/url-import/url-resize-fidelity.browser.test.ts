import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { withContentHeight } from '@feega/motion-core/motion/layout/resolve';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { fitToNode, ResizeMode } from '$lib/motion/custom-size';
import type { PageTree } from './page-tree';
import { capturedIn, scoredIn } from './fidelity-pages';
import { FOLD, plannedPage, scores, sideBySide } from './fidelity-score';

const LABEL = process.env.URL_IMPORT_RESIZE ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',') ?? [];
const WIDTHS = [1024, 768, 390];
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;

describe.runIf(LABEL && ONLY.length)('an imported page resized on the canvas looks like the page at that width', () => {
  it.each(ONLY)('%s', async (name) => {
    const captured = capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL);
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    const { made, assetOf, assets } = await plannedPage(tree);
    const [item] = made.plan.items;
    const out = scoredIn(LABEL);
    mkdirSync(out, { recursive: true });
    const rows: string[] = [];
    for (const width of WIDTHS.filter((w) => existsSync(join(captured, `${name}@${w}-source.png`)))) {
      const per = item.doc.width / tree.width;
      const sized = fitToNode(item.doc, { width: Math.round(width * per), height: item.doc.height }, ResizeMode.Constrained);
      if (!sized.ok) {
        rows.push(`${name}@${width} refused: ${sized.error}`);
        continue;
      }
      const doc = withContentHeight(imagesFilled(sized.doc, item.images, assetOf));
      const drawn = await sharp(await drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets }, SPEC)).resize({ width }).png().toBuffer();
      const scored = await scores(readFileSync(join(captured, `${name}@${width}-source.png`)), drawn, { width, height: FOLD.height });
      writeFileSync(join(out, `${name}@${width}-resized.png`), drawn);
      writeFileSync(join(out, `${name}@${width}-full.png`), await sideBySide(scored.a, scored.b, scored.height, width));
      rows.push(`${name}@${width} fold ${scored.fold.toFixed(3)} full ${scored.full.toFixed(3)}`);
    }
    writeFileSync(join(out, `${name}-resize.txt`), rows.join('\n'));

    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
