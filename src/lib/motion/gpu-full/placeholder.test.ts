import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { drawFrame, ItemKind, prepare, Unsupported } from '@feega/motion-core/motion/gpu-full/display-list';
import { DrawnKind, type DomRead } from '@feega/motion-core/motion/gpu-full/dom/read';
import { readClips } from '@feega/motion-core/motion/gpu-full/dom/custom';
import { CUSTOM_ROOT_PREFIX } from '@feega/motion-core/motion/gpu-full/dom/tree';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { FillRule, PaintKind } from '@feega/motion-core/motion/gpu-full/paint';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const empty = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: null, x: 0.5, y: 0.5, width: 0.5, height: 0.5 } }, 'photo'));
const filled = must(addClip(empty, { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: 'a1' } }, 'shot'));
const grid = must(addClip(filled, { component: 'Composition', from: 0, durationInFrames: 30, props: { layout: 'helix', media: [] } }, 'grid'));

const card: DomRead = { drawn: [{ kind: DrawnKind.Path, contours: [[0, 0, 10, 0, 10, 10]], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [1, 1, 1, 1] }, opacity: 1, matrix: [1, 0, 0, 1, 0, 0] }], gaps: [] };

describe('media without a picture, and compositions', () => {
  it('reads the placeholder of empty media and every composition, never a picture it can draw itself', () => {
    expect(readClips(grid).read.sort()).toEqual(['grid', 'photo']);
  });

  it('marks the placeholder and the composition as the roots the reader looks for', () => {
    const html = composeHtml({ doc: grid, tokens: FEEGA_TOKENS, assets: {} });

    expect(html).toContain(`id="${CUSTOM_ROOT_PREFIX}photo"`);
    expect(html).toContain(`id="${CUSTOM_ROOT_PREFIX}grid"`);
  });

  it('reads a logo set as text from a root spanning its box, so the text keeps its place in it', () => {
    const named = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Logo', from: 0, durationInFrames: 30, props: { assetId: null, height: 0.1 } }, 'logo'));
    const html = composeHtml({ doc: named, tokens: FEEGA_TOKENS, assets: {} });

    expect(html).toMatch(new RegExp(`id="${CUSTOM_ROOT_PREFIX}logo" style="[^"]*height:${named.height * 0.1}px`));
  });

  it('draws the read placeholder in the box of the empty image', () => {
    const list = drawFrame(prepare(empty, FEEGA_TOKENS), 0, new Map([['photo', card]]));
    const { width, height } = empty;

    expect(list.unsupported).toEqual([]);
    expect(list.items).toMatchObject([{ kind: ItemKind.Path, clip: 'photo', matrix: [1, 0, 0, 1, width / 4, height / 4] }]);
  });

  it('draws a composition from its read, and waits for it before', () => {
    const only = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Composition', from: 0, durationInFrames: 30, props: { layout: 'helix', media: [] } }, 'grid'));

    expect(drawFrame(prepare(only, FEEGA_TOKENS), 0).unsupported).toEqual([{ clip: 'grid', component: 'Composition', reason: Unsupported.Unread }]);
    expect(drawFrame(prepare(only, FEEGA_TOKENS), 0, new Map([['grid', card]])).items).toMatchObject([{ kind: ItemKind.Path, clip: 'grid' }]);
  });
});
