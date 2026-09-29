import { describe, expect, it } from 'vitest';
import { AssetSize } from './asset-url';
import { decodedPx, nextTier, planTiers, tierFor, type TileView } from './image-tiers';

describe('tierFor', () => {
  it('a 320px tile at zoom 1 on a 2x screen needs 640px, so the 1024 tier', () => {
    expect(tierFor(320, 1, 2)).toBe(AssetSize.Px1024);
  });

  it('zoomed far out, the same tile needs the smallest tier', () => {
    expect(tierFor(320, 0.2, 2)).toBe(AssetSize.Px256);
  });

  it('at 3x zoom a 320px tile on a 2x screen needs 1920px, so the 2048 tier', () => {
    expect(tierFor(320, 3, 2)).toBe(AssetSize.Px2048);
  });

  it('beyond the largest preview only the original is sharp enough', () => {
    expect(tierFor(320, 4, 2)).toBe(AssetSize.Full);
  });

  it('exactly on a tier boundary stays on that tier', () => {
    expect(tierFor(256, 1, 2)).toBe(AssetSize.Px512);
  });
});

describe('nextTier', () => {
  it('upgrades as soon as a sharper tier is needed', () => {
    expect(nextTier(AssetSize.Px512, AssetSize.Px1024)).toBe(AssetSize.Px1024);
  });

  it('keeps a decoded tier when the need drops by one step', () => {
    expect(nextTier(AssetSize.Px1024, AssetSize.Px512)).toBe(AssetSize.Px1024);
  });

  it('downgrades when the need drops by two steps or more', () => {
    expect(nextTier(AssetSize.Full, AssetSize.Px512)).toBe(AssetSize.Px512);
  });

  it('a tile never shown takes what it needs', () => {
    expect(nextTier(null, AssetSize.Px512)).toBe(AssetSize.Px512);
  });
});

const tile = (id: string, over: Partial<TileView> = {}): TileView => ({ id, cssWidth: 320, visible: true, current: null, ...over });

describe('planTiers', () => {
  it('a visible tile at 3x zoom gets at least the tier its pixels need', () => {
    const plan = planTiers([tile('a')], { zoom: 3, dpr: 2, budgetPx: Infinity });
    expect(plan.get('a')).toBe(AssetSize.Px2048);
  });

  it('an off-screen tile takes the smallest tier whatever the zoom', () => {
    const plan = planTiers([tile('a', { visible: false })], { zoom: 3, dpr: 2, budgetPx: Infinity });
    expect(plan.get('a')).toBe(AssetSize.Px256);
  });

  it('a tile that scrolls off-screen gives its decoded tier back', () => {
    const plan = planTiers([tile('a', { visible: false, current: AssetSize.Full })], { zoom: 1, dpr: 2, budgetPx: Infinity });
    expect(plan.get('a')).toBe(AssetSize.Px256);
  });

  it('a tile that scrolls into view upgrades to what it needs', () => {
    const plan = planTiers([tile('a', { current: AssetSize.Px256 })], { zoom: 1, dpr: 2, budgetPx: Infinity });
    expect(plan.get('a')).toBe(AssetSize.Px1024);
  });

  it('over budget, visible tiles step down together until they fit', () => {
    const tiles = [tile('a'), tile('b')];
    const budgetPx = decodedPx(AssetSize.Px1024) * 2;

    const plan = planTiers(tiles, { zoom: 3, dpr: 2, budgetPx });

    expect(plan.get('a')).toBe(AssetSize.Px1024);
    expect(plan.get('b')).toBe(AssetSize.Px1024);
  });

  it('never steps below the smallest tier, even when the budget cannot be met', () => {
    const plan = planTiers([tile('a')], { zoom: 1, dpr: 2, budgetPx: 1 });
    expect(plan.get('a')).toBe(AssetSize.Px256);
  });

  it('off-screen tiles do not count against the budget of the visible ones', () => {
    const offscreen = Array.from({ length: 500 }, (_, i) => tile(`off-${i}`, { visible: false }));
    const plan = planTiers([tile('a'), ...offscreen], { zoom: 1, dpr: 2, budgetPx: decodedPx(AssetSize.Px1024) });
    expect(plan.get('a')).toBe(AssetSize.Px1024);
  });
});
