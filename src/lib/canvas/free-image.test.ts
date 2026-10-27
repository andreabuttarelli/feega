import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { freeImageAssetId, imageSourceTile } from './free-image';

const clipOf = (id: string, component: string, props: Record<string, unknown>) =>
  newClip({ id, from: 0, durationInFrames: 30, component: component as never, props });

const docWith = (...clips: ReturnType<typeof clipOf>[]): MotionDoc => {
  const doc = newMotionDoc(MotionFormat.Landscape);
  doc.tracks[0].clips = clips;
  return doc;
};

describe('freeImageAssetId', () => {
  it('names the asset of an element that holds one image', () => {
    expect(freeImageAssetId(docWith(clipOf('c1', 'Image', { assetId: 'asset-1' })))).toBe('asset-1');
  });

  it('is null for an image clip with no asset yet', () => {
    expect(freeImageAssetId(docWith(clipOf('c1', 'Image', { assetId: '' })))).toBeNull();
  });

  it('is null when the element holds something else', () => {
    expect(freeImageAssetId(docWith(clipOf('c1', 'Text', { text: 'hi' })))).toBeNull();
  });

  it('is null when the element holds more than one clip', () => {
    expect(freeImageAssetId(docWith(clipOf('c1', 'Image', { assetId: 'a' }), clipOf('c2', 'Image', { assetId: 'b' })))).toBeNull();
  });

  it('is null without a doc', () => {
    expect(freeImageAssetId(null)).toBeNull();
  });
});

describe('imageSourceTile', () => {
  const element = { id: 'el', kind: 'element', connectable: false, connectors: [], output: null };
  const holding = docWith(clipOf('c1', 'Image', { assetId: 'asset-1' }));

  it('gives an element holding one image an image output', () => {
    expect(imageSourceTile(element, holding)).toMatchObject({ connectable: true, connectors: [], output: 'images', node: { id: 'el', kind: 'element' } });
  });

  it('leaves an element without an image alone', () => {
    expect(imageSourceTile(element, docWith(clipOf('c1', 'Text', { text: 'hi' })))).toBe(element);
  });

  it('leaves every other tile alone', () => {
    const frame = { id: 'f', kind: 'motion', connectable: true, connectors: [], output: 'motions' as const };
    expect(imageSourceTile(frame, holding)).toBe(frame);
  });
});
