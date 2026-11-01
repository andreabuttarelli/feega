import { describe, expect, it } from 'vitest';
import { canvasHeads, frameHead, heldOutlines } from './frame-outlines';
import { frameRows } from './layers';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';

describe('frame heads', () => {
  it('only a frame with a saved revision has a head', () => {
    expect(frameHead('motion', { docHeadRevision: 5 })).toBe(5);
    expect(frameHead('motion', { docHeadRevision: 0 })).toBeNull();
    expect(frameHead('text', { docHeadRevision: 5 })).toBeNull();
    expect(frameHead('element', { docHeadRevision: 2 })).toBe(2);
    expect(canvasHeads([{ id: 'm1', head: 5 }, { id: 'n1', head: null }, { id: 'n2' }])).toEqual([{ nodeId: 'm1', version: 5 }]);
  });
});

describe('the tree from what the canvas already holds', () => {
  const heads = [{ nodeId: 'm1', version: 3 }, { nodeId: 'm2', version: 1 }];
  const doc = newMotionDoc(MotionFormat.Landscape);

  it('builds the frames the canvas loaded and leaves the others without children', () => {
    const now = heldOutlines(heads, new Map([['m1', doc]]));

    expect(now.m1).toEqual(frameRows(doc, 'm1'));
    expect(now.m2).toBeUndefined();
  });

  it('builds a doc once, however often the tree asks', () => {
    const held = new Map([['m1', doc]]);

    expect(heldOutlines(heads, held).m1).toBe(heldOutlines(heads, held).m1);
  });

  it('rebuilds a frame when the canvas holds a newer doc for it', () => {
    const newer = { ...doc, tracks: [] };

    expect(heldOutlines(heads, new Map([['m1', newer]])).m1).toEqual(frameRows(newer, 'm1'));
  });
});
