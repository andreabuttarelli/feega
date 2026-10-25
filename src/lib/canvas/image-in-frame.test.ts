import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { imageInFrame, withAssetSwapped } from './image-in-frame';

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
