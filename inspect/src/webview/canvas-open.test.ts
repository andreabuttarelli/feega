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

  it('opens nothing for a dynamic route without examples', () => {
    expect(openOf(frames[3])).toBeNull();
  });

  it('opens the example a dynamic route shows', () => {
    const shown = layoutCanvas([{ route: '/blog/[slug]', dynamic: true, examples: [{ path: '/blog/hi', label: 'hi' }] }], CANVAS_COLUMNS).frames[1];

    expect(openOf(shown)).toEqual({ route: '/blog/hi', size: Size.Tablet });
  });
});
