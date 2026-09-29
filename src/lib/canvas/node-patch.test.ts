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

  it('params merge one level, their values replace', () => {
    const current = { params: { seed: 1, steps: 20, size: { w: 1 } } };

    expect(mergeNodeData(current, { params: { seed: 2, size: { h: 2 }, steps: null } })).toEqual({
      params: { seed: 2, size: { h: 2 } }
    });
  });

  it('arrays replace', () => {
    expect(mergeNodeData({ references: [1, 2] }, { references: [3] })).toEqual({ references: [3] });
  });
});

describe('clashingKeys: a conflict is the same key moved by someone else', () => {
  it('disjoint keys never clash', () => {
    const current = { prompt: 'cat', refId: 'theirs' };

    expect(clashingKeys(current, { prompt: 'cat' }, { prompt: 'dog' })).toEqual([]);
  });

  it('the same key moved underneath clashes', () => {
    expect(clashingKeys({ prompt: 'theirs' }, { prompt: 'cat' }, { prompt: 'dog' })).toEqual(['prompt']);
  });

  it('landing on the value already there is not a clash', () => {
    expect(clashingKeys({ prompt: 'dog' }, { prompt: 'cat' }, { prompt: 'dog' })).toEqual([]);
  });

  it('params clash per sub-key', () => {
    const current = { params: { seed: 9, steps: 30 } };
    const base = { params: { seed: 1 } };

    expect(clashingKeys(current, base, { params: { seed: 2 } })).toEqual(['params.seed']);
    expect(clashingKeys(current, { params: { steps: 30 } }, { params: { steps: 40 } })).toEqual([]);
  });
});

describe('baseOf: what the client believed before its patch', () => {
  it('picks the patched keys, one level down for merged ones', () => {
    const saved = { prompt: 'cat', refId: 'a', params: { seed: 1, steps: 20 } };

    expect(baseOf(saved, { prompt: 'dog', params: { seed: 2 } })).toEqual({ prompt: 'cat', params: { seed: 1 } });
  });

  it('a key the client never had travels as null', () => {
    expect(baseOf({}, { prompt: 'dog', params: { seed: 2 } })).toEqual({ prompt: null, params: { seed: null } });
  });
});
