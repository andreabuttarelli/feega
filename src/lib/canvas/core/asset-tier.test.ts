import { describe, expect, it } from 'vitest';
import { AssetSize } from '$lib/canvas/asset-url';
import { assetTier, keptTier } from './asset-tier';

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

describe('keptTier', () => {
  it('allontanandosi un frame tiene le immagini grandi già caricate', () => {
    expect(keptTier(AssetSize.Px256, AssetSize.Px1024)).toBe(AssetSize.Px1024);
  });

  it('avvicinandosi passa alle immagini grandi', () => {
    expect(keptTier(AssetSize.Px1024, AssetSize.Px256)).toBe(AssetSize.Px1024);
  });

  it('senza nulla caricato segue lo zoom', () => {
    expect(keptTier(AssetSize.Px256, undefined)).toBe(AssetSize.Px256);
  });
});
