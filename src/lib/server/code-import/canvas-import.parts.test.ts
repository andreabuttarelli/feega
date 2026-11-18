import { describe, expect, it } from 'vitest';
import { importedFrames } from './canvas-import';

describe('a page taller than one frame', () => {
  it('every frame it was split into carries the import, not only the first', () => {
    expect(importedFrames({ frameId: 'a', parts: ['b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(importedFrames({ frameId: 'a' })).toEqual(['a']);
  });
});
