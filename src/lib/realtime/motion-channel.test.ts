import { describe, expect, it } from 'vitest';
import { headMoved } from './motion-channel';

describe('headMoved: the editor re-reads the head only when someone else moved it', () => {
  it('skips the echo of its own save and of its own poster', () => {
    expect(headMoved({ data: { docHeadRevision: 4 } }, 4)).toBe(false);
    expect(headMoved({ data: { docHeadRevision: 3 } }, 4)).toBe(false);
  });

  it('re-reads a newer head, and a row it cannot read', () => {
    expect(headMoved({ data: { docHeadRevision: 5 } }, 4)).toBe(true);
    expect(headMoved({}, 4)).toBe(true);
  });
});
