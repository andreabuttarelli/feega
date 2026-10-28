import { describe, expect, it } from 'vitest';
import { sourceAssetIdOf } from './image-source';

describe('sourceAssetIdOf', () => {
  it('prefers the generated result', () => {
    expect(sourceAssetIdOf({ refId: 'gen', assetId: 'up' })).toBe('gen');
  });

  it('falls back to the uploaded asset', () => {
    expect(sourceAssetIdOf({ assetId: 'up' })).toBe('up');
  });

  it('is null for a node holding nothing, or non-string ids', () => {
    expect(sourceAssetIdOf({})).toBeNull();
    expect(sourceAssetIdOf({ refId: '', assetId: 3 })).toBeNull();
  });
});
