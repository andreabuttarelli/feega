// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { imageInFrame, withAssetSwapped } from './image-in-frame';
import { framePicker, frameSpace } from './frame-pick';

const EMPTY = newMotionDoc(MotionFormat.Landscape);
const PICTURE = { assetId: 'asset-1', name: 'photo.png', width: 400, height: 300 };

describe('imageInFrame', () => {
  it('adds one centred Image clip that points at the asset', () => {
    const placed = imageInFrame(EMPTY, PICTURE);

    expect(placed.ok).toBe(true);
    const clips = placed.ok ? placed.doc.tracks.flatMap((t) => t.clips) : [];
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ component: 'Image', props: { assetId: 'asset-1', x: 0.5, y: 0.5 } });
  });

  it('declares the asset in the document', () => {
    const placed = imageInFrame(EMPTY, PICTURE);

    expect(placed.ok && placed.doc.assets.map((a) => a.id)).toEqual(['asset-1']);
  });

  it('leaves the original document untouched', () => {
    imageInFrame(EMPTY, PICTURE);

    expect(EMPTY.tracks.flatMap((t) => t.clips)).toHaveLength(0);
  });
});

describe('withAssetSwapped', () => {
  it('points the clip and the asset list at the real asset', () => {
    const placed = imageInFrame(EMPTY, { ...PICTURE, assetId: 'pending-1' });
    const swapped = placed.ok ? withAssetSwapped(placed.doc, 'pending-1', 'real-1') : EMPTY;

    expect(swapped.assets.map((a) => a.id)).toEqual(['real-1']);
    expect(swapped.tracks.flatMap((t) => t.clips)[0].props.assetId).toBe('real-1');
  });
});

describe('an image inserted in a frame', () => {
  it('has a real outline on the stage, so it can be selected and dragged', () => {
    const placed = imageInFrame(EMPTY, PICTURE);
    if (!placed.ok) {
      throw new Error(placed.error);
    }
    const picker = framePicker({ doc: placed.doc, tokens: FEEGA_TOKENS, assets: { 'asset-1': 'blob:https://app.test/1' } });
    const stage = frameSpace({ x: 0, y: 0, w: EMPTY.width, h: EMPTY.height }, { width: EMPTY.width, height: EMPTY.height }, 0);

    const corners = picker.outlineQuad(placed.clipId, stage)!.flatMap((p) => [p.x, p.y]);
    expect(corners.every(Number.isFinite)).toBe(true);
  });
});
