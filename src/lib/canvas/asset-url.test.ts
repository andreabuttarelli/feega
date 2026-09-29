import { describe, expect, it } from 'vitest';
import { keepSame } from './snapshot-keep';
import { AssetSize, canvasAssetUrl, sized } from './asset-url';

describe('canvasAssetUrl', () => {
  it('a tier asks the server for the preview', () => {
    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512)).toBe('/p/p1/c/c1/assets/a1?size=512');
  });

  it('full is the original file, for download and generation inputs', () => {
    expect(canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Full)).toBe('/p/p1/c/c1/assets/a1');
  });
});

describe('sized', () => {
  it('turns a stored canvas asset path into its tile', () => {
    expect(sized('/p/p1/c/c1/assets/a1', AssetSize.Px512)).toBe('/p/p1/c/c1/assets/a1?size=512');
  });

  it('leaves an external or already signed url alone', () => {
    const external = 'https://cdn.example.com/x.jpg';
    expect(sized(external, AssetSize.Px512)).toBe(external);
  });

  it('does not stack two sizes on the same path', () => {
    expect(sized('/p/p1/c/c1/assets/a1?size=512', AssetSize.Thumb)).toBe('/p/p1/c/c1/assets/a1?size=thumb');
  });

  it('full strips the preview back to the original', () => {
    expect(sized('/p/p1/c/c1/assets/a1?size=512', AssetSize.Full)).toBe('/p/p1/c/c1/assets/a1');
  });
});

describe('preview identity across refetches', () => {
  it('the same tile url is the same asset, so a refetch keeps the decoded image', () => {
    const shown = { url: canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512) };
    const fetched = { url: canvasAssetUrl('p1', 'c1', 'a1', AssetSize.Px512) };
    expect(keepSame(shown, fetched, Date.now())).toBe(shown);
  });
});
