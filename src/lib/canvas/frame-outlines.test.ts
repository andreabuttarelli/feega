import { describe, expect, it } from 'vitest';
import { cacheOutlines, canvasHeads, frameHead, headsParam, missingHeads, outlinesFor, parseHeads } from './frame-outlines';
import { LayerKind, type LayerRow } from './layers';

const row = (id: string, nodeId: string): LayerRow => ({ id, kind: LayerKind.Clip, depth: 2, label: id, type: 'Title', nodeId, hidden: false, locked: false, nested: false });

describe('frame outlines on the client', () => {
  it('round-trips the heads of a canvas through one query parameter, dropping junk', () => {
    const heads = [{ nodeId: 'm1', version: 3 }, { nodeId: 'm2', version: 9 }];
    expect(parseHeads(headsParam(heads))).toEqual(heads);
    expect(parseHeads('m1:x,:4,m2:0,m3:2')).toEqual([{ nodeId: 'm3', version: 2 }]);
  });

  it('asks only for revisions it has not read yet, so a new revision of one frame refetches only that frame', () => {
    const cache = cacheOutlines({}, [{ nodeId: 'm1', version: 3 }, { nodeId: 'm2', version: 9 }], { m1: [row('t1', 'm1')] });

    expect(missingHeads([{ nodeId: 'm1', version: 3 }, { nodeId: 'm2', version: 9 }], cache)).toEqual([]);
    expect(missingHeads([{ nodeId: 'm1', version: 4 }, { nodeId: 'm2', version: 9 }], cache)).toEqual([{ nodeId: 'm1', version: 4 }]);
  });

  it('serves each frame the outline of its current revision', () => {
    const cache = cacheOutlines({}, [{ nodeId: 'm1', version: 3 }], { m1: [row('t1', 'm1')] });

    expect(outlinesFor([{ nodeId: 'm1', version: 3 }], cache)).toEqual({ m1: [row('t1', 'm1')] });
    expect(outlinesFor([{ nodeId: 'm1', version: 4 }], cache)).toEqual({});
  });

  it('only a frame with a saved revision has a head to read', () => {
    expect(frameHead('motion', { docHeadRevision: 5 })).toBe(5);
    expect(frameHead('motion', { docHeadRevision: 0 })).toBeNull();
    expect(frameHead('text', { docHeadRevision: 5 })).toBeNull();
    expect(canvasHeads([{ id: 'm1', head: 5 }, { id: 'n1', head: null }, { id: 'n2' }])).toEqual([{ nodeId: 'm1', version: 5 }]);
  });
});
