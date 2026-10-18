import { describe, expect, it } from 'vitest';
import { nextSnapshot, snapshotKey } from './snapshot-queue';

const tile = (id: string, x = 0) => ({ id, kind: 'doc', x, y: 0, w: 100, h: 100 });

describe('snapshotKey — one picture per node revision', () => {
  it('changes with the data, the size or the thumbs, never with the position', () => {
    const base = snapshotKey(tile('a'), { content: 'x' }, []);
    expect(snapshotKey({ ...tile('a'), x: 500 }, { content: 'x' }, [])).toBe(base);
    expect(snapshotKey(tile('a'), { content: 'y' }, [])).not.toBe(base);
    expect(snapshotKey({ ...tile('a'), w: 120 }, { content: 'x' }, [])).not.toBe(base);
    expect(snapshotKey(tile('a'), { content: 'x' }, ['t'])).not.toBe(base);
  });

  it('a run starting or finishing does not re-rasterise the card: its live state is drawn on top', () => {
    const idle = snapshotKey(tile('a'), { prompt: 'p' }, []);
    expect(snapshotKey(tile('a'), { prompt: 'p', running: true, status: 'running', run_id: 'r', started_at: 't' }, [])).toBe(idle);
    expect(snapshotKey(tile('a'), { prompt: 'p', refId: 'out' }, [])).not.toBe(idle);
  });
});

describe('nextSnapshot — which node to picture next', () => {
  it('visible nodes first, then the rest, skipping fresh pictures and live tiles', () => {
    const tiles = [tile('far', 9000), tile('seen'), tile('fresh'), tile('live')];
    const keyOf = (id: string) => `k-${id}`;
    const pictured = new Map([['fresh', 'k-fresh']]);
    expect(nextSnapshot(tiles, keyOf, pictured, new Set(['seen', 'fresh', 'live']), new Set(['live']))).toBe('seen');
    expect(nextSnapshot(tiles, keyOf, new Map([...pictured, ['seen', 'k-seen']]), new Set(['seen', 'fresh', 'live']), new Set(['live']))).toBe('far');
  });

  it('a stale picture is redone', () => {
    expect(nextSnapshot([tile('a')], () => 'new', new Map([['a', 'old']]), new Set(['a']), new Set())).toBe('a');
  });

  it('nothing left, nothing to do', () => {
    expect(nextSnapshot([tile('a')], () => 'k', new Map([['a', 'k']]), new Set(['a']), new Set())).toBeNull();
  });

  it('among visible nodes, the one nearest the view centre goes first', () => {
    const tiles = [tile('edge', 0), tile('middle', 400), tile('right', 900)];
    expect(nextSnapshot(tiles, (id) => id, new Map(), new Set(['edge', 'middle', 'right']), new Set(), { x: 450, y: 50 })).toBe('middle');
  });
});
