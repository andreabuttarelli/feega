import { describe, expect, it } from 'vitest';
import { CANVAS_COLUMNS, layoutCanvas } from './canvas-layout';
import { openOf } from './canvas-open';
import { Size } from './sizes';

const { frames } = layoutCanvas([{ route: '/about', dynamic: false }, { route: '/blog/[slug]', dynamic: true }], CANVAS_COLUMNS);

describe('openOf', () => {
  it.each([
    [0, '/about', Size.Desktop],
    [1, '/about', Size.Tablet],
    [2, '/about', Size.Phone]
  ])('frame %i opens %s at %s', (i, route, size) => {
    expect(openOf(frames[i])).toEqual({ route, size });
  });

  it('opens nothing for a dynamic route', () => {
    expect(openOf(frames[3])).toBeNull();
  });
});
