import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import sharp from 'sharp';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import type { PageTree } from './page-tree';
import { PAGE_VIEWS, type PageView, type ViewRead } from './page-views';
import { capturedIn, scoredIn } from './fidelity-pages';
import { band, FOLD, harnessShape, plannedPage, scores, sideBySide, stacked } from './fidelity-score';

const LABEL = process.env.URL_IMPORT_FIDELITY ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const atWidth = (width: number, doc: { width: number }) => ({ mime: 'image/png', ext: 'png', scale: Math.max(1, width / doc.width), quality: undefined, size: () => FOLD }) as never;

const captured = LABEL ? capturedIn(process.env.URL_IMPORT_CAPTURED ?? LABEL) : '';
const names = captured && existsSync(captured) ? readdirSync(captured).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).filter((n) => !n.includes('@') && (!ONLY || ONLY.includes(n))) : [];

const viewsOf = (name: string): ViewRead[] => PAGE_VIEWS.flatMap((view) => (existsSync(join(captured, `${name}@${view.width}.json`)) ? [{ view, tree: JSON.parse(readFileSync(join(captured, `${name}@${view.width}.json`), 'utf8')) as PageTree }] : []));

async function viewDrawn(items: PlanItem[], view: PageView, assetOf: Record<string, string>, assets: Record<string, string>): Promise<Buffer> {
  const parts: { input: Buffer; top: number; left: number }[] = [];
  let top = 0;
  for (const item of items) {
    const doc = resolveView(imagesFilled(item.doc, item.images, assetOf), view.id);
    const pxPerUnit = item.size.width / item.doc.width;
    const png = await drawStill(chromiumFrames, { doc, tokens: FEEGA_TOKENS, assets }, atWidth(view.width, doc));
    const fitted = await sharp(png).resize({ width: Math.min(view.width, Math.round(doc.width * pxPerUnit)), height: Math.round(doc.height * pxPerUnit), fit: 'fill' }).png().toBuffer();
    parts.push({ input: fitted, top, left: 0 });
    top += (await sharp(fitted).metadata()).height!;
  }
  return sharp({ create: { width: view.width, height: Math.max(1, top), channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(parts).png().toBuffer();
}

describe.runIf(LABEL && names.length)('an imported page painted again looks like the page', () => {
  it.each(names)('%s', async (name) => {
    const tree = JSON.parse(readFileSync(join(captured, `${name}.json`), 'utf8')) as PageTree;
    const views = viewsOf(name);
    const { made, assetOf, assets } = await plannedPage(tree, views, harnessShape());
    const parts: { png: Buffer; height: number }[] = [];
    for (const item of made.plan.items) {
      parts.push({ png: await drawStill(chromiumFrames, { doc: imagesFilled(item.doc, item.images, assetOf), tokens: FEEGA_TOKENS, assets }, atWidth(FOLD.width, item.doc)), height: item.size.height });
    }
    const drawn = await stacked(parts);
    const out = scoredIn(LABEL);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${name}-imported.png`), drawn);
    const scored = await scores(readFileSync(join(captured, `${name}-source.png`)), drawn);
    writeFileSync(join(out, `${name}-fold.png`), await sideBySide(await band(scored.a, 0), await band(scored.b, 0), FOLD.height));
    writeFileSync(join(out, `${name}-full.png`), await sideBySide(scored.a, scored.b, scored.height));
    writeFileSync(join(out, `${name}-score.json`), JSON.stringify({ fold: scored.fold, full: scored.full, bands: scored.bands, height: tree.height, truncated: tree.truncated, skipped: made.plan.skipped.length }, null, 2));
    for (const { view } of views) {
      const viewed = await viewDrawn(made.plan.items, view, assetOf, assets);
      const fold = { width: view.width, height: FOLD.height };
      const viewScored = await scores(readFileSync(join(captured, `${name}@${view.width}-source.png`)), viewed, fold);
      writeFileSync(join(out, `${name}@${view.width}-imported.png`), viewed);
      writeFileSync(join(out, `${name}@${view.width}-full.png`), await sideBySide(viewScored.a, viewScored.b, viewScored.height, fold.width));
      writeFileSync(join(out, `${name}@${view.width}-score.json`), JSON.stringify({ fold: viewScored.fold, full: viewScored.full, bands: viewScored.bands }, null, 2));
    }

    expect(drawn.length).toBeGreaterThan(0);
  }, 300_000);
});
