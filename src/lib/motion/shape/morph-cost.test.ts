import { afterEach, expect, it, vi } from 'vitest';
import { ellipseOutline, starOutline } from './geometry';
import { MORPH_POINTS, morphBetween } from './morph';

const MAX_RING_COPIES = 4;

afterEach(() => vi.restoreAllMocks());

function ringCopies(work: () => void): number {
  const map = vi.spyOn(Array.prototype, 'map');
  work();
  const copies = map.mock.contexts.filter((ring) => Array.isArray(ring) && ring.length === MORPH_POINTS).length;
  map.mockRestore();
  return copies;
}

it('un frame di morph non copia un anello per ogni rotazione provata', () => {
  const star = starOutline(5, 0.5, 0);
  const circle = ellipseOutline();

  expect(ringCopies(() => morphBetween(star, circle, 0.5, 0))).toBeLessThanOrEqual(MAX_RING_COPIES);
});
