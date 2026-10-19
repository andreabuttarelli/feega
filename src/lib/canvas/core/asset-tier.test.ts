import { describe, expect, it } from 'vitest';
import { AssetSize } from '$lib/canvas/asset-url';
import { assetTier } from './asset-tier';

describe('card image size on the core canvas', () => {
  it('far away a card fetches the 256 px rendition, as the Pixi canvas did', () => {
    expect(assetTier(0.2)).toBe(AssetSize.Px256);
    expect(assetTier(0.74)).toBe(AssetSize.Px256);
  });

  it('close up it fetches 1024 px, never the full original', () => {
    expect(assetTier(0.75)).toBe(AssetSize.Px1024);
    expect(assetTier(4)).toBe(AssetSize.Px1024);
  });
});
