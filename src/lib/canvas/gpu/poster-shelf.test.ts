import { describe, expect, it } from 'vitest';
import { SHELF_CAP, shelfIds } from './poster-shelf';

const frame = (id: string, data: Record<string, unknown>) => ({ id, type: 'motion', data: { docHeadRevision: 2, ...data } });

describe('shelfIds — frames whose GPU texture needs the DOM tile to shoot a poster', () => {
  it('a frame with no poster, or one behind its doc, goes on the shelf', () => {
    const rows = [frame('none', {}), frame('old', { posterAssetId: 'p', posterRevision: 1 }), frame('ok', { posterAssetId: 'p', posterRevision: 2 }), { id: 'img', type: 'image', data: {} }];
    expect(shelfIds(rows, new Set())).toEqual(['none', 'old']);
  });

  it('a frame already mounted for editing is not shelved twice', () => {
    expect(shelfIds([frame('a', {})], new Set(['a']))).toEqual([]);
  });

  it('only a few at a time: a capture is a long task', () => {
    const rows = Array.from({ length: 10 }, (_, i) => frame(`f${i}`, {}));
    expect(shelfIds(rows, new Set())).toHaveLength(SHELF_CAP);
  });
});
