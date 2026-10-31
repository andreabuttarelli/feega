import { describe, expect, it } from 'vitest';
import { docNodeIds } from './doc-nodes';

describe('the nodes that hold a doc', () => {
  it('a free element on the canvas counts like a frame, other nodes do not', () => {
    const nodes = [
      { id: 'frame', type: 'motion' },
      { id: 'free-text', type: 'element' },
      { id: 'image', type: 'image' }
    ];

    expect(docNodeIds(nodes)).toEqual(['frame', 'free-text']);
  });
});
