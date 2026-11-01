import { describe, expect, it } from 'vitest';
import { landTiles } from './land-tiles';

describe('landTiles', () => {
  it('replaces a tile realtime already added instead of keeping a stale twin', () => {
    const early = { id: 'page', data: { docHeadRevision: 1 } };
    const other = { id: 'other', data: {} };
    const landed = { id: 'page', data: { docHeadRevision: 2 } };

    expect(landTiles([other, early], [landed])).toEqual([other, landed]);
  });

  it('appends tiles nobody has seen yet', () => {
    const other = { id: 'other', data: {} };
    const landed = { id: 'page', data: {} };

    expect(landTiles([other], [landed])).toEqual([other, landed]);
  });
});
