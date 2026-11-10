import { describe, expect, it } from 'vitest';
import { AssetSize } from '$lib/canvas/asset-url';
import { Reach, assetTier, keptTier, reachOf } from './asset-tier';

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
    expect(keptTier(AssetSize.Px256, AssetSize.Px1024, Reach.Near)).toBe(AssetSize.Px1024);
  });

  it('avvicinandosi passa alle immagini grandi', () => {
    expect(keptTier(AssetSize.Px1024, AssetSize.Px256, Reach.Near)).toBe(AssetSize.Px1024);
  });

  it('senza nulla caricato segue lo zoom', () => {
    expect(keptTier(AssetSize.Px256, undefined, Reach.Near)).toBe(AssetSize.Px256);
  });
});

describe('tier cap', () => {
  const view = { x: 0, y: 0, zoom: 1 };
  const screen = { width: 1000, height: 800 };

  it('un frame lontano torna alle immagini piccole', () => {
    expect(keptTier(AssetSize.Px256, AssetSize.Px1024, Reach.Far)).toBe(AssetSize.Px256);
  });

  it('vicino è dentro uno schermo di margine, lontano oltre', () => {
    expect(reachOf({ x: 1500, y: 100, w: 200, h: 200 }, view, screen)).toBe(Reach.Near);
    expect(reachOf({ x: 2500, y: 100, w: 200, h: 200 }, view, screen)).toBe(Reach.Far);
    expect(reachOf({ x: 100, y: -1700, w: 200, h: 200 }, view, screen)).toBe(Reach.Far);
  });
});
