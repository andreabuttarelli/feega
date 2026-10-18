import { describe, expect, it } from 'vitest';
import { RETRY_MS, SHELF_CAP, parkStuck, shelfIds } from './poster-shelf';

const frame = (id: string, data: Record<string, unknown>) => ({ id, type: 'motion', data: { docHeadRevision: 2, ...data } });

describe('shelfIds — frames whose GPU texture needs the DOM tile to shoot a poster', () => {
  it('a frame with no poster, one behind its doc, or one of unknown revision goes on the shelf', () => {
    const rows = [frame('none', {}), frame('old', { posterAssetId: 'p', posterRevision: 1 }), frame('ok', { posterAssetId: 'p', posterRevision: 2 }), frame('unknown', { posterAssetId: 'p' }), { id: 'img', type: 'image', data: {} }];
    expect(shelfIds(rows, new Set(), new Map(), 0)).toEqual(['none', 'old']);
    expect(shelfIds(rows.slice(2), new Set(), new Map(), 0)).toEqual(['unknown']);
  });

  it('a frame already mounted for editing is not shelved twice', () => {
    expect(shelfIds([frame('a', {})], new Set(['a']), new Map(), 0)).toEqual([]);
  });

  it('only a few at a time: a capture is a long task', () => {
    const rows = Array.from({ length: 10 }, (_, i) => frame(`f${i}`, {}));
    expect(shelfIds(rows, new Set(), new Map(), 0)).toHaveLength(SHELF_CAP);
  });

  it('a frame whose shot is stuck is parked until its retry time, freeing the slot', () => {
    const rows = [frame('stuck', {}), frame('next', {}), frame('third', {})];
    const parked = new Map([['stuck', 1000]]);
    expect(shelfIds(rows, new Set(), parked, 500)).toEqual(['next', 'third']);
    expect(shelfIds(rows, new Set(), parked, 1000)).toEqual(['stuck', 'next']);
  });

  it('parkStuck parks what sat on the shelf too long', () => {
    const since = new Map([['a', 0], ['b', 15_000]]);
    expect([...parkStuck(since, new Map(), 21_000)]).toEqual([['a', 21_000 + RETRY_MS]]);
  });
});
