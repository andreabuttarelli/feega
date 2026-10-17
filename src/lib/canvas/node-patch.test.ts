import { describe, expect, it } from 'vitest';
import { baseOf, clashingKeys, diffNodeData, mergeNodeData } from './node-patch';

describe('diffNodeData: only the keys the caller changed', () => {
  it('drops the keys whose value did not move', () => {
    const saved = { prompt: 'cat', refId: 'a1', runId: 'r1' };
    const next = { prompt: 'dog', refId: 'a1', runId: 'r1' };

    expect(diffNodeData(saved, next)).toEqual({ prompt: 'dog' });
  });

  it('a key that disappears travels as null', () => {
    expect(diffNodeData({ prompt: 'cat', error: 'boom' }, { prompt: 'cat', error: undefined })).toEqual({ error: null });
  });

  it('params diff down to the leaf, at any depth', () => {
    const saved = { params: { size: { w: 1, h: 2 }, seed: 1 } };
    const next = { params: { size: { w: 1, h: 3 }, seed: 1 } };

    expect(diffNodeData(saved, next)).toEqual({ params: { size: { h: 3 } } });
  });

  it('params and filters diff one level down', () => {
    const saved = { params: { seed: 1, steps: 20 }, filters: { query: 'x', sort: 'new' } };
    const next = { params: { seed: 2, steps: 20 }, filters: { query: 'x' } };

    expect(diffNodeData(saved, next)).toEqual({ params: { seed: 2 }, filters: { sort: null } });
  });

  it('arrays replace whole', () => {
    const saved = { references: [{ id: 'a' }, { id: 'b' }] };
    const next = { references: [{ id: 'a' }] };

    expect(diffNodeData(saved, next)).toEqual({ references: [{ id: 'a' }] });
  });

  it('objects outside the table replace whole', () => {
    const saved = { instagram: { caption: 'a', media: [] } };
    const next = { instagram: { caption: 'b' } };

    expect(diffNodeData(saved, next)).toEqual({ instagram: { caption: 'b' } });
  });

  it('key order is not a change', () => {
    expect(diffNodeData({ params: { a: 1, b: 2 } }, { params: { b: 2, a: 1 } })).toEqual({});
  });
});

describe('mergeNodeData: the patch lands on the current row', () => {
  it('keeps every key the patch does not name', () => {
    expect(mergeNodeData({ prompt: 'cat', refId: 'new' }, { prompt: 'dog' })).toEqual({ prompt: 'dog', refId: 'new' });
  });

  it('null removes the key', () => {
    expect(mergeNodeData({ prompt: 'cat', error: 'boom' }, { error: null })).toEqual({ prompt: 'cat' });
  });

  it('params merge at every depth: a peer\'s sibling field survives', () => {
    const current = { params: { seed: 1, steps: 20, size: { w: 1 } } };

    expect(mergeNodeData(current, { params: { seed: 2, size: { h: 2 }, steps: null } })).toEqual({
      params: { seed: 2, size: { w: 1, h: 2 } }
    });
  });

  it('arrays replace', () => {
    expect(mergeNodeData({ references: [1, 2] }, { references: [3] })).toEqual({ references: [3] });
  });
});

describe('clashingKeys: last writer wins, except where it would lose a list', () => {
  it('disjoint keys never clash', () => {
    const current = { prompt: 'cat', refId: 'theirs' };

    expect(clashingKeys(current, { prompt: 'cat' }, { prompt: 'dog' })).toEqual([]);
  });

  it('the same scalar moved underneath is last-writer-wins, not a conflict', () => {
    expect(clashingKeys({ prompt: 'theirs' }, { prompt: 'cat' }, { prompt: 'dog' })).toEqual([]);
  });

  it('a list moved underneath still clashes: replacing it would drop their items', () => {
    expect(clashingKeys({ references: ['a', 'theirs'] }, { references: ['a'] }, { references: ['a', 'mine'] })).toEqual(['references']);
  });

  it('landing on the value already there is not a clash', () => {
    expect(clashingKeys({ prompt: 'dog' }, { prompt: 'cat' }, { prompt: 'dog' })).toEqual([]);
  });

  it('a nested list clashes by its path', () => {
    const current = { params: { size: { stops: [1, 9] } } };

    expect(clashingKeys(current, { params: { size: { stops: [1] } } }, { params: { size: { stops: [1, 2] } } })).toEqual(['params.size.stops']);
    expect(clashingKeys({ params: { seed: 9 } }, { params: { seed: 1 } }, { params: { seed: 2 } })).toEqual([]);
  });
});

describe('baseOf: what the client believed before its patch', () => {
  it('follows the patch to the leaf', () => {
    expect(baseOf({ params: { size: { w: 1, h: 2 } } }, { params: { size: { h: 3 } } })).toEqual({ params: { size: { h: 2 } } });
  });

  it('picks the patched keys, one level down for merged ones', () => {
    const saved = { prompt: 'cat', refId: 'a', params: { seed: 1, steps: 20 } };

    expect(baseOf(saved, { prompt: 'dog', params: { seed: 2 } })).toEqual({ prompt: 'cat', params: { seed: 1 } });
  });

  it('a key the client never had travels as null', () => {
    expect(baseOf({}, { prompt: 'dog', params: { seed: 2 } })).toEqual({ prompt: null, params: { seed: null } });
  });
});
