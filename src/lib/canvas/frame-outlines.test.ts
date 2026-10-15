import { describe, expect, it } from 'vitest';
import { cacheOutlines, canvasHeads, frameHead, headsParam, missingHeads, outlinesFor, parseHeads, parseParts, partIds, partsParam, posterHeads } from './frame-outlines';
import { LayerKind, type LayerRow } from './layers';

const row = (id: string, nodeId: string): LayerRow => ({ id, key: id, kind: LayerKind.Clip, depth: 2, label: id, type: 'Title', nodeId, hidden: false, locked: false, nested: false });

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

describe('closed posters list their parts', () => {
  const poster = (nodeId: string): LayerRow => ({ ...row('p', nodeId), type: 'Custom' });

  it('probes only a closed frame whose outline holds a custom clip, once per revision', () => {
    const heads = [{ nodeId: 'm1', version: 1 }, { nodeId: 'm2', version: 1 }, { nodeId: 'm3', version: 1 }];
    const cache = cacheOutlines({}, heads, { m1: [poster('m1')], m2: [row('t', 'm2')], m3: [poster('m3')] });

    expect(posterHeads(heads, cache, new Set(), 'm3')).toEqual([{ nodeId: 'm1', version: 1 }]);
    expect(posterHeads(heads, cache, new Set(['m1:1']), null)).toEqual([{ nodeId: 'm3', version: 1 }]);
  });

  it('never probes a poster whose parts the outline already names', () => {
    const heads = [{ nodeId: 'm1', version: 1 }];
    const named = cacheOutlines({}, heads, { m1: [poster('m1'), { ...row('p#title:0', 'm1'), kind: LayerKind.Part }] });

    expect(posterHeads(heads, named, new Set(), null)).toEqual([]);
  });

  it('keeps the part ids of a measure, per clip, without their boxes', () => {
    const box = { left: 0, top: 0, width: 1, height: 1 };

    expect(partIds({ p: box, 'p#lines:0': box, 'p#footer1': box })).toEqual({ p: ['lines:0', 'footer1'] });
  });

  it('carries the parts of one frame through the query and back', () => {
    expect(parseParts(partsParam('m1', { p: ['lines:0'] }))).toEqual({ m1: { p: ['lines:0'] } });
  });
});
