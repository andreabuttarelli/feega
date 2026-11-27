import { describe, expect, it } from 'vitest';
import { Size } from './sizes';
import { CANVAS_COLUMNS, COLUMN_GAP, ROW_GAP, ROW_HEAD, layoutCanvas } from './canvas-layout';

const pages = [
  { route: '/', dynamic: false },
  { route: '/about', dynamic: false },
  { route: '/blog/[slug]', dynamic: true }
];

describe('the columns are the responsive sizes', () => {
  it('goes desktop, tablet, phone', () => {
    expect(CANVAS_COLUMNS).toEqual([Size.Desktop, Size.Tablet, Size.Phone]);
  });
});

describe('layoutCanvas', () => {
  const { frames, rows } = layoutCanvas(pages, CANVAS_COLUMNS);

  it('gives every page one frame per size', () => {
    expect(frames).toHaveLength(9);
    expect(frames.filter((f) => f.route === '/about').map((f) => f.size)).toEqual(CANVAS_COLUMNS);
  });

  it('sizes a frame like its device', () => {
    expect(frames[0]).toMatchObject({ width: 1440, height: 900 });
    expect(frames[1]).toMatchObject({ width: 768, height: 1024 });
    expect(frames[2]).toMatchObject({ width: 390, height: 844 });
  });

  it('places the sizes of a page side by side, tops aligned', () => {
    const row = frames.slice(0, 3);

    expect(row[1].x).toBe(row[0].x + row[0].width + COLUMN_GAP);
    expect(row[2].x).toBe(row[1].x + row[1].width + COLUMN_GAP);
    expect(new Set(row.map((f) => f.y)).size).toBe(1);
    expect(row[0].y).toBe(rows[0].y + ROW_HEAD);
  });

  it('stacks one row per page, in order, below the tallest frame', () => {
    expect(rows.map((r) => r.route)).toEqual(['/', '/about', '/blog/[slug]']);
    expect(rows[0].height).toBe(ROW_HEAD + 1024);
    expect(rows[1].y).toBe(rows[0].y + rows[0].height + ROW_GAP);
  });

  it('marks dynamic routes on the row and on every frame', () => {
    expect(rows[2].dynamic).toBe(true);
    expect(frames.filter((f) => f.dynamic).map((f) => f.route)).toEqual(['/blog/[slug]', '/blog/[slug]', '/blog/[slug]']);
  });

  it('keys each frame by route and size', () => {
    expect(frames[1].key).toBe('/::tablet');
  });
});

describe('a dynamic route with examples', () => {
  const withExample = layoutCanvas([{ route: '/blog/[slug]', dynamic: true, examples: [{ path: '/blog/primo-post', label: 'primo-post' }, { path: '/blog/b', label: 'b' }] }], CANVAS_COLUMNS);

  it('shows its first example on every frame and on the row', () => {
    expect(withExample.frames.map((f) => f.target)).toEqual(['/blog/primo-post', '/blog/primo-post', '/blog/primo-post']);
    expect(withExample.rows[0].example).toEqual({ path: '/blog/primo-post', label: 'primo-post' });
  });

  it('without examples keeps a placeholder', () => {
    const empty = layoutCanvas([{ route: '/blog/[slug]', dynamic: true, examples: [] }], CANVAS_COLUMNS);

    expect(empty.frames.map((f) => f.target)).toEqual([null, null, null]);
    expect(empty.rows[0].example).toBeNull();
  });

  it('a static page targets its own route', () => {
    expect(layoutCanvas(pages, CANVAS_COLUMNS).frames[3].target).toBe('/about');
  });
});

describe('bounds', () => {
  it('wrap every frame and row head', () => {
    const { frames, rows, bounds } = layoutCanvas(pages, CANVAS_COLUMNS);

    expect(bounds).toEqual({ x: 0, y: 0, width: frames[2].x + frames[2].width, height: rows[2].y + rows[2].height });
  });

  it('are empty without pages', () => {
    expect(layoutCanvas([], CANVAS_COLUMNS).bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
