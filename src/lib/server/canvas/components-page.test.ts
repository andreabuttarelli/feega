import { describe, expect, it } from 'vitest';
import { belowAll } from './components-page';

describe('new mains land below what the Components page already holds', () => {
  it('starts at the origin on an empty page', () => {
    expect(belowAll([])).toEqual({ x: 0, y: 0 });
  });

  it('goes under the lowest node, aligned to the leftmost', () => {
    const nodes = [
      { position: { x: 100, y: 0, z: 0 }, size: { width: 200, height: 300 } },
      { position: { x: -50, y: 400, z: 0 }, size: { width: 200, height: 100 } }
    ];
    expect(belowAll(nodes)).toEqual({ x: -50, y: 740 });
  });
});
