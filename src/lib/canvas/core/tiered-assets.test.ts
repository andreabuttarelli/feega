import { describe, expect, it } from 'vitest';
import { AssetKind } from '@feega/motion-core/motion/components';
import { AssetSize } from '$lib/canvas/asset-url';
import { tieredAssets } from './tiered-assets';
import type { FrameDoc } from './frame-build';

const place = { projectId: 'p1', canvasId: 'c1' };
const source = (media: Record<string, { kind: AssetKind; width: number | null; height: number | null }>) =>
  ({ revision: 1, doc: {}, tokens: {}, assets: { img: 'https://store/full.png?sig=1', vid: 'https://store/clip.mp4?sig=1' }, media }) as unknown as FrameDoc;

describe('frame images sized by zoom', () => {
  it('points an image at the canvas rendition of the tier, even without its size (the landings fixture has none)', () => {
    const tiered = tieredAssets(source({ img: { kind: AssetKind.Image, width: null, height: null } }), place, AssetSize.Px256);

    expect(tiered.assets.img).toBe('/p/p1/c/c1/assets/img?size=256');
  });

  it('leaves what is not an image as the server signed it', () => {
    const tiered = tieredAssets(source({ img: { kind: AssetKind.Image, width: 10, height: 10 } }), place, AssetSize.Px1024);

    expect(tiered.assets.vid).toBe('https://store/clip.mp4?sig=1');
    expect(tiered.assets.img).toBe('/p/p1/c/c1/assets/img?size=1024');
  });

  it('keeps a source without hints as it is', () => {
    const plain = { ...source({}), media: undefined } as FrameDoc;

    expect(tieredAssets(plain, place, AssetSize.Px256)).toBe(plain);
  });
});
