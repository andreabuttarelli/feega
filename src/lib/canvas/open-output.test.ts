import { describe, expect, it } from 'vitest';
import { outputTabUrl } from './open-output';

const place = { projectId: 'p1', canvasId: 'c1' };

describe('double-clicking a generated node opens its full file in a new tab', () => {
  it('opens the full-size asset of an image or video that has an output', () => {
    expect(outputTabUrl(place, { medium: 'image', refId: 'a1' })).toBe('/p/p1/c/c1/assets/a1');
    expect(outputTabUrl(place, { medium: 'video', refId: 'a2' })).toBe('/p/p1/c/c1/assets/a2');
  });

  it('leaves text nodes and nodes without output to their own double-click', () => {
    expect(outputTabUrl(place, { medium: 'text', refId: 'a3' })).toBeNull();
    expect(outputTabUrl(place, { medium: 'image', refId: null })).toBeNull();
  });
});
