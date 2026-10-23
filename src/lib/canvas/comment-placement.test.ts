import { describe, expect, it } from 'vitest';
import { commentPlacement } from './comment-placement';

describe('comment placement', () => {
  it('a click on empty canvas pins to the canvas at the click', () => {
    expect(commentPlacement({ x: 40, y: 50 }, null)).toEqual({ nodeId: null, x: 40, y: 50 });
  });

  it('a click on a node pins to that node, relative to its top-left corner', () => {
    expect(commentPlacement({ x: 140, y: 90 }, { id: 'n1', x: 100, y: 60 })).toEqual({ nodeId: 'n1', x: 40, y: 30 });
  });
});
